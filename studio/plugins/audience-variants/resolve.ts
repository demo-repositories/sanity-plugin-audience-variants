import type {PortableTextBlock} from '@portabletext/editor'
import type {Reader, ResolvedAudienceConfig} from './config'
import {DEFAULT_LABEL, DEFAULT_TYPE, VARIANT_TYPE} from './constants'

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

export function variantSections(value: VariationValue): VariantSection[] {
  return (value.variants ?? []).filter((s): s is VariantSection => !isDefaultSection(s))
}

/**
 * Preview-as filter: some regions, some audiences, or both. An empty
 * dimension means "any", so the filter stands for every reader in any of the
 * picked regions and any of the picked audiences.
 */
export type PreviewFilter = {regions?: string[]; audiences?: string[]}

/** Whether the filter pins down a single reader. */
export function isExactFilter(filter: PreviewFilter): boolean {
  return filter.regions?.length === 1 && filter.audiences?.length === 1
}

/**
 * Keys of the sections that some reader matching the filter sees. With one
 * region and one audience that's at most one section; otherwise it can be
 * several (e.g. each variant that includes the region, plus the default if
 * some reader in that region falls through to it).
 */
export function previewSectionKeys(
  value: VariationValue,
  filter: PreviewFilter,
  allRegions: string[],
  allAudiences: string[],
): Set<string> {
  const regions = filter.regions?.length ? filter.regions : allRegions
  const audiences = filter.audiences?.length ? filter.audiences : allAudiences
  const keys = new Set<string>()
  for (const region of regions) {
    for (const audience of audiences) {
      const section = resolveVariation(value, {region, audience})
      if (section) keys.add(section._key)
    }
  }
  return keys
}

/**
 * A document-level audience (`audienceTargeting`). An empty dimension means
 * "any", so nothing picked is the Default Audience: every reader.
 */
export type AudienceValue = {_type?: string; regions?: string[]; audiences?: string[]}

/** Whether a reader is in a document's audience. Mirrors the frontend rule. */
export function audienceMatches(value: AudienceValue | undefined, reader: Reader): boolean {
  const {regions = [], audiences = []} = value ?? {}
  return (
    (!regions.length || regions.includes(reader.region)) &&
    (!audiences.length || audiences.includes(reader.audience))
  )
}

/** "EMEA, APEC · Hotel Owners", or "Default Audience" when nothing is picked. */
export function audienceLabel(
  {
    summarizeRegions,
    summarizeAudiences,
  }: Pick<ResolvedAudienceConfig, 'summarizeRegions' | 'summarizeAudiences'>,
  value: AudienceValue | undefined,
): string {
  const {regions = [], audiences = []} = value ?? {}
  if (!regions.length && !audiences.length) return DEFAULT_LABEL
  return [
    regions.length ? summarizeRegions(regions) : null,
    audiences.length ? summarizeAudiences(audiences) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
