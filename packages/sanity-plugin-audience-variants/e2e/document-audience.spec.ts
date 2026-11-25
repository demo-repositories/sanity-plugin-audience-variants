import {AUDIENCE, expect, REGION, test} from './support/fixtures'

test.describe('document audience field', () => {
  test('starts as the Default Audience, and stores picks per dimension', async ({
    studio,
    page,
    openArticle,
  }) => {
    const article = await openArticle(['Body'])

    const field = page.getByRole('button', {name: /Default Audience · everyone/})
    await expect(field).toBeVisible()
    await field.click()
    const popover = studio.popover()
    await studio.option(popover, REGION.emea).click()
    await studio.option(popover, AUDIENCE.partners).click()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('button', {name: 'EMEA · Partners'})).toBeVisible()
    await article.expectAudience({regions: ['emea'], audiences: ['partners']})
  })

  test('clearing every pick returns it to the Default Audience', async ({
    studio,
    page,
    openArticle,
  }) => {
    const article = await openArticle(['Body'])

    await page.getByRole('button', {name: /Default Audience · everyone/}).click()
    const popover = studio.popover()
    await studio.option(popover, REGION.emea).click()
    await article.expectAudience({regions: ['emea'], audiences: []})
    await studio.option(popover, REGION.emea).click()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('button', {name: /Default Audience · everyone/})).toBeVisible()
    await expect.poll(async () => (await article.raw())?.audience).toBeUndefined()
  })
})
