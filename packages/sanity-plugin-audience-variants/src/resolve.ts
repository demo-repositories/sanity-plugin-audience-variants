import type {PortableTextBlock} from '@portabletext/editor'
import type {DimensionNames, Reader, ResolvedAudienceConfig, Selection} from './config'
import {DEFAULT_LABEL, DEFAULT_TYPE, VARIANT_TYPE} from './constants'

/**
 * A variant stores its picks as one string array per dimension, named after
 * the dimension (`regions: ['emea']`), alongside `content`.
 */
export type VariantSection = {
  _type: typeof VARIANT_TYPE
  _key: string
  content?: PortableTextBlock[]
  [dimension: string]: unknown
}
export type DefaultSection = {
  _type: typeof DEFAULT_TYPE
  _key: string
  content?: PortableTextBlock[]
}
export type Section = VariantSection | DefaultSection

export type VariationValue = {_type: string; _key: string; variants?: Section[]}

/** Dimensions with their value ids, for enumerating every reader. */
type DimensionValues = readonly {name: string; values: readonly {id: string}[]}[]

export function isDefaultSection(section: {_type: string}): section is DefaultSection {
  return section._type === DEFAULT_TYPE
}

export function getDefaultSection(value: VariationValue): DefaultSection | undefined {
  return value.variants?.find(isDefaultSection)
}

/** The ids picked in one dimension of a variant or document audience. */
export function picksOf(target: object | undefined, dimension: string): string[] {
  const picks = (target as Record<string, unknown> | undefined)?.[dimension]
  return Array.isArray(picks) ? picks.filter((id): id is string => typeof id === 'string') : []
}

/** Every dimension's picks, keyed by dimension name. */
export function selectionOf(target: object | undefined, dimensions: DimensionNames): Selection {
  return Object.fromEntries(dimensions.map(({name}) => [name, picksOf(target, name)]))
}

/** Every reader with one of `choose(dimension)` in each dimension. */
function product(dimensions: DimensionNames, choose: (dimension: string) => string[]): Reader[] {
  return dimensions.reduce<Reader[]>(
    (readers, {name}) =>
      readers.flatMap((reader) => choose(name).map((id) => ({...reader, [name]: id}))),
    [{}],
  )
}

/** Whether a variant reaches this reader: their value is picked in every dimension. */
export function variantMatches(
  section: VariantSection,
  reader: Reader,
  dimensions: DimensionNames,
): boolean {
  return dimensions.every(({name}) => picksOf(section, name).includes(reader[name]))
}

/**
 * The section a reader sees: the variant that targets them, else the
 * default, else nothing (`undefined`). Mirrors the frontend rule.
 */
export function resolveVariation(
  value: VariationValue,
  reader: Reader,
  dimensions: DimensionNames,
): Section | undefined {
  return (
    variantSections(value).find((s) => variantMatches(s, reader, dimensions)) ??
    getDefaultSection(value)
  )
}

/** Every reader a variant reaches (the product of its picks). */
export function readersOf(section: VariantSection, dimensions: DimensionNames): Reader[] {
  return product(dimensions, (name) => [...new Set(picksOf(section, name))])
}

/** Every possible reader. */
export function allReaders(dimensions: DimensionValues): Reader[] {
  const values = new Map(dimensions.map((d) => [d.name, d.values.map((v) => v.id)]))
  return product(dimensions, (name) => values.get(name) ?? [])
}

export const readerKey = (reader: Reader, dimensions: DimensionNames) =>
  dimensions.map(({name}) => reader[name]).join('|')

/**
 * Readers reached by more than one variant of this variation, keyed by
 * section: each reader must resolve to at most one variant. Two variants
 * share readers only where their picks intersect in every dimension.
 */
