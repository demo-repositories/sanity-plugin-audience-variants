# sanity-plugin-audience-variants

Audience-targeted variations inside Portable Text. Editors wrap part of a body in a
variation and write one section per audience, inline in the Studio editor; the
frontend picks the section that matches the reader.

A reader is one **region** plus one **audience** (e.g. EMEA × Hotel Owners). A variant
section targets one or more regions and one or more audiences, and reaches every
reader in any of its regions _and_ any of its audiences. Leaving a dimension empty
means "any". Every variation also has a default section for readers no variant matches.

## Install

```sh
npm install sanity-plugin-audience-variants
```

Peer dependencies: `sanity` ^6, `react` ^19, `react-dom` ^19, `styled-components` ^6,
`@portabletext/editor` ^8.

## Studio setup

```ts
// sanity.config.ts
import {defineConfig} from 'sanity'
import {audienceVariants} from 'sanity-plugin-audience-variants'

export default defineConfig({
  // …
  plugins: [
    audienceVariants({
      regions: [
        {id: 'emea', title: 'Europe, Middle East and Africa', shortTitle: 'EMEA'},
        {id: 'apec', title: 'Asia Pacific', shortTitle: 'APEC'},
      ],
      audiences: [
        {id: 'owners', title: 'Hotel Owners'},
        {id: 'associates', title: 'Managed Associates'},
      ],
      // Optional: what variant sections may contain besides text.
      content: {
        block: {styles: [/* … */]},
        of: [defineArrayMember({type: 'image'})],
      },
    }),
  ],
})
```

`shortTitle` is used in the compact label above each section. Ids are stored in
documents, so changing them later means migrating content.

Then add fields to your document types:

```ts
import {defineAudienceField, defineAudienceVariantsField} from 'sanity-plugin-audience-variants'

defineType({
  name: 'article',
  type: 'document',
  fields: [
    // Who the whole document is for (optional)
    defineAudienceField({name: 'audience', title: 'Audience'}),
    // Portable Text with variations
    defineAudienceVariantsField({
      name: 'body',
      title: 'Body',
      block: content.block, // pass the same values as the plugin's `content`
      of: content.of, //       so the top level allows them too
      tables: false, //        true turns on Sanity table editing (needs a `table` type)
    }),
  ],
})
```

## Stored shape

```jsonc
// inside a Portable Text array
{
  "_type": "audienceVariation",
  "variants": [
    {"_type": "audienceVariant", "regions": ["emea"], "audiences": ["owners"], "content": [/* blocks */]},
    {"_type": "audienceDefault", "content": [/* blocks */]}
  ]
}

// defineAudienceField
{"_type": "audienceTargeting", "regions": ["emea"], "audiences": []}
```

## Frontend

The `/resolve` entry point has no Studio code, so it's safe to import in any frontend.

```ts
import {resolveVariation, audienceMatches} from 'sanity-plugin-audience-variants/resolve'

const reader = {region: 'emea', audience: 'owners'}

if (!audienceMatches(doc.audience, reader)) notFound()

const body = doc.body.flatMap((block) =>
  block._type === 'audienceVariation'
    ? (resolveVariation(block, reader)?.content ?? [])
    : [block],
)
```

`resolveVariation` returns the first matching variant, or the default section.

## Development

This package lives in a workspace with a test Studio (`../../studio`). The Studio
resolves the package from source, so changes show up in `npm run dev` without a build.

```sh
npm run build      # build dist/ (also checks the package)
npm run typecheck
```

## Publishing

```sh
npm version <patch|minor|major>
npm publish
```

`prepublishOnly` builds first. `publishConfig.exports` makes sure the published
package points at `dist/`, not `src/`.
