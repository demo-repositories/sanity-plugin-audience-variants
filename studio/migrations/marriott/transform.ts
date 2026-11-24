/**
 * Transform Marriott `program` / `generalContent` documents into `article`
 * documents with audience variations.
 *
 *   npx sanity exec migrations/marriott/transform.ts -- <input.json|.ndjson> <output.ndjson> [--weak-refs]
 *
 * `--weak-refs` marks every reference weak, for importing into a dataset
 * that doesn't have the referenced documents (files, organizations…).
 *
 * Then import the output:
 *
 *   npx sanity dataset import <output.ndjson> <dataset> --replace
 *
 * Source model: a `body` everyone in the document's audience sees, plus
 * `audienceSpecificSections[]`, each with its own body and targeting
 * (`regions[]` and `employeeAudienceTypes[]` references; empty = any).
 *
 * Target model: one `body`. Runs of consecutive sections on the same topic
 * whose audiences don't overlap become one `audienceVariation`, with one
 * variant per section. Sections with identical content that differ in only
 * one dimension merge into one variant.
 *
 * Assumptions, to confirm with Marriott:
 * - Sections render after `body`, in array order.
 * - The topic part of a section heading ("Criteria" in "Criteria — NALO
 *   Franchisee") is shown to readers; it becomes an h3 inside each variant.
 * - `region-global` means every region.
 *
 * Every reader (region × audience) is checked to see the same content
 * before and after; the script exits non-zero if not.
 */
import {readFileSync, writeFileSync} from 'node:fs'
import {audiences as configAudiences, regions as configRegions} from '../../audienceConfig'
import {
  overlappingReaders,
  readersOf,
  resolveVariation,
  type Section,
  type VariantSection,
  type VariationValue,
  AUDIENCE_TYPE,
  VARIANT_TYPE,
  VARIATION_TYPE,
} from 'sanity-plugin-audience-variants/resolve'

const args = process.argv.slice(2).filter((a) => a !== '--')
const WEAK_REFS = args.includes('--weak-refs')

/** Show each section's topic as an h3 at the top of its content. */
const INCLUDE_TOPIC_HEADINGS = true

const ALL = '*'

/** Marriott region document id → plugin region id. */
const REGION_MAP: Record<string, string> = {
  'region-global': ALL,
  'region-uscanada': 'uscan',
  'region-ap': 'apec',
  'region-cala': 'cala',
  'region-europe': 'emea',
  'region-greater-china': 'gc',
}

/**
 * Marriott employeeAudienceType document id → plugin audience id. On- and
 * above-property associates both map to managed associates; a section that
 * targets only one of them is reported, since it would widen to both.
 */
const AUDIENCE_MAP: Record<string, string> = {
  'employeeAudienceType-associate-on-property': 'managedAssociates',
  'employeeAudienceType-associate-above-property': 'managedAssociates',
  'employeeAudienceType-franchisee': 'franchisees',
}

const allRegionIds = configRegions.map((r) => r.id)
const allAudienceIds = configAudiences.map((a) => a.id)

type Ref = {_ref: string}
type Block = {_type: string; _key: string; [k: string]: unknown}
type SourceSection = {
  _key: string
  heading?: string
  regions?: Ref[]
  employeeAudienceTypes?: Ref[]
  body?: Block[]
}
type SourceDoc = {
  _id: string
  _type: string
  title?: string
  body?: Block[]
  regions?: Ref[]
  employeeAudienceTypes?: Ref[]
  audienceSpecificSections?: SourceSection[]
}
type Reader = {region: string; audience: string}

const warnings: string[] = []

// ---------------------------------------------------------------------------
// Targeting

function mapIds(refs: Ref[] | undefined, map: Record<string, string>, all: string[], what: string) {
  if (!refs?.length) return all
  const ids = new Set<string>()
  for (const {_ref} of refs) {
    const id = map[_ref]
    if (!id) throw new Error(`Unknown ${what} "${_ref}": add it to the map in transform.ts`)
    if (id === ALL) return all
    ids.add(id)
  }
  return all.filter((id) => ids.has(id)) // config order
}

function checkAssociatePair(refs: Ref[] | undefined, where: string) {
  const ids = new Set((refs ?? []).map((r) => r._ref))
  const on = ids.has('employeeAudienceType-associate-on-property')
  const above = ids.has('employeeAudienceType-associate-above-property')
  if (on !== above) {
    warnings.push(
      `${where}: targets only ${on ? 'on' : 'above'}-property associates; widened to all managed associates`,
    )
  }
}

/** Plugin targeting for a section; empty source lists mean "any". */
function targetingOf(section: SourceSection) {
  checkAssociatePair(section.employeeAudienceTypes, `Section "${section.heading}"`)
  return {
    regions: mapIds(section.regions, REGION_MAP, allRegionIds, 'region'),
    audiences: mapIds(section.employeeAudienceTypes, AUDIENCE_MAP, allAudienceIds, 'audience type'),
  }
}