export function overlappingReaders(
  value: VariationValue,
  dimensions: DimensionNames,
): Map<string, Reader[]> {
  const clashes = new Map<string, Map<string, Reader>>()
  const add = (key: string, readers: Reader[]) => {
    const found = clashes.get(key) ?? new Map<string, Reader>()
    for (const r of readers) found.set(readerKey(r, dimensions), r)
    clashes.set(key, found)
  }
  const variants = variantSections(value)
  variants.forEach((a, i) => {
    for (const b of variants.slice(i + 1)) {
      const shared = product(dimensions, (name) =>
        [...new Set(picksOf(a, name))].filter((id) => picksOf(b, name).includes(id)),
      )
      if (!shared.length) continue
      add(a._key, shared)
      add(b._key, shared)
    }
  })
  return new Map([...clashes].map(([key, readers]) => [key, [...readers.values()]]))
}

export function variantSections(value: VariationValue): VariantSection[] {
  return (value.variants ?? []).filter((s): s is VariantSection => !isDefaultSection(s))
}

/**
 * Preview-as filter: picks in some dimensions. An empty or missing dimension
 * means "any", so the filter stands for every reader whose value is picked
 * in each dimension that has picks.
 */
export type PreviewFilter = Selection

/** Whether the filter pins down a single reader. */
export function isExactFilter(filter: PreviewFilter, dimensions: DimensionNames): boolean {
  return dimensions.every(({name}) => filter[name]?.length === 1)
}

/**
 * Keys of the sections that some reader matching the filter sees. With one
 * value in every dimension that's at most one section; otherwise it can be
 * several (e.g. each variant that includes the region, plus the default if
 * some reader in that region falls through to it).
 */
export function previewSectionKeys(
  value: VariationValue,
  filter: PreviewFilter,
  dimensions: DimensionValues,
): Set<string> {
  const keys = new Set<string>()
  const values = new Map(dimensions.map((d) => [d.name, d.values.map((v) => v.id)]))
  const readers = product(dimensions, (name) =>
    filter[name]?.length ? filter[name] : (values.get(name) ?? []),
  )
  for (const reader of readers) {
    const section = resolveVariation(value, reader, dimensions)
    if (section) keys.add(section._key)
  }
  return keys
}

/**
 * A document-level audience (`audienceTargeting`): picks per dimension. An
 * empty dimension means "any", so nothing picked is the Default Audience:
 * every reader.
 */
export type AudienceValue = {_type?: string; [dimension: string]: unknown}

/** Whether a reader is in a document's audience. Mirrors the frontend rule. */
export function audienceMatches(
  value: AudienceValue | undefined,
  reader: Reader,
  dimensions: DimensionNames,
): boolean {
  return dimensions.every(({name}) => {
    const picks = picksOf(value, name)
    return !picks.length || picks.includes(reader[name])
  })
}

/** Every picked value's full title, for a tooltip: "Japan, Korea · Customers". */
export function audienceTitles(
  {dimensions, valueTitle}: Pick<ResolvedAudienceConfig, 'dimensions' | 'valueTitle'>,
  value: object | undefined,
): string {
  return dimensions
    .map(({name, values}) => {
      const ids = picksOf(value, name)
      // Sorted like the picker; ids no longer in the config go last, raw.
      const known = values.filter((v) => ids.includes(v.id))
      const unknown = ids.filter((id) => !values.some((v) => v.id === id))
      return [...known.map((v) => v.title), ...unknown.map((id) => valueTitle(name, id))].join(', ')
    })
    .filter(Boolean)
    .join(' · ')
}

/** "EMEA, APAC · Partners", or "Default Audience" when nothing is picked. */
export function audienceLabel(
  {dimensions, summarize}: Pick<ResolvedAudienceConfig, 'dimensions' | 'summarize'>,
  value: object | undefined,
): string {
  // An empty dimension means "any", so only show the dimensions actually chosen.
  const parts = dimensions.flatMap(({name}) => {
    const ids = picksOf(value, name)
    return ids.length ? [summarize(name, ids)] : []
  })
  return parts.length ? parts.join(' · ') : DEFAULT_LABEL
}
