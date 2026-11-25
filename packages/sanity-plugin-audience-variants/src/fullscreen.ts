import type {Editor} from '@portabletext/editor'
import {useEffect, useState} from 'react'

/**
 * Where to render the "Preview as" bar while the editor is fullscreen.
 *
 * Studio renders Portable Text plugins next to the editor, not inside it, and
 * in fullscreen moves only the editor into a layer that covers the pane. The
 * bar would stay behind that layer, so while fullscreen we place a host
 * element in the editor's own column, between its toolbar and the text, and
 * the bar renders there through a portal. `null` when not fullscreen.
 *
 * Studio exposes no fullscreen state to plugins, so this watches the DOM: the
 * editor's root carries `data-fullscreen`, and toggling it remounts the editor
 * elsewhere in the page.
 */
export function useFullscreenBarHost(editor: Editor): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const el = document.createElement('div')
    el.dataset.audiencePreviewHost = ''
    el.style.flex = 'none'
    let active = false

    const sync = () => {
      const root = editor.dom
        .getEditorElement()
        ?.closest<HTMLElement>('[data-testid="pt-editor"][data-fullscreen="true"]')
      const scroller = root?.querySelector('[data-testid="pt-editor__scroller"]')
      // The card holding the scroller is the root's last child; the toolbar sits above it.
      const textCard = scroller?.parentElement
      if (root && textCard?.parentElement === root) {
        if (el.parentElement !== root || el.nextElementSibling !== textCard) {
          root.insertBefore(el, textCard)
        }
        if (!active) {
          active = true
          setHost(el)
        }
      } else if (active) {
        active = false
        setHost(null)
        el.remove()
      }
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-fullscreen'],
    })
    return () => {
      observer.disconnect()
      el.remove()
    }
  }, [editor])

  return host
}
