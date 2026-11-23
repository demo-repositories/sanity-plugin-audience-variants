import {useEditor} from '@portabletext/editor'
import {PortableText} from '@portabletext/react'
import {EditIcon} from '@sanity/icons/Edit'
import {EyeClosedIcon} from '@sanity/icons/EyeClosed'
import {UnlinkIcon} from '@sanity/icons/Unlink'
import {UsersIcon} from '@sanity/icons/Users'
import {Box, Button, Card, Flex, Stack, Tab, TabList, Text} from '@sanity/ui'
import {type MouseEvent, useState} from 'react'
import type {BlockProps, Path} from 'sanity'
import {UNWRAP_EVENT} from './constants'
import {useAudienceConfig} from './context'
import {usePreviewAudience} from './previewAudience'
import {resolveVariation, type VariationValue} from './resolve'

const DEFAULT_TAB = 'default'

/**
 * Renders an audience variation inline in the body as a bordered box with a
 * tab per variant. Content is read-only here; clicking it opens Studio's
 * editing popover focused on that tab's content.
 *
 * When the editor-wide "Preview as" audience is set, the box locks to what
 * that audience would see (variant, default, or nothing).
 */
export function VariationBlock(props: BlockProps) {
  return props.renderDefault({...props, renderPreview: () => <VariationBox {...props} />})
}

function VariationBox(props: BlockProps) {
  const value = props.value as VariationValue
  const variants = value.variants ?? []
  const hasDefault = Boolean(value.default?.length)
  const editor = useEditor()
  const {audienceTitle} = useAudienceConfig()
  const [previewAudience] = usePreviewAudience(editor)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [confirmingUnwrap, setConfirmingUnwrap] = useState(false)

  // Which tab is shown: in preview, whatever the audience resolves to;
  // otherwise the user's pick, falling back to Default (or the first variant
  // when there is no default).
  const resolution = previewAudience ? resolveVariation(value, previewAudience) : null
  let tab: string
  if (resolution) {
    tab = resolution.kind === 'variant' ? resolution.variant._key : DEFAULT_TAB
  } else if (
    activeTab &&
    (activeTab === DEFAULT_TAB || variants.some((v) => v._key === activeTab))
  ) {
    tab = activeTab
  } else {
    tab = hasDefault || !variants.length ? DEFAULT_TAB : variants[0]._key
  }
  const hidden = resolution?.kind === 'hidden'

  const activeVariant = variants.find((v) => v._key === tab)
  const content = activeVariant ? activeVariant.content : value.default
  const contentPath: Path = activeVariant
    ? ['variants', {_key: activeVariant._key}, 'content']
    : ['default']

  const hasError = props.validation.some((v) => v.level === 'error')

  // Stop clicks reaching the default preview wrapper, which would open the
  // whole-object form instead of the field we target.
  const stop = (e: MouseEvent) => e.stopPropagation()

  // onPathFocus alone doesn't open the block's form; open it, then focus.
  const openAt = (path: Path) => {
    props.onOpen()
    props.onPathFocus(path)
  }

  return (
    <Card
      border
      radius={2}
      tone={hasError ? 'critical' : hidden ? 'transparent' : 'default'}
      style={hidden ? {opacity: 0.6} : undefined}
      onClick={stop}
    >
      <Flex align="center" gap={2} paddingX={3} paddingTop={3} wrap="wrap">
        <Text size={1} muted>
          <UsersIcon />
        </Text>
        <TabList gap={1}>
          {[
            <Tab
              key="default"
              id={`${value._key}-default`}
              aria-controls={`${value._key}-panel`}
              label={hasDefault ? 'Default' : 'No default'}
              fontSize={1}
              selected={!hidden && tab === DEFAULT_TAB}
              disabled={Boolean(resolution) && (hidden || tab !== DEFAULT_TAB)}
              onClick={() => setActiveTab(DEFAULT_TAB)}
            />,
            ...variants.map((variant) => (
              <Tab
                key={variant._key}
                id={`${value._key}-${variant._key}`}
                aria-controls={`${value._key}-panel`}
                label={
                  variant.audiences?.length
                    ? variant.audiences.map(audienceTitle).join(' | ')
                    : 'No audiences'
                }
                fontSize={1}
                selected={tab === variant._key}
                disabled={Boolean(resolution) && tab !== variant._key}
                onClick={() => setActiveTab(variant._key)}
              />
            )),
          ]}
        </TabList>
      </Flex>

      <Box
        id={`${value._key}-panel`}
        padding={3}
        style={{cursor: props.readOnly || hidden ? 'default' : 'pointer'}}
        onClick={() => !props.readOnly && !hidden && openAt(contentPath)}
      >
        {hidden ? (
          <Flex align="center" gap={2}>
            <Text size={1} muted>
              <EyeClosedIcon />
            </Text>
            <Text size={1} muted>
              Not shown to {audienceTitle(previewAudience!)}
            </Text>
          </Flex>
        ) : content?.length ? (
          <Stack gap={3}>
            <PortableText value={content} />
          </Stack>
        ) : (
          <Text size={1} muted>
            {activeVariant
              ? 'Empty — click to add content'
              : 'No default — only readers in the audiences above see this. Click to add default content.'}
          </Text>
        )}
      </Box>

      {!props.readOnly && (
        <Flex gap={2} paddingX={3} paddingBottom={3} justify="flex-end" wrap="wrap">
          <Button
            icon={EditIcon}
            mode="bleed"
            fontSize={1}
            padding={2}
            text="Edit variants"
            onClick={() => openAt(['variants'])}
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
                text={unwrapLabel(hasDefault, variants.length)}
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
        </Flex>
      )}
    </Card>
  )
}

function unwrapLabel(hasDefault: boolean, variantCount: number): string {
  if (!hasDefault) return 'No default — remove block entirely'
  if (variantCount) return `Keep default, discard ${variantCount} variant(s)`
  return 'Confirm unwrap'
}
