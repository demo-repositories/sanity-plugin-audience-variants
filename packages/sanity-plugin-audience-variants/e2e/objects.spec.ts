import {dflt, expect, test, variation} from './support/fixtures'

test.describe('block objects in sections', () => {
  test('the insert menu adds an external image inside a section', async ({
    studio,
    page,
    openArticle,
  }) => {
    const article = await openArticle(['Intro', variation(dflt('Everyone')), 'Outro'])

    await studio.caretIn('Everyone')
    const menu = await studio.openInsertMenu()
    await menu.getByRole('menuitem', {name: /External image/}).click()
    // The new object opens its edit dialog; fill it in.
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('URL').fill('https://example.com/new.png')
    await page.keyboard.press('Escape')

    await article.expectBody([
      'Intro',
      variation(dflt('Everyone', {_type: 'externalImage', src: 'https://example.com/new.png'})),
      'Outro',
    ])
  })

  test("Sanity's table is offered at the top level but not inside a section", async ({
    studio,
    page,
    openArticle,
  }) => {
    await openArticle(['Intro', variation(dflt('Everyone')), 'Outro'])

    await studio.caretIn('Intro')
    let menu = await studio.openInsertMenu()
    await expect(menu.getByRole('menuitem').filter({hasText: /^Table$/})).toBeEnabled()
    await page.keyboard.press('Escape')

    await studio.caretIn('Everyone')
    menu = await studio.openInsertMenu()
    await expect(menu.getByRole('menuitem').filter({hasText: /^Table$/})).toBeDisabled()
    await expect(menu.getByRole('menuitem', {name: /External image/})).toBeEnabled()
    await expect(menu.getByRole('menuitem', {name: /Table \(plain\)/})).toBeEnabled()
  })
})
