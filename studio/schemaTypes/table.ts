import {ThLargeIcon} from '@sanity/icons/ThLarge'
import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * Table in the shape Sanity's built-in Portable Text table plugin expects:
 * table > rows[] row > cells[] cell > value[] (Portable Text). Cells hold
 * ordinary text blocks, so links and other marks work inside them.
 */
export const table = defineType({
  name: 'table',
  title: 'Table',
  type: 'object',
  icon: ThLargeIcon,
  fields: [
    defineField({name: 'headerRows', title: 'Header rows', type: 'number'}),
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
              of: [
                defineArrayMember({
                  name: 'cell',
                  type: 'object',
                  fields: [
                    defineField({
                      name: 'value',
                      type: 'array',
                      of: [defineArrayMember({type: 'block'})],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
  preview: {
    select: {rows: 'rows'},
    prepare: ({rows}: {rows?: {cells?: unknown[]}[]}) => ({
      title: 'Table',
      subtitle: `${rows?.length ?? 0} × ${rows?.[0]?.cells?.length ?? 0}`,
    }),
  },
})
