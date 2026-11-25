import {dflt, expect, test, variant, variation} from './support/fixtures'

const EMEA = {regions: ['emea'], audiences: ['partners']}
const seed = () => ['Intro', variation(variant(EMEA, 'V1', 'V2'), dflt('D1', 'D2')), 'Outro']

test.describe('cut, copy and paste', () => {
  test('copy a paragraph from a variant and paste it in the body', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(seed())
    await studio.select('V1')
    await studio.press('ControlOrMeta+c')
    await studio.caretIn('Outro')
    await studio.press('Enter', 'ControlOrMeta+v')
    await article.expectBody([...seed(), 'V1'])
  })

  test('cut a body paragraph and paste it into the default', async ({studio, openArticle}) => {
    const article = await openArticle(seed())
    await studio.select('Intro')
    await studio.press('ControlOrMeta+x')
    await studio.caretIn('D2')
    await studio.press('Enter', 'ControlOrMeta+v')
    // Cutting a whole paragraph's text leaves the (now empty) paragraph.
    await article.expectBody([
      '',
      variation(variant(EMEA, 'V1', 'V2'), dflt('D1', 'D2', 'Intro')),
      'Outro',
    ])
  })

  test('cut a paragraph out of the default and paste it in the body', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(seed())
    await studio.select('D1')
    await studio.press('ControlOrMeta+x')
    await studio.caretIn('Outro')
    await studio.press('Enter', 'ControlOrMeta+v')
    await article.expectBody([
      'Intro',
      variation(variant(EMEA, 'V1', 'V2'), dflt('', 'D2')),
      'Outro',
      'D1',
    ])
  })

  test('copy between two variations', async ({studio, openArticle}) => {
    const article = await openArticle([
      variation(variant(EMEA, 'First variant')),
      variation(dflt('Second default')),
    ])
    await studio.select('First variant')
    await studio.press('ControlOrMeta+c')
    await studio.caretIn('Second default')
    await studio.press('Enter', 'ControlOrMeta+v')
    await article.expectBody([
      variation(variant(EMEA, 'First variant')),
      variation(dflt('Second default', 'First variant')),
    ])
  })

  test('copying a whole variation and pasting it in the body duplicates it', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(seed())
    await studio.select('Intro', 'Outro')
    await studio.press('ControlOrMeta+c')
    await studio.caretIn('Outro')
    await studio.press('Enter', 'ControlOrMeta+v')
    await expect(studio.variations()).toHaveCount(2)
    // The fixture also checks the copy got its own keys.
    await article.expectBody([...seed(), ...seed()])
  })

  // A variation can't nest, so pasting one into a section flattens it, in order.
  test('pasting copied body text that contains a variation into a section keeps the order', async ({
    studio,
    openArticle,
  }) => {
    const article = await openArticle(seed())
    await studio.select('Intro', 'Outro')
    await studio.press('ControlOrMeta+c')
    await studio.caretIn('D2')
    await studio.press('Enter', 'ControlOrMeta+v')
    await article.expectBody(
      [
        'Intro',
        variation(
          variant(EMEA, 'V1', 'V2'),
          dflt('D1', 'D2', 'Intro', 'V1', 'V2', 'D1', 'D2', 'Outro'),
        ),
        'Outro',
      ],
      {timeout: 8000},
    )
  })

  test('pasting HTML from another app into a section', async ({studio, page, openArticle}) => {
    const article = await openArticle(seed())
    await page.evaluate(() =>
      navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob(['<p>Pasted one</p><p>Pasted <strong>two</strong></p>'], {
            type: 'text/html',
          }),
          'text/plain': new Blob(['Pasted one\n\nPasted two'], {type: 'text/plain'}),
        }),
      ]),
    )
    await studio.caretIn('D2')
    await studio.press('Enter', 'ControlOrMeta+v')
    await article.expectBody([
      'Intro',
      variation(
        variant(EMEA, 'V1', 'V2'),
        dflt('D1', 'D2', 'Pasted one', {
          spans: [{text: 'Pasted '}, {text: 'two', marks: ['strong']}],
        }),
      ),
      'Outro',
    ])
  })
})
