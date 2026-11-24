import {fileURLToPath} from 'node:url'
import {defineCliConfig} from 'sanity/cli'

const pluginSrc = (path: string) =>
  fileURLToPath(new URL(`../packages/sanity-plugin-audience-variants/src/${path}`, import.meta.url))

type Alias = {find: string | RegExp; replacement: string}
const toAliasArray = (alias: readonly Alias[] | Record<string, string> | undefined): Alias[] =>
  Array.isArray(alias)
    ? [...alias]
    : Object.entries(alias ?? {}).map(([find, replacement]) => ({find, replacement}))

export default defineCliConfig({
  api: {
    projectId: 'gbkr8ghe',
    dataset: 'production',
  },
  deployment: {
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: true,
  },
  // Load the workspace plugin from source, so edits show up without rebuilding it.
  vite: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      alias: [
        ...toAliasArray(config.resolve?.alias),
        {find: /^sanity-plugin-audience-variants$/, replacement: pluginSrc('index.ts')},
        {
          find: /^sanity-plugin-audience-variants\/resolve$/,
          replacement: pluginSrc('exports/resolve.ts'),
        },
      ],
    },
  }),
})
