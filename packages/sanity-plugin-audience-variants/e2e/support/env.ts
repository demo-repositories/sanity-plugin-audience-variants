import {readFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

/**
 * Where the e2e Studio points and how it signs in.
 *
 * - Project: `SANITY_STUDIO_PROJECT_ID`, else `studio/.env.local`.
 * - Dataset: `SANITY_E2E_DATASET`, else `e2e`. Never the Studio's own
 *   dataset, so tests can't touch real content.
 * - Token: `SANITY_E2E_TOKEN`, else the Sanity CLI's login
 *   (`~/.config/sanity/config.json`), so a logged-in developer needs no setup.
 *   It needs to belong to a user (or robot) that can edit the dataset.
 */

export const studioDir = fileURLToPath(new URL('../../../../studio', import.meta.url))

function readDotenv(path: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split('\n')
        .map((line) => line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map(([, k, v]) => [k, v.replace(/^(['"])(.*)\1$/, '$2')]),
    )
  } catch {
    return {}
  }
}

function cliToken(): string | undefined {
  try {
    const config = JSON.parse(readFileSync(join(homedir(), '.config/sanity/config.json'), 'utf8'))
    return typeof config.authToken === 'string' ? config.authToken : undefined
  } catch {
    return undefined
  }
}

const studioEnv = readDotenv(join(studioDir, '.env.local'))

export const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? studioEnv.SANITY_STUDIO_PROJECT_ID
export const dataset = process.env.SANITY_E2E_DATASET ?? 'e2e'
export const token = process.env.SANITY_E2E_TOKEN ?? cliToken()
export const port = Number(process.env.SANITY_E2E_PORT ?? 3334)
export const baseURL = `http://localhost:${port}`

/** Prefix for every document the suite creates; cleanup removes anything with it. */
export const DOC_PREFIX = 'e2e-'

export function assertEnv() {
  const missing = [
    !projectId && 'a project ID (studio/.env.local or SANITY_STUDIO_PROJECT_ID)',
    !token && 'a token (run `npx sanity login`, or set SANITY_E2E_TOKEN)',
  ].filter(Boolean)
  if (missing.length) throw new Error(`e2e setup: missing ${missing.join(' and ')}`)
}
