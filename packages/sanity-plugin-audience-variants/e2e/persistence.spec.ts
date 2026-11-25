import {AUDIENCE, dflt, expect, REGION, test, variant, variation} from './support/fixtures'

test.describe('saving and loading', () => {
  test('edits survive a reload', async ({studio, page, openArticle}) => {
    const article = await openArticle(['Intro', 'Middle', 'Outro'])

    await studio.caretIn('Middle')
    await studio.wrapShortcut()
    await studio.addVariant()
    await studio.type('For APAC')
    await studio.pick(studio.sectionWith('For APAC'), REGION.apac, AUDIENCE.customers)
    const expected = [
      'Intro',
      variation(variant({regions: ['apac'], audiences: ['customers']}, 'For APAC'), dflt('Middle')),
      'Outro',
    ]
    await article.expectBody(expected)

    await page.reload()
    await expect(studio.editor).toHaveAttribute('data-read-only', 'false', {timeout: 30_000})
    expect(await studio.sectionLabels()).toEqual(['APAC · Customers', 'Default Audience'])
    await expect(studio.block('For APAC')).toBeVisible()
    await article.expectBody(expected)
  })

  test('a stored body with a block loose in a variation is repaired on open', async ({
    studio,
    openArticle,
  }) => {
    // The editor has been seen to leave a bare block directly in `variants`;
    // the plugin moves it back into the section above.
    const article = await openArticle(
      [
        'Intro',
        variation(variant({regions: ['emea'], audiences: ['partners']}, 'V1'), dflt('D1')),
        'Outro',
      ],
      {
        transform: (body) =>
          body.map((node) => {
            if (node._type !== 'audienceVariation') return node
            const [first, ...rest] = node.variants as object[]
            const stray = {
              _type: 'block',
              _key: 'stray',
              style: 'normal',
              markDefs: [],
              children: [{_type: 'span', _key: 'stray-span', text: 'Stray', marks: []}],
            }
            return {...node, variants: [first, stray, ...rest]}
          }),
      },
    )

    await article.expectBody([
      'Intro',
      variation(variant({regions: ['emea'], audiences: ['partners']}, 'V1', 'Stray'), dflt('D1')),
      'Outro',
    ])
    await expect(studio.sectionWith('Stray')).toHaveAttribute('data-audience-section', 'variant')
  })
})
