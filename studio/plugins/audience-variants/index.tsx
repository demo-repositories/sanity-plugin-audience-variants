import type {PortableTextPluginsProps} from 'sanity'
import {AudienceVariantsPlugin} from './AudienceVariantsPlugin'

/**
 * Studio wrapper for the Portable Text plugin. Keeps Sanity's default plugins
 * (markdown shortcuts, etc.) and mounts ours alongside them.
 *
 * Use on a Portable Text field:
 *   components: {portableText: {plugins: AudienceVariantsPlugins}}
 */
export function AudienceVariantsPlugins(props: PortableTextPluginsProps) {
  return (
    <>
      {props.renderDefault(props)}
      <AudienceVariantsPlugin />
    </>
  )
}

export {AudienceVariantsPlugin}
