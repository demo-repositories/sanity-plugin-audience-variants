import type {PortableTextBlock} from '@portabletext/editor'
import {DEFAULT_TYPE, VARIANT_TYPE} from './constants'

export type VariantSection = {
  _type: typeof VARIANT_TYPE
  _key: string
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

/**
 * The section a reader in `audience` sees: the variant that targets them,
 * else the default, else nothing (`undefined`). Mirrors the frontend rule.
 */
export function resolveVariation(value: VariationValue, audience: string): Section | undefined {
  const sections = value.variants ?? []
  return (
    sections.find((s) => !isDefaultSection(s) && s.audiences?.includes(audience)) ??
    getDefaultSection(value)
  )
}

/** Audience ids that appear in more than one variant of this variation. */
export function overlappingAudiences(value: VariationValue): Set<string> {
  const seen = new Set<string>()
  const overlaps = new Set<string>()
  for (const section of value.variants ?? []) {
    if (isDefaultSection(section)) continue
    for (const id of new Set(section.audiences ?? [])) {
      if (seen.has(id)) overlaps.add(id)
      seen.add(id)
    }
  }
  return overlaps
}

/** Variant sections, i.e. everything but the default. */
export function variantSections(value: VariationValue) {
  return (value.variants ?? []).filter((s) => !isDefaultSection(s))
}
