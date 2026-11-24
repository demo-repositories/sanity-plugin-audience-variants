import type {BlockDefinition, defineArrayMember} from 'sanity'

/**
 * Audience configuration.
 *
 * A reader is one region plus one employee audience type (e.g. EMEA ×
 * Hotel Owners). A variant targets 1+ regions and 1+ audiences, and reaches
 * every reader in any of its regions *and* any of its audiences.
 *
 * Variants store the ids as `regions[]` and `audiences[]`; changing ids
 * later means migrating stored documents.
 */

export type AudienceDimensionValue = {
  id: string
  title: string
  /** Used in the compact one-line section label; defaults to `title`. */
  shortTitle?: string
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
  regions: AudienceDimensionValue[]
  audiences: AudienceDimensionValue[]
  content?: AudienceContentConfig
}

/** Who is reading: one region and one audience type. */
export type Reader = {region: string; audience: string}

export type ResolvedAudienceConfig = {
  regions: AudienceDimensionValue[]
  audiences: AudienceDimensionValue[]
  content: AudienceContentConfig
  /** `_type`s of the non-text members allowed in a section (from `content.of`). */
  sectionObjectTypes: ReadonlySet<string>
  regionTitle: (id: string) => string
  audienceTitle: (id: string) => string
  /** Compact label for a selection: "All regions", or short titles joined. */
  summarizeRegions: (ids: string[]) => string
  summarizeAudiences: (ids: string[]) => string
  /** "EMEA × Hotel Owners" */
  readerTitle: (reader: Reader) => string
}

export function resolveAudienceConfig(config: AudienceVariantsConfig): ResolvedAudienceConfig {
  const lookup = (values: AudienceDimensionValue[]) => {
    const byId = new Map(values.map((v) => [v.id, v]))
    // Unknown ids (removed from config) show raw so nothing is hidden.
    const title = (id: string) => byId.get(id)?.title ?? id
    const summarize = (ids: string[], all: string) => {
      if (values.length > 1 && values.every((v) => ids.includes(v.id))) return all
      // Config order, so the label doesn't depend on click order.
      const known = values.filter((v) => ids.includes(v.id)).map((v) => v.shortTitle ?? v.title)
      const unknown = ids.filter((id) => !byId.has(id))
      return [...known, ...unknown].join(', ')
    }
    return {title, summarize}
  }
  const regions = lookup(config.regions)
  const audiences = lookup(config.audiences)

  const content = config.content ?? {}

  return {
    regions: config.regions,
    audiences: config.audiences,
    content,
    sectionObjectTypes: new Set((content.of ?? []).map((m) => m.name ?? m.type)),
    regionTitle: regions.title,
    audienceTitle: audiences.title,
    summarizeRegions: (ids) => regions.summarize(ids, 'All regions'),
    summarizeAudiences: (ids) => audiences.summarize(ids, 'All audiences'),
    readerTitle: ({region, audience}) => `${regions.title(region)} × ${audiences.title(audience)}`,
  }
}
