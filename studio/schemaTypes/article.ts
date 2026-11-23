import {DocumentTextIcon} from '@sanity/icons/DocumentText'
import {defineField, defineType} from 'sanity'
import {defineAudienceField, defineAudienceVariantsField} from '../plugins/audience-variants'

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
    defineAudienceField({
      name: 'audience',
      title: 'Audience',
      description: 'Who this article is for. Leave empty for the Default Audience (everyone).',
    }),
    defineAudienceVariantsField({name: 'body', title: 'Body'}),
  ],
  preview: {
    select: {title: 'title'},
  },
})
