import {
  type ContainerRenderProps,
  defineContainer,
  type Editor,
  useEditor,
  useEditorSelector,
} from '@portabletext/editor'
import {AddIcon} from '@sanity/icons/Add'
import {EyeClosedIcon} from '@sanity/icons/EyeClosed'
import {TrashIcon} from '@sanity/icons/Trash'
import {UnlinkIcon} from '@sanity/icons/Unlink'
import {UsersIcon} from '@sanity/icons/Users'
import {Badge, Box, Button, Card, Checkbox, Flex, Stack, Text} from '@sanity/ui'
import {Popover} from '@sanity/ui/popover'
import {type CSSProperties, type ReactNode, useState} from 'react'
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
  type VariationValue,
} from './resolve'

/**
 * Inline editing: the variation and each of its sections are Portable Text
 * containers, so section content is typed directly in the body. Headers are
 * `contentEditable={false}` chrome; their actions go through custom behavior
 * events (see behaviors.ts).
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

/**
 * Non-editable chrome inside the editable: keep the caret and selection out.
 * Mouse-down is cancelled so buttons never take focus from the editor;
 * otherwise typing after a click would go to the button (Space re-clicks it).
 */
function Chrome({children, style}: {children: ReactNode; style?: CSSProperties}) {
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

function VariationContainer({attributes, children, node, readOnly}: ContainerRenderProps) {
  const value = node as unknown as VariationValue
  const editor = useEditor()
  const {audienceTitle} = useAudienceConfig()
  const [previewAudience] = usePreviewAudience(editor)
  const [confirmingUnwrap, setConfirmingUnwrap] = useState(false)

  const hasDefault = Boolean(getDefaultSection(value))
  const variantCount = (value.variants ?? []).filter((s) => !isDefaultSection(s)).length
  const hidden = previewAudience ? !resolveVariation(value, previewAudience) : false

  return (
    <div
      {...attributes}
      style={{
        border: '1px solid var(--card-border-color)',
        borderRadius: 6,
        margin: '8px 0',
        padding: '4px 8px 8px',
      }}
    >
      <Chrome>
        <Flex align="center" gap={1} paddingY={1} wrap="wrap">
          <Text size={1} muted>
            <UsersIcon />
          </Text>
          <Box flex={1} paddingLeft={1}>
            <Text size={1} muted weight="medium">
              Audience variation
            </Text>
          </Box>
          {!readOnly && (
            <>
              {!hasDefault && (
                <Button
                  icon={AddIcon}
                  mode="bleed"
                  fontSize={1}
                  padding={2}
                  text="Default"
                  onClick={() => {
                    editor.send({type: ADD_SECTION_EVENT, key: value._key, kind: 'default'})
                    editor.send({type: 'focus'})
                  }}
                />
              )}
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
                  onClick={() => setConfirmingUnwrap(true)}
                />
              )}
            </>
          )}
        </Flex>
        {hidden && (
          <Flex align="center" gap={2} paddingY={2}>
            <Text size={1} muted>
              <EyeClosedIcon />
            </Text>
            <Text size={1} muted>
              Not shown to {audienceTitle(previewAudience!)}
            </Text>
          </Flex>
        )}
      </Chrome>
      <Stack gap={2}>{children}</Stack>
    </div>
  )
}

function unwrapLabel(hasDefault: boolean, variantCount: number): string {
  if (!hasDefault) return 'No default — remove block entirely'
  if (variantCount) return `Keep default, discard ${variantCount} variant(s)`
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
  const {audienceTitle} = useAudienceConfig()
  const [previewAudience] = usePreviewAudience(editor)
  const variation = useParentVariation(editor, path)

  const isDefault = isDefaultSection(section)
  const audiences = isDefault ? [] : (section.audiences ?? [])
  const overlaps = variation ? overlappingAudiences(variation) : new Set<string>()
  const conflicting = audiences.filter((id) => overlaps.has(id))

  // In preview, highlight the section this audience gets and dim the rest.
  const resolved =
    previewAudience && variation ? resolveVariation(variation, previewAudience) : undefined
  const dimmed = Boolean(previewAudience) && resolved?._key !== section._key
  const shown = Boolean(previewAudience) && !dimmed

  const accent = shown
    ? 'var(--card-focus-ring-color)'
    : isDefault
      ? 'var(--card-border-color)'
      : 'var(--card-badge-primary-bg-color, var(--card-border-color))'

  return (
    <div
      {...attributes}
      style={{
        borderLeft: `3px solid ${accent}`,
        paddingLeft: 10,
        opacity: dimmed ? 0.4 : 1,
        transition: 'opacity 120ms',
      }}
    >
      <Chrome>
        <Flex align="center" gap={1} paddingY={1} wrap="wrap">
          {isDefault ? (
            <Badge fontSize={0}>Default</Badge>
          ) : audiences.length ? (
            audiences.map((id) => (
              <Badge key={id} fontSize={0} tone={overlaps.has(id) ? 'critical' : 'primary'}>
                {audienceTitle(id)}
              </Badge>
            ))
          ) : (
            <Badge fontSize={0} tone="caution">
              No audiences
            </Badge>
          )}
          {shown && (
            <Text size={0} muted>
              · shown to {audienceTitle(previewAudience!)}
            </Text>
          )}
          <Box flex={1} />
          {!readOnly && !isDefault && variation && (
            <AudiencePicker
              selected={audiences}
              onChange={(next) =>
                editor.send({
                  type: SET_AUDIENCES_EVENT,
                  key: variation._key,
                  sectionKey: section._key,
                  audiences: next,
                })
              }
            />
          )}
          {!readOnly && variation && (
            <Button
              icon={TrashIcon}
              mode="bleed"
              tone="critical"
              fontSize={1}
              padding={2}
              title={isDefault ? 'Remove default' : 'Remove variant'}
              onClick={() =>
                editor.send({
                  type: REMOVE_SECTION_EVENT,
                  key: variation._key,
                  sectionKey: section._key,
                })
              }
            />
          )}
        </Flex>
        {conflicting.length > 0 && (
          <Box paddingBottom={1}>
            <Text size={0} style={{color: 'var(--card-badge-critical-fg-color, crimson)'}}>
              Also used in another variant: {conflicting.map(audienceTitle).join(', ')}
            </Text>
          </Box>
        )}
      </Chrome>
      {children}
    </div>
  )
}

function AudiencePicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const {audiences} = useAudienceConfig()
  const [open, setOpen] = useState(false)
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])

  return (
    <Popover
      open={open}
      portal
      placement="bottom-end"
      content={
        <Card padding={3} radius={2}>
          <Stack gap={3}>
            {audiences.map((a) => (
              <Flex key={a.id} as="label" align="center" gap={2} style={{cursor: 'pointer'}}>
                <Checkbox checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
                <Text size={1}>{a.title}</Text>
              </Flex>
            ))}
            <Button fontSize={1} padding={2} text="Done" onClick={() => setOpen(false)} />
          </Stack>
        </Card>
      }
    >
      <Button
        icon={UsersIcon}
        mode="bleed"
        fontSize={1}
        padding={2}
        text="Audiences"
        selected={open}
        onClick={() => setOpen((o) => !o)}
      />
    </Popover>
  )
}
