import {useEditor, useEditorSelector} from '@portabletext/editor'
import {BehaviorPlugin, NodePlugin} from '@portabletext/editor/plugins'
import {EyeOpenIcon} from '@sanity/icons/EyeOpen'
import {Button, Card, Flex, Text} from '@sanity/ui'
import {useEffect, useMemo} from 'react'
import {createPortal} from 'react-dom'
import {createAudienceVariantBehaviors, hasStrayVariantMembers} from './behaviors'
import {REPAIR_EVENT} from './constants'
import {AudienceSelect, Muted} from './AudienceSelect'
import {audienceVariantContainers} from './containers'
import {useAudienceConfig} from './context'
import {useFullscreenBarHost} from './fullscreen'
import type {PreviewFilter} from './resolve'
import {usePreviewAudience} from './previewAudience'

/**
 * Previewing is read-only: lock the editor while a preview audience is set,
 * and on leaving restore whatever read-only state it had before (it may be
 * read-only for other reasons, e.g. permissions).
 */
function usePreviewReadOnly(editor: ReturnType<typeof useEditor>, previewing: boolean) {
  useEffect(() => {
    if (!previewing) return undefined
    const wasReadOnly = editor.getSnapshot().context.readOnly
    if (!wasReadOnly) editor.send({type: 'update readOnly', readOnly: true})
    return () => {
      if (!wasReadOnly) editor.send({type: 'update readOnly', readOnly: false})
    }
  }, [editor, previewing])
}

/**
 * Self-heal: a block left directly in a variation's `variants` (outside any
 * section) crashes Sanity's form as soon as the caret enters it, so move it
 * back into a section whenever one shows up, including in stored documents.
 */
function useRepairVariations(editor: ReturnType<typeof useEditor>) {
  const broken = useEditorSelector(editor, (snapshot) =>
    hasStrayVariantMembers(snapshot.context.value),
  )
  const readOnly = useEditorSelector(editor, (snapshot) => snapshot.context.readOnly)
  useEffect(() => {
    if (broken && !readOnly) editor.send({type: REPAIR_EVENT})
  }, [editor, broken, readOnly])
}

/**
 * Portable Text Editor plugin: registers the behaviors and inline-editing
 * containers, and renders a bar with an editor-wide "Preview as" audience switch.
 */
export function AudienceVariantsPlugin() {
  const editor = useEditor()
  const [previewAudience, setPreviewAudience] = usePreviewAudience(editor)
  usePreviewReadOnly(editor, previewAudience !== null)
  useRepairVariations(editor)
  const {sectionObjectTypes, dimensions} = useAudienceConfig()
  const behaviors = useMemo(
    () =>
      createAudienceVariantBehaviors({
        objectTypes: sectionObjectTypes,
        dimensions: dimensions.map((d) => d.name),
      }),
    [sectionObjectTypes, dimensions],
  )

  const fullscreenHost = useFullscreenBarHost(editor)
  const bar = <PreviewBar value={previewAudience} onChange={setPreviewAudience} />

  return (
    <>
      <BehaviorPlugin behaviors={behaviors} />
      <NodePlugin nodes={audienceVariantContainers} />
      {/* In fullscreen the editor covers this spot, so the bar moves into it. */}
      {fullscreenHost ? createPortal(bar, fullscreenHost) : bar}
    </>
  )
}

/** The "Preview as" switch, plus "Back to editing" while previewing. */
function PreviewBar({
  value,
  onChange,
}: {
  value: PreviewFilter | null
  onChange: (filter: PreviewFilter | null) => void
}) {
  return (
    <Card
      padding={1}
      radius={2}
      tone={value ? 'caution' : 'default'}
      style={{transition: 'background-color 120ms'}}
    >
      <Flex align="center" gap={2} wrap="wrap">
        {value && (
          <Flex align="center" gap={2}>
            <Text size={1} style={{paddingLeft: 4}}>
              Read-only preview
            </Text>
            <Button
              fontSize={1}
              padding={2}
              mode="ghost"
              text="Back to editing"
              onClick={() => onChange(null)}
            />
          </Flex>
        )}

        <Flex align="center" gap={2} style={{marginLeft: 'auto'}}>
          <Text size={1} muted>
            <EyeOpenIcon />
          </Text>
          <Text size={1} muted style={{whiteSpace: 'nowrap'}}>
            Preview as
          </Text>
          <AudienceSelect
            compact
            aria-label="Preview as"
            selection={value ?? {}}
            onChange={(dimension, ids) => onChange({...value, [dimension]: ids})}
            emptyLabel={<Muted>Choose who…</Muted>}
          />
        </Flex>
      </Flex>
    </Card>
  )
}
