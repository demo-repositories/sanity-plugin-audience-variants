import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {audienceVariants, type AudienceDimension} from 'sanity-plugin-audience-variants'
import {bodyContent} from './schemaTypes/bodyContent'

// Set these in studio/.env.local (see .env.example).
const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? 'your-project-id'
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production'

/**
 * Who content can be targeted at. Dimension order sets the picker's groups
 * and the label above each variant ("EMEA · Partners"); values are shown
 * alphabetically. `name` is the field the picks are stored under, and ids
 * are stored in documents, so changing either means migrating content.
 * `shortTitle` is used in that label.
 *
 * Example values for the test Studio; replace them with your own.
 */
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

/**
 * A second workspace with 20 values per dimension, to see (and test) how the
 * pickers and labels cope with long lists. Same dataset and schema.
 */
const slug = (title: string) => title.toLowerCase().replace(/[^a-z]+/g, '-')
const manyDimensions: AudienceDimension[] = [
  {
    name: 'regions',
    title: 'Regions',
    values: [
      'North America',
      'Latin America',
      'Caribbean',
      'Western Europe',
      'Northern Europe',
      'Southern Europe',
      'Central & Eastern Europe',
      'Nordics',
      'Middle East',
      'North Africa',
      'Sub-Saharan Africa',
      'Central Asia',
      'South Asia',
      'Southeast Asia',
      'East Asia',
      'Greater China',
      'Japan',
      'Korea',
      'Australia & New Zealand',
      'Pacific Islands',
    ].map((title) => ({id: slug(title), title})),
  },
  {
    name: 'audiences',
    title: 'Audiences',
    values: [
      'Customers',
      'Resellers & Partners',
      'Employees',
      'Prospects',
      'Developers',
      'Executives',
      'IT Administrators',
      'Marketing Teams',
      'Finance Teams',
      'Students',
      'Educators',
      'Government Agencies',
      'Healthcare Providers',
      'Non-profits',
      'Startups',
      'Enterprise Accounts',
      'SMB Accounts',
      'Investors',
      'Press & Analysts',
      'Job Candidates',
    ].map((title) => ({id: slug(title), title})),
  },
]

function workspace(name: string, title: string, basePath: string, dims: AudienceDimension[]) {
  return {
    name,
    title,
    basePath,

    projectId,
    dataset,

    plugins: [
      structureTool(),
      visionTool(),
      audienceVariants({
        dimensions: dims,
        // What variant sections may contain, besides text. Sanity's `table`
        // stays top-level only until it's been tested inside variants.
        content: bodyContent,
      }),
    ],

    schema: {
      types: schemaTypes,
    },
  }
}

export default defineConfig([
  workspace('default', 'Audience Variants', '/default', dimensions),
  workspace('scale', 'Audience Variants (20 × 20)', '/scale', manyDimensions),
])
