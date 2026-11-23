export {audienceVariants} from './plugin'
export {defineAudienceVariantsField, type AudienceVariantsFieldOptions} from './field'
export {VARIATION_TYPE, VARIANT_TYPE, DEFAULT_TYPE} from './constants'
export {
  resolveAudienceConfig,
  type AudienceVariantsConfig,
  type AudienceDimensionValue,
  type Reader,
} from './config'
export {
  resolveVariation,
  variantMatches,
  previewSectionKeys,
  type PreviewFilter,
  type VariationValue,
  type Section,
  type VariantSection,
  type DefaultSection,
} from './resolve'
