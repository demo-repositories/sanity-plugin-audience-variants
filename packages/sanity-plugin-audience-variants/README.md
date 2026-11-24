# sanity-plugin-audience-variants

Audience-targeted variations inside Portable Text. Editors wrap part of a body in a
variation and write one section per audience, inline in the Studio editor; the
frontend picks the section that matches the reader.

You choose the **dimensions** readers are described by: for example region and
audience type, just audience type, or region, audience type and department. A reader
has one value in every dimension (e.g. EMEA × Partners). A variant section picks
one or more values in every dimension, and reaches every reader whose value is picked
in each of them. Every variation can also have a default section for readers no
variant matches.

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
      dimensions: [
        {
          name: 'regions',
          title: 'Regions',
          values: [
            {id: 'emea', title: 'Europe, Middle East and Africa', shortTitle: 'EMEA'},
            {id: 'apac', title: 'Asia Pacific', shortTitle: 'APAC'},
          ],
        },
        {
          name: 'audiences',
          title: 'Audiences',
          values: [
            {id: 'partners', title: 'Partners'},
            {id: 'employees', title: 'Employees'},
          ],
        },
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

Each dimension's `name` is the field its picked ids are stored under, so it must be a
valid field name (and not `content` or `variants`). Dimension order sets the order of
the picker's groups and of labels like "EMEA · Partners". `allTitle` is the label
when every value is picked (default "All <title>"); `shortTitle` is used in the compact
label above each section.

Names and ids are stored in documents, so renaming them, or adding a dimension that
existing variants don't have, means migrating content.

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
    // one string array per dimension, named after it
    {"_type": "audienceVariant", "regions": ["emea"], "audiences": ["partners"], "content": [/* blocks */]},
    {"_type": "audienceDefault", "content": [/* blocks */]}
  ]
}

// defineAudienceField: an empty dimension means "any"
{"_type": "audienceTargeting", "regions": ["emea"], "audiences": []}
```

## Frontend

The `/resolve` entry point has no Studio code, so it's safe to import in any frontend.

```ts
import {resolveVariation, audienceMatches} from 'sanity-plugin-audience-variants/resolve'

// The same dimensions as the Studio config (only `name` is needed here)
const dimensions = [{name: 'regions'}, {name: 'audiences'}]

// One value per dimension, keyed by dimension name
const reader = {regions: 'emea', audiences: 'partners'}

if (!audienceMatches(doc.audience, reader, dimensions)) notFound()

const body = doc.body.flatMap((block) =>
  block._type === 'audienceVariation'
    ? (resolveVariation(block, reader, dimensions)?.content ?? [])
    : [block],
)
```

`resolveVariation` returns the first matching variant, or the default section. A
variant matches only if the reader's value is picked in every dimension you pass, so
pass all of them.

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

`prepack` builds first, for both `npm pack` and `npm publish`. It then swaps in
`publishConfig.exports`, which npm otherwise ignores, so the packed `package.json`
points only at `dist/`. `postpack` restores the original.

To build the tarball shipped in this repo:

```sh
npm pack --pack-destination ../../release
```
