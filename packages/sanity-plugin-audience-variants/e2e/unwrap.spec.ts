import {dflt, expect, test, variant, variation} from './support/fixtures'

const EMEA = {regions: ['emea'], audiences: ['partners']}
const APAC = {regions: ['apac'], audiences: ['partners']}

test.describe('unwrapping a variation', () => {
  test('keeps the default content as plain text and discards variants', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle([
      'Intro',
      variation(variant(EMEA, 'EMEA'), variant(APAC, 'APAC'), dflt('Everyone', 'Everyone 2')),
      'Outro',
    ])

    const confirm = await studio.unwrap(undefined, {confirm: false})
    await expect(confirm).toHaveText('Keep “Default Audience”, discard 2 variant(s)')
    await confirm.click()

    await expect(studio.variations()).toHaveCount(0)
    await article.expectBody(['Intro', 'Everyone', 'Everyone 2', 'Outro'])
  })

  test('with only a default, asks for a plain confirmation', async ({studio, openArticle}) => {
    const article = await openArticle(['Intro', variation(dflt('Everyone')), 'Outro'])

    const confirm = await studio.unwrap(undefined, {confirm: false})
    await expect(confirm).toHaveText('Confirm unwrap')
    await confirm.click()

    await article.expectBody(['Intro', 'Everyone', 'Outro'])
  })

  test('without a default, removes the block', async ({studio, openArticle}) => {
    const article = await openArticle(['Intro', variation(variant(EMEA, 'EMEA')), 'Outro'])

    const confirm = await studio.unwrap(undefined, {confirm: false})
    await expect(confirm).toHaveText('No “Default Audience” — remove block')
    await confirm.click()

    await article.expectBody(['Intro', 'Outro'])
  })

  test('Cancel leaves the variation alone', async ({studio, openArticle}) => {
    const body = ['Intro', variation(variant(EMEA, 'EMEA'), dflt('Everyone')), 'Outro']
    const article = await openArticle(body)

    await studio.unwrap(undefined, {confirm: false})
    const actions = await studio.variationActions()
    await actions.getByRole('button', {name: 'Cancel'}).click()

    await expect(actions.getByRole('button', {name: 'Unwrap', exact: true})).toBeVisible()
    await expect(studio.variations()).toHaveCount(1)
    await article.expectBody(body)
  })

  test('unwrapped text can be edited and wrapped again', async ({studio, openArticle}) => {
    const article = await openArticle(['Intro', variation(dflt('Everyone')), 'Outro'])

    await studio.unwrap()
    await studio.caretIn('Everyone')
    await studio.type(' here')
    await article.expectBody(['Intro', 'Everyone here', 'Outro'])

    await studio.wrapShortcut()
    await article.expectBody(['Intro', variation(dflt('Everyone here')), 'Outro'])
  })
})
