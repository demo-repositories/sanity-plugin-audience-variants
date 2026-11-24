import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {audienceVariants, type AudienceDimension} from 'sanity-plugin-audience-variants'
import {marriottContent} from './schemaTypes/marriottContent'

/**
 * Who content can be targeted at. Order sets the picker's groups and the
 * label above each variant ("EMEA · Hotel Owners"). `name` is the field the
 * picks are stored under, and ids are stored in documents, so changing
 * either means migrating content. `shortTitle` is used in that label.
 *
 * Ids are placeholders; titles match Marriott's current Studio.
 */
const dimensions: AudienceDimension[] = [
  {
    name: 'regions',
    title: 'Regions',
    values: [
      {id: 'global', title: 'Global'},
      {id: 'apec', title: 'Asia Pacific excluding China (APEC)', shortTitle: 'APEC'},
      {id: 'cala', title: 'Caribbean and Latin America (CALA)', shortTitle: 'CALA'},
      {id: 'emea', title: 'Europe, Middle East and Africa (EMEA)', shortTitle: 'EMEA'},
      {id: 'gc', title: 'Greater China (GC)', shortTitle: 'GC'},
      {id: 'uscan', title: 'U.S. and Canada (US/CAN)', shortTitle: 'US/CAN'},
    ],
  },
  {
    name: 'audiences',
    title: 'Audiences',
    values: [
      {
        id: 'managedAssociates',
        title: 'Marriott International Managed Associates',
        shortTitle: 'Managed Associates',
      },
      {
        id: 'franchisees',
        title: 'Franchisees & Hotel Partners',
        shortTitle: 'Franchisees & Partners',
      },
      {id: 'hotelOwners', title: 'Hotel Owners'},
      {id: 'contractors', title: 'Contractors'},
      {id: 'contractorBusinessApps', title: 'Contractor Business Apps'},
    ],
  },
]

export default defineConfig({
  name: 'default',
  title: 'MarriottAudienceVariantsPTE',

  projectId: 'gbkr8ghe',
  dataset: 'production',

  plugins: [
    structureTool(),
    visionTool(),
    audienceVariants({
      dimensions,
      // What variant sections may contain, besides text. Sanity's `table`
      // stays top-level only until it's been tested inside variants.
      content: marriottContent,
    }),
  ],

  schema: {
    types: schemaTypes,
  },
})
