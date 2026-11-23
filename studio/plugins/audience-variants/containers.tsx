import {
  type ContainerRenderProps,
  defineContainer,
  type Editor,
  useEditor,
  useEditorSelector,
} from '@portabletext/editor'
import {AddIcon} from '@sanity/icons/Add'
import {CopyIcon} from '@sanity/icons/Copy'
import {EllipsisHorizontalIcon} from '@sanity/icons/EllipsisHorizontal'
import {TrashIcon} from '@sanity/icons/Trash'
import {UnlinkIcon} from '@sanity/icons/Unlink'
import {Box, Button, Card, Checkbox, Flex, Stack, Text, useClickOutsideEvent} from '@sanity/ui'
import {Menu, MenuButton, MenuItem} from '@sanity/ui/menu'
import {Popover} from '@sanity/ui/popover'
import {
  createContext,
  type ComponentProps,
  type CSSProperties,
  Fragment,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import {
  ADD_SECTION_EVENT,
  DEFAULT_TYPE,
  REMOVE_SECTION_EVENT,
  SET_AUDIENCES_EVENT,
  UNWRAP_EVENT,
  VARIANT_TYPE,
  VARIATION_TYPE,
} from './constants'
import {useAudienceConfig} from './context'
import {usePreviewAudience} from './previewAudience'
import {
  getDefaultSection,
  isDefaultSection,
  overlappingAudiences,
  resolveVariation,
  type Section,
  variantSections,
  type VariationValue,
} from './resolve'

/**
 * Inline editing: the variation and each of its sections are Portable Text
 * containers, so section content is typed directly in the body. Labels and
 * actions are `contentEditable={false}` chrome; actions go through custom
 * behavior events (see behaviors.ts).
 *
 * Layout is tuned for skimming: a variation is a tinted block in the same
 * centred column as body text, nested text lines up with body text, and each
 * section has one label line saying who sees it. Editing actions float over
 * the variation only while it's being worked on, so nothing shifts.
 */
export const audienceVariantContainers = [
  defineContainer({
    type: VARIATION_TYPE,
    arrayField: 'variants',
    render: (props) => <VariationContainer {...props} />,
    of: [
      defineContainer({
        type: VARIANT_TYPE,
        arrayField: 'content',
        render: (props) => <SectionContainer {...props} />,
      }),
      defineContainer({
        type: DEFAULT_TYPE,
        arrayField: 'content',
        render: (props) => <SectionContainer {...props} />,
      }),
    ],
  }),
]

const DEFAULT_LABEL = 'All other audiences'

/**
 * Sanity sizes containers to the body-text column, so nested text already
 * lines up with body text. The tint and rails extend this far outside it.
 */
const GUTTER = 12

const color = {
  variant: 'var(--card-badge-primary-fg-color)',
  variantRail: 'var(--card-badge-primary-dot-color)',
  muted: 'var(--card-muted-fg-color)',
  caution: 'var(--card-badge-caution-fg-color)',
  critical: 'var(--card-badge-critical-fg-color)',
  focus: 'var(--card-focus-ring-color)',
  border: 'var(--card-border-color)',
  tint: 'var(--card-muted-bg-color)',
}

/** Coloured bar in the gutter left of a section; takes no layout space. */
function Rail({color: c}: {color: string}) {
  return (
    <Chrome
      style={{
        position: 'absolute',
        left: -GUTTER,
        top: 0,
        bottom: 0,
        width: 3,
        background: c,
        transition: 'background-color 120ms',
      }}
    />
  )
}

/**
 * Whether the variation's editing actions are showing, and a way for
 * sections to keep them showing while one of their popovers is open (the
 * pointer leaves the variation to reach a portalled menu).
 */
type ActiveState = {active: boolean; hold: (on: boolean) => void}
const VariationActiveContext = createContext<ActiveState>({active: true, hold: () => undefined})

/**
 * Non-editable chrome inside the editable: keep the caret and selection out.
 * Mouse-down is cancelled so buttons never take focus from the editor;
 * otherwise typing after a click would go to the button (Space re-clicks it).
 */
function Chrome({children, style}: {children?: ReactNode; style?: CSSProperties}) {
  return (
    <div
      contentEditable={false}
      style={{userSelect: 'none', ...style}}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>
  )
}

/**
 * A bleed button for use on the tint: Sanity's buttons paint their own
 * `--card-bg-color` (white), so clear it except while hovered.
 */
function TintButton(props: ComponentProps<typeof Button>) {
  const [hover, setHover] = useState(false)
  return (
    <Button
      mode="bleed"
      {...props}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={hover ? props.style : {...props.style, ['--card-bg-color' as string]: 'transparent'}}
    />
  )
}

/**
 * Editing actions show only on the variation being worked on: the caret is
 * inside it, the pointer is over it, or one of its popovers is open.
 */
function useVariationActive(editor: Editor, key: string) {
  const [hovered, setHovered] = useState(false)
  const [holds, setHolds] = useState(0)
  const focused = useEditorSelector(editor, (snapshot) => {
    const first = snapshot.context.selection?.focus.path[0]
    return typeof first === 'object' && first !== null && '_key' in first && first._key === key
  })
  const hold = useCallback((on: boolean) => setHolds((n) => Math.max(0, n + (on ? 1 : -1))), [])
  const active = focused || hovered || holds > 0
  const context = useMemo(() => ({active, hold}), [active, hold])
  return {active, context, setHovered}
}

function VariationContainer({attributes, children, node, readOnly}: ContainerRenderProps) {
  const value = node as unknown as VariationValue
  const editor = useEditor()
  const [previewAudience] = usePreviewAudience(editor)
  const {active, context, setHovered} = useVariationActive(editor, value._key)
  const editing = active && !readOnly

  // Preview: plain content only, exactly what this audience reads. Nothing
  // at all if no section applies to them.
  if (previewAudience) {
    return (
      <div
        {...attributes}
        style={{display: resolveVariation(value, previewAudience) ? undefined : 'none'}}
      >
        <VariationActiveContext.Provider value={context}>
          {children}
        </VariationActiveContext.Provider>
      </div>
    )
  }

  return (
    <div
      {...attributes}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        // Own stacking context so the tint layer sits behind the content.
        isolation: 'isolate',
        // Keep `auto`: Sanity centres top-level blocks in the editor column.
        margin: '20px auto',
      }}
    >
      <Chrome
        style={{
          position: 'absolute',
          inset: `-6px -${GUTTER}px`,
          zIndex: -1,
          borderRadius: 6,
          background: color.tint,
          boxShadow: `0 0 0 1px ${editing ? color.focus : 'transparent'}`,
          transition: 'box-shadow 120ms',
        }}
      />
      <VariationActiveContext.Provider value={context}>
        {editing && <VariationActions value={value} />}
        <Stack gap={2}>{children}</Stack>
      </VariationActiveContext.Provider>
    </div>
  )
}