/** Empty when every value is picked: the plugin's "any". */
const orAny = (ids: string[], all: string[]) => (all.every((id) => ids.includes(id)) ? [] : ids)

// ---------------------------------------------------------------------------
// Content

/** "Criteria — NALO Franchisee, INTL Franchisee" → "Criteria"; audience-only headings → null. */
const AUDIENCE_LABELS = /^((NALO|INTL) (Associate|Franchisee)(, )?)+$/
function topicOf(heading = ''): string | null {
  const topic = heading.split(' — ')[0].trim()
  return !topic || AUDIENCE_LABELS.test(topic) ? null : topic
}

function headingBlock(key: string, text: string): Block {
  return {
    _type: 'block',
    _key: key,
    style: 'h3',
    markDefs: [],
    children: [{_type: 'span', _key: `${key}-s`, text, marks: []}],
  }
}

/**
 * Drop `_strengthenOnPublish` from references: it makes publishing wait for
 * the target to exist, which documents migrated out of order may not yet.
 * With `--weak-refs`, every reference is made weak.
 */
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T
  if (value && typeof value === 'object') {
    const out = Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== '_strengthenOnPublish')
        .map(([k, v]) => [k, clean(v)]),
    )
    return (WEAK_REFS && '_ref' in out ? {...out, _weak: true} : out) as T
  }
  return value
}

function sectionContent(section: SourceSection): Block[] {
  const topic = topicOf(section.heading)
  const body = clean(section.body ?? [])
  return INCLUDE_TOPIC_HEADINGS && topic
    ? [headingBlock(`h-${section._key}`, topic), ...body]
    : body
}

/**
 * Content without keys, for comparing. Span marks that point at an
 * annotation are replaced by the annotation itself, since copies of the same
 * text carry the same links under different keys.
 */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize)
  if (!value || typeof value !== 'object') return value
  const {_key, markDefs, children, ...rest} = value as Record<string, unknown>
  const out = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, normalize(v)]))
  if (!Array.isArray(markDefs) || !Array.isArray(children)) {
    return children === undefined ? out : {...out, children: normalize(children)}
  }
  const defs = new Map(markDefs.map((d: {_key: string}) => [d._key, normalize(d)]))
  return {
    ...out,
    children: children.map((child: {marks?: string[]}) => ({
      ...(normalize(child) as object),
      marks: (child.marks ?? []).map((m) => defs.get(m) ?? m),
    })),
  }
}

const fingerprint = (blocks: unknown) => JSON.stringify(normalize(blocks))

// ---------------------------------------------------------------------------
// Grouping

const overlaps = (a: VariantSection, b: VariantSection) => {
  const keys = new Set(readersOf(a).map((r) => `${r.region}|${r.audience}`))
  return readersOf(b).some((r) => keys.has(`${r.region}|${r.audience}`))
}

const sameSet = (a: string[] = [], b: string[] = []) =>
  a.length === b.length && a.every((x) => b.includes(x))

/**
 * Merge variants with the same content that differ in one dimension:
 * R1 × A and R2 × A reach exactly the readers (R1 ∪ R2) × A.
 */
function mergeIdentical(variants: VariantSection[]): VariantSection[] {
  const out: VariantSection[] = []
  for (const v of variants) {
    const twin = out.find(
      (o) =>
        fingerprint(o.content) === fingerprint(v.content) &&
        (sameSet(o.regions, v.regions) || sameSet(o.audiences, v.audiences)),
    )
    if (!twin) {
      out.push(v)
      continue
    }
    twin.regions = allRegionIds.filter(
      (id) => twin.regions?.includes(id) || v.regions?.includes(id),
    )
    twin.audiences = allAudienceIds.filter(
      (id) => twin.audiences?.includes(id) || v.audiences?.includes(id),
    )
  }
  return out
}

/**
 * Sections → body items. Consecutive sections on the same topic with
 * non-overlapping audiences share a variation. Within such a run each
 * reader sees at most one section, in the same place as before, so
 * grouping never changes what anyone sees. A section that reaches every
 * reader becomes plain top-level blocks.
 */
function sectionsToBody(sections: SourceSection[]): Block[] {
  type Item = {block: Block} | {topic: string | null; variants: VariantSection[]}
  const out: Item[] = []

  for (const section of sections) {
    const {regions, audiences} = targetingOf(section)
    const content = sectionContent(section) as VariantSection['content']
    if (sameSet(regions, allRegionIds) && sameSet(audiences, allAudienceIds)) {
      out.push(...(content as unknown as Block[]).map((block) => ({block})))
      continue
    }
    const variant: VariantSection = {
      _type: VARIANT_TYPE,
      _key: section._key,
      regions,
      audiences,
      content,
    }
    const topic = topicOf(section.heading)
    const last = out.at(-1)
    if (
      last &&
      'variants' in last &&
      last.topic === topic &&
      !last.variants.some((v) => overlaps(v, variant))
    ) {
      last.variants.push(variant)
    } else {
      out.push({topic, variants: [variant]})
    }
  }

  return out.map((item): Block =>
    'block' in item
      ? item.block
      : {
          _type: VARIATION_TYPE,
          _key: `v-${item.variants[0]._key}`,
          variants: mergeIdentical(item.variants),
        },
  )
}

