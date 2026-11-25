import {dflt, test, variant, variation} from './support/fixtures'

/**
 * Typing at the edges of sections. Text must stay in the section it was
 * typed in, and keys like Enter and Backspace must never leave blocks loose
 * in a variation (the fixture checks that after every test).
 */
const EMEA = {regions: ['emea'], audiences: ['partners']}
const seed = () => ['Intro', variation(variant(EMEA, 'V1', 'V2'), dflt('D1', 'D2')), 'Outro']

test.describe('typing inside sections', () => {
  test('Enter at the end of a section adds a paragraph to that section', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(seed())
    await studio.caretIn('V2')
    await studio.press('Enter')
    await studio.type('V3')
    await article.expectBody([
      'Intro',
      variation(variant(EMEA, 'V1', 'V2', 'V3'), dflt('D1', 'D2')),
      'Outro',
    ])
  })

  test('Enter twice at the end of a variant stays in the variant', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(seed())
    await studio.caretIn('V2')
    await studio.press('Enter', 'Enter')
    await studio.type('X')
    await article.expectBody([
      'Intro',
      variation(variant(EMEA, 'V1', 'V2', '', 'X'), dflt('D1', 'D2')),
      'Outro',
    ])
  })

  test('Enter twice at the end of the default stays in the default', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(seed())
    await studio.caretIn('D2')
    await studio.press('Enter', 'Enter')
    await studio.type('X')
    await article.expectBody([
      'Intro',
      variation(variant(EMEA, 'V1', 'V2'), dflt('D1', 'D2', '', 'X')),
      'Outro',
    ])
  })

  test('Backspace at the start of a section does not merge it with what is above', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(seed())
    await studio.caretIn('V1', 'start')
    await studio.press('Backspace')
    await studio.type('X')
    await studio.caretIn('D1', 'start')
    await studio.press('Backspace')
    await studio.type('Y')
    await article.expectBody([
      'Intro',
      variation(variant(EMEA, 'XV1', 'V2'), dflt('YD1', 'D2')),
      'Outro',
    ])
  })

  test('Backspace after a variation and Delete before one leave it alone', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(seed())
    await studio.caretIn('Outro', 'start')
    await studio.press('Backspace')
    await studio.type('X')
    await studio.caretIn('Intro')
    await studio.press('Delete')
    await studio.type('Y')
    await article.expectBody([
      'IntroY',
      variation(variant(EMEA, 'V1', 'V2'), dflt('D1', 'D2')),
      'XOutro',
    ])
  })

  test('deleting a selection within a section keeps the rest of the variation', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(seed())
    await studio.select('V1', 'V2')
    await studio.press('Backspace')
    await studio.type('X')
    await article.expectBody(['Intro', variation(variant(EMEA, 'X'), dflt('D1', 'D2')), 'Outro'])
  })

  test('deleting a selection across two sections empties the text but keeps both sections', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(seed())
    await studio.select('V2', 'D1')
    await studio.press('Backspace')
    await studio.type('X')
    await article.expectBody([
      'Intro',
      variation(variant(EMEA, 'V1', 'X'), dflt('', 'D2')),
      'Outro',
    ])
  })

  test('deleting a selection from body text into a section keeps the variation', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(seed())
    await studio.select('Intro', 'V1')
    await studio.press('Backspace')
    await studio.type('X')
    await article.expectBody(['X', variation(variant(EMEA, '', 'V2'), dflt('D1', 'D2')), 'Outro'])
  })
})
