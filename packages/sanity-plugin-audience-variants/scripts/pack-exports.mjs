/**
 * npm, unlike pnpm, ignores `publishConfig.exports` when packing, so the
 * tarball would keep the `source` conditions pointing at src/. `prepack`
 * swaps them in (keeping a backup) and `postpack` restores the original.
 *
 *   node scripts/pack-exports.mjs apply|restore
 */
import {copyFileSync, existsSync, readFileSync, renameSync, writeFileSync} from 'node:fs'

const PKG = 'package.json'
const BACKUP = 'package.json.prepack'

if (process.argv[2] === 'apply') {
  copyFileSync(PKG, BACKUP)
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'))
  const {publishConfig: {exports, ...publishConfig} = {}} = pkg
  if (!exports) throw new Error('pack-exports: no publishConfig.exports to apply')
  pkg.exports = exports
  if (Object.keys(publishConfig).length) pkg.publishConfig = publishConfig
  else delete pkg.publishConfig
  writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n')
} else if (process.argv[2] === 'restore') {
  if (existsSync(BACKUP)) renameSync(BACKUP, PKG)
} else {
  throw new Error('Usage: node scripts/pack-exports.mjs apply|restore')
}
