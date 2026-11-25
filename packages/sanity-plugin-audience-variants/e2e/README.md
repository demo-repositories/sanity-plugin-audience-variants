# End-to-end tests

These tests drive the test Studio (`studio/`) in a real browser with Playwright: they
click, type, paste and drag like an editor, then check both what the Studio shows and
what it saved. The Studio loads the plugin from source, so the tests always run against
the current code.

## Running

```sh
# from the repo root
npm run e2e

# or from packages/sanity-plugin-audience-variants
npm run e2e                       # whole suite, headless
npm run e2e -- e2e/wrap.spec.ts   # one file
npm run e2e -- -g "Duplicate"     # tests whose name matches
npm run e2e -- --headed           # watch it happen
npm run e2e:ui                    # Playwright's UI: pick tests, time-travel through steps
SLOWMO=500 npm run e2e -- --headed --workers=1 -g "Duplicate"   # watch it, slowed down
npm run e2e -- --debug -g "Duplicate"                           # step through with the inspector
```

Playwright starts the Studio on port 3334 itself. While you're writing tests, it's
faster to keep one running in another terminal with `npm run e2e:studio`; the tests
reuse it.

When a test fails, `test-results/` has a screenshot, a video and a trace. Open the
trace with `npx playwright show-trace <path>/trace.zip`.

The first time, install the browser with `npx playwright install chromium`.

### What it needs

- **Project:** `SANITY_STUDIO_PROJECT_ID` from `studio/.env.local` (or the environment).
- **Dataset:** a dataset called `e2e` in that project (override with
  `SANITY_E2E_DATASET`). The suite refuses to run against `production`. To create it:
  `cd studio && npx sanity dataset create e2e --visibility private`.
- **CORS:** `http://localhost:3334` with credentials:
  `npx sanity cors add http://localhost:3334 --credentials`.
- **Login:** if you're logged in with the Sanity CLI (`npx sanity login`), the tests
  use that login. Otherwise (for example in CI), set `SANITY_E2E_TOKEN` to a token that
  can edit the dataset.

Each test creates its own article (id `e2e-…`), opens it, and deletes it afterwards.
Leftovers from an interrupted run are deleted at the start of the next. To keep them
for debugging, set `E2E_KEEP_DOCS=1`.

## How a test reads

```ts
import {dflt, expect, REGION, AUDIENCE, test, variant, variation} from './support/fixtures'

test('picking audiences targets the variant', async ({studio, openArticle}) => {
  // 1. Seed an article with this body and open it in the Studio
  const article = await openArticle([variation(variant({}, 'Targeted'), dflt('Everyone'))])

  // 2. Do what the editor did
  await studio.pick(studio.sectionWith('Targeted'), REGION.emea, AUDIENCE.partners)

  // 3. Check what they see…
  await expect(studio.sectionLabel(studio.sectionWith('Targeted'))).toHaveText('EMEA · Partners')
  // …and what was saved
  await article.expectBody([
    variation(variant({regions: ['emea'], audiences: ['partners']}, 'Targeted'), dflt('Everyone')),
  ])
})
```

**Bodies** are written without keys (`support/body.ts`):

| Write                                          | Means                                          |
| ---------------------------------------------- | ---------------------------------------------- |
| `'Some text'`                                  | a plain paragraph                              |
| `block({style: 'h2', text: 'Title'})`          | a paragraph with a style or list item          |
| `block({spans: [{text: 'x', marks: ['strong']}]})` | marks; links are `'link:https://…'`         |
| `image(src, alt)`                              | an `externalImage` block                       |
| `variation(...sections)`                       | an audience variation                          |
| `variant({regions: [...], audiences: [...]}, ...content)` | a variant section                   |
| `dflt(...content)`                             | the Default Audience section                   |

`article.expectBody(...)` waits for the Studio to save, then compares the stored body
with that spec (keys ignored, neighbouring spans with the same marks merged). If they
differ, the error shows both bodies in full.

**After every test**, the fixture also checks the stored body is well-formed: no
blocks loose in a variation, no duplicate keys, no marks without their link
definition, no nested variations, at most one default per variation. A test can pass
its own checks and still fail here.

**Studio helpers** (`support/studio.ts`) find blocks by their exact text, so give each
block in a test distinct text:

- Caret and selection: `caretIn(text, 'start' | 'end' | offset)`, `select(fromText, toText)`, `type`, `press`
- Wrapping: `wrapShortcut()` (Alt+Shift+V), `variationInsertButton()`
- Variation actions: `addVariant()`, `addDefault()`, `unwrap(variation, {confirm})`
- Sections: `sections()`, `sectionWith(text)`, `defaultSection()`, `sectionLabels()`,
  `sectionMenu(section, 'Remove variant')`, `pick(section, ...optionTitles)`, `openPicker(section)`
- Objects: `openInsertMenu()`, `object(previewText)`, `dragObject(objectText, targetText, 'before' | 'after')`
- Preview: `previewAs(...optionTitles)`

Option titles are in `support/audiences.ts` (`REGION.emea`, `AUDIENCE.partners`…), copied
from the test Studio's config.

## Adding a case from customer feedback

1. Write down the starting content and the steps, as the customer described them.
2. Add a test to the spec file for that area (`typing`, `clipboard`, `move`, `sections`…).
   For a group of reports from one customer, `e2e/customer-cases/<topic>.spec.ts` works
   too. Name the test after the behaviour, not the ticket, and put the ticket link in a
   comment.
3. Seed the closest body with `openArticle([...])`. If the customer's data is malformed,
   use `openArticle(body, {transform: (pt) => …})` to store exactly that shape (see
   `persistence.spec.ts`).
4. Assert what *should* happen. If that's not what happens today, mark it as a known bug
   so the suite stays green and the bug stays recorded:

   ```ts
   test('pasting X keeps Y', async ({studio, openArticle}) => {
     test.fail(true, 'Known bug: <what happens instead>. <ticket link>')
     // …
   })
   ```

   Once the bug is fixed, Playwright reports the test as "expected to fail, but
   passed". Then remove the `test.fail` line.

## Known bugs the suite records

- `undo.spec.ts`: Cmd+Z doesn't undo plugin actions (wrap, unwrap, removing a section).
  It does undo typing.
- `clipboard.spec.ts`: pasting body content that includes a whole variation into a
  section flattens it, and the pasted blocks come out in the wrong order.

## Layout

```
playwright.config.ts      starts the Studio, browser settings
e2e/
  support/
    env.ts                project, dataset, token, port
    client.ts             Sanity client for seeding, reading and cleanup
    body.ts               key-free body specs, conversion, well-formedness checks
    fixtures.ts           `test` with `openArticle` and `studio`
    studio.ts             page helpers
    audiences.ts          option titles from the Studio config
  *.spec.ts               one file per area
```

The plugin's containers and controls carry `data-audience-variation`,
`data-audience-section`, `data-section-key` and a few `data-testid`s for these tests.
Keep them when changing the UI.
