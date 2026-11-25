import type {BlockDefinition, defineArrayMember} from 'sanity'

/**
 * Audience configuration.
 *
 * Readers are described by an ordered list of dimensions (e.g. region and
 * audience type). A reader has one value in every dimension (EMEA ×
 * Partners). A variant picks 1+ values in every dimension, and reaches every
 * reader whose value is picked in each of them.
 *
 * Each dimension is stored as a string array named after it (`regions[]`);
 * renaming a dimension, adding one, or changing value ids later means
 * migrating stored documents.
 */

export type AudienceDimensionValue = {
  id: string
  title: string
  /** Used in the compact one-line section label; defaults to `title`. */
  shortTitle?: string
}

export type AudienceDimension = {
  /** Field name the picked ids are stored under, e.g. `regions`. */
  name: string
  /** Group heading in the picker, e.g. "Regions". */
  title: string
  /** Label when every value is picked; defaults to "All <title>". */
  allTitle?: string
  /** Shown sorted alphabetically by title, whatever order they're given in. */
  values: AudienceDimensionValue[]
}

type ArrayMember = ReturnType<typeof defineArrayMember>

/**
 * What can go inside a variant or default section. Text blocks are always
 * allowed; `block` customises them (styles, lists, annotations) and `of` adds
 * other types (images, tables, embeds) the Studio schema declares. Pass the
 * same values to `defineAudienceVariantsField` so the top level allows them too.
 */
export type AudienceContentConfig = {
  block?: Omit<BlockDefinition, 'type' | 'name'>
  of?: ArrayMember[]
}

export type AudienceVariantsConfig = {
  dimensions: AudienceDimension[]
  content?: AudienceContentConfig
}

/** Who is reading: one value id per dimension, keyed by dimension name. */
export type Reader = Record<string, string>

/** Picked value ids per dimension, keyed by dimension name. */
export type Selection = Record<string, string[]>

/** The dimensions to match on: the config's, or just `[{name}]`. */
export type DimensionNames = readonly {name: string}[]

export type ResolvedAudienceConfig = {
  dimensions: AudienceDimension[]
  content: AudienceContentConfig
  /** `_type`s of the non-text members allowed in a section (from `content.of`). */
  sectionObjectTypes: ReadonlySet<string>
  /** Full title of a value; unknown ids show raw. */
  valueTitle: (dimension: string, id: string) => string
  /**
   * Compact label for a selection: short titles joined ("EMEA, APAC") for a
   * few picks, else "All regions", "All regions except Japan" or "12 regions".
   */
  summarize: (dimension: string, ids: string[]) => string
  /** "EMEA × Partners" */
  readerTitle: (reader: Reader) => string
  /** "regions and audiences", for hints. */
  dimensionList: string
}

const RESERVED = new Set(['content', 'variants'])
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]*$/

function validate({dimensions}: AudienceVariantsConfig) {
  const fail = (message: string): never => {
    throw new Error(`audience-variants: ${message}`)
  }
  if (!dimensions?.length) fail('`dimensions` needs at least one dimension')
  const names = new Set<string>()
  for (const {name, values} of dimensions) {
    if (!FIELD_NAME.test(name)) fail(`dimension name \`${name}\` isn't a valid field name`)
    if (RESERVED.has(name)) fail(`dimension name \`${name}\` is reserved`)
    if (names.has(name)) fail(`dimension \`${name}\` is declared twice`)
    names.add(name)
    if (!values?.length) fail(`dimension \`${name}\` needs at least one value`)
    const ids = new Set<string>()
    for (const {id} of values) {
      if (ids.has(id)) fail(`dimension \`${name}\` has value \`${id}\` twice`)
      ids.add(id)
    }
  }
}

/** Selections with more picks than this are counted ("12 regions") instead of listed. */
const MAX_NAMED_PICKS = 3

const byTitle = (a: AudienceDimensionValue, b: AudienceDimensionValue) =>
  a.title.localeCompare(b.title, undefined, {numeric: true, sensitivity: 'base'})

/** "a", "a and b", "a, b and c" */
function joinWords(words: string[]) {
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words.join('')
}

export function resolveAudienceConfig(config: AudienceVariantsConfig): ResolvedAudienceConfig {
  validate(config)
  // Alphabetical, so long lists are easy to scan in the picker and labels
  // don't depend on how the config happened to be written.
  const dimensions = config.dimensions.map((d) => ({...d, values: [...d.values].sort(byTitle)}))

  const lookups = new Map(
    dimensions.map((dimension) => {
      const {values} = dimension
      const byId = new Map(values.map((v) => [v.id, v]))
      // Unknown ids (removed from config) show raw so nothing is hidden.
      const title = (id: string) => byId.get(id)?.title ?? id
      const all = dimension.allTitle ?? `All ${dimension.title.toLowerCase()}`
      const short = (v: AudienceDimensionValue) => v.shortTitle ?? v.title
      const summarize = (ids: string[]) => {
        if (values.length > 1 && values.every((v) => ids.includes(v.id))) return all
        // Sorted order, so the label doesn't depend on click order.
        const known = values.filter((v) => ids.includes(v.id))
        const unknown = ids.filter((id) => !byId.has(id))
        const count = known.length + unknown.length
        if (count <= MAX_NAMED_PICKS) return [...known.map(short), ...unknown].join(', ')
        const missing = values.filter((v) => !ids.includes(v.id))
        if (missing.length === 1 && !unknown.length) return `${all} except ${short(missing[0])}`
        return `${count} ${dimension.title.toLowerCase()}`
      }
      return [dimension.name, {title, summarize}] as const
    }),
  )

  const content = config.content ?? {}

  return {
    dimensions,
    content,
    sectionObjectTypes: new Set((content.of ?? []).map((m) => m.name ?? m.type)),
    valueTitle: (name, id) => lookups.get(name)?.title(id) ?? id,
    summarize: (name, ids) => lookups.get(name)?.summarize(ids) ?? ids.join(', '),
    readerTitle: (reader) =>
      dimensions
        .map(({name}) => lookups.get(name)?.title(reader[name]) ?? reader[name])
        .join(' × '),
    dimensionList: joinWords(dimensions.map((d) => d.title.toLowerCase())),
  }
}
