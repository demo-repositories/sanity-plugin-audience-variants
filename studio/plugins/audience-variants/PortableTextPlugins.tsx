import type {PortableTextPluginsProps} from 'sanity'
import {AudienceVariantsPlugin} from './AudienceVariantsPlugin'

/**
 * Studio wrapper for the Portable Text plugin. Keeps Sanity's default plugins
 * (markdown shortcuts, etc.) and mounts ours alongside them. Wired up by
 * `defineAudienceVariantsField`.
 */
export function AudienceVariantsPlugins(props: PortableTextPluginsProps) {
  return (
    <>
      {props.renderDefault(props)}
      <AudienceVariantsPlugin />
    </>
  )
}
