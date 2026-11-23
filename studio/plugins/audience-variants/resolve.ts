import type {PortableTextBlock} from '@portabletext/editor'
import type {Reader} from './config'
import {DEFAULT_TYPE, VARIANT_TYPE} from './constants'

export type VariantSection = {
  _type: typeof VARIANT_TYPE
  _key: string
  regions?: string[]
  audiences?: string[]
  content?: PortableTextBlock[]
}
export type DefaultSection = {
  _type: typeof DEFAULT_TYPE
  _key: string
  content?: PortableTextBlock[]
}
export type Section = VariantSection | DefaultSection

export type VariationValue = {_type: string; _key: string; variants?: Section[]}

export function isDefaultSection(section: {_type: string}): section is DefaultSection {
  return section._type === DEFAULT_TYPE
}

export function getDefaultSection(value: VariationValue): DefaultSection | undefined {
  return value.variants?.find(isDefaultSection)
}

/** Whether a variant reaches this reader: their region and their audience are both picked. */
export function variantMatches(section: VariantSection, reader: Reader): boolean {
  return Boolean(
    section.regions?.includes(reader.region) && section.audiences?.includes(reader.audience),
  )
}

/**
 * The section a reader sees: the variant that targets them, else the
 * default, else nothing (`undefined`). Mirrors the frontend rule.
 */
export function resolveVariation(value: VariationValue, reader: Reader): Section | undefined {
  return variantSections(value).find((s) => variantMatches(s, reader)) ?? getDefaultSection(value)
}

/** Every reader a variant reaches (regions × audiences). */
export function readersOf(section: VariantSection): Reader[] {
  return (section.regions ?? []).flatMap((region) =>
    (section.audiences ?? []).map((audience) => ({region, audience})),
  )
}

export const readerKey = ({region, audience}: Reader) => `${region}|${audience}`

/**
 * Readers reached by more than one variant of this variation, keyed by
 * section: each reader must resolve to at most one variant.
 */
export function overlappingReaders(value: VariationValue): Map<string, Reader[]> {
  const owners = new Map<string, string[]>()
  const variants = variantSections(value)
  for (const section of variants) {
    for (const key of new Set(readersOf(section).map(readerKey))) {
      owners.set(key, [...(owners.get(key) ?? []), section._key])
    }
  }
  const result = new Map<string, Reader[]>()
  for (const section of variants) {
    const clashes = readersOf(section).filter((r) => (owners.get(readerKey(r))?.length ?? 0) > 1)
    if (clashes.length) result.set(section._key, clashes)
  }
  return result
}

/** Variant sections, i.e. everything but the default. */
export function variantSections(value: VariationValue): VariantSection[] {
  return (value.variants ?? []).filter((s): s is VariantSection => !isDefaultSection(s))
}
