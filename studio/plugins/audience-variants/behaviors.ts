import type {EditorSnapshot, Path, PortableTextBlock} from '@portabletext/editor'
import {defineBehavior, raise} from '@portabletext/editor/behaviors'
import {getSelectedBlocks, isSelectionCollapsed} from '@portabletext/editor/selectors'
import {createKeyboardShortcut} from '@portabletext/keyboard-shortcuts'
import {
  ADD_SECTION_EVENT,
  DEFAULT_TYPE,
  REMOVE_SECTION_EVENT,
  SET_AUDIENCES_EVENT,
  UNWRAP_EVENT,
  VARIANT_TYPE,
  VARIATION_TYPE,
  WRAP_EVENT,
} from './constants'
import {getDefaultSection, isDefaultSection, type Section, type VariationValue} from './resolve'

/** Alt+Shift+V (Option+Shift+V on Mac). `code` so Option's special chars don't matter. */
export const wrapShortcut = createKeyboardShortcut({
  default: [{code: 'KeyV', alt: true, shift: true, ctrl: false, meta: false}],
})

type Keyed = {_key: string}

/** Top-level text blocks covered by the selection, or null if it covers anything else. */
export function getWrappableBlocks(snapshot: EditorSnapshot) {
  const selected = getSelectedBlocks(snapshot)
  if (selected.length === 0) return null
  const textBlockType = snapshot.context.schema.block.name
  // Path length 1 = top level; deeper means the selection is inside a variation.
  const ok = selected.every(({node, path}) => node._type === textBlockType && path.length === 1)
  return ok ? selected : null
}

function findVariation(snapshot: EditorSnapshot, key: string) {
  return snapshot.context.value.find(
    (b): b is VariationValue & PortableTextBlock => b._key === key && b._type === VARIATION_TYPE,
  )
}

function emptyTextBlock(snapshot: EditorSnapshot): PortableTextBlock {
  return {
    _type: snapshot.context.schema.block.name,
    _key: snapshot.context.keyGenerator(),
    children: [{_type: 'span', _key: snapshot.context.keyGenerator(), text: '', marks: []}],
    markDefs: [],
    style: 'normal',
  }
}

function newSection(snapshot: EditorSnapshot, kind: 'default' | 'variant'): Section {
  const content = [emptyTextBlock(snapshot)]
  const _key = snapshot.context.keyGenerator()
  return kind === 'default'
    ? {_type: DEFAULT_TYPE, _key, content}
    : {_type: VARIANT_TYPE, _key, audiences: [], content}
}

/** Caret at the start of a section's first block. */
function selectStartOf(sectionPath: Path, section: Section) {
  const block = section.content?.[0] as (PortableTextBlock & {children?: Keyed[]}) | undefined
  const span = block?.children?.[0]
  if (!block || !span) return []
  const path: Path = [...sectionPath, 'content', {_key: block._key}, 'children', {_key: span._key}]
  return [raise({type: 'select', at: {anchor: {path, offset: 0}, focus: {path, offset: 0}}})]
}

/**
 * Wrap the selected top-level text blocks in a new variation; they become its
 * default section.
 */
