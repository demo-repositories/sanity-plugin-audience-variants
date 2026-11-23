import type {PortableTextBlock} from '@portabletext/editor'
import {defineBehavior, raise} from '@portabletext/editor/behaviors'
import {getSelectedBlocks} from '@portabletext/editor/selectors'
import {createKeyboardShortcut} from '@portabletext/keyboard-shortcuts'
import {UNWRAP_EVENT, VARIATION_TYPE, WRAP_EVENT} from './constants'

/** Alt+Shift+V (Option+Shift+V on Mac). `code` so Option's special chars don't matter. */
export const wrapShortcut = createKeyboardShortcut({
  default: [{code: 'KeyV', alt: true, shift: true, ctrl: false, meta: false}],
})

type VariationValue = {
  _type: typeof VARIATION_TYPE
  _key: string
  default?: PortableTextBlock[]
  variants?: unknown[]
}

/**
 * Wrap the selected top-level text blocks in a new variation; they become its
 * default content. Refuses if the selection includes any non-text block
 * (e.g. an existing variation), so variations never nest.
 */
const wrapSelection = defineBehavior({
  on: WRAP_EVENT,
  guard: ({snapshot}) => {
    const selected = getSelectedBlocks(snapshot)
    if (selected.length === 0) return false
    const textBlockType = snapshot.context.schema.block.name
    if (selected.some(({node}) => node._type !== textBlockType)) return false
    return {selected}
  },
  actions: [
    ({snapshot}, {selected}) => {
      const variation: VariationValue = {
        _type: VARIATION_TYPE,
        _key: snapshot.context.keyGenerator(),
        default: selected.map(({node}) => node),
        variants: [],
      }
      const first = selected[0].path
      return [
        raise({
          type: 'insert.block',
          block: variation,
          placement: 'before',
          select: 'none',
          at: {anchor: {path: first, offset: 0}, focus: {path: first, offset: 0}},
        }),
        ...selected.map(({path}) => raise({type: 'delete.block', at: path})),
      ]
    },
  ],
})

const wrapOnShortcut = defineBehavior({
  on: 'keyboard.keydown',
  guard: ({event}) => wrapShortcut.guard(event.originEvent),
  actions: [() => [raise({type: WRAP_EVENT})]],
})

/**
 * Replace a variation with its default content as plain blocks. Variants are
 * discarded (the UI confirms before sending this).
 */
const unwrapVariation = defineBehavior({
  on: UNWRAP_EVENT,
  guard: ({snapshot, event}) => {
    const block = snapshot.context.value.find(
      (b): b is VariationValue & PortableTextBlock =>
        b._key === (event as {key?: string}).key && b._type === VARIATION_TYPE,
    )
    if (!block) return false
    return {
      path: [{_key: block._key}] as [{_key: string}],
      // Fresh keys: the default blocks' keys are only unique within the
      // nested array and could collide with keys already in the body.
      blocks: (block.default ?? []).map((b) => ({...b, _key: snapshot.context.keyGenerator()})),
    }
  },
  actions: [
    (_, {path, blocks}) => [
      ...(blocks.length
        ? [
            raise({
              type: 'insert.blocks',
              blocks,
              placement: 'after',
              select: 'none',
              at: {anchor: {path, offset: 0}, focus: {path, offset: 0}},
            }),
          ]
        : []),
      raise({type: 'delete.block', at: path}),
    ],
  ],
})

export const audienceVariantBehaviors = [wrapSelection, wrapOnShortcut, unwrapVariation]
