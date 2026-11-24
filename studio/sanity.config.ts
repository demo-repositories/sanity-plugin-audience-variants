import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {audienceVariants, type AudienceDimension} from 'sanity-plugin-audience-variants'
import {bodyContent} from './schemaTypes/bodyContent'

/**
 * Who content can be targeted at. Order sets the picker's groups and the
 * label above each variant ("EMEA · Partners"). `name` is the field the
 * picks are stored under, and ids are stored in documents, so changing
 * either means migrating content. `shortTitle` is used in that label.
 *
 * Example values for the test Studio; replace them with your own.
 */
// Set these in studio/.env.local (see .env.example).
const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? 'your-project-id'
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production'

const dimensions: AudienceDimension[] = [
  {
    name: 'regions',
    title: 'Regions',
    values: [
      {id: 'americas', title: 'Americas'},
      {id: 'emea', title: 'Europe, Middle East and Africa (EMEA)', shortTitle: 'EMEA'},
      {id: 'apac', title: 'Asia Pacific (APAC)', shortTitle: 'APAC'},
    ],
  },
  {
    name: 'audiences',
    title: 'Audiences',
    values: [
      {id: 'customers', title: 'Customers'},
      {id: 'partners', title: 'Resellers & Partners', shortTitle: 'Partners'},
      {id: 'employees', title: 'Employees'},
    ],
  },
]

export default defineConfig({
  name: 'default',
  title: 'Audience Variants',

  projectId,
  dataset,

  plugins: [
    structureTool(),
    visionTool(),
    audienceVariants({
      dimensions,
      // What variant sections may contain, besides text. Sanity's `table`
      // stays top-level only until it's been tested inside variants.
      content: bodyContent,
    }),
  ],

  schema: {
    types: schemaTypes,
  },
})
