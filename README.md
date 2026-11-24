# Audience variants for Sanity Studio

`sanity-plugin-audience-variants` lets editors write audience-specific versions of part
of a Portable Text body, inline in the Studio editor. The frontend then shows each
reader the version that matches them.

This guide covers:

1. [Installing the plugin](#1-install) in your Studio
2. [Configuring it](#2-configure): your audience dimensions and the fields that use them
3. [The data format](#3-data-format): what the plugin stores, and the rules that data must follow
4. [Mapping your existing content](#4-mapping-existing-content) into that format
5. [Rendering it on the frontend](#5-frontend)

The repo contains the plugin (`packages/sanity-plugin-audience-variants`) and a small
test Studio (`studio/`) that shows a working setup. The test Studio's schema types
(`externalImage`, `tableBlock`, the link annotations) are stand-ins for yours.

## Concepts

- A **dimension** is one way readers are described, for example region or audience type.
  You choose the dimensions and their values in the plugin config.
- A **reader** has exactly one value in every dimension: _EMEA × Franchisees_.
- An **audience variation** is a block in the body that holds alternative **sections**.
  Each reader sees at most one of them.
- A **variant** section picks one or more values in every dimension. It reaches every
  reader whose value is picked in each dimension, so `regions: [emea, apec]` ×
  `audiences: [franchisees]` reaches EMEA × Franchisees and APEC × Franchisees.
- A **default** section (optional, at most one per variation) is for readers that no
  variant in that variation reaches.
- A **document audience** says who a whole document is for. A dimension with nothing
  picked means "any value".

## 1. Install

Requirements: Node 22.18 or later, `sanity` ^6.24, React 19, `styled-components` ^6 and
`@portabletext/editor` ^8.

The package isn't published to npm. It ships as a tarball in this repo:
`release/sanity-plugin-audience-variants-0.1.0.tgz`.

Copy it into your Studio's repo (for example to `vendor/`) and install it, along with
the peer dependencies:

```sh
npm install ./vendor/sanity-plugin-audience-variants-0.1.0.tgz
npm install @portabletext/editor@^8 styled-components@^6
```

Commit the tarball (or host it in your private registry) so CI and Studio deploys can
install it.

To rebuild the tarball after changing the plugin:

```sh
npm install
cd packages/sanity-plugin-audience-variants
npm pack --pack-destination ../../release
```

## 2. Configure

### Dimensions

Define your dimensions in their own module, so that the Studio, migration scripts and
frontend can all import the same list:

```ts
// audienceDimensions.ts
import type {AudienceDimension} from 'sanity-plugin-audience-variants'

export const dimensions: AudienceDimension[] = [
  {
    name: 'regions', // the field name picks are stored under
    title: 'Regions', // group heading in the picker
    values: [
      {id: 'emea', title: 'Europe, Middle East and Africa (EMEA)', shortTitle: 'EMEA'},
      {id: 'apec', title: 'Asia Pacific excluding China (APEC)', shortTitle: 'APEC'},
      // …
    ],
  },
  {
    name: 'audiences',
    title: 'Audiences',
    values: [
      {id: 'franchisees', title: 'Franchisees & Hotel Partners', shortTitle: 'Franchisees'},
      // …
    ],
  },
]
```

- `name` must be a valid field name and can't be `content` or `variants`.
- `id` is the value written into documents. `title` is shown in the picker, and
  `shortTitle` (optional) in the compact label above each section.
- `allTitle` (optional) is the label shown when every value is picked. It defaults to
  "All regions".
- The order of dimensions sets the picker's group order and the label order
  ("EMEA · Franchisees").

**Names and ids are stored in content.** Renaming a dimension, changing an id, or
adding a dimension later means migrating existing documents. Settle on them before you
migrate. Removing a value from the config doesn't break documents that still use it:
the Studio shows the raw id, and no reader matches it.

### Plugin

```ts
// sanity.config.ts
import {defineConfig} from 'sanity'
import {audienceVariants} from 'sanity-plugin-audience-variants'
import {dimensions} from './audienceDimensions'
import {bodyContent} from './schemaTypes/bodyContent'

export default defineConfig({
  // …
  plugins: [
    // …
    audienceVariants({
      dimensions,
      content: bodyContent, // what variant sections may contain; see below
    }),
  ],
})
```

### Section content

Text blocks are always allowed in sections. `content` customises them and adds other
block types:

```ts
// schemaTypes/bodyContent.ts
import {defineArrayMember} from 'sanity'
import type {AudienceContentConfig} from 'sanity-plugin-audience-variants'

export const bodyContent = {
  block: {
    // the same options as a `block` array member: styles, lists, marks
    marks: {annotations: [/* your link annotations */]},
  },
  of: [defineArrayMember({type: 'yourImageType'}), defineArrayMember({type: 'yourTableType'})],
} satisfies AudienceContentConfig
```

Any type listed in `of` must also be declared in your schema. Variations can't nest, so
the plugin's own types aren't allowed in `of`.

### Fields

```ts
import {defineType} from 'sanity'
import {defineAudienceField, defineAudienceVariantsField} from 'sanity-plugin-audience-variants'
import {bodyContent} from './bodyContent'

export const page = defineType({
  name: 'page',
  type: 'document',
  fields: [
    // Optional: who the whole document is for
    defineAudienceField({name: 'audience', title: 'Audience'}),

    // Portable Text with audience variations
    defineAudienceVariantsField({
      name: 'body',
      title: 'Body',
      block: bodyContent.block, // pass the same values as the plugin's `content`
      of: bodyContent.of, //       so the top level allows them too
    }),
  ],
})
```

`defineAudienceVariantsField` accepts the usual array field options (`title`,
`description`, `validation`, `group`, …) plus:

| Option   | Purpose                                                                    |
| -------- | -------------------------------------------------------------------------- |
| `block`  | Options for top-level text blocks                                          |
| `of`     | Extra top-level block types. These can differ from the section content: a type that's only in `of` is allowed at the top level but not inside variants |
| `tables` | `true` turns on Sanity's table editing. This needs a `table` type shaped `table → rows[] (row) → cells[] (cell) → value[] (blocks)` that is included in `of`. See `studio/schemaTypes/table.ts` |

### What editors get

- Select blocks and press **Alt+Shift+V** (Option+Shift+V on Mac), or use the toolbar's
  insert menu, to wrap them in a variation. The selected blocks become its default
  section.
- Add, duplicate, retarget or remove sections from the variation's controls. Each
  section's label says who sees it.
- **Preview as** a region, an audience, or both shows only what those readers see. The
  editor is read-only while previewing.
- Validation flags any reader who is reached by more than one variant in a variation.

## 3. Data format

This is the contract your migration has to produce and your frontend reads. The
examples use `regions` and `audiences`. Your field names are your dimension `name`s.

### Variation, inside a Portable Text array

```jsonc
// a member of `body` (the field defined with defineAudienceVariantsField)
{
  "_type": "audienceVariation",
  "_key": "a1b2c3",
  "variants": [
    {
      "_type": "audienceVariant",
      "_key": "d4e5f6",
      "regions": ["emea", "apec"], // one string array per dimension
      "audiences": ["franchisees"],
      "content": [
        /* Portable Text: blocks plus your `content.of` types */
      ]
    },
    {
      "_type": "audienceDefault", // optional: everyone not reached above
      "_key": "g7h8i9",
      "content": [/* … */]
    }
  ]
}
```

Rules:

1. **Every variant has at least one value in every dimension.** An empty array doesn't
   mean "any" here. To target every region, list every region id.
2. **No reader can be reached by two variants in the same variation.** Two variants
   clash when their picks overlap in every dimension. Validation rejects this.
3. **At most one `audienceDefault`, and at least one section**, per variation.
4. **`variants` holds only `audienceVariant` and `audienceDefault`.** Never put a bare
   block directly in `variants`. (The Studio moves stray blocks into a section when it
   finds them, but don't rely on that.)
5. **Variations only appear at the top level of the field.** A section's `content`
   can't contain another `audienceVariation`.
6. **Section `content` may only contain `block` and the types in the plugin's
   `content.of`.**
7. **Every array member needs a `_key`.** Make keys unique across the whole field,
   including inside sections, not just within each array. Span `marks` must refer to
   `markDefs` keys in the same block, as in any Portable Text.
8. Order sections as variants first, then the default. That's what the editor
   produces. Resolution doesn't depend on the order (rule 2 guarantees at most one
   variant matches), but keeping it consistent avoids surprises.

How a reader is resolved:

- If a variant picks the reader's value in every dimension, they see that variant's
  `content`.
- Otherwise they see the default's `content`.
- If there's no default either, they see nothing for that variation.

### Document audience

```jsonc
// a field defined with defineAudienceField
{"_type": "audienceTargeting", "regions": ["emea"], "audiences": []}
```

Here an empty or missing dimension **does** mean "any". So `{"regions": ["emea"]}` is
everyone in EMEA, and an empty or missing field is everyone. The Studio calls that the
"Default Audience".

## 4. Mapping existing content

Your migration's job is to turn each existing piece of targeted content into one of the
following:

- **plain top-level blocks**, if every reader sees it;
- **a variant section**, if only some readers see it;
- **a default section**, if it's the fallback for readers who don't get a more specific
  version.

Guidelines:

- **Map your targeting values to dimension ids first.** Build an explicit lookup (for
  example, region document id → region id) and stop the script on anything it doesn't
  know, rather than guessing. Decide up front how your "global" or "all" values map.
- **Source targeting that means "any" becomes the full list of ids** in a variant (rule
  1), or no picks at all in a document audience.
- **Group sections that are alternatives to each other** into one variation, placed
  where that content appeared. A variation is one slot in the body where each reader
  gets one version, for example the "Eligibility" section for each audience.
- **Content that some readers see in addition to other content can't be an
  alternative.** If two source sections can both reach the same reader, they belong in
  separate variations, one after the other (or as plain blocks if one of them reaches
  everyone). Otherwise you break rule 2.
- **Targeting that isn't a rectangle needs more than one variant.** A variant reaches
  _every combination_ of its picks. To reach EMEA × Franchisees and APEC × Owners, but
  not EMEA × Owners, write two variants. They can hold the same content.
- **Identical content for several audiences can share one variant**, if the combined
  readers form a rectangle: EMEA × Franchisees plus APEC × Franchisees becomes
  `regions: [emea, apec]` × `audiences: [franchisees]`.
- **Carry over any section headings that readers see** as blocks inside each section's
  `content`. The plugin doesn't render a heading of its own.
- **Generate fresh `_key`s** wherever the same blocks are copied into more than one
  section (rule 7), and remap span `marks` to the new `markDefs` keys.
- **Keep draft and published documents separate.** Transform `drafts.<id>` and `<id>`
  as two documents.

### Check the result reader by reader

The most reliable check is to compare, for every possible reader, what they saw before
and what they'll see after. The `/resolve` entry point has the helpers you need, and it
runs in Node with no Studio code:

```ts
import {
  allReaders,
  audienceMatches,
  overlappingReaders,
  resolveVariation,
} from 'sanity-plugin-audience-variants/resolve'
import {dimensions} from './audienceDimensions'

function viewAfter(body, reader) {
  return body.flatMap((block) =>
    block._type === 'audienceVariation'
      ? (resolveVariation(block, reader, dimensions)?.content ?? [])
      : [block],
  )
}

for (const reader of allReaders(dimensions)) {
  // compare viewBefore(sourceDoc, reader) with viewAfter(targetDoc.body, reader),
  // ignoring _key differences
}

// and for each variation: overlappingReaders(variation, dimensions).size === 0
```

`sanity documents validate` also runs the plugin's validation (rules 1–3) against
migrated content.

## 5. Frontend

### In JavaScript

```ts
import {audienceMatches, resolveVariation} from 'sanity-plugin-audience-variants/resolve'

// Only `name` is needed here, but pass every dimension
const dimensions = [{name: 'regions'}, {name: 'audiences'}]

// One value per dimension
const reader = {regions: 'emea', audiences: 'franchisees'}

if (!audienceMatches(doc.audience, reader, dimensions)) notFound()

const body = doc.body.flatMap((block) =>
  block._type === 'audienceVariation'
    ? (resolveVariation(block, reader, dimensions)?.content ?? [])
    : [block],
)
// render `body` with your existing Portable Text components
```

If your query expands references inside the body (for example internal links), extend
the projection so it also reaches section content:

```groq
body[]{
  ...,
  markDefs[]{..., reference->{_type, slug}},
  _type == "audienceVariation" => {
    variants[]{
      ...,
      content[]{..., markDefs[]{..., reference->{_type, slug}}}
    }
  }
}
```

### In GROQ

You can also filter documents and resolve variations in the query, so only the reader's
content is sent:

```groq
*[_type == "page"
  && (count(coalesce(audience.regions, [])) == 0 || $region in audience.regions)
  && (count(coalesce(audience.audiences, [])) == 0 || $audience in audience.audiences)
]{
  ...,
  body[]{
    ...,
    _type == "audienceVariation" => {
      "resolved": coalesce(
        variants[_type == "audienceVariant" && $region in regions && $audience in audiences][0],
        variants[_type == "audienceDefault"][0]
      ).content
    }
  }
}
```

With this query, flatten `resolved` into the body on the frontend. A variation with no
`resolved` renders nothing. The filter needs one `$param in <dimension>` condition per
dimension.

## Plugin development

See [`packages/sanity-plugin-audience-variants/README.md`](packages/sanity-plugin-audience-variants/README.md).
`npm run dev` at the repo root starts the test Studio, which loads the plugin from source.
