import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {audienceVariants} from './plugins/audience-variants'
import {marriottContent} from './schemaTypes/marriottContent'

export default defineConfig({
  name: 'default',
  title: 'MarriottAudienceVariantsPTE',

  projectId: 'gbkr8ghe',
  dataset: 'production',

  plugins: [
    structureTool(),
    visionTool(),
    // Ids are placeholders until we have the real ones from the existing
    // schema; titles match the current Studio. `shortTitle` is used in the
    // one-line label above each variant.
    audienceVariants({
      regions: [
        {id: 'global', title: 'Global'},
        {id: 'apec', title: 'Asia Pacific excluding China (APEC)', shortTitle: 'APEC'},
        {id: 'cala', title: 'Caribbean and Latin America (CALA)', shortTitle: 'CALA'},
        {id: 'emea', title: 'Europe, Middle East and Africa (EMEA)', shortTitle: 'EMEA'},
        {id: 'gc', title: 'Greater China (GC)', shortTitle: 'GC'},
        {id: 'uscan', title: 'U.S. and Canada (US/CAN)', shortTitle: 'US/CAN'},
      ],
      audiences: [
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
      // What variant sections may contain, besides text. Sanity's `table`
      // stays top-level only until it's been tested inside variants.
      content: marriottContent,
    }),
  ],

  schema: {
    types: schemaTypes,
  },
})
