import {
  type ArrayDefinition,
  type BlockDefinition,
  defineArrayMember,
  defineField,
  type FieldDefinitionBase,
} from 'sanity'
import {VARIATION_TYPE} from './constants'
import {AudienceVariantsPlugins} from './PortableTextPlugins'

type ArrayMember = ReturnType<typeof defineArrayMember>

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
