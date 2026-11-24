import {ImageIcon} from '@sanity/icons/Image'
import {LinkIcon} from '@sanity/icons/Link'
import {ThListIcon} from '@sanity/icons/ThList'
import {defineArrayMember, defineField, defineType} from 'sanity'
import type {AudienceContentConfig} from 'sanity-plugin-audience-variants'

/**
 * Example Portable Text types for the test Studio: an external image, a plain
 * table and two link annotations. In your Studio, use your own.
 */

/** An image hosted outside Sanity, referenced by URL. */
export const externalImage = defineType({
  name: 'externalImage',
  title: 'External image',
  type: 'object',
  icon: ImageIcon,
  fields: [
    defineField({name: 'src', title: 'URL', type: 'url', validation: (rule) => rule.required()}),
    defineField({name: 'alt', title: 'Alternative text', type: 'string'}),
  ],
  preview: {select: {title: 'alt', subtitle: 'src'}},
})

/** A simple table: each cell is a plain string. */
export const tableBlock = defineType({
  name: 'tableBlock',
  title: 'Table (plain)',
  type: 'object',
  icon: ThListIcon,
  fields: [
    defineField({name: 'hasHeaderRow', title: 'First row is a header', type: 'boolean'}),
    defineField({
      name: 'rows',
      title: 'Rows',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'row',
          type: 'object',
          fields: [
            defineField({
              name: 'cells',
              type: 'array',
              of: [defineArrayMember({type: 'string'})],
            }),
          ],
          preview: {
            select: {cells: 'cells'},
            prepare: ({cells}: {cells?: string[]}) => ({title: (cells ?? []).join(' | ')}),
          },
        }),
      ],
    }),
  ],
  preview: {
    select: {rows: 'rows'},
    prepare: ({rows}: {rows?: {cells?: string[]}[]}) => ({
      title: rows?.[0]?.cells?.join(' | ') || 'Table',
      subtitle: `${rows?.length ?? 0} rows`,
    }),
  },
})

/**
 * Text block settings and extra block types, shared by the top level of the
 * body and by variant sections. Add a type here and both levels allow it.
 */
export const bodyContent = {
  block: {
    marks: {
      annotations: [
        defineArrayMember({
          name: 'link',
          title: 'Link',
          type: 'object',
          icon: LinkIcon,
          fields: [
            defineField({name: 'href', title: 'URL', type: 'url'}),
            defineField({name: 'newWindow', title: 'Open in new window', type: 'boolean'}),
          ],
        }),
        defineArrayMember({
          name: 'internalLink',
          title: 'Internal link',
          type: 'object',
          icon: LinkIcon,
          fields: [
            defineField({
              name: 'reference',
              title: 'Document',
              type: 'reference',
              to: [{type: 'article'}],
              weak: true,
            }),
            defineField({name: 'anchor', title: 'Anchor', type: 'string'}),
          ],
        }),
      ],
    },
  },
  of: [defineArrayMember({type: 'externalImage'}), defineArrayMember({type: 'tableBlock'})],
} satisfies AudienceContentConfig
