import {definePlugin, type LayoutProps} from 'sanity'
import {type AudienceVariantsConfig, resolveAudienceConfig} from './config'
import {AudienceConfigContext} from './context'
import {createSchemaTypes} from './schema'

/**
 * Studio plugin: registers the `audienceVariation` / `audienceVariant` object
 * types and makes the audience config available to the editor components.
 *
 * ```ts
 * plugins: [audienceVariants({regions: [...], ownershipTypes: [...]})]
 * ```
 *
 * Then add a field with `defineAudienceVariantsField({name: 'body'})`.
 */
export const audienceVariants = definePlugin<AudienceVariantsConfig>((config) => {
  const resolved = resolveAudienceConfig(config)

  function AudienceConfigLayout(props: LayoutProps) {
    return (
      <AudienceConfigContext.Provider value={resolved}>
        {props.renderDefault(props)}
      </AudienceConfigContext.Provider>
    )
  }

  return {
    name: 'audience-variants',
    schema: {types: createSchemaTypes(resolved)},
    studio: {components: {layout: AudienceConfigLayout}},
  }
})
