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
  SET_TARGETING_EVENT,
  UNWRAP_EVENT,
  VARIANT_TYPE,
  VARIATION_TYPE,
} from './constants'
import type {AudienceDimensionValue, Reader} from './config'
import {useAudienceConfig} from './context'
import {usePreviewAudience} from './previewAudience'
import {
  getDefaultSection,
  isDefaultSection,
  overlappingReaders,
  readerKey,
  readersOf,
  isExactFilter,
  previewSectionKeys,
  type Section,
  type VariantSection,
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

const DEFAULT_LABEL = 'Default Audience'

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
  const {regions: allRegions, audiences: allAudiences} = useAudienceConfig()
  const {active, context, setHovered} = useVariationActive(editor, value._key)
  const editing = active && !readOnly

  // Preview: plain content only, what the matching readers see. Nothing at
  // all if no section applies to any of them.
  if (previewAudience) {
    const visible = previewSectionKeys(
      value,
      previewAudience,
      allRegions.map((r) => r.id),
      allAudiences.map((a) => a.id),
    )
    return (
      <div {...attributes} style={{display: visible.size ? undefined : 'none'}}>
        <VariationActiveContext.Provider value={context}>
          {/* Grid, so the default's `order` keeps it last when several show. */}
          <Stack gap={visible.size > 1 ? 3 : 0}>{children}</Stack>
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
        <Stack gap={2}>{children}</Stack>
      </VariationActiveContext.Provider>
    </div>
  )
}

/**
 * Action bar at the right end of the top section's label line. It stays
 * inside the variation because Sanity clips the editable area, so anything
 * drawn above the first block gets cut off.
 */
function VariationActions({value}: {value: VariationValue}) {
  const editor = useEditor()
  const [confirmingUnwrap, setConfirmingUnwrap] = useState(false)
  const hasDefault = Boolean(getDefaultSection(value))
  const variantCount = variantSections(value).length

  return (
    <Box style={{marginLeft: 'auto'}}>
      <Flex gap={1}>
        <TintButton
          icon={AddIcon}
          fontSize={1}
          padding={1}
          text="Variant"
          onClick={() => {
            editor.send({type: ADD_SECTION_EVENT, key: value._key, kind: 'variant'})
            editor.send({type: 'focus'})
          }}
        />
        {!hasDefault && (
          <TintButton
            icon={AddIcon}
            fontSize={1}
            padding={1}
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
            <TintButton
              fontSize={1}
              padding={1}
              text="Cancel"
              onClick={() => setConfirmingUnwrap(false)}
            />
            <Button
              icon={UnlinkIcon}
              tone="critical"
              fontSize={1}
              padding={1}
              text={unwrapLabel(hasDefault, variantCount)}
              onClick={() => editor.send({type: UNWRAP_EVENT, key: value._key})}
            />
          </>
        ) : (
          <TintButton
            icon={UnlinkIcon}
            fontSize={1}
            padding={1}
            text="Unwrap"
            title="Turn back into normal text"
            onClick={() => setConfirmingUnwrap(true)}
          />
        )}
      </Flex>
    </Box>
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

type Field = 'regions' | 'audiences'

function SectionContainer({attributes, children, node, path, readOnly}: ContainerRenderProps) {
  const section = node as unknown as Section
  const editor = useEditor()
  const [previewAudience] = usePreviewAudience(editor)
  const variation = useParentVariation(editor, path)
  const {active} = useContext(VariationActiveContext)
  const {regions: allRegions, audiences: allAudiences} = useAudienceConfig()

  const isDefault = isDefaultSection(section)
  // The variation's actions go on the first label line shown: the first
  // variant, or the default when there are none (it always shows last).
  const isTopSection =
    variation !== undefined &&
    (variantSections(variation)[0] ?? getDefaultSection(variation))?._key === section._key
  const regions = isDefault ? [] : (section.regions ?? [])
  const audiences = isDefault ? [] : (section.audiences ?? [])

  const others = useMemo(
    () => (variation ? variantSections(variation).filter((s) => s._key !== section._key) : []),
    [variation, section._key],
  )

  // The default is only seen by readers no variant reaches; flag it when
  // every region × audience is already taken.
  const fallbackUnreachable = useMemo(() => {
    if (!isDefault || !variation) return false
    const reached = new Set(variantSections(variation).flatMap(readersOf).map(readerKey))
    return (
      reached.size > 0 &&
      allRegions.every((r) =>
        allAudiences.every((a) => reached.has(readerKey({region: r.id, audience: a.id}))),
      )
    )
  }, [isDefault, variation, allRegions, allAudiences])

  // Preview: show only the sections the matching readers get, without
  // chrome. When only region or only audience is picked, several sections
  // can apply, so each gets a small label saying who it's for.
  if (previewAudience) {
    const visible = variation
      ? previewSectionKeys(
          variation,
          previewAudience,
          allRegions.map((r) => r.id),
          allAudiences.map((a) => a.id),
        )
      : new Set<string>()
    const showLabel = !isExactFilter(previewAudience) && visible.size > 1
    return (
      <div
        {...attributes}
        style={{
          display: visible.has(section._key) ? undefined : 'none',
          order: isDefault ? 1 : 0,
        }}
      >
        {showLabel && (
          <Chrome style={{paddingTop: 4}}>
            <SectionLabel
              isDefault={isDefault}
              regions={regions}
              audiences={audiences}
              overlaps={[]}
              fallbackUnreachable={false}
            />
          </Chrome>
        )}
        {children}
      </div>
    )
  }

  const label = (
    <SectionLabel
      isDefault={isDefault}
      regions={regions}
      audiences={audiences}
      overlaps={(variation && overlappingReaders(variation).get(section._key)) || []}
      fallbackUnreachable={fallbackUnreachable}
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
              regions={regions}
              audiences={audiences}
              others={others}
              onChange={(field, ids) =>
                editor.send({
                  type: SET_TARGETING_EVENT,
                  key: variation._key,
                  sectionKey: section._key,
                  field,
                  ids,
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
          {!readOnly && active && isTopSection && variation && (
            <VariationActions value={variation} />
          )}
        </Flex>
      </Chrome>
      {children}
    </div>
  )
}

/**
 * Who sees a section, as one line of text: "EMEA, APEC · Hotel Owners".
 * Hovering shows the full names.
 */
function SectionLabel({
  isDefault,
  regions,
  audiences,
  overlaps,
  fallbackUnreachable,
}: {
  isDefault: boolean
  regions: string[]
  audiences: string[]
  overlaps: Reader[]
  fallbackUnreachable: boolean
}) {
  const {regionTitle, audienceTitle, summarizeRegions, summarizeAudiences, readerTitle} =
    useAudienceConfig()
  const style = {fontWeight: 500}

  if (isDefault) {
    return fallbackUnreachable ? (
      <Text
        size={1}
        style={{...style, color: color.caution}}
        title="Every region and audience already has a variant, so no one sees this content"
      >
        {DEFAULT_LABEL} · none left
      </Text>
    ) : (
      <Text size={1} style={{...style, color: color.muted}}>
        {DEFAULT_LABEL}
      </Text>
    )
  }

  if (!regions.length && !audiences.length) {
    return (
      <Text size={1} style={{...style, color: color.caution}}>
        Set audience variant…
      </Text>
    )
  }

  // An empty dimension means "any", so only show the dimensions actually chosen.
  const label = [
    regions.length ? summarizeRegions(regions) : null,
    audiences.length ? summarizeAudiences(audiences) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const title = overlaps.length
    ? `Also reached by another variant: ${overlaps.map(readerTitle).join(', ')}`
    : [regions.map(regionTitle).join(', '), audiences.map(audienceTitle).join(', ')]
        .filter(Boolean)
        .join(' · ')

  return (
    <Text
      size={1}
      style={{...style, color: overlaps.length ? color.critical : color.variant}}
      title={title || undefined}
    >
      {label}
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

/**
 * Wraps the section label in a button that opens the picker: regions and
 * audiences as two checkbox groups. A reader may be in only one variant, so
 * an option is disabled when ticking it would reach a reader another variant
 * already reaches.
 */
function AudiencePicker({
  children,
  regions,
  audiences,
  others,
  onChange,
}: {
  children: ReactNode
  regions: string[]
  audiences: string[]
  others: VariantSection[]
  onChange: (field: Field, ids: string[]) => void
}) {
  const config = useAudienceConfig()
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

  const selected = {regions, audiences}
  const otherField = (field: Field): Field => (field === 'regions' ? 'audiences' : 'regions')

  /** The other variant that ticking `id` would clash with, if any. */
  const clashWith = (field: Field, id: string) =>
    others.find(
      (o) =>
        o[field]?.includes(id) &&
        o[otherField(field)]?.some((x) => selected[otherField(field)].includes(x)),
    )

  const group = (field: Field, heading: string, values: AudienceDimensionValue[]) => {
    const ids = selected[field]
    const allOn = values.every((v) => ids.includes(v.id))
    const toggle = (id: string) =>
      onChange(field, ids.includes(id) ? ids.filter((s) => s !== id) : [...ids, id])
    const free = values.filter((v) => ids.includes(v.id) || !clashWith(field, v.id))
    return (
      <Stack gap={3}>
        <Flex align="center" gap={2}>
          <Box flex={1}>
            <Text size={1} weight="medium">
              {heading}
            </Text>
          </Box>
          <Button
            fontSize={0}
            padding={1}
            mode="bleed"
            text={allOn ? 'Clear' : 'All'}
            onClick={() => onChange(field, allOn ? [] : free.map((v) => v.id))}
          />
        </Flex>
        {values.map((v) => {
          const checked = ids.includes(v.id)
          const isTaken = !checked && Boolean(clashWith(field, v.id))
          return (
            <Flex
              key={v.id}
              as="label"
              align="center"
              gap={2}
              style={{cursor: isTaken ? 'not-allowed' : 'pointer'}}
              title={
                isTaken
                  ? `Another variant already reaches ${v.title} for some of the selected ${otherField(field)}`
                  : undefined
              }
            >
              <Checkbox checked={checked} disabled={isTaken} onChange={() => toggle(v.id)} />
              <Box flex={1}>
                <Text size={1} muted={isTaken}>
                  {v.title}
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
    )
  }

  return (
    <Popover
      open={open}
      portal
      placement="bottom-start"
      ref={setPopover}
      content={
        <Card padding={3} radius={2} style={{maxWidth: 360}}>
          <Stack gap={4}>
            <Text size={1} muted>
              Show this audience variant to readers in any of these regions who are in any of these
              audiences.
            </Text>
            {group('regions', 'Regions', config.regions)}
            {group('audiences', 'Audiences', config.audiences)}
          </Stack>
        </Card>
      }
    >
      {/* A bare button: the label stays plain text on the tint, underlined on hover. */}
      <button
        ref={setButton}
        type="button"
        title="Change regions and audiences"
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
