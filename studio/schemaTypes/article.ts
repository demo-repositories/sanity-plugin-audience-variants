import {DocumentTextIcon} from '@sanity/icons/DocumentText'
import {defineField, defineType} from 'sanity'
import {defineAudienceVariantsField} from '../plugins/audience-variants'

export const article = defineType({
  name: 'article',
  title: 'Article',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineAudienceVariantsField({name: 'body', title: 'Body'}),
  ],
  preview: {
    select: {title: 'title'},
  },
})
