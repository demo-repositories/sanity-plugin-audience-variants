import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {audienceVariants} from 'sanity-plugin-audience-variants'
import {marriottContent} from './schemaTypes/marriottContent'
import {audiences, regions} from './audienceConfig'

export default defineConfig({
  name: 'default',
  title: 'MarriottAudienceVariantsPTE',

  projectId: 'gbkr8ghe',
  dataset: 'production',

  plugins: [
    structureTool(),
    visionTool(),
    audienceVariants({
      regions,
      audiences,
      // What variant sections may contain, besides text. Sanity's `table`
      // stays top-level only until it's been tested inside variants.
      content: marriottContent,
    }),
  ],

  schema: {
    types: schemaTypes,
  },
})
