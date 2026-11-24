import {ChevronDownIcon} from '@sanity/icons/ChevronDown'
import {UsersIcon} from '@sanity/icons/Users'
import {Box, Card, Flex, Text, useClickOutsideEvent} from '@sanity/ui'
import {Popover} from '@sanity/ui/popover'
import {type ReactNode, useEffect, useState} from 'react'
import {AudienceChecklist} from './AudienceChecklist'
import type {Selection} from './config'
import {useAudienceConfig} from './context'
import {audienceLabel} from './resolve'

/**
 * A select-style button showing who's picked ("EMEA · Partners") that
 * opens the checklist of every dimension. Used by the document audience
 * field and the body's "Preview as" bar. Nothing picked shows `emptyLabel`.
 */
export function AudienceSelect({
  selection,
  onChange,
  readOnly,
  hint,
  emptyLabel,
  compact,
  'aria-label': ariaLabel,
}: {
  selection: Selection
  onChange: (dimension: string, ids: string[]) => void
  readOnly?: boolean
  hint?: ReactNode
  /** Label when nothing is picked; may include muted parts. */
  emptyLabel: ReactNode
  /** Smaller, for toolbars. */
  compact?: boolean
  'aria-label'?: string
}) {
  const config = useAudienceConfig()
  const [open, setOpen] = useState(false)
  const [button, setButton] = useState<HTMLElement | null>(null)
  const [popover, setPopover] = useState<HTMLElement | null>(null)
  useClickOutsideEvent(open && (() => setOpen(false)), () => [button, popover])
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const empty = !Object.values(selection).some((ids) => ids.length)

  return (
    <Popover
      open={open}
      portal
      // Toolbar triggers sit at the right edge, so open leftwards from there.
      placement={compact ? 'bottom-end' : 'bottom-start'}
      ref={setPopover}
      content={
        <AudienceChecklist
          selection={selection}
          onChange={onChange}
          disabled={readOnly}
          hint={hint}
        />
      }
    >
      <Card
        as="button"
        type="button"
        ref={setButton}
        radius={2}
        padding={compact ? 2 : 3}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={readOnly}
        onClick={() => setOpen(!open)}
        style={{
          // Fixed in toolbars so the popover doesn't move as picks change the label.
          width: compact ? 240 : '100%',
          maxWidth: '100%',
          minWidth: 0,
          textAlign: 'left',
          cursor: readOnly ? 'default' : 'pointer',
          // Button cards drop the `border` prop's line; draw it like a select's.
          boxShadow: 'inset 0 0 0 1px var(--card-border-color)',
        }}
      >
        <Flex align="center" gap={compact ? 2 : 3}>
          <Text size={1} muted>
            <UsersIcon />
          </Text>
          <Box flex={1} style={{minWidth: 0}}>
            <Text size={1} textOverflow="ellipsis">
              {empty ? emptyLabel : audienceLabel(config, selection)}
            </Text>
          </Box>
          {!readOnly && (
            <Text size={1} muted>
              <ChevronDownIcon />
            </Text>
          )}
        </Flex>
      </Card>
    </Popover>
  )
}

/** A muted trailing part of a label, e.g. the "everyone" in "Default Audience · everyone". */
export function Muted({children}: {children: ReactNode}) {
  return <span style={{color: 'var(--card-muted-fg-color)'}}>{children}</span>
}
