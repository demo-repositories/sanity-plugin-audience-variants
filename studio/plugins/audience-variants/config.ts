/**
 * Audience configuration.
 *
 * An audience is a combination of one region and one ownership type, stored
 * as `region:ownership` (e.g. `noram:corporate`). Editors tick combinations,
 * not dimensions, because a variant can target an arbitrary set of combos
 * (e.g. NORAM Corporate + EMEA Franchise) that isn't a cartesian product.
 *
 * Changing ids later means migrating stored `audiences` strings.
 */

export type AudienceDimensionValue = {id: string; title: string}

export type AudienceVariantsConfig = {
  regions: AudienceDimensionValue[]
  ownershipTypes: AudienceDimensionValue[]
}

export type Audience = {id: string; title: string}

export type ResolvedAudienceConfig = {
  audiences: Audience[]
  /** Human label for a stored audience id; falls back to the raw id if unknown. */
  audienceTitle: (id: string) => string
}

export function resolveAudienceConfig(config: AudienceVariantsConfig): ResolvedAudienceConfig {
  const audiences = config.regions.flatMap((region) =>
    config.ownershipTypes.map((ownership) => ({
      id: `${region.id}:${ownership.id}`,
      title: `${region.title} ${ownership.title}`,
    })),
  )
  const titles = new Map(audiences.map((a) => [a.id, a.title]))
  return {audiences, audienceTitle: (id) => titles.get(id) ?? id}
}
