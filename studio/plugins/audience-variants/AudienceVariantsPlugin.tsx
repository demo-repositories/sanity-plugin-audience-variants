import {useEffect} from 'react'

/**
 * Portable Text Editor plugin.
 *
 * Rendered inside the editor's provider, so it can use `useEditor()` from
 * `@portabletext/editor` to register behaviors, read selection, etc.
 */
export function AudienceVariantsPlugin() {
  useEffect(() => {
    console.log('[audience-variants] plugin mounted')
  }, [])

  // TEMP: visible marker to confirm the plugin is loading. Remove once real features land.
  return (
    <div style={{fontSize: 11, opacity: 0.6, padding: '2px 4px'}}>
      ✓ audience-variants plugin loaded
    </div>
  )
}