/** Floating action bar over the top-right corner; takes no layout space. */
function VariationActions({value}: {value: VariationValue}) {
  const editor = useEditor()
  const [confirmingUnwrap, setConfirmingUnwrap] = useState(false)
  const hasDefault = Boolean(getDefaultSection(value))
  const variantCount = variantSections(value).length

  return (
    <Chrome style={{position: 'absolute', top: -22, right: -4, zIndex: 2}}>
      <Card radius={2} shadow={1} padding={1}>
        <Flex gap={1}>
          <Button
            icon={AddIcon}
            mode="bleed"
            fontSize={1}
            padding={2}
            text="Variant"
            onClick={() => {
              editor.send({type: ADD_SECTION_EVENT, key: value._key, kind: 'variant'})
              editor.send({type: 'focus'})
            }}
          />
          {!hasDefault && (
            <Button
              icon={AddIcon}
              mode="bleed"
              fontSize={1}
              padding={2}
              text={DEFAULT_LABEL}
              title="Add content for audiences no variant targets"
              onClick={() => {
                editor.send({type: ADD_SECTION_EVENT, key: value._key, kind: 'default'})
                editor.send({type: 'focus'})
              }}
            />
          )}
          {confirmingUnwrap ? (
            <>
              <Button
                mode="bleed"
                fontSize={1}
                padding={2}
                text="Cancel"
                onClick={() => setConfirmingUnwrap(false)}
              />
              <Button
                icon={UnlinkIcon}
                tone="critical"
                fontSize={1}
                padding={2}
                text={unwrapLabel(hasDefault, variantCount)}
                onClick={() => editor.send({type: UNWRAP_EVENT, key: value._key})}
              />
            </>
          ) : (
            <Button
              icon={UnlinkIcon}
              mode="bleed"
              fontSize={1}
              padding={2}
              text="Unwrap"
              title="Turn back into normal text"
              onClick={() => setConfirmingUnwrap(true)}
            />
          )}
        </Flex>
      </Card>
    </Chrome>
  )
}

