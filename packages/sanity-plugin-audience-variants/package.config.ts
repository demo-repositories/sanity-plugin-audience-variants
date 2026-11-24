import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.json',
  tsdoc: {
    // Everything exported from the entry points is public; don't require `@public` on each.
    rules: {'ae-missing-release-tag': 'off'},
  },
})