export function transform(doc: SourceDoc) {
  const id = doc._id.replace(/^drafts\./, '')
  checkAssociatePair(doc.employeeAudienceTypes, `Document "${doc.title}"`)
  return {
    _id: `article-${id}`,
    _type: 'article',
    title: doc.title,
    audience: {
      _type: AUDIENCE_TYPE,
      regions: orAny(mapIds(doc.regions, REGION_MAP, allRegionIds, 'region'), allRegionIds),
      audiences: orAny(
        mapIds(doc.employeeAudienceTypes, AUDIENCE_MAP, allAudienceIds, 'audience type'),
        allAudienceIds,
      ),
    },
    body: [...clean(doc.body ?? []), ...sectionsToBody(doc.audienceSpecificSections ?? [])],
  }
}

// ---------------------------------------------------------------------------
// Verification

/** What a reader sees in the source: body, then each section that reaches them. */
function sourceView(doc: SourceDoc, reader: Reader): Block[] {
  const visible = (doc.audienceSpecificSections ?? []).filter((s) => {
    const {regions, audiences} = targetingOf(s)
    return regions.includes(reader.region) && audiences.includes(reader.audience)
  })
  return [...clean(doc.body ?? []), ...visible.flatMap(sectionContent)]
}

/** What a reader sees in the target: variations resolved the way the frontend does. */
function targetView(body: Block[], reader: Reader): Block[] {
  return body.flatMap((b) =>
    b._type === VARIATION_TYPE
      ? ((resolveVariation(b as unknown as VariationValue, reader)?.content ?? []) as Block[])
      : [b],
  )
}

function verify(doc: SourceDoc, target: ReturnType<typeof transform>): string[] {
  const errors: string[] = []
  for (const region of allRegionIds) {
    for (const audience of allAudienceIds) {
      const reader = {region, audience}
      if (fingerprint(sourceView(doc, reader)) !== fingerprint(targetView(target.body, reader))) {
        errors.push(`${target._id}: ${region} × ${audience} sees different content`)
      }
    }
  }
  for (const b of target.body) {
    if (b._type !== VARIATION_TYPE) continue
    const variation = b as unknown as VariationValue
    if (overlappingReaders(variation).size) errors.push(`${target._id}: ${b._key} has overlaps`)
    for (const s of variation.variants ?? ([] as Section[])) {
      if (s._type === VARIANT_TYPE && (!s.regions?.length || !s.audiences?.length)) {
        errors.push(`${target._id}: ${s._key} is missing regions or audiences`)
      }
    }
  }
  return errors
}

// ---------------------------------------------------------------------------

function readDocs(path: string): SourceDoc[] {
  const text = readFileSync(path, 'utf8').trim()
  if (path.endsWith('.ndjson')) return text.split('\n').map((line: string) => JSON.parse(line))
  const parsed = JSON.parse(text)
  return Array.isArray(parsed) ? parsed : [parsed]
}

function summarize(target: ReturnType<typeof transform>) {
  const variations = target.body.filter((b) => b._type === VARIATION_TYPE)
  const lines = [`${target._id}  "${target.title}"`]
  lines.push(
    `  audience: regions [${target.audience.regions}] audiences [${target.audience.audiences}]`,
  )
  lines.push(
    `  body: ${target.body.length} items, ${variations.length} variations, ${
      target.body.length - variations.length
    } top-level blocks`,
  )
  for (const v of variations as unknown as VariationValue[]) {
    for (const s of v.variants ?? []) {
      const vs = s as VariantSection
      lines.push(
        `    ${v._key} / ${vs._key}: [${vs.regions}] × [${vs.audiences}]  ${vs.content?.length ?? 0} blocks`,
      )
    }
  }
  return lines.join('\n')
}

const [input, output] = args.filter((a) => !a.startsWith('--'))
if (!input || !output) {
  console.error(
    'Usage: npx sanity exec migrations/marriott/transform.ts -- <input> <output.ndjson>',
  )
  process.exit(1)
}

const sources = readDocs(input)
const targets = sources.map(transform)
const errors = sources.flatMap((doc, i) => verify(doc, targets[i]))

for (const t of targets) console.log(summarize(t))
for (const w of new Set(warnings)) console.warn(`warning: ${w}`)
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`)
  process.exit(1)
}
writeFileSync(output, targets.map((t) => JSON.stringify(t)).join('\n') + '\n')
console.log(
  `\nWrote ${targets.length} document(s) to ${output}; every reader sees the same content as before.`,
)
