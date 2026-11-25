import {createClient} from '@sanity/client'
import {assertEnv, dataset, DOC_PREFIX, projectId, token} from './env'

assertEnv()

/** Raw perspective, so drafts and published documents are both visible. */
export const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: '2025-02-19',
  useCdn: false,
  perspective: 'raw',
})

/** Delete every document the suite created (published and drafts). */
export async function deleteTestDocuments(prefix = DOC_PREFIX) {
  const ids = await client.fetch<string[]>(
    `*[string::startsWith(_id, $prefix) || string::startsWith(_id, $draft)]._id`,
    {prefix, draft: `drafts.${prefix}`},
  )
  if (!ids.length) return
  const tx = client.transaction()
  ids.forEach((id) => tx.delete(id))
  await tx.commit({visibility: 'async'})
}
