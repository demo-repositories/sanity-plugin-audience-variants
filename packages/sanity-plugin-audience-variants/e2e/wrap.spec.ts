import {block, dflt, expect, image, test, variation} from './support/fixtures'

test.describe('wrapping text in a variation', () => {
  test('Alt+Shift+V wraps the paragraph at the caret', async ({studio, openArticle}) => {
    const article = await openArticle(['Intro', 'Middle', 'Outro'])

    await studio.caretIn('Middle')
    await studio.wrapShortcut()

    await expect(studio.variations()).toHaveCount(1)
    expect(await studio.sectionLabels()).toEqual(['Default Audience'])
    await article.expectBody(['Intro', variation(dflt('Middle')), 'Outro'])
  })

  test('Alt+Shift+V wraps every selected paragraph into one default section', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(['Intro', 'First', 'Second', 'Third', 'Outro'])

    await studio.select('First', 'Third')
    await studio.wrapShortcut()

    await article.expectBody(['Intro', variation(dflt('First', 'Second', 'Third')), 'Outro'])
  })
})

test.describe('wrapping: toolbar and edge cases', () => {
  test('the toolbar button wraps the selection, like the shortcut', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(['Intro', 'First', 'Second', 'Outro'])

    await studio.select('First', 'Second')
    await studio.variationInsertButton().click()

    await article.expectBody(['Intro', variation(dflt('First', 'Second')), 'Outro'])
  })

  test('the toolbar button with just a caret inserts an empty variation to type in', async ({
    studio,
    page,
    openArticle,
  }) => {
    const article = await openArticle(['Intro', 'Outro'])

    await studio.caretIn('Outro')
    await studio.variationInsertButton().click()
    // The caret moves into the new variation once it's rendered.
    await expect(studio.variations()).toHaveCount(1)
    await page.waitForTimeout(300)
    await studio.type('New content')

    await article.expectBody(['Intro', 'Outro', variation(dflt('New content'))])
  })

  test('links and marks survive wrapping', async ({studio, openArticle}) => {
    const rich = block({
      spans: [
        {text: 'Read '},
        {text: 'the guide', marks: ['link:https://example.com/guide']},
        {text: ' now', marks: ['strong']},
      ],
    })
    const article = await openArticle(['Intro', rich, 'Outro'])

    await studio.caretIn('Read the guide now')
    await studio.wrapShortcut()

    await article.expectBody(['Intro', variation(dflt(rich)), 'Outro'])
  })

  test('a selection spanning text and a block object wraps them all', async ({
    studio,
    openArticle,
  }) => {
    const pic = image('https://example.com/a.png', 'A picture')
    const article = await openArticle(['Intro', 'Before', pic, 'After', 'Outro'])

    await studio.select('Before', 'After')
    await studio.wrapShortcut()

    await article.expectBody(['Intro', variation(dflt('Before', pic, 'After')), 'Outro'])
  })

  test('does nothing when the selection reaches into a variation', async ({
    studio,
    page,
    openArticle,
  }) => {
    const body = ['Intro', variation(dflt('Inside')), 'Outro']
    const article = await openArticle(body)

    await studio.select('Intro', 'Inside')
    await studio.wrapShortcut()
    await page.waitForTimeout(1500)

    await expect(studio.variations()).toHaveCount(1)
    await article.expectBody(body)
  })

  test('does nothing inside a variation (variations never nest)', async ({
    studio,
    page,
    openArticle,
  }) => {
    const body = ['Intro', variation(dflt('Inside')), 'Outro']
    const article = await openArticle(body)

    await studio.caretIn('Inside')
    await studio.wrapShortcut()
    await page.waitForTimeout(1500)

    await expect(studio.variationInsertButton()).toBeDisabled()
    await article.expectBody(body)
  })
})
