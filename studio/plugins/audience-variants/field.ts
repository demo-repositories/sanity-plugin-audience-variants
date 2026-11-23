import {
  type ArrayDefinition,
  type BlockDefinition,
  defineArrayMember,
  defineField,
  type FieldDefinitionBase,
  type ObjectDefinition,
} from 'sanity'
import {AUDIENCE_TYPE, VARIATION_TYPE} from './constants'
import {AudienceVariantsPlugins} from './PortableTextPlugins'

type ArrayMember = ReturnType<typeof defineArrayMember>

export type AudienceFieldOptions = FieldDefinitionBase &
  Pick<ObjectDefinition, 'name' | 'title' | 'description' | 'hidden' | 'readOnly' | 'initialValue'>

export type AudienceVariantsFieldOptions = Omit<ArrayDefinition, 'type' | 'of' | 'components'> &
  FieldDefinitionBase & {
    /** Overrides for the top-level text block member (styles, marks, lists…). */
    block?: Omit<BlockDefinition, 'type' | 'name'>
    /** Extra array members (images, other block objects) alongside text and variations. */
    of?: ArrayMember[]
  }

/**
 * A Portable Text field with audience variations enabled: text blocks plus
 * `audienceVariation`, with the editor plugin wired up.
 *
 * ```ts
 * fields: [defineAudienceVariantsField({name: 'body', title: 'Body'})]
 * ```
 */
export function defineAudienceVariantsField({
  block,
  of = [],
  ...field
}: AudienceVariantsFieldOptions) {
  return defineField({
    ...field,
    type: 'array',
    of: [
      defineArrayMember({...block, type: 'block'}),
      defineArrayMember({type: VARIATION_TYPE}),
      ...of,
    ],
    components: {portableText: {plugins: AudienceVariantsPlugins}},
  })
}

/**
 * Who a whole document is for: regions and audiences, picked the same way
 * as a variant in the body. Empty means the Default Audience (every reader).
 * Stored as `{_type: 'audienceTargeting', regions[], audiences[]}`.
 *
 * ```ts
 * fields: [defineAudienceField({name: 'audience', title: 'Audience'})]
 * ```
 */
export function defineAudienceField(field: AudienceFieldOptions) {
  return defineField({...field, type: AUDIENCE_TYPE})
}
