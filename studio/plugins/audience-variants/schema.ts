import {UsersIcon} from '@sanity/icons/Users'
import {defineArrayMember, defineField, defineType} from 'sanity'
import type {Reader, ResolvedAudienceConfig} from './config'
import {AudienceFieldComponent, AudienceInput} from './AudienceInput'
import {AUDIENCE_TYPE, DEFAULT_TYPE, VARIANT_TYPE, VARIATION_TYPE} from './constants'
import {audienceLabel, overlappingReaders, readerKey, type Section} from './resolve'

/** Nested content: plain text blocks only, so variations can't nest. */
const nestedContent = [defineArrayMember({type: 'block'})]

/**
 * Builds the plugin's object types for a given audience config.
 *
 * Shape (both levels are edited inline as Portable Text containers):
 *   audienceVariation.variants[]
 *     audienceDefault {content[]}          optional, at most one
 *     audienceVariant {regions[], audiences[], content[]}
 *
 * Plus `audienceTargeting {regions[], audiences[]}` for a whole document's
 * audience (see `defineAudienceField`).
 */
export function createSchemaTypes({
  regions,
  audiences,
  summarizeRegions,
  summarizeAudiences,
  readerTitle,
}: ResolvedAudienceConfig) {
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
        name: 'regions',
        title: 'Regions',
        type: 'array',
        of: [defineArrayMember({type: 'string'})],
        options: {list: regions.map((r) => ({value: r.id, title: r.title}))},
        validation: (rule) => rule.required().min(1).unique(),
      }),
      defineField({
        name: 'audiences',
        title: 'Audiences',
        type: 'array',
        of: [defineArrayMember({type: 'string'})],
        options: {list: audiences.map((a) => ({value: a.id, title: a.title}))},
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
      select: {regions: 'regions', audiences: 'audiences'},
      prepare: (sel: {regions?: string[]; audiences?: string[]}) => ({
        title: summarizeRegions(sel.regions ?? []),
        subtitle: summarizeAudiences(sel.audiences ?? []),
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
            // A reader may only be reached by one variant per variation, so
            // they always resolve to at most one variant.
            const overlaps = overlappingReaders({
              _type: VARIATION_TYPE,
              _key: '',
              variants: sections,
            })
            if (overlaps.size) {
              const unique = new Map<string, Reader>()
              for (const r of [...overlaps.values()].flat()) unique.set(readerKey(r), r)
              const names = [...unique.values()].map(readerTitle).join(', ')
              return `Reached by more than one variant: ${names}`
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

  const audienceTargeting = defineType({
    name: AUDIENCE_TYPE,
    title: 'Audience',
    type: 'object',
    icon: UsersIcon,
    components: {input: AudienceInput, field: AudienceFieldComponent},
    fields: [
      defineField({
        name: 'regions',
        title: 'Regions',
        type: 'array',
        of: [defineArrayMember({type: 'string'})],
        options: {list: regions.map((r) => ({value: r.id, title: r.title}))},
        validation: (rule) => rule.unique(),
      }),
      defineField({
        name: 'audiences',
        title: 'Audiences',
        type: 'array',
        of: [defineArrayMember({type: 'string'})],
        options: {list: audiences.map((a) => ({value: a.id, title: a.title}))},
        validation: (rule) => rule.unique(),
      }),
    ],
    preview: {
      select: {regions: 'regions', audiences: 'audiences'},
      prepare: (sel: {regions?: string[]; audiences?: string[]}) => ({
        title: audienceLabel({summarizeRegions, summarizeAudiences}, sel),
      }),
    },
  })

  return [audienceVariation, audienceVariant, audienceDefault, audienceTargeting]
}
