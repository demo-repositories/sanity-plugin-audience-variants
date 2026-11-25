import {dflt, expect, test, variant, variation} from './support/fixtures'

/**
 * Long lists: the `scale` workspace of the test Studio has 20 regions and 20
 * audiences (studio/sanity.config.ts). The pickers must fit the window and
 * scroll, sort values alphabetically, and filter by search; labels must stay
 * short however many values are picked.
 */

const slug = (title: string) => title.toLowerCase().replace(/[^a-z]+/g, '-')
const ALL_REGIONS = [
  'Australia & New Zealand',
  'Caribbean',
  'Central & Eastern Europe',
  'Central Asia',
  'East Asia',
  'Greater China',
  'Japan',
  'Korea',
  'Latin America',
  'Middle East',
  'Nordics',
  'North Africa',
  'North America',
  'Northern Europe',
  'Pacific Islands',
  'South Asia',
  'Southeast Asia',
  'Southern Europe',
  'Sub-Saharan Africa',
  'Western Europe',
]
const open = {workspace: 'scale'}

test.describe('with 20 values per dimension', () => {
  test('the picker fits the window and scrolls to the last option', async ({
    studio,
    page,
    openArticle,
  }) => {
    const article = await openArticle(
      [variation(variant({}, 'Targeted'), dflt('Everyone')), 'After'],
      open,
    )

    const popover = await studio.openPicker(studio.sectionWith('Targeted'))
    const box = await popover.boundingBox()
    const viewport = page.viewportSize()!
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)

    // The last audience alphabetically is far below the fold; it can still be ticked.
    const last = studio.option(popover, 'Students')
    await last.scrollIntoViewIfNeeded()
    await last.click()
    await expect(last).toBeChecked()
    await page.keyboard.press('Escape')

    await article.expectBody([
      variation(variant({audiences: ['students']}, 'Targeted'), dflt('Everyone')),
      'After',
    ])
  })

  test('options are listed alphabetically', async ({studio, openArticle}) => {
    await openArticle([variation(variant({}, 'Targeted'), dflt('Everyone'))], open)

    const popover = await studio.openPicker(studio.sectionWith('Targeted'))
    const regions = await popover
      .getByRole('checkbox')
      .evaluateAll((els) => els.map((el) => el.closest('label')?.textContent ?? ''))
    expect(regions.slice(0, ALL_REGIONS.length)).toEqual(ALL_REGIONS)
  })

  test('searching filters the options, and "Select matching" ticks only those', async ({
    studio,
    page,
    openArticle,
  }) => {
    const article = await openArticle([variation(variant({}, 'Targeted'), dflt('Everyone'))], open)

    const popover = await studio.openPicker(studio.sectionWith('Targeted'))
    await popover.getByRole('textbox', {name: /Search/}).fill('eur')

    const europe = [
      'Central & Eastern Europe',
      'Northern Europe',
      'Southern Europe',
      'Western Europe',
    ]
    await expect(popover.getByRole('checkbox')).toHaveCount(europe.length)
    // The audiences group has no matches, so it's hidden.
    await expect(popover.getByText('Audiences', {exact: true})).toBeHidden()

    await popover.getByRole('button', {name: 'Select matching'}).click()
    for (const title of europe) await expect(studio.option(popover, title)).toBeChecked()

    await popover.getByRole('textbox', {name: /Search/}).fill('zzz')
    await expect(popover.getByText('Nothing matches “zzz”')).toBeVisible()
    await page.keyboard.press('Escape')

    await article.expectBody([
      variation(variant({regions: europe.map(slug)}, 'Targeted'), dflt('Everyone')),
    ])
    expect(await studio.sectionLabels()).toEqual(['4 regions', 'Default Audience'])
  })

  test('labels count picks instead of listing them', async ({studio, openArticle}) => {
    const allButJapan = ALL_REGIONS.filter((t) => t !== 'Japan').map(slug)
    const audiences = ['customers', 'developers', 'employees', 'investors', 'students']
    await openArticle(
      [
        variation(
          variant({regions: allButJapan, audiences}, 'Broad'),
          variant({regions: ['japan'], audiences: ['students', 'customers']}, 'Narrow'),
          dflt('Everyone'),
        ),
      ],
      open,
    )

    expect(await studio.sectionLabels()).toEqual([
      'All regions except Japan · 5 audiences',
      'Japan · Customers, Students',
      'Default Audience',
    ])
    // Hovering still names every pick.
    await expect(
      studio.sectionLabel(studio.sectionWith('Broad')).locator('[title]'),
    ).toHaveAttribute(
      'title',
      /Australia & New Zealand, Caribbean, .* · Customers, Developers, Employees, Investors, Students/,
    )
  })
})
