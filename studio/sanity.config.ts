import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {audienceVariants} from './plugins/audience-variants'

export default defineConfig({
  name: 'default',
  title: 'MarriottAudienceVariantsPTE',

  projectId: 'gbkr8ghe',
  dataset: 'production',

  plugins: [
    structureTool(),
    visionTool(),
    // PLACEHOLDER audience values: replace with the real lists.
    audienceVariants({
      regions: [
        {id: 'noram', title: 'NORAM'},
        {id: 'emea', title: 'EMEA'},
        {id: 'apac', title: 'APAC'},
        {id: 'cala', title: 'CALA'},
      ],
      ownershipTypes: [
        {id: 'corporate', title: 'Corporate'},
        {id: 'franchise', title: 'Franchise'},
      ],
    }),
  ],

  schema: {
    types: schemaTypes,
  },
})
