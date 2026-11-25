import {dflt, test, variant, variation} from './support/fixtures'

const EMEA = {regions: ['emea'], audiences: ['partners']}
const seed = () => ['Intro', variation(variant(EMEA, 'V1'), dflt('D1')), 'Outro']

test.describe('undo', () => {
  test('undoes typing inside a section', async ({studio, page, openArticle}) => {
    const article = await openArticle(seed())
    await studio.caretIn('V1')
    await studio.type(' more')
    await article.expectBody(['Intro', variation(variant(EMEA, 'V1 more'), dflt('D1')), 'Outro'])
    await page.waitForTimeout(1000) // let the typing close its undo step
    await studio.undo()
    await article.expectBody(seed())
  })

  test('undoes wrapping', async ({studio, openArticle}) => {
    const article = await openArticle(['Intro', 'Middle', 'Outro'])
    await studio.caretIn('Middle')
    await studio.wrapShortcut()
    await article.expectBody(['Intro', variation(dflt('Middle')), 'Outro'])
    await studio.undo()
    await article.expectBody(['Intro', 'Middle', 'Outro'], {timeout: 5000})
  })

  test('undoes unwrapping', async ({studio, openArticle}) => {
    const article = await openArticle(seed())
    await studio.caretIn('V1')
    await studio.unwrap()
    await article.expectBody(['Intro', 'D1', 'Outro'])
    await studio.undo()
    await article.expectBody(seed(), {timeout: 5000})
  })

  test('undoes removing a variant', async ({studio, openArticle}) => {
    const article = await openArticle(seed())
    await studio.caretIn('V1')
    await studio.sectionMenu(studio.sectionWith('V1'), 'Remove variant')
    await article.expectBody(['Intro', variation(dflt('D1')), 'Outro'])
    // The menu unmounts with the removed section, so focus falls to <body>; click back in.
    await studio.caretIn('D1')
    await studio.undo()
    await article.expectBody(seed(), {timeout: 5000})
  })
})
