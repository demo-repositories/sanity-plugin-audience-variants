import {SearchIcon} from '@sanity/icons/Search'
import {Box, Button, Card, Checkbox, Flex, Stack, Text, TextInput} from '@sanity/ui'
import {Fragment, type ReactNode, useState} from 'react'
import type {AudienceDimension, AudienceDimensionValue, Selection} from './config'
import {useAudienceConfig} from './context'

/** Show the search box once the dimensions have more values than this between them. */
const SEARCH_THRESHOLD = 10

/**
 * Popover body for picking who sees something: one group of selectable rows
 * per dimension (regions, audiences…), each with a count and an All / Clear
 * toggle, and a short hint underneath. Shared by the variant picker in the
 * body and the document-level audience field, so both pick audiences the
 * same way.
 *
 * In a popover with `constrainSize`, long lists scroll between a fixed search
 * box (which filters the rows) and the hint, with each group's heading
 * pinned while its rows scroll past. While searching, the All / Clear toggle
 * applies to the matching rows only.
 *
 * `takenBy` lets the caller block options (the variant picker uses it so a
 * reader is never reached by two variants); it returns a reason or nothing.
 */
export function AudienceChecklist({
  selection,
  onChange,
  takenBy,
  disabled,
  hint,
}: {
  selection: Selection
  onChange: (dimension: string, ids: string[]) => void
  takenBy?: (dimension: string, value: AudienceDimensionValue) => string | undefined
  disabled?: boolean
  hint?: ReactNode
}) {
  const {dimensions, dimensionList} = useAudienceConfig()
  const searchable = dimensions.reduce((n, d) => n + d.values.length, 0) > SEARCH_THRESHOLD
  const [query, setQuery] = useState('')
  const q = searchable ? query.trim().toLowerCase() : ''

  const matches = (v: AudienceDimensionValue) =>
    !q || v.title.toLowerCase().includes(q) || Boolean(v.shortTitle?.toLowerCase().includes(q))

  const group = ({name, title, values}: AudienceDimension, shown: AudienceDimensionValue[]) => {
    const ids = selection[name] ?? []
    const count = values.filter((v) => ids.includes(v.id)).length
    const allOn = shown.every((v) => ids.includes(v.id))
    const toggle = (id: string) =>
      onChange(name, ids.includes(id) ? ids.filter((s) => s !== id) : [...ids, id])
    const free = shown.filter((v) => !ids.includes(v.id) && !takenBy?.(name, v)).map((v) => v.id)
    const shownIds = new Set(shown.map((v) => v.id))
    return (
      <Stack gap={1}>
        <Card paddingLeft={2} paddingY={1} style={{position: 'sticky', top: 0, zIndex: 1}}>
          <Flex align="center" gap={2}>
            <Box flex={1}>
              <Text
                size={0}
                weight="semibold"
                muted
                style={{textTransform: 'uppercase', letterSpacing: '0.06em'}}
              >
                {title}
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
              text={
                q ? (allOn ? 'Clear matching' : 'Select matching') : allOn ? 'Clear' : 'Select all'
              }
              onClick={() =>
                onChange(name, allOn ? ids.filter((id) => !shownIds.has(id)) : [...ids, ...free])
              }
            />
          </Flex>
        </Card>
        {shown.map((v) => (
          <Option
            key={v.id}
            title={v.title}
            checked={ids.includes(v.id)}
            disabled={disabled}
            reason={ids.includes(v.id) ? undefined : takenBy?.(name, v)}
            onToggle={() => toggle(v.id)}
          />
        ))}
      </Stack>
    )
  }

  const groups = dimensions
    .map((dimension) => ({dimension, shown: dimension.values.filter(matches)}))
    .filter(({shown}) => shown.length)

  return (
    <Card
      radius={3}
      // A column the popover can shrink: search and hint stay put, the list scrolls.
      style={{
        width: 340,
        maxWidth: 'calc(100vw - 32px)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {searchable && (
        <Card padding={2} borderBottom style={{flexShrink: 0}}>
          <TextInput
            fontSize={1}
            icon={SearchIcon}
            placeholder={`Search ${dimensionList}`}
            aria-label={`Search ${dimensionList}`}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            clearButton={Boolean(query)}
            onClear={() => setQuery('')}
          />
        </Card>
      )}
      {/* Unpadded scroller, so pinned headings sit flush with its top edge. */}
      <Box style={{overflowY: 'auto', minHeight: 0}}>
        <Stack gap={3} padding={2} paddingTop={3}>
          {groups.map(({dimension, shown}, i) => (
            <Fragment key={dimension.name}>
              {i > 0 && <Card borderTop marginX={2} />}
              {group(dimension, shown)}
            </Fragment>
          ))}
          {!groups.length && (
            <Box padding={2}>
              <Text size={1} muted>
                Nothing matches “{query.trim()}”
              </Text>
            </Box>
          )}
        </Stack>
      </Box>
      {hint && (
        <Card
          borderTop
          paddingX={4}
          paddingY={3}
          tone="transparent"
          radius={3}
          style={{flexShrink: 0}}
        >
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
