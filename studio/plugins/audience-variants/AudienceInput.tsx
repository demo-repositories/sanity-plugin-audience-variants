import {type ObjectFieldProps, type ObjectInputProps, set, setIfMissing, unset} from 'sanity'
import type {AudienceField} from './AudienceChecklist'
import {AudienceSelect, Muted} from './AudienceSelect'
import {AUDIENCE_TYPE, DEFAULT_LABEL} from './constants'
import type {AudienceValue} from './resolve'

/**
 * Input for the document-level `audienceTargeting` field. Same picker as a
 * variant in the body and the "Preview as" bar. Nothing picked means the
 * Default Audience (every reader).
 */
export function AudienceInput(props: ObjectInputProps) {
  const {onChange, readOnly} = props
  const value = props.value as AudienceValue | undefined
  const regions = value?.regions ?? []
  const audiences = value?.audiences ?? []

  const handleChange = (field: AudienceField, ids: string[]) => {
    if (ids.length) {
      onChange([setIfMissing({_type: AUDIENCE_TYPE}), set(ids, [field])])
      return
    }
    // Clearing the last pick returns the field to empty, i.e. the Default Audience.
    const other = field === 'regions' ? audiences : regions
    onChange(other.length ? unset([field]) : unset())
  }

  return (
    <AudienceSelect
      regions={regions}
      audiences={audiences}
      onChange={handleChange}
      readOnly={readOnly}
      emptyLabel={
        <>
          {DEFAULT_LABEL} <Muted>· everyone</Muted>
        </>
      }
      hint="Leave a group empty to include all of it. Leave both empty for the Default Audience: everyone."
    />
  )
}

/**
 * Object fields below the top level get an indented left rule, which made
 * this one-line field look like a nested group. Render it like a plain field.
 */
export function AudienceFieldComponent(props: ObjectFieldProps) {
  return props.renderDefault({...props, level: 0})
}
