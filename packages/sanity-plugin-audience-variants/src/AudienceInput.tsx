import {type ObjectFieldProps, type ObjectInputProps, set, setIfMissing, unset} from 'sanity'
import {AudienceSelect, Muted} from './AudienceSelect'
import {AUDIENCE_TYPE, DEFAULT_LABEL} from './constants'
import {useAudienceConfig} from './context'
import {selectionOf} from './resolve'

/**
 * Input for the document-level `audienceTargeting` field. Same picker as a
 * variant in the body and the "Preview as" bar. Nothing picked means the
 * Default Audience (every reader).
 */
export function AudienceInput(props: ObjectInputProps) {
  const {onChange, readOnly} = props
  const {dimensions} = useAudienceConfig()
  const selection = selectionOf(props.value, dimensions)

  const handleChange = (dimension: string, ids: string[]) => {
    if (ids.length) {
      onChange([setIfMissing({_type: AUDIENCE_TYPE}), set(ids, [dimension])])
      return
    }
    // Clearing the last pick returns the field to empty, i.e. the Default Audience.
    const othersPicked = dimensions.some(
      ({name}) => name !== dimension && selection[name].length,
    )
    onChange(othersPicked ? unset([dimension]) : unset())
  }

  return (
    <AudienceSelect
      selection={selection}
      onChange={handleChange}
      readOnly={readOnly}
      emptyLabel={
        <>
          {DEFAULT_LABEL} <Muted>· everyone</Muted>
        </>
      }
      hint="Leave a group empty to include all of it. Leave everything empty for the Default Audience: everyone."
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
