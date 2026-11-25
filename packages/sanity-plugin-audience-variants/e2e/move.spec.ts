import {dflt, image, test, variant, variation} from './support/fixtures'

/**
 * Moving block objects by dragging them. Only block objects (images,
 * tables) have a drag handle; text and variations are moved with cut/paste
 * (see clipboard.spec.ts).
 */
const EMEA = {regions: ['emea'], audiences: ['partners']}
const pic = image('https://example.com/a.png', 'A picture')

test.describe('dragging block objects', () => {
  test('from the body into a section', async ({studio, openArticle}) => {
    const article = await openArticle([
      'Intro',
      pic,
      variation(variant(EMEA, 'V1', 'V2'), dflt('D1')),
      'Outro',
    ])
    await studio.dragObject('A picture', 'V1', 'after')
    await article.expectBody([
      'Intro',
      variation(variant(EMEA, 'V1', pic, 'V2'), dflt('D1')),
      'Outro',
    ])
  })

  test('out of a section into the body', async ({studio, openArticle}) => {
    const article = await openArticle(['Intro', variation(dflt('D1', pic, 'D2')), 'Outro'])
    await studio.dragObject('A picture', 'Outro', 'before')
    await article.expectBody(['Intro', variation(dflt('D1', 'D2')), pic, 'Outro'])
  })

  test('from one section to another', async ({studio, openArticle}) => {
    const article = await openArticle([variation(variant(EMEA, 'V1', pic), dflt('D1'))])
    await studio.dragObject('A picture', 'D1', 'after')
    await article.expectBody([variation(variant(EMEA, 'V1'), dflt('D1', pic))])
  })

  test('within a section', async ({studio, openArticle}) => {
    const article = await openArticle([variation(dflt('D1', pic, 'D2', 'D3'))])
    await studio.dragObject('A picture', 'D3', 'after')
    await article.expectBody([variation(dflt('D1', 'D2', 'D3', pic))])
  })
})
