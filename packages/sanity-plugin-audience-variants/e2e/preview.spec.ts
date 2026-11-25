import {AUDIENCE, dflt, expect, REGION, test, variant, variation} from './support/fixtures'

const seed = () => [
  'Intro',
  variation(
    variant({regions: ['emea'], audiences: ['partners']}, 'EMEA partners'),
    dflt('Everyone else'),
  ),
  variation(variant({regions: ['apac'], audiences: ['customers']}, 'APAC customers only')),
  'Outro',
]

test.describe('"Preview as"', () => {
  test('shows only what a matching reader sees, read-only', async ({studio, page, openArticle}) => {
    await openArticle(seed())

    await studio.previewAs(REGION.emea, AUDIENCE.partners)

    await expect(page.getByText('Read-only preview')).toBeVisible()
    await expect(studio.editor).toHaveAttribute('data-read-only', 'true')
    await expect(studio.block('EMEA partners')).toBeVisible()
    await expect(studio.block('Everyone else')).toBeHidden()
    // A variation with nothing for this reader disappears entirely.
    await expect(studio.variation(1)).toBeHidden()
    await expect(studio.block('Intro')).toBeVisible()
  })

  test('readers no variant targets see the default', async ({studio, openArticle}) => {
    await openArticle(seed())

    await studio.previewAs(REGION.americas, AUDIENCE.employees)

    await expect(studio.block('Everyone else')).toBeVisible()
    await expect(studio.block('EMEA partners')).toBeHidden()
    await expect(studio.block('APAC customers only')).toBeHidden()
  })

  test('a broad filter shows every section that applies, labelled', async ({
    studio,
    openArticle,
  }) => {
    await openArticle(seed())

    // EMEA, any audience: partners get the variant, the rest the default.
    await studio.previewAs(REGION.emea)

    await expect(studio.block('EMEA partners')).toBeVisible()
    await expect(studio.block('Everyone else')).toBeVisible()
    await expect(studio.variation(0).getByText('EMEA · Partners')).toBeVisible()
    await expect(studio.variation(0).getByText('Default Audience')).toBeVisible()
  })

  test('"Back to editing" restores the editor', async ({studio, page, openArticle}) => {
    const article = await openArticle(seed())

    await studio.previewAs(REGION.emea, AUDIENCE.partners)
    await page.getByTestId('field-body').getByRole('button', {name: 'Back to editing'}).click()

    await expect(studio.editor).toHaveAttribute('data-read-only', 'false')
    await expect(studio.block('Everyone else')).toBeVisible()
    await expect(studio.block('APAC customers only')).toBeVisible()

    await studio.caretIn('Everyone else')
    await studio.type('!')
    await article.expectBody([
      'Intro',
      variation(
        variant({regions: ['emea'], audiences: ['partners']}, 'EMEA partners'),
        dflt('Everyone else!'),
      ),
      variation(variant({regions: ['apac'], audiences: ['customers']}, 'APAC customers only')),
      'Outro',
    ])
  })
})
