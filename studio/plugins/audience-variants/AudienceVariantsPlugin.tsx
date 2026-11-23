import {useEditor, useEditorSelector} from '@portabletext/editor'
import {BehaviorPlugin, NodePlugin} from '@portabletext/editor/plugins'
import {EyeOpenIcon} from '@sanity/icons/EyeOpen'
import {Button, Card, Flex, Select, Text} from '@sanity/ui'
import {useEffect} from 'react'
import {audienceVariantBehaviors, hasStrayVariantMembers} from './behaviors'
import {REPAIR_EVENT} from './constants'
import {audienceVariantContainers} from './containers'
import {useAudienceConfig} from './context'
import {usePreviewAudience} from './previewAudience'

/** "All regions" / "All audiences": that dimension isn't filtered. */
const ANY = ''

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
  const {regions, audiences} = useAudienceConfig()
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
            <Flex align="center" gap={2}>
              <Text size={1} style={{paddingLeft: 4}}>
                Read-only preview
              </Text>
              <Button
                fontSize={1}
                padding={2}
                mode="ghost"
                text="Back to editing"
                onClick={() => setPreviewAudience(null)}
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
            <Select
              fontSize={1}
              padding={2}
              aria-label="Preview region"
              value={previewAudience?.region ?? ANY}
              onChange={(e) =>
                setPreviewAudience({
                  ...previewAudience,
                  region: e.currentTarget.value || undefined,
                })
              }
            >
              <option value={ANY}>All regions</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
            <Select
              fontSize={1}
              padding={2}
              aria-label="Preview audience"
              value={previewAudience?.audience ?? ANY}
              onChange={(e) =>
                setPreviewAudience({
                  ...previewAudience,
                  audience: e.currentTarget.value || undefined,
                })
              }
            >
              <option value={ANY}>All audiences</option>
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
