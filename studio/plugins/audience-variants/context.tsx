import {createContext, useContext} from 'react'
import type {ResolvedAudienceConfig} from './config'

/**
 * Carries the plugin's audience config to editor components. Provided by the
 * `audienceVariants()` Studio plugin around the workspace layout, so it is
 * per-workspace and reaches block components rendered inside the editor.
 */
export const AudienceConfigContext = createContext<ResolvedAudienceConfig | null>(null)

export function useAudienceConfig(): ResolvedAudienceConfig {
  const config = useContext(AudienceConfigContext)
  if (!config) {
    throw new Error(
      'audience-variants: add `audienceVariants({...})` to `plugins` in sanity.config.ts',
    )
  }
  return config
}