const wrapSelection = defineBehavior({
  on: WRAP_EVENT,
  guard: ({snapshot}) => {
    const selected = getWrappableBlocks(snapshot)
    return selected ? {selected} : false
  },
  actions: [
    ({snapshot}, {selected}) => {
      const variation: VariationValue = {
        _type: VARIATION_TYPE,
        _key: snapshot.context.keyGenerator(),
        variants: [
          {
            _type: DEFAULT_TYPE,
            _key: snapshot.context.keyGenerator(),
            content: selected.map(({node}) => node),
          },
        ],
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
 * A variation inserted empty (e.g. from the toolbar's insert menu) gets a
 * default section with one empty paragraph, so there is somewhere to type.
 */
/**
 * The toolbar's "Audience variation" insert button wraps the selected text
 * instead of inserting an empty variation, so it does the same as the
 * shortcut. With a caret only, it inserts as before.
 */
const insertWrapsSelection = defineBehavior({
  on: 'insert.block',
  guard: ({snapshot, event}) => {
    if (event.block._type !== VARIATION_TYPE) return false
    const variants = (event.block as Partial<VariationValue>).variants
    if (Array.isArray(variants) && variants.length > 0) return false
    const selection = snapshot.context.selection
    if (!selection || isSelectionCollapsed(snapshot)) return false
    return getWrappableBlocks(snapshot) !== null
  },
  actions: [() => [raise({type: WRAP_EVENT})]],
})

const scaffoldInsertedVariation = defineBehavior({
  on: 'insert.block',
  guard: ({event}) => {
    if (event.block._type !== VARIATION_TYPE) return false
    const variants = (event.block as Partial<VariationValue>).variants
    return !(Array.isArray(variants) && variants.length > 0)
  },
  actions: [
    ({snapshot, event}) => [
      raise({...event, block: {...event.block, variants: [newSection(snapshot, 'default')]}}),
    ],
  ],
})

/**
 * Replace a variation with its default content as plain blocks. Variants are
 * discarded (the UI confirms before sending this). No default = removed.
 */
const unwrapVariation = defineBehavior({
  on: UNWRAP_EVENT,
  guard: ({snapshot, event}) => {
    const block = findVariation(snapshot, (event as {key?: string}).key ?? '')
    if (!block) return false
    return {
      path: [{_key: block._key}] as Path,
      // Fresh keys: nested keys are only unique within their array and could
      // collide with keys already in the body.
      blocks: (getDefaultSection(block)?.content ?? []).map((b) => ({
        ...b,
        _key: snapshot.context.keyGenerator(),
      })),
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

type TextBlock = PortableTextBlock & {
  children?: (Keyed & {marks?: string[]})[]
  markDefs?: Keyed[]
}

/**
 * Deep-copy blocks with fresh keys (blocks, spans and annotation defs, with
 * span marks remapped to the new def keys) so the copy can live in another
 * section without key collisions.
 */
function cloneBlocks(snapshot: EditorSnapshot, blocks: PortableTextBlock[]): PortableTextBlock[] {
  const key = () => snapshot.context.keyGenerator()
  return (blocks as TextBlock[]).map((block) => {
    const defKeys = new Map((block.markDefs ?? []).map((d) => [d._key, key()]))
    return {
      ...block,
      _key: key(),
      ...(block.markDefs && {
        markDefs: block.markDefs.map((d) => ({...d, _key: defKeys.get(d._key)!})),
      }),
      ...(block.children && {
        children: block.children.map((child) => ({
          ...child,
          _key: key(),
          ...(child.marks && {marks: child.marks.map((m) => defKeys.get(m) ?? m)}),
        })),
      }),
    }
  })
}

/**
 * Add a default or variant section to a variation. Order is variants first,
 * default last, so the block reads "these audiences get X, everyone else Y".
 * `copyFrom` seeds the new section with another section's content.
 */
const addSection = defineBehavior({
  on: ADD_SECTION_EVENT,
  guard: ({snapshot, event}) => {
    const {key, kind, copyFrom} = event as {
      key?: string
      kind?: 'default' | 'variant'
      copyFrom?: string
    }
    const block = findVariation(snapshot, key ?? '')
    if (!block || !kind) return false
    if (kind === 'default' && getDefaultSection(block)) return false
    const source = copyFrom ? block.variants?.find((s) => s._key === copyFrom) : undefined
    const section = newSection(snapshot, kind)
    if (source?.content?.length) section.content = cloneBlocks(snapshot, source.content)
    return {block, kind, section}
  },
  actions: [
    (_, {block, kind, section}) => {
      const variationPath: Path = [{_key: block._key}]
      const sections = block.variants ?? []
      const sectionPath: Path = [...variationPath, 'variants', {_key: section._key}]
      // Variants go after the last variant (or before the default if there are
      // none yet); a default goes at the end.
      const lastVariant = sections.filter((s) => !isDefaultSection(s)).at(-1)
      const fallback = getDefaultSection(block)
      const [anchor, position] =
        kind === 'variant' && lastVariant
          ? [lastVariant, 'after' as const]
          : kind === 'variant' && fallback
            ? [fallback, 'before' as const]
            : [sections.at(-1), 'after' as const]
      const insert = anchor
        ? raise({
            type: 'insert',
            at: [...variationPath, 'variants', {_key: anchor._key}],
            value: section,
            position,
          })
        : raise({type: 'set', at: [...variationPath, 'variants'], value: [section]})
      return [insert, ...selectStartOf(sectionPath, section)]
    },
  ],
})

/** Remove one section; removing the last one removes the whole variation. */
const removeSection = defineBehavior({
  on: REMOVE_SECTION_EVENT,
  guard: ({snapshot, event}) => {
    const {key, sectionKey} = event as {key?: string; sectionKey?: string}
    const block = findVariation(snapshot, key ?? '')
    if (!block || !block.variants?.some((s) => s._key === sectionKey)) return false
    return {block, sectionKey: sectionKey!}
  },
  actions: [
    (_, {block, sectionKey}) => {
      const variationPath: Path = [{_key: block._key}]
      if ((block.variants ?? []).length <= 1) {
        return [raise({type: 'delete.block', at: variationPath})]
      }
      return [raise({type: 'unset', at: [...variationPath, 'variants', {_key: sectionKey}]})]
    },
  ],
})

const setAudiences = defineBehavior({
  on: SET_AUDIENCES_EVENT,
  guard: ({snapshot, event}) => {
    const {key, sectionKey, audiences} = event as {
      key?: string
      sectionKey?: string
      audiences?: string[]
    }
    const block = findVariation(snapshot, key ?? '')
    const section = block?.variants?.find((s) => s._key === sectionKey)
    if (!block || !section || isDefaultSection(section) || !audiences) return false
    return {
      at: [{_key: block._key}, 'variants', {_key: section._key}, 'audiences'] as Path,
      audiences,
    }
  },
  actions: [(_, {at, audiences}) => [raise({type: 'set', at, value: audiences})]],
})

export const audienceVariantBehaviors = [
  wrapSelection,
  wrapOnShortcut,
  insertWrapsSelection,
  scaffoldInsertedVariation,
  unwrapVariation,
  addSection,
  removeSection,
  setAudiences,
]
