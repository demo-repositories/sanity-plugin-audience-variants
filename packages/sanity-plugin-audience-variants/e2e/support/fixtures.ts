import {randomUUID} from 'node:crypto'
import {expect, test as base} from '@playwright/test'
import {bodyProblems, type BodySpec, fromPortableText, toPortableText} from './body'
import {client} from './client'
import {DOC_PREFIX, projectId, token} from './env'
import {Studio} from './studio'

type ArticleDoc = {
  _id: string
  _type: 'article'
  title?: string
  body?: unknown[]
  audience?: unknown
}

/** A test article: its id, and ways to read what's stored. */
export class TestArticle {
  constructor(readonly id: string) {}

  /** The draft if there is one (the Studio writes drafts), else the published doc. */
  async raw(): Promise<ArticleDoc | undefined> {
    const docs = await client.fetch<ArticleDoc[]>(`*[_id in [$draft, $id]]`, {
      draft: `drafts.${this.id}`,
      id: this.id,
    })
    return docs.find((d) => d._id.startsWith('drafts.')) ?? docs[0]
  }

  /** The stored body as a key-free spec (see body.ts). */
  async body(): Promise<BodySpec[]> {
    return fromPortableText((await this.raw())?.body)
  }

  /**
   * Wait until the stored body equals `expected`. The Studio saves in the
   * background, so this polls.
   */
  async expectBody(expected: BodySpec[], options?: {timeout?: number}) {
    try {
      await expect
        .poll(() => this.body(), {timeout: options?.timeout ?? 15_000, intervals: [250, 500, 1000]})
        .toEqual(expected)
    } catch (error) {
      // Playwright's diff collapses nested arrays; show both bodies in full.
      const show = (b: unknown) => JSON.stringify(b, null, 2)
      ;(error as Error).message +=
        `\n\nExpected body:\n${show(expected)}\n\nStored body:\n${show(await this.body())}`
      throw error
    }
  }

  async expectAudience(expected: Record<string, string[]>) {
    await expect
      .poll(async () => {
        const audience = (await this.raw())?.audience as Record<string, unknown> | undefined
        return Object.fromEntries(
          Object.keys(expected).map((d) => [d, (audience?.[d] as string[] | undefined) ?? []]),
        )
      })
      .toEqual(expected)
  }
}

type Fixtures = {
  /** Create an article with this body (and title), and open it in the Studio. */
  openArticle: (
    body: BodySpec[],
    options?: {
      title?: string
      /** Edit the generated Portable Text before it's stored, e.g. to seed malformed data. */
      transform?: (body: ReturnType<typeof toPortableText>) => unknown[]
    },
  ) => Promise<TestArticle>
  studio: Studio
}

export const test = base.extend<Fixtures>({
  page: async ({page}, use) => {
    // Sign the Studio in: it reads its token from localStorage.
    await page.addInitScript(({key, value}) => window.localStorage.setItem(key, value), {
      key: `__studio_auth_token_${projectId}`,
      value: JSON.stringify({token}),
    })
    await use(page)
  },

  studio: async ({page}, use) => {
    await use(new Studio(page))
  },

  openArticle: async ({studio}, use, testInfo) => {
    const created: string[] = []
    await use(async (body, options) => {
      const id = `${DOC_PREFIX}${testInfo.workerIndex}-${randomUUID().slice(0, 8)}`
      created.push(id)
      await client.create(
        {
          _id: id,
          _type: 'article',
          title: options?.title ?? testInfo.title,
          body: (options?.transform ?? ((b) => b))(toPortableText(body)),
        },
        {visibility: 'sync'},
      )
      await studio.open(id)
      return new TestArticle(id)
    })

    // Whatever the test did, the stored body must stay well-formed.
    for (const id of created) {
      const article = new TestArticle(id)
      const problems = bodyProblems((await article.raw())?.body)
      expect(problems, `stored body of ${id} is malformed`).toEqual([])
    }
    if (!process.env.E2E_KEEP_DOCS && created.length) {
      const tx = client.transaction()
      created.forEach((id) => tx.delete(id).delete(`drafts.${id}`))
      await tx.commit({visibility: 'async'})
    }
  },
})

export {expect}
export * from './body'
export * from './audiences'
