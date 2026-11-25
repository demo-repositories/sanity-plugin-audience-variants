/**
 * A compact, key-free way to write Portable Text bodies, used both to seed
 * documents and to describe what the stored body should look like afterwards.
 *
 *   [
 *     'Intro',                                        // plain paragraph
 *     variation(
 *       variant({regions: ['emea']}, 'For EMEA'),
 *       dflt('Everyone else'),
 *     ),
 *     block({style: 'h2', text: 'Heading'}),
 *     block({spans: [{text: 'a '}, {text: 'link', marks: ['link:https://x.y']}]}),
 *     image('https://example.com/a.png'),
 *   ]
 *
 * `toPortableText` turns that into stored Portable Text with keys, and
 * `fromPortableText` turns stored Portable Text back into it (keys dropped,
 * adjacent spans with the same marks merged, annotations written as
 * `type:value`), so tests can `toEqual` the stored body against a spec.
 */

export type Span = {text: string; marks?: string[]}
export type BlockSpec =
  string | {text?: string; spans?: Span[]; style?: string; listItem?: string; level?: number}
export type ObjectSpec = {_type: string; [field: string]: unknown}
export type SectionSpec =
  {default: ContentSpec[]} | {variant: Record<string, string[]>; content: ContentSpec[]}
export type VariationSpec = {variation: SectionSpec[]}
export type ContentSpec = BlockSpec | ObjectSpec
export type BodySpec = ContentSpec | VariationSpec

/** Dimension names, in config order; every variant stores all of them. */
export const DIMENSIONS = ['regions', 'audiences'] as const

export const variation = (...sections: SectionSpec[]): VariationSpec => ({variation: sections})
export const dflt = (...content: ContentSpec[]): SectionSpec => ({default: content})
export const variant = (
  picks: Partial<Record<(typeof DIMENSIONS)[number], string[]>>,
  ...content: ContentSpec[]
): SectionSpec => ({
  variant: Object.fromEntries(DIMENSIONS.map((d) => [d, picks[d] ?? []])),
  content,
})
export const block = (spec: Exclude<BlockSpec, string>): BlockSpec => normalizeBlockSpec(spec)
export const image = (src: string, alt?: string): ObjectSpec =>
  alt === undefined ? {_type: 'externalImage', src} : {_type: 'externalImage', src, alt}

// ---------------------------------------------------------------------------
// spec -> Portable Text

type Keyed = {_key: string; _type: string; [k: string]: unknown}

