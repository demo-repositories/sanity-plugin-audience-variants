import {Box, Button, Card, Checkbox, Flex, Stack, Text} from '@sanity/ui'
import {type ReactNode, useState} from 'react'
import type {AudienceDimensionValue} from './config'
import {useAudienceConfig} from './context'

export type AudienceField = 'regions' | 'audiences'

/**
 * Popover body for picking who sees something: regions and audiences as two
 * groups of selectable rows, each with a count and an All / Clear toggle,
 * and a short hint underneath. Shared by the variant picker in the body and
 * the document-level audience field, so both pick audiences the same way.
 *
 * `takenBy` lets the caller block options (the variant picker uses it so a
 * reader is never reached by two variants); it returns a reason or nothing.
 */
export function AudienceChecklist({
  regions,
  audiences,
  onChange,
  takenBy,
  disabled,
  hint,
}: {
  regions: string[]
  audiences: string[]
  onChange: (field: AudienceField, ids: string[]) => void
  takenBy?: (field: AudienceField, value: AudienceDimensionValue) => string | undefined
  disabled?: boolean
  hint?: ReactNode
}) {
  const config = useAudienceConfig()
  const selected = {regions, audiences}

  const group = (field: AudienceField, heading: string, values: AudienceDimensionValue[]) => {
    const ids = selected[field]
    const count = values.filter((v) => ids.includes(v.id)).length
    const allOn = count === values.length
    const toggle = (id: string) =>
      onChange(field, ids.includes(id) ? ids.filter((s) => s !== id) : [...ids, id])
    const free = values.filter((v) => ids.includes(v.id) || !takenBy?.(field, v))
    return (
      <Stack gap={1}>
        <Flex align="center" gap={2} paddingLeft={2} paddingBottom={1}>
          <Box flex={1}>
            <Text
              size={0}
              weight="semibold"
              muted
              style={{textTransform: 'uppercase', letterSpacing: '0.06em'}}
            >
              {heading}
            </Text>
          </Box>
          {count > 0 && (
            <Text size={0} muted>
              {count} of {values.length}
            </Text>
          )}
          <Button
            fontSize={0}
            padding={2}
            mode="bleed"
            tone="primary"
            disabled={disabled}
            text={allOn ? 'Clear' : 'Select all'}
            onClick={() => onChange(field, allOn ? [] : free.map((v) => v.id))}
          />
        </Flex>
        {values.map((v) => (
          <Option
            key={v.id}
            title={v.title}
            checked={ids.includes(v.id)}
            disabled={disabled}
            reason={ids.includes(v.id) ? undefined : takenBy?.(field, v)}
            onToggle={() => toggle(v.id)}
          />
        ))}
      </Stack>
    )
  }

  return (
    <Card radius={3} style={{width: 340, maxWidth: 'calc(100vw - 32px)'}}>
      <Stack gap={3} padding={2} paddingTop={3}>
        {group('regions', 'Regions', config.regions)}
        <Card borderTop marginX={2} />
        {group('audiences', 'Audiences', config.audiences)}
      </Stack>
      {hint && (
        <Card borderTop paddingX={4} paddingY={3} tone="transparent" radius={3}>
          <Text size={1} muted>
            {hint}
          </Text>
        </Card>
      )}
    </Card>
  )
}

/** One selectable row: the whole row toggles, and it tints while ticked. */
function Option({
  title,
  checked,
  disabled,
  reason,
  onToggle,
}: {
  title: string
  checked: boolean
  disabled?: boolean
  reason?: string
  onToggle: () => void
}) {
  const [hover, setHover] = useState(false)
  const off = disabled || Boolean(reason)
  return (
    <Card
      as="label"
      radius={2}
      paddingX={2}
      paddingY={2}
      tone={checked ? 'primary' : 'default'}
      title={reason}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: off ? 'not-allowed' : 'pointer',
        background: checked
          ? undefined
          : hover && !off
            ? 'var(--card-muted-bg-color)'
            : 'transparent',
        transition: 'background-color 80ms',
      }}
    >
      <Flex align="center" gap={3}>
        <Checkbox checked={checked} disabled={off} onChange={onToggle} />
        <Box flex={1}>
          <Text size={1} muted={Boolean(reason)} weight={checked ? 'medium' : 'regular'}>
            {title}
          </Text>
        </Box>
        {reason && (
          <Text size={0} muted>
            In another variant
          </Text>
        )}
      </Flex>
    </Card>
  )
}
