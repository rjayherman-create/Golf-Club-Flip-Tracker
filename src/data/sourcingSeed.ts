import type {
  GolfLeadItem,
  GolfLeadRadar,
  LeadFollowup,
  SourcingLocation,
  SourcingRadarSettings,
  SourcingSource,
} from '../types'

function nowIso() {
  return new Date().toISOString()
}

function makeSource(source: Omit<SourcingSource, 'id' | 'created_at' | 'updated_at'>): SourcingSource {
  const timestamp = nowIso()
  return {
    id: crypto.randomUUID(),
    created_at: timestamp,
    updated_at: timestamp,
    ...source,
  }
}

function makeLocation(location: Omit<SourcingLocation, 'id' | 'created_at'>): SourcingLocation {
  return {
    id: crypto.randomUUID(),
    created_at: nowIso(),
    ...location,
  }
}

export const sourcingSourceSeeds: SourcingSource[] = [
  makeSource({
    source_name: 'Facebook Marketplace - LI Golf Alerts',
    source_type: 'facebook_manual',
    base_url: 'https://www.facebook.com/marketplace/',
    enabled: true,
    compliance_notes: 'Manual import only. User pastes URL, title, photos, and listing details.',
  }),
  makeSource({
    source_name: 'Craigslist - NYC Golf',
    source_type: 'craigslist',
    base_url: 'https://newyork.craigslist.org/',
    enabled: true,
    compliance_notes: 'Respect rate limits, no login bypass, no CAPTCHA bypass, store only listing facts.',
  }),
  makeSource({
    source_name: 'Estate Sale Roundup',
    source_type: 'estate_sale',
    base_url: 'https://www.estatesales.net/',
    enabled: true,
    compliance_notes: 'Use public listings only and keep original source URLs.',
  }),
  makeSource({
    source_name: 'Garage Sale Scout',
    source_type: 'garage_sale',
    base_url: '',
    enabled: true,
    compliance_notes: 'Manual import and local scouting only.',
  }),
]

export const sourcingLocationSeeds: SourcingLocation[] = [
  makeLocation({ location_name: 'Long Island', county: 'Nassau', state: 'NY', zone_type: 'primary', priority_score: 100, max_drive_minutes: 90 }),
  makeLocation({ location_name: 'Nassau County', county: 'Nassau', state: 'NY', zone_type: 'primary', priority_score: 98, max_drive_minutes: 75 }),
  makeLocation({ location_name: 'Suffolk County', county: 'Suffolk', state: 'NY', zone_type: 'primary', priority_score: 96, max_drive_minutes: 90 }),
  makeLocation({ location_name: 'Queens', county: 'Queens', state: 'NY', zone_type: 'primary', priority_score: 95, max_drive_minutes: 60 }),
  makeLocation({ location_name: 'Brooklyn', county: 'Kings', state: 'NY', zone_type: 'primary', priority_score: 94, max_drive_minutes: 70 }),
  makeLocation({ location_name: 'Bronx', county: 'Bronx', state: 'NY', zone_type: 'primary', priority_score: 84, max_drive_minutes: 75 }),
  makeLocation({ location_name: 'Manhattan', county: 'New York', state: 'NY', zone_type: 'primary', priority_score: 82, max_drive_minutes: 60 }),
  makeLocation({ location_name: 'Staten Island', county: 'Richmond', state: 'NY', zone_type: 'primary', priority_score: 80, max_drive_minutes: 75 }),
  makeLocation({ location_name: 'Westchester County', county: 'Westchester', state: 'NY', zone_type: 'primary', priority_score: 88, max_drive_minutes: 70 }),
  makeLocation({ location_name: 'North Jersey', county: 'Bergen', state: 'NJ', zone_type: 'secondary', priority_score: 62, max_drive_minutes: 90 }),
  makeLocation({ location_name: 'Fairfield County', county: 'Fairfield', state: 'CT', zone_type: 'secondary', priority_score: 60, max_drive_minutes: 90 }),
  makeLocation({ location_name: 'Hudson Valley', county: 'Various', state: 'NY', zone_type: 'secondary', priority_score: 58, max_drive_minutes: 120 }),
  makeLocation({ location_name: 'Rockland County', county: 'Rockland', state: 'NY', zone_type: 'secondary', priority_score: 59, max_drive_minutes: 90 }),
  makeLocation({ location_name: 'Putnam County', county: 'Putnam', state: 'NY', zone_type: 'secondary', priority_score: 54, max_drive_minutes: 90 }),
  makeLocation({ location_name: 'Southern Connecticut', county: 'Various', state: 'CT', zone_type: 'secondary', priority_score: 55, max_drive_minutes: 120 }),
  makeLocation({ location_name: 'Nearby NYC Suburbs', county: 'Various', state: 'NY', zone_type: 'secondary', priority_score: 57, max_drive_minutes: 90 }),
]

export const sourcingRadarSeedSettings: SourcingRadarSettings = {
  base_zip_code: '11747',
  max_drive_time_minutes: 90,
  primary_counties: ['Nassau', 'Suffolk', 'Queens', 'Brooklyn', 'Bronx', 'Manhattan', 'Staten Island', 'Westchester'],
  secondary_counties: ['North Jersey', 'Fairfield', 'Hudson Valley', 'Rockland', 'Putnam', 'Southern Connecticut'],
  minimum_profit_target: 25,
  minimum_deal_score: 55,
  auto_fetch_runs_per_day: 2,
  allow_high_frequency_auto: false,
  source_enablement: {
    craigslist: true,
    facebook_manual: true,
    offerup_manual: true,
    ebay_local_manual: true,
    estate_sale: true,
    garage_sale: true,
    other: true,
  },
  keyword_rules: [
    'golf clubs',
    'golf club set',
    'golf clubs lot',
    'golf bag clubs',
    'full golf set',
    'used golf clubs',
    'golf bag',
    'stand bag',
    'driver irons putter',
    'irons set',
    'wedge set',
  ],
  brand_priority: [
    'Titleist',
    'Scotty Cameron',
    'Ping',
    'Callaway',
    'TaylorMade',
    'Mizuno',
    'Cobra',
    'Cleveland',
    'Odyssey',
    'PXG',
    'Srixon',
    'Vokey',
    'Bettinardi',
    'Evnroll',
  ],
}

export const golfLeadRadarSeeds: GolfLeadRadar[] = []

export const golfLeadItemSeeds: GolfLeadItem[] = []

export const leadFollowupSeeds: LeadFollowup[] = []
