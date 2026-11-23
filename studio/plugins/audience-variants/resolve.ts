import type {PortableTextBlock} from '@portabletext/editor'

export type Variant = {_key: string; audiences?: string[]; content?: PortableTextBlock[]}
export type VariationValue = {_key: string; default?: PortableTextBlock[]; variants?: Variant[]}

export type Resolution = {kind: 'variant'; variant: Variant} | {kind: 'default'} | {kind: 'hidden'}

/**
 * What a reader in `audience` sees for this variation: the variant that
 * targets them, else the default, else nothing. Mirrors the frontend rule.
 */
export function resolveVariation(value: VariationValue, audience: string): Resolution {
  const variant = value.variants?.find((v) => v.audiences?.includes(audience))
  if (variant) return {kind: 'variant', variant}
  if (value.default?.length) return {kind: 'default'}
  return {kind: 'hidden'}
}
