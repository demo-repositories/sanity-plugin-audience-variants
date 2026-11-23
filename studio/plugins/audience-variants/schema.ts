import {UsersIcon} from '@sanity/icons/Users'
import {defineArrayMember, defineField, defineType} from 'sanity'
import type {ResolvedAudienceConfig} from './config'
import {VARIANT_TYPE, VARIATION_TYPE} from './constants'
import {VariationBlock} from './VariationBlock'

/** Nested content: plain text blocks only, so variations can't nest. */
const nestedContent = [defineArrayMember({type: 'block'})]

type VariantValue = {_key: string; audiences?: string[]}

/** Builds the plugin's object types for a given audience config. */
export function createSchemaTypes({audiences, audienceTitle}: ResolvedAudienceConfig) {
  const audienceVariant = defineType({
    name: VARIANT_TYPE,
    title: 'Variant',
    type: 'object',
    icon: UsersIcon,
    fields: [
      defineField({
        name: 'audiences',
        title: 'Audiences',
        type: 'array',
        of: [defineArrayMember({type: 'string'})],
        options: {
          list: audiences.map((a) => ({value: a.id, title: a.title})),
          layout: 'grid',
        },
        validation: (rule) => rule.required().min(1).unique(),
      }),
      defineField({
        name: 'content',
        title: 'Content',
        type: 'array',
        of: nestedContent,
        validation: (rule) => rule.required().min(1),
      }),
    ],
    preview: {
      select: {audiences: 'audiences'},
      prepare: ({audiences: ids}: {audiences?: string[]}) => ({
        title: ids?.length ? ids.map(audienceTitle).join(', ') : 'No audiences selected',
      }),
    },
  })

  const audienceVariation = defineType({
    name: VARIATION_TYPE,
    title: 'Audience variation',
    type: 'object',
    icon: UsersIcon,
    fields: [
      defineField({
        name: 'default',
        title: 'Default',
        description:
          'Shown to readers who match none of the variants below. Leave empty to show this block only to the audiences in the variants.',
        type: 'array',
        of: nestedContent,
      }),
      defineField({
        name: 'variants',
        title: 'Variants',
        type: 'array',
        of: [defineArrayMember({type: VARIANT_TYPE})],
        validation: (rule) =>
          rule.custom((variants: VariantValue[] | undefined) => {
            if (!variants) return true
            // An audience may only appear in one variant per variation, so a
            // reader always resolves to at most one variant.
            const seen = new Map<string, string>()
            for (const variant of variants) {
              for (const id of variant.audiences ?? []) {
                if (seen.has(id) && seen.get(id) !== variant._key) {
                  return {
                    message: `${audienceTitle(id)} is used in more than one variant`,
                    path: [{_key: variant._key}, 'audiences'],
                  }
                }
                seen.set(id, variant._key)
              }
            }
            return true
          }),
      }),
    ],
    validation: (rule) =>
      rule.custom((value: {default?: unknown[]; variants?: unknown[]} | undefined) => {
        if (!value) return true
        if (value.default?.length || value.variants?.length) return true
        return 'Add default content or at least one variant'
      }),
    components: {block: VariationBlock},
    preview: {
      select: {variants: 'variants'},
      prepare: ({variants}: {variants?: VariantValue[]}) => ({
        title: 'Audience variation',
        subtitle: `${variants?.length ?? 0} variant(s)`,
      }),
    },
  })

  return [audienceVariation, audienceVariant]
}
