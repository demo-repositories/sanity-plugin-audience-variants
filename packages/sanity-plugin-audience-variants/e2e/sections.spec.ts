import {AUDIENCE, dflt, expect, REGION, test, variant, variation} from './support/fixtures'

const EMEA_PARTNERS = {regions: ['emea'], audiences: ['partners']}

test.describe('adding sections', () => {
  test('"+ Variant" adds an untargeted variant above the default and puts the caret in it', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(['Intro', variation(dflt('Everyone')), 'Outro'])

    await studio.addVariant()
    expect(await studio.sectionLabels()).toEqual(['Set audience variant…', 'Default Audience'])

    await studio.type('Only some')
    await article.expectBody([
      'Intro',
      variation(variant({}, 'Only some'), dflt('Everyone')),
      'Outro',
    ])
  })

  test('new variants go after the last variant', async ({studio, openArticle}) => {
    const article = await openArticle([
      variation(variant(EMEA_PARTNERS, 'EMEA partners'), dflt('Everyone')),
    ])

    await studio.addVariant()
    await studio.type('Second')

    await article.expectBody([
      variation(variant(EMEA_PARTNERS, 'EMEA partners'), variant({}, 'Second'), dflt('Everyone')),
    ])
  })

  test('picking audiences targets the variant and updates its label', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle([variation(variant({}, 'Targeted'), dflt('Everyone'))])

    await studio.pick(studio.sectionWith('Targeted'), REGION.emea, AUDIENCE.partners)

    await expect(studio.sectionLabel(studio.sectionWith('Targeted'))).toHaveText('EMEA · Partners')
    await article.expectBody([variation(variant(EMEA_PARTNERS, 'Targeted'), dflt('Everyone'))])
  })

  test('picking every value in a dimension reads "All …"', async ({studio, openArticle}) => {
    await openArticle([variation(variant({}, 'Targeted'))])

    await studio.pick(
      studio.sectionWith('Targeted'),
      REGION.americas,
      REGION.emea,
      REGION.apac,
      AUDIENCE.partners,
    )

    await expect(studio.sectionLabel(studio.sectionWith('Targeted'))).toHaveText(
      'All regions · Partners',
    )
  })

  test('"+ Default Audience" adds a default last, then disappears', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle([variation(variant(EMEA_PARTNERS, 'EMEA partners'))])

    await studio.addDefault()
    await studio.type('Everyone else')

    expect(await studio.sectionLabels()).toEqual(['EMEA · Partners', 'Default Audience'])
    const actions = await studio.variationActions()
    await expect(actions.getByRole('button', {name: 'Default Audience', exact: true})).toHaveCount(
      0,
    )
    await article.expectBody([
      variation(variant(EMEA_PARTNERS, 'EMEA partners'), dflt('Everyone else')),
    ])
  })
})

test.describe('section menu', () => {
  test('"Duplicate as new variant" copies content, links included, into an untargeted variant', async ({
    studio,
    openArticle,
  }) => {
    const linked = {
      spans: [{text: 'See '}, {text: 'the docs', marks: ['link:https://example.com/docs']}],
    }
    const article = await openArticle([variation(variant(EMEA_PARTNERS, linked), dflt('Everyone'))])

    await studio.sectionMenu(studio.sections().first(), 'Duplicate as new variant')

    await article.expectBody([
      variation(variant(EMEA_PARTNERS, linked), variant({}, linked), dflt('Everyone')),
    ])
  })

  test('duplicating the default makes an untargeted variant with its content', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle([variation(dflt('Everyone'))])

    await studio.sectionMenu(studio.defaultSection(), 'Duplicate as new variant')

    await article.expectBody([variation(variant({}, 'Everyone'), dflt('Everyone'))])
  })

  test('"Use as Default Audience" turns a variant into the default', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle([
      variation(
        variant(EMEA_PARTNERS, 'EMEA partners'),
        variant({regions: ['apac'], audiences: ['partners']}, 'APAC partners'),
      ),
    ])

    await studio.sectionMenu(studio.sectionWith('EMEA partners'), /^Use as “Default Audience”/)

    expect(await studio.sectionLabels()).toEqual(['APAC · Partners', 'Default Audience'])
    await article.expectBody([
      variation(
        variant({regions: ['apac'], audiences: ['partners']}, 'APAC partners'),
        dflt('EMEA partners'),
      ),
    ])
  })

  test('"Use as Default Audience" is not offered when there already is one', async ({
    studio,
    page,
    openArticle,
  }) => {
    await openArticle([variation(variant(EMEA_PARTNERS, 'EMEA partners'), dflt('Everyone'))])

    const section = studio.sectionWith('EMEA partners')
    await section.hover()
    await section.getByTestId('section-menu').click()
    await expect(page.getByRole('menuitem', {name: 'Remove variant'})).toBeVisible()
    await expect(page.getByRole('menuitem', {name: /Use as/})).toHaveCount(0)
  })

  test('"Remove variant" removes just that variant', async ({studio, openArticle}) => {
    const article = await openArticle([
      'Intro',
      variation(variant(EMEA_PARTNERS, 'EMEA partners'), dflt('Everyone')),
    ])

    await studio.sectionMenu(studio.sectionWith('EMEA partners'), 'Remove variant')

    await article.expectBody(['Intro', variation(dflt('Everyone'))])
  })

  test('"Remove Default Audience" removes the default', async ({studio, openArticle}) => {
    const article = await openArticle([
      variation(variant(EMEA_PARTNERS, 'EMEA partners'), dflt('Everyone')),
    ])

    await studio.sectionMenu(studio.defaultSection(), 'Remove “Default Audience”')

    await article.expectBody([variation(variant(EMEA_PARTNERS, 'EMEA partners'))])
    // With the default gone, the variation offers to add one again.
    const actions = await studio.variationActions()
    await expect(actions.getByRole('button', {name: 'Default Audience', exact: true})).toBeVisible()
  })

  test('removing the last section removes the whole variation', async ({studio, openArticle}) => {
    const article = await openArticle(['Intro', variation(dflt('Everyone')), 'Outro'])

    await studio.sectionMenu(studio.defaultSection(), 'Remove “Default Audience”')

    await expect(studio.variations()).toHaveCount(0)
    await article.expectBody(['Intro', 'Outro'])
  })
})