function unwrapLabel(hasDefault: boolean, variantCount: number): string {
  if (!hasDefault) return `No “${DEFAULT_LABEL}” — remove block`
  if (variantCount) return `Keep “${DEFAULT_LABEL}”, discard ${variantCount} variant(s)`
  return 'Confirm unwrap'
}

/** The variation that owns the section at `path` (path[0] is its key). */
function useParentVariation(editor: Editor, path: ContainerRenderProps['path']) {
  const key = (path[0] as {_key?: string})._key
  return useEditorSelector(editor, (snapshot) =>
    snapshot.context.value.find((b) => b._key === key),
  ) as VariationValue | undefined
}

function SectionContainer({attributes, children, node, path, readOnly}: ContainerRenderProps) {
  const section = node as unknown as Section
  const editor = useEditor()
  const [previewAudience] = usePreviewAudience(editor)
  const variation = useParentVariation(editor, path)
  const {active} = useContext(VariationActiveContext)

  const isDefault = isDefaultSection(section)
  const audiences = isDefault ? [] : (section.audiences ?? [])

  // Audiences picked in this variation's other variants: an audience may be
  // in only one variant, so the picker offers each audience once.
  const takenElsewhere = useMemo(
    () =>
      new Set(
        variation
          ? variantSections(variation)
              .filter((s) => s._key !== section._key)
              .flatMap((s) => s.audiences ?? [])
          : [],
      ),
    [variation, section._key],
  )

  // Preview: show only the section this audience gets, without chrome.
  if (previewAudience) {
    const resolved = variation ? resolveVariation(variation, previewAudience) : undefined
    return (
      <div {...attributes} style={{display: resolved?._key === section._key ? undefined : 'none'}}>
        {children}
      </div>
    )
  }

  const label = (
    <SectionLabel
      isDefault={isDefault}
      audiences={audiences}
      overlaps={variation ? overlappingAudiences(variation) : new Set()}
    />
  )

  return (
    <div
      {...attributes}
      style={{
        position: 'relative',
        // Older documents may store the default first; always show it last.
        order: isDefault ? 1 : 0,
      }}
    >
      <Rail color={isDefault ? color.border : color.variantRail} />
      <Chrome style={{paddingTop: 2}}>
        <Flex align="center" gap={1} style={{minHeight: 25}}>
          {!readOnly && !isDefault && variation ? (
            <AudiencePicker
              selected={audiences}
              taken={takenElsewhere}
              onChange={(next) =>
                editor.send({
                  type: SET_AUDIENCES_EVENT,
                  key: variation._key,
                  sectionKey: section._key,
                  audiences: next,
                })
              }
            >
              {label}
            </AudiencePicker>
          ) : (
            label
          )}
          {!readOnly && active && variation && (
            <SectionMenu variation={variation} section={section} />
          )}
        </Flex>
      </Chrome>
      {children}
    </div>
  )
}

/** Who sees a section, as one line of text: "EMEA Corporate, NORAM Corporate". */
function SectionLabel({
  isDefault,
  audiences,
  overlaps,
}: {
  isDefault: boolean
  audiences: string[]
  overlaps: Set<string>
}) {
  const {audienceTitle} = useAudienceConfig()
  const style = {fontWeight: 500}

  if (isDefault) {
    return (
      <Text size={1} style={{...style, color: color.muted}}>
        {DEFAULT_LABEL}
      </Text>
    )
  }
  if (!audiences.length) {
    return (
      <Text size={1} style={{...style, color: color.caution}}>
        Choose audiences…
      </Text>
    )
  }
  return (
    <Text size={1} style={{...style, color: color.variant}}>
      {audiences.map((id, i) => (
        <Fragment key={id}>
          {i > 0 && ', '}
          <span
            style={overlaps.has(id) ? {color: color.critical} : undefined}
            title={overlaps.has(id) ? 'Also used in another variant' : undefined}
          >
            {audienceTitle(id)}
          </span>
        </Fragment>
      ))}
    </Text>
  )
}

