import {deleteTestDocuments} from './client'
import {dataset} from './env'

/** Start clean: remove documents an interrupted earlier run left behind. */
export default async function globalSetup() {
  if (dataset === 'production') throw new Error('e2e: refusing to run against `production`')
  await deleteTestDocuments()
}
