import {UsersIcon} from '@sanity/icons/Users'
import {defineArrayMember, defineField, defineType} from 'sanity'
import type {ResolvedAudienceConfig} from './config'
import {DEFAULT_TYPE, VARIANT_TYPE, VARIATION_TYPE} from './constants'
import {overlappingAudiences, type Section} from './resolve'

/** Nested content: plain text blocks only, so variations can't nest. */
const nestedContent = [defineArrayMember({type: 'block'})]

/**
 * Builds the plugin's object types for a given audience config.
 *
 * Shape (both levels are edited inline as Portable Text containers):
 *   audienceVariation.variants[]
 *     audienceDefault {content[]}          optional, at most one
 *     audienceVariant {audiences[], content[]}
 */
export function createSchemaTypes({audiences, audienceTitle}: ResolvedAudienceConfig) {
  const audienceDefault = defineType({
    name: DEFAULT_TYPE,
    title: 'Default',
    type: 'object',
    fields: [
      defineField({
        name: 'content',
        title: 'Content',
        description: 'Shown to readers who match none of the variants.',
        type: 'array',
        of: nestedContent,
      }),
    ],
    preview: {prepare: () => ({title: 'Default'})},
  })

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
        name: 'variants',
        title: 'Variants',
        type: 'array',
        of: [defineArrayMember({type: DEFAULT_TYPE}), defineArrayMember({type: VARIANT_TYPE})],
        validation: (rule) =>
          rule.custom((sections: Section[] | undefined) => {
            if (!sections?.length) return 'Add default content or at least one variant'
            if (sections.filter((s) => s._type === DEFAULT_TYPE).length > 1) {
              return 'Only one default per variation'
            }
            // An audience may only appear in one variant per variation, so a
            // reader always resolves to at most one variant.
            const overlaps = overlappingAudiences({
              _type: VARIATION_TYPE,
              _key: '',
              variants: sections,
            })
            if (overlaps.size) {
              const names = [...overlaps].map(audienceTitle).join(', ')
              return `Used in more than one variant: ${names}`
            }
            return true
          }),
      }),
    ],
    preview: {
      select: {variants: 'variants'},
      prepare: ({variants}: {variants?: Section[]}) => ({
        title: 'Audience variation',
        subtitle: `${variants?.length ?? 0} section(s)`,
      }),
    },
  })

  return [audienceVariation, audienceVariant, audienceDefault]
}
