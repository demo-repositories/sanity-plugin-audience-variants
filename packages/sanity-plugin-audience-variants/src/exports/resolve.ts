/**
 * Frontend entry: resolve audience variations for a reader without loading
 * any Studio code.
 *
 * ```ts
 * import {resolveVariation} from 'sanity-plugin-audience-variants/resolve'
 * ```
 */
export * from '../resolve'
export {VARIATION_TYPE, VARIANT_TYPE, DEFAULT_TYPE, AUDIENCE_TYPE, DEFAULT_LABEL} from '../constants'
export {
  resolveAudienceConfig,
  type AudienceVariantsConfig,
  type AudienceContentConfig,
  type AudienceDimension,
  type AudienceDimensionValue,
  type Reader,
  type Selection,
  type DimensionNames,
  type ResolvedAudienceConfig,
} from '../config'
