import {DocumentTextIcon} from '@sanity/icons/DocumentText'
import {defineArrayMember, defineField, defineType} from 'sanity'
import {defineAudienceField, defineAudienceVariantsField} from 'sanity-plugin-audience-variants'
import {bodyContent} from './bodyContent'

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
    defineAudienceVariantsField({
      name: 'body',
      title: 'Body',
      block: bodyContent.block,
      of: [...bodyContent.of, defineArrayMember({type: 'table'})],
      tables: true,
    }),
  ],
  preview: {
    select: {title: 'title'},
  },
})
