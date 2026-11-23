import type {Editor} from '@portabletext/editor'
import {useCallback, useSyncExternalStore} from 'react'
import type {PreviewFilter} from './resolve'

/**
 * "Preview as audience" state, shared between the plugin toolbar and every
 * variation block in the same editor.
 *
 * Block components render inside the editable, not under our plugin
 * component, so React context can't connect them. Instead we keep one small
 * store per editor instance (both sides get the same instance from
 * `useEditor()`), which also keeps separate PT fields on a page independent.
 *
 * `null` means "editing": no preview, blocks show their own tabs. Otherwise
 * at least one of region / audience is set; an unset one means "any".
 */
type Store = {value: PreviewFilter | null; listeners: Set<() => void>}

const stores = new WeakMap<Editor, Store>()

function getStore(editor: Editor): Store {
  let store = stores.get(editor)
  if (!store) {
    store = {value: null, listeners: new Set()}
    stores.set(editor, store)
  }
  return store
}

export function usePreviewAudience(
  editor: Editor,
): [PreviewFilter | null, (filter: PreviewFilter | null) => void] {
  const store = getStore(editor)
  const subscribe = useCallback(
    (listener: () => void) => {
      store.listeners.add(listener)
      return () => store.listeners.delete(listener)
    },
    [store],
  )
  const value = useSyncExternalStore(subscribe, () => store.value)
  const setValue = useCallback(
    (filter: PreviewFilter | null) => {
      store.value = filter?.region || filter?.audience ? filter : null
      store.listeners.forEach((l) => l())
    },
    [store],
  )
  return [value, setValue]
}
