import {UsersIcon} from '@sanity/icons/Users'
import {defineArrayMember, defineField, defineType} from 'sanity'
import type {AudienceContentConfig, AudienceDimension, Reader, ResolvedAudienceConfig} from './config'
import {AudienceFieldComponent, AudienceInput} from './AudienceInput'
import {AUDIENCE_TYPE, DEFAULT_TYPE, VARIANT_TYPE, VARIATION_TYPE} from './constants'
import {audienceLabel, overlappingReaders, picksOf, readerKey, type Section} from './resolve'

const PLUGIN_TYPES: string[] = [VARIATION_TYPE, VARIANT_TYPE, DEFAULT_TYPE, AUDIENCE_TYPE]

/**
 * Section content: text blocks plus whatever `content.of` injects. The
 * plugin's own types are refused so variations can't nest: nesting would
 * make reader resolution ambiguous and multiply the dataset's attributes.
 */
function sectionContent({block, of = []}: AudienceContentConfig) {
  const nested = of.find((m) => PLUGIN_TYPES.includes(m.name ?? m.type))
  if (nested) {
    throw new Error(
      `audience-variants: \`content.of\` can't include \`${nested.name ?? nested.type}\`; variations can't nest.`,
    )
  }
  return [defineArrayMember({...block, type: 'block'}), ...of]
}

/** One string-array field per dimension, listing its values. */
function dimensionFields(dimensions: AudienceDimension[], required: boolean) {
  return dimensions.map(({name, title, values}) =>
    defineField({
      name,
      title,
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      options: {list: values.map((v) => ({value: v.id, title: v.title}))},
      validation: (rule) => (required ? rule.required().min(1).unique() : rule.unique()),
    }),
  )
}

/** Preview `select` for every dimension field. */
function selectDimensions(dimensions: AudienceDimension[]) {
  return Object.fromEntries(dimensions.map(({name}) => [name, name]))
}

/**
 * Builds the plugin's object types for a given audience config.
 *
 * Shape (both levels are edited inline as Portable Text containers):
 *   audienceVariation.variants[]
 *     audienceDefault {content[]}          optional, at most one
 *     audienceVariant {<dimension>[]…, content[]}
 *
 * Plus `audienceTargeting {<dimension>[]…}` for a whole document's audience
 * (see `defineAudienceField`). Each dimension in the config becomes a
 * string-array field named after it.
 */
export function createSchemaTypes(config: ResolvedAudienceConfig) {
  const {dimensions, content, summarize, readerTitle} = config
  const nestedContent = sectionContent(content)

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
      ...dimensionFields(dimensions, true),
      defineField({
        name: 'content',
        title: 'Content',
        type: 'array',
        of: nestedContent,
      }),
    ],
    preview: {
      select: selectDimensions(dimensions),
      prepare: (sel: Record<string, unknown>) => {
        const [first, ...rest] = dimensions.map(({name}) => summarize(name, picksOf(sel, name)))
        return {title: first, subtitle: rest.join(' · ') || undefined}
      },
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
            const overlaps = overlappingReaders(
              {_type: VARIATION_TYPE, _key: '', variants: sections},
              dimensions,
            )
            if (overlaps.size) {
              const unique = new Map<string, Reader>()
              for (const r of [...overlaps.values()].flat()) unique.set(readerKey(r, dimensions), r)
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
    fields: dimensionFields(dimensions, false),
    preview: {
      select: selectDimensions(dimensions),
      prepare: (sel: Record<string, unknown>) => ({title: audienceLabel(config, sel)}),
    },
  })

  return [audienceVariation, audienceVariant, audienceDefault, audienceTargeting]
}