function SectionMenu({variation, section}: {variation: VariationValue; section: Section}) {
  const editor = useEditor()
  const {hold} = useContext(VariationActiveContext)
  const id = useId()
  const isDefault = isDefaultSection(section)

  return (
    <MenuButton
      id={id}
      onOpen={() => hold(true)}
      onClose={() => hold(false)}
      button={
        <TintButton
          icon={EllipsisHorizontalIcon}
          fontSize={1}
          padding={1}
          title="Section actions"
        />
      }
      popover={{portal: true, placement: 'bottom-start'}}
      menu={
        <Menu>
          <MenuItem
            icon={CopyIcon}
            fontSize={1}
            text="Duplicate as new variant"
            onClick={() => {
              editor.send({
                type: ADD_SECTION_EVENT,
                key: variation._key,
                kind: 'variant',
                copyFrom: section._key,
              })
              editor.send({type: 'focus'})
            }}
          />
          <MenuItem
            icon={TrashIcon}
            tone="critical"
            fontSize={1}
            text={isDefault ? `Remove “${DEFAULT_LABEL}”` : 'Remove variant'}
            onClick={() =>
              editor.send({
                type: REMOVE_SECTION_EVENT,
                key: variation._key,
                sectionKey: section._key,
              })
            }
          />
        </Menu>
      }
    />
  )
}

/** Wraps the section label in a button that opens the audience picker. */
function AudiencePicker({
  children,
  selected,
  taken,
  onChange,
}: {
  children: ReactNode
  selected: string[]
  taken: Set<string>
  onChange: (next: string[]) => void
}) {
  const {audiences} = useAudienceConfig()
  const {hold} = useContext(VariationActiveContext)
  const [open, setOpen] = useState(false)
  const [button, setButton] = useState<HTMLElement | null>(null)
  const [popover, setPopover] = useState<HTMLElement | null>(null)
  const [hover, setHover] = useState(false)

  // Keep the variation's actions showing while the picker is open.
  useEffect(() => {
    if (!open) return undefined
    hold(true)
    return () => hold(false)
  }, [open, hold])

  useClickOutsideEvent(open && (() => setOpen(false)), () => [button, popover])
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])

  return (
    <Popover
      open={open}
      portal
      placement="bottom-start"
      ref={setPopover}
      content={
        <Card padding={3} radius={2}>
          <Stack gap={3}>
            <Text size={1} weight="medium">
              Show this variant to
            </Text>
            {audiences.map((a) => {
              const isTaken = taken.has(a.id) && !selected.includes(a.id)
              return (
                <Flex
                  key={a.id}
                  as="label"
                  align="center"
                  gap={2}
                  style={{cursor: isTaken ? 'not-allowed' : 'pointer'}}
                  title={isTaken ? `${a.title} already has its own variant` : undefined}
                >
                  <Checkbox
                    checked={selected.includes(a.id)}
                    disabled={isTaken}
                    onChange={() => toggle(a.id)}
                  />
                  <Box flex={1}>
                    <Text size={1} muted={isTaken}>
                      {a.title}
                    </Text>
                  </Box>
                  {isTaken && (
                    <Text size={0} muted>
                      in another variant
                    </Text>
                  )}
                </Flex>
              )
            })}
          </Stack>
        </Card>
      }
    >
      {/* A bare button: the label stays plain text on the tint, underlined on hover. */}
      <button
        ref={setButton}
        type="button"
        title="Change audiences"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          textDecoration: hover || open ? 'underline dotted' : 'none',
          textUnderlineOffset: 3,
        }}
      >
        {children}
      </button>
    </Popover>
  )
}
