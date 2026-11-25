import {AUDIENCE, dflt, expect, REGION, test, variant, variation} from './support/fixtures'

test.describe('audience targeting', () => {
  test('picking on the default turns it into a variant for that pick', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle([
      variation(
        variant({regions: ['emea'], audiences: ['partners']}, 'EMEA partners'),
        dflt('Everyone'),
      ),
    ])

    const popover = await studio.openPicker(studio.defaultSection())
    await studio.option(popover, REGION.apac).click()

    // The picker stays open on the converted section, so you can keep picking.
    await expect(popover).toBeVisible()
    await studio.option(popover, AUDIENCE.customers).click()
    await studio.press('Escape')

    expect(await studio.sectionLabels()).toEqual(['EMEA · Partners', 'APAC · Customers'])
    await article.expectBody([
      variation(
        variant({regions: ['emea'], audiences: ['partners']}, 'EMEA partners'),
        variant({regions: ['apac'], audiences: ['customers']}, 'Everyone'),
      ),
    ])
  })

  test('options that would reach a reader another variant reaches are disabled', async ({
    studio,
    openArticle,
  }) => {
    await openArticle([
      variation(
        variant({regions: ['emea'], audiences: ['partners']}, 'EMEA partners'),
        variant({audiences: ['partners']}, 'Other partners'),
      ),
    ])

    const popover = await studio.openPicker(studio.sectionWith('Other partners'))

    // EMEA × Partners is taken by the first variant…
    await expect(studio.option(popover, REGION.emea)).toBeDisabled()
    await expect(popover.getByText('In another variant')).toHaveCount(1)
    // …the other regions are free.
    await expect(studio.option(popover, REGION.apac)).toBeEnabled()
    await expect(studio.option(popover, REGION.americas)).toBeEnabled()
  })

  test('"Select all" skips values another variant already has', async ({studio, openArticle}) => {
    const article = await openArticle([
      variation(
        variant({regions: ['emea'], audiences: ['partners']}, 'EMEA partners'),
        variant({audiences: ['partners']}, 'Other partners'),
      ),
    ])

    const popover = await studio.openPicker(studio.sectionWith('Other partners'))
    await popover.getByRole('button', {name: 'Select all'}).first().click()
    await studio.press('Escape')

    await article.expectBody([
      variation(
        variant({regions: ['emea'], audiences: ['partners']}, 'EMEA partners'),
        variant({regions: ['americas', 'apac'], audiences: ['partners']}, 'Other partners'),
      ),
    ])
  })

  test('overlapping variants (e.g. from an import) are flagged', async ({studio, openArticle}) => {
    await openArticle([
      variation(
        variant({regions: ['emea'], audiences: ['partners']}, 'First'),
        variant({regions: ['emea', 'apac'], audiences: ['partners']}, 'Second'),
      ),
    ])

    const label = studio.sectionLabel(studio.sectionWith('First')).locator('[title]')
    await expect(label).toHaveAttribute(
      'title',
      'Also reached by another variant: Europe, Middle East and Africa (EMEA) × Resellers & Partners',
    )
  })

  test('the default says "none left" when variants already reach every reader', async ({
    studio,
    openArticle,
  }) => {
    await openArticle([
      variation(
        variant(
          {
            regions: ['americas', 'emea', 'apac'],
            audiences: ['customers', 'partners', 'employees'],
          },
          'All',
        ),
        dflt('Nobody'),
      ),
    ])

    await expect(studio.sectionLabel(studio.defaultSection())).toHaveText(
      'Default Audience · none left',
    )
  })
})
