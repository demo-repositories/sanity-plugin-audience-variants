import type {Editor} from '@portabletext/editor'
import {useCallback, useSyncExternalStore} from 'react'

/**
 * "Preview as audience" state, shared between the plugin toolbar and every
 * variation block in the same editor.
 *
 * Block components render inside the editable, not under our plugin
 * component, so React context can't connect them. Instead we keep one small
 * store per editor instance (both sides get the same instance from
 * `useEditor()`), which also keeps separate PT fields on a page independent.
 *
 * `null` means "editing": no preview, blocks show their own tabs.
 */
type Store = {value: string | null; listeners: Set<() => void>}

const stores = new WeakMap<Editor, Store>()

function getStore(editor: Editor): Store {
  let store = stores.get(editor)
  if (!store) {
    store = {value: null, listeners: new Set()}
    stores.set(editor, store)
  }
  return store
}

export function usePreviewAudience(editor: Editor): [string | null, (id: string | null) => void] {
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
    (id: string | null) => {
      store.value = id
      store.listeners.forEach((l) => l())
    },
    [store],
  )
  return [value, setValue]
}
