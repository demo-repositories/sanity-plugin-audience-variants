import {deleteTestDocuments} from './client'

export default async function globalTeardown() {
  // Keep documents around for debugging with E2E_KEEP_DOCS=1.
  if (!process.env.E2E_KEEP_DOCS) await deleteTestDocuments()
}