let keyCounter = 0
const newKey = () => `k${(keyCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

const DECORATORS = new Set(['strong', 'em', 'code', 'underline', 'strike-through'])

function isVariationSpec(spec: BodySpec): spec is VariationSpec {
  return typeof spec === 'object' && 'variation' in spec
}
function isObjectSpec(spec: BodySpec): spec is ObjectSpec {
  return typeof spec === 'object' && '_type' in spec
}

function blockToPT(spec: BlockSpec): Keyed {
  const b = typeof spec === 'string' ? {text: spec} : spec
  const spans = b.spans ?? [{text: b.text ?? ''}]
  const markDefs: Keyed[] = []
  const children = spans.map((span) => ({
    _type: 'span',
    _key: newKey(),
    text: span.text,
    marks: (span.marks ?? []).map((mark) => {
      if (DECORATORS.has(mark)) return mark
      const [type, ...rest] = mark.split(':')
      const value = rest.join(':')
      const _key = newKey()
      markDefs.push(
        type === 'internalLink'
          ? {_type: type, _key, reference: {_type: 'reference', _ref: value, _weak: true}}
          : {_type: type, _key, href: value},
      )
      return _key
    }),
  }))
  return {
    _type: 'block',
    _key: newKey(),
    style: b.style ?? 'normal',
    ...(b.listItem && {listItem: b.listItem, level: b.level ?? 1}),
    markDefs,
    children,
  }
}

function contentToPT(spec: ContentSpec): Keyed {
  return isObjectSpec(spec) ? {...spec, _key: newKey()} : blockToPT(spec)
}

export function toPortableText(body: BodySpec[]): Keyed[] {
  return body.map((spec) => {
    if (!isVariationSpec(spec)) return contentToPT(spec)
    return {
      _type: 'audienceVariation',
      _key: newKey(),
      variants: spec.variation.map((section) =>
        'default' in section
          ? {_type: 'audienceDefault', _key: newKey(), content: section.default.map(contentToPT)}
          : {
              _type: 'audienceVariant',
              _key: newKey(),
              ...section.variant,
              content: section.content.map(contentToPT),
            },
      ),
    }
  })
}

// ---------------------------------------------------------------------------
// Portable Text -> spec

type PTSpan = {_type: string; text?: string; marks?: string[]}
type PTBlock = Keyed & {
  children?: PTSpan[]
  markDefs?: Keyed[]
  style?: string
  listItem?: string
  level?: number
}

/** Plain normal paragraphs collapse to a string; otherwise the minimal object. */
function normalizeBlockSpec(b: Exclude<BlockSpec, string>): BlockSpec {
  // Empty spans carry no content; merge neighbours with the same marks.
  const nonEmpty: Span[] = []
  for (const span of (b.spans ?? [{text: b.text ?? ''}]).filter((s) => s.text !== '')) {
    const marks = [...(span.marks ?? [])].sort()
    const prev = nonEmpty.at(-1)
    if (prev && sameMarks(prev.marks ?? [], marks)) prev.text += span.text
    else nonEmpty.push(marks.length ? {text: span.text, marks} : {text: span.text})
  }
  if (!nonEmpty.length) nonEmpty.push({text: ''})
  const style = b.style && b.style !== 'normal' ? b.style : undefined
  const plain = nonEmpty.length === 1 && !nonEmpty[0].marks
  if (plain && !style && !b.listItem) return nonEmpty[0].text
  return {
    ...(style && {style}),
    ...(b.listItem && {listItem: b.listItem, level: b.level ?? 1}),
    ...(plain ? {text: nonEmpty[0].text} : {spans: nonEmpty}),
  }
}

function sameMarks(a: string[], b: string[]) {
  return a.length === b.length && a.every((m, i) => m === b[i])
}

function blockFromPT(b: PTBlock): BlockSpec {
  const defs = new Map((b.markDefs ?? []).map((d) => [d._key, d]))
  const describe = (mark: string) => {
    const def = defs.get(mark)
    if (!def) return mark
    const value =
      (def.href as string | undefined) ?? (def.reference as {_ref?: string} | undefined)?._ref ?? ''
    return `${def._type}:${value}`
  }
  return normalizeBlockSpec({
    style: b.style,
    listItem: b.listItem,
    level: b.level,
    spans: (b.children ?? [])
      .filter((c) => c._type === 'span')
      .map((c) => ({text: c.text ?? '', marks: (c.marks ?? []).map(describe)})),
  })
}

function contentFromPT(node: PTBlock): ContentSpec | VariationSpec {
  if (node._type === 'block') return blockFromPT(node)
  if (node._type === 'audienceVariation') return variationFromPT(node)
  return stripKeys(node) as ObjectSpec
}

function variationFromPT(node: Keyed): VariationSpec {
  const members = (node.variants as PTBlock[] | undefined) ?? []
  return {
    variation: members.map((section): SectionSpec => {
      const content = ((section.content as PTBlock[] | undefined) ?? []).map(
        contentFromPT,
      ) as ContentSpec[]
      if (section._type === 'audienceDefault') return {default: content}
      if (section._type === 'audienceVariant') {
        return {
          variant: Object.fromEntries(
            DIMENSIONS.map((d) => [d, (section[d] as string[] | undefined) ?? []]),
          ),
          content,
        }
      }
      // A stray member (not a section): keep it visible so a toEqual fails loudly.
      return {stray: contentFromPT(section)} as unknown as SectionSpec
    }),
  }
}

export function fromPortableText(body: unknown[] | undefined): BodySpec[] {
  return ((body ?? []) as PTBlock[]).map(contentFromPT)
}

function stripKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripKeys)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== '_key')
        .map(([k, v]) => [k, stripKeys(v)]),
    )
  }
  return value
}

// ---------------------------------------------------------------------------
// Invariants every stored body must satisfy, whatever the test did.

export function bodyProblems(body: unknown[] | undefined): string[] {
  const problems: string[] = []

  const checkKeys = (items: Keyed[], where: string) => {
    const seen = new Set<string>()
    for (const item of items) {
      if (!item._key) problems.push(`${where}: member without _key (${item._type})`)
      else if (seen.has(item._key)) problems.push(`${where}: duplicate _key ${item._key}`)
      seen.add(item._key)
    }
  }

  const checkContent = (items: PTBlock[], where: string, nested: boolean) => {
    checkKeys(items, where)
    for (const node of items) {
      const at = `${where}[${node._key}]`
      if (node._type === 'audienceVariation') {
        if (nested) problems.push(`${at}: variation nested inside a section`)
        checkVariation(node, at)
      } else if (node._type === 'block') {
        checkKeys((node.children ?? []) as Keyed[], `${at}.children`)
        checkKeys(node.markDefs ?? [], `${at}.markDefs`)
        const defs = new Set((node.markDefs ?? []).map((d) => d._key))
        for (const span of node.children ?? []) {
          for (const mark of span.marks ?? []) {
            if (!DECORATORS.has(mark) && !defs.has(mark)) {
              problems.push(`${at}: span mark ${mark} has no markDef`)
            }
          }
        }
      }
    }
  }

  const checkVariation = (node: Keyed, at: string) => {
    const members = (node.variants as PTBlock[] | undefined) ?? []
    checkKeys(members, `${at}.variants`)
    if (!members.length) problems.push(`${at}: variation without sections`)
    let defaults = 0
    for (const member of members) {
      if (member._type === 'audienceDefault') defaults++
      else if (member._type !== 'audienceVariant') {
        problems.push(`${at}.variants: stray ${member._type} outside any section`)
        continue
      }
      checkContent(
        (member.content as PTBlock[] | undefined) ?? [],
        `${at}.variants[${member._key}].content`,
        true,
      )
    }
    if (defaults > 1) problems.push(`${at}: ${defaults} default sections`)
  }

  checkContent((body ?? []) as PTBlock[], 'body', false)
  return problems
}
