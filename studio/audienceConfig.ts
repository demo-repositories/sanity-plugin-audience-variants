import type {AudienceDimensionValue} from 'sanity-plugin-audience-variants'

/**
 * Regions and audience types, shared by the Studio config and migration
 * scripts. Ids are placeholders until we have the real ones from the existing
 * schema; titles match the current Studio. `shortTitle` is used in the
 * one-line label above each variant.
 */
export const regions: AudienceDimensionValue[] = [
  {id: 'global', title: 'Global'},
  {id: 'apec', title: 'Asia Pacific excluding China (APEC)', shortTitle: 'APEC'},
  {id: 'cala', title: 'Caribbean and Latin America (CALA)', shortTitle: 'CALA'},
  {id: 'emea', title: 'Europe, Middle East and Africa (EMEA)', shortTitle: 'EMEA'},
  {id: 'gc', title: 'Greater China (GC)', shortTitle: 'GC'},
  {id: 'uscan', title: 'U.S. and Canada (US/CAN)', shortTitle: 'US/CAN'},
]

export const audiences: AudienceDimensionValue[] = [
  {
    id: 'managedAssociates',
    title: 'Marriott International Managed Associates',
    shortTitle: 'Managed Associates',
  },
  {
    id: 'franchisees',
    title: 'Franchisees & Hotel Partners',
    shortTitle: 'Franchisees & Partners',
  },
  {id: 'hotelOwners', title: 'Hotel Owners'},
  {id: 'contractors', title: 'Contractors'},
  {id: 'contractorBusinessApps', title: 'Contractor Business Apps'},
]
