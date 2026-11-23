import {useEditor, useEditorSelector} from '@portabletext/editor'
import {BehaviorPlugin, NodePlugin} from '@portabletext/editor/plugins'
import {EyeOpenIcon} from '@sanity/icons/EyeOpen'
import {Card, Flex, Select, Text} from '@sanity/ui'
import {useEffect} from 'react'
import {audienceVariantBehaviors, hasStrayVariantMembers} from './behaviors'
import {REPAIR_EVENT} from './constants'
import {audienceVariantContainers} from './containers'
import {useAudienceConfig} from './context'
import {usePreviewAudience} from './previewAudience'

const EDITING = ''

/**
 * Portable Text Editor plugin: registers the behaviors and inline-editing
 * containers, and renders a bar with an editor-wide "Preview as" audience switch.
 */
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

export function AudienceVariantsPlugin() {
  const editor = useEditor()
  const {audiences} = useAudienceConfig()
  const [previewAudience, setPreviewAudience] = usePreviewAudience(editor)
  usePreviewReadOnly(editor, previewAudience !== null)
  useRepairVariations(editor)

  return (
    <>
      <BehaviorPlugin behaviors={audienceVariantBehaviors} />
      <NodePlugin nodes={audienceVariantContainers} />
      <Card
        padding={1}
        radius={2}
        tone={previewAudience ? 'caution' : 'default'}
        style={{transition: 'background-color 120ms'}}
      >
        <Flex align="center" gap={2} wrap="wrap">
          {previewAudience && (
            <Text size={1} style={{paddingLeft: 4}}>
              Read-only preview — switch back to edit
            </Text>
          )}

          <Flex align="center" gap={2} style={{marginLeft: 'auto'}}>
            <Text size={1} muted>
              <EyeOpenIcon />
            </Text>
            <Text size={1} muted style={{whiteSpace: 'nowrap'}}>
              Preview as
            </Text>
            <Select
              fontSize={1}
              padding={2}
              value={previewAudience ?? EDITING}
              onChange={(e) => setPreviewAudience(e.currentTarget.value || null)}
            >
              <option value={EDITING}>All variants (editing)</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </Select>
          </Flex>
        </Flex>
      </Card>
    </>
  )
}
