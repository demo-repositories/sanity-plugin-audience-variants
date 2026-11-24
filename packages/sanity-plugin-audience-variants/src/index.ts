export {audienceVariants} from './plugin'
export {
  defineAudienceVariantsField,
  defineAudienceField,
  type AudienceVariantsFieldOptions,
  type AudienceFieldOptions,
} from './field'
export {VARIATION_TYPE, VARIANT_TYPE, DEFAULT_TYPE, AUDIENCE_TYPE} from './constants'
export {
  resolveAudienceConfig,
  type AudienceVariantsConfig,
  type AudienceContentConfig,
  type AudienceDimension,
  type AudienceDimensionValue,
  type Reader,
  type Selection,
} from './config'
export {
  resolveVariation,
  audienceMatches,
  audienceLabel,
  type AudienceValue,
  variantMatches,
  previewSectionKeys,
  picksOf,
  selectionOf,
  readersOf,
  allReaders,
  overlappingReaders,
  type PreviewFilter,
  type VariationValue,
  type Section,
  type VariantSection,
  type DefaultSection,
} from './resolve'
