import {useEditor, useEditorSelector} from '@portabletext/editor'
import {BehaviorPlugin} from '@portabletext/editor/plugins'
import {getSelectedBlocks} from '@portabletext/editor/selectors'
import {EyeOpenIcon} from '@sanity/icons/EyeOpen'
import {UsersIcon} from '@sanity/icons/Users'
import {Button, Card, Flex, Select, Text} from '@sanity/ui'
import {audienceVariantBehaviors, wrapShortcut} from './behaviors'
import {WRAP_EVENT} from './constants'
import {useAudienceConfig} from './context'
import {usePreviewAudience} from './previewAudience'

const EDITING = ''

/**
 * Portable Text Editor plugin: registers the wrap/unwrap behaviors and renders
 * a bar with the "Wrap in audience variation" action and an editor-wide
 * "Preview as" audience switch.
 */
export function AudienceVariantsPlugin() {
  const editor = useEditor()
  const {audiences} = useAudienceConfig()
  const [previewAudience, setPreviewAudience] = usePreviewAudience(editor)
  const canWrap = useEditorSelector(editor, (snapshot) => {
    const selected = getSelectedBlocks(snapshot)
    const textBlockType = snapshot.context.schema.block.name
    return selected.length > 0 && selected.every(({node}) => node._type === textBlockType)
  })

  return (
    <>
      <BehaviorPlugin behaviors={audienceVariantBehaviors} />
      <Card
        padding={1}
        radius={2}
        tone={previewAudience ? 'caution' : 'default'}
        style={{transition: 'background-color 120ms'}}
      >
        <Flex align="center" gap={2} wrap="wrap">
          <Button
            icon={UsersIcon}
            mode="ghost"
            fontSize={1}
            padding={2}
            text="Wrap in audience variation"
            disabled={!canWrap}
            // Keep editor focus/selection while clicking.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.send({type: WRAP_EVENT})}
          />
          <Text size={0} muted>
            {wrapShortcut.keys.map((k) => k.replace(/^Key/, '')).join(' + ')}
          </Text>

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
