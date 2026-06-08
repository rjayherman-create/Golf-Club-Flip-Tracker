import type {
  GolfLeadItem,
  GolfLeadRadar,
  LeadFollowup,
  SourcingLocation,
  SourcingRadarSettings,
  SourcingSource,
} from '../types'
import { classifyDealLabel, estimateGolfValue } from '../utils/valuation'

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

function makeRadarLead(
  lead: Omit<
    GolfLeadRadar,
    | 'id'
    | 'estimated_resale_low'
    | 'estimated_resale_high'
    | 'estimated_resale_average'
    | 'estimated_profit_low'
    | 'estimated_profit_high'
    | 'deal_score'
    | 'deal_label'
    | 'created_at'
    | 'updated_at'
  >,
) {
  const valuation = estimateGolfValue({
    asking_price: lead.asking_price,
    brand_detected: lead.brand_detected,
    model_detected: lead.model_detected,
    club_type_detected: lead.club_type_detected,
    shipping_required: lead.shipping_required,
    pickup_available: lead.pickup_available,
    local_delivery_available: lead.local_delivery_available,
    distance_miles: lead.distance_miles,
    estimated_drive_minutes: lead.estimated_drive_minutes,
    condition_grade: lead.notes.toLowerCase().includes('excellent') ? 'Excellent' : 'Good',
  })

  const deal_score = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (valuation.confidence_score * 0.35) +
          (lead.pickup_available ? 15 : 0) +
          (lead.local_delivery_available ? 10 : 0) +
          (lead.shipping_required ? -35 : 10) +
          (lead.distance_miles <= 25 ? 12 : 0) +
          (lead.asking_price > 0 && valuation.expected_profit > 0 ? 18 : 0),
      ),
    ),
  )

  const estimated_resale_low = valuation.estimated_resale_low
  const estimated_resale_high = valuation.estimated_resale_high
  const estimated_resale_average = valuation.estimated_resale_average
  const estimated_profit_low = Number((estimated_resale_low - lead.asking_price).toFixed(2))
  const estimated_profit_high = Number((estimated_resale_high - lead.asking_price).toFixed(2))

  return {
    id: crypto.randomUUID(),
    created_at: nowIso(),
    updated_at: nowIso(),
    ...lead,
    estimated_resale_low,
    estimated_resale_high,
    estimated_resale_average,
    estimated_profit_low,
    estimated_profit_high,
    deal_score,
    deal_label: classifyDealLabel(deal_score),
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

export const golfLeadRadarSeeds: GolfLeadRadar[] = [
  makeRadarLead({
    source_id: sourcingSourceSeeds[0].id,
    source_name: sourcingSourceSeeds[0].source_name,
    source_url: 'https://www.facebook.com/marketplace/item/alpha-titleist-vokey',
    title: 'Titleist Vokey SM8 56 Degree Wedge',
    description: 'Manual import from Facebook Marketplace. Pickup only in Huntington. Clear face and shaft photos included.',
    asking_price: 40,
    location_text: 'Huntington, NY',
    city: 'Huntington',
    county: 'Suffolk',
    state: 'NY',
    latitude: null,
    longitude: null,
    distance_miles: 18,
    estimated_drive_minutes: 28,
    pickup_available: true,
    local_delivery_available: false,
    shipping_required: false,
    brand_detected: 'Titleist',
    model_detected: 'Vokey SM8',
    club_type_detected: 'wedge',
    status: 'new',
    seller_name_optional: 'Mike',
    seller_contact_optional: '',
    buyer_contact_optional: '',
    image_urls: [],
    notes: 'Good shape with normal face wear.',
    last_checked_at: nowIso(),
  }),
  makeRadarLead({
    source_id: sourcingSourceSeeds[1].id,
    source_name: sourcingSourceSeeds[1].source_name,
    source_url: 'https://newyork.craigslist.org/gbs/d/queens-taylormade-sim2-max-driver/12345.html',
    title: 'TaylorMade SIM2 Max Driver 10.5',
    description: 'Public listing from Craigslist. No shipping, local pickup in Queens.',
    asking_price: 70,
    location_text: 'Queens, NY',
    city: 'Queens',
    county: 'Queens',
    state: 'NY',
    latitude: null,
    longitude: null,
    distance_miles: 24,
    estimated_drive_minutes: 35,
    pickup_available: true,
    local_delivery_available: true,
    shipping_required: false,
    brand_detected: 'TaylorMade',
    model_detected: 'SIM2 Max',
    club_type_detected: 'driver',
    status: 'researching',
    seller_name_optional: '',
    seller_contact_optional: '',
    buyer_contact_optional: '',
    image_urls: [],
    notes: 'Need original photos and shaft label.',
    last_checked_at: nowIso(),
  }),
  makeRadarLead({
    source_id: sourcingSourceSeeds[2].id,
    source_name: sourcingSourceSeeds[2].source_name,
    source_url: 'https://www.estatesales.net/NY/Westchester',
    title: 'Mixed Golf Bag Lot with Callaway and Ping',
    description: 'Estate sale lot with bag, driver, putter, wedges, and iron set. Local pickup only.',
    asking_price: 150,
    location_text: 'White Plains, NY',
    city: 'White Plains',
    county: 'Westchester',
    state: 'NY',
    latitude: null,
    longitude: null,
    distance_miles: 39,
    estimated_drive_minutes: 52,
    pickup_available: true,
    local_delivery_available: false,
    shipping_required: false,
    brand_detected: 'Callaway',
    model_detected: 'Mixed lot',
    club_type_detected: 'full_set',
    status: 'contacted',
    seller_name_optional: 'Estate Office',
    seller_contact_optional: '',
    buyer_contact_optional: '',
    image_urls: [],
    notes: 'Strong lot if full set is complete.',
    last_checked_at: nowIso(),
  }),
  makeRadarLead({
    source_id: sourcingSourceSeeds[0].id,
    source_name: sourcingSourceSeeds[0].source_name,
    source_url: 'https://www.facebook.com/marketplace/item/bad-shipping-listing',
    title: 'Scotty Cameron Newport Putters - Ship Only',
    description: 'User notes shipping only. Avoid for local pickup model.',
    asking_price: 200,
    location_text: 'Brooklyn, NY',
    city: 'Brooklyn',
    county: 'Kings',
    state: 'NY',
    latitude: null,
    longitude: null,
    distance_miles: 21,
    estimated_drive_minutes: 40,
    pickup_available: false,
    local_delivery_available: false,
    shipping_required: true,
    brand_detected: 'Scotty Cameron',
    model_detected: 'Newport',
    club_type_detected: 'putter',
    status: 'passed',
    seller_name_optional: '',
    seller_contact_optional: '',
    buyer_contact_optional: '',
    image_urls: [],
    notes: 'Shipping required - avoid.',
    last_checked_at: nowIso(),
  }),
]

export const golfLeadItemSeeds: GolfLeadItem[] = [
  {
    id: crypto.randomUUID(),
    lead_id: golfLeadRadarSeeds[0].id,
    item_type: 'wedge',
    brand: 'Titleist',
    model: 'Vokey SM8',
    shaft: 'Dynamic Gold',
    flex: 'Wedge Flex',
    condition_grade: 'Good',
    estimated_individual_resale_low: 65,
    estimated_individual_resale_high: 90,
    notes: 'Primary resale item.',
  },
  {
    id: crypto.randomUUID(),
    lead_id: golfLeadRadarSeeds[1].id,
    item_type: 'driver',
    brand: 'TaylorMade',
    model: 'SIM2 Max',
    shaft: 'Ventus Blue',
    flex: 'Regular',
    condition_grade: 'Very Good',
    estimated_individual_resale_low: 120,
    estimated_individual_resale_high: 160,
    notes: 'Strong brand/model combo.',
  },
]

export const leadFollowupSeeds: LeadFollowup[] = [
  {
    id: crypto.randomUUID(),
    lead_id: golfLeadRadarSeeds[0].id,
    followup_type: 'message_seller',
    due_date: new Date().toISOString().slice(0, 10),
    completed: false,
    notes: 'Request shaft and grip closeups.',
    created_at: nowIso(),
  },
  {
    id: crypto.randomUUID(),
    lead_id: golfLeadRadarSeeds[2].id,
    followup_type: 'inspect_clubs',
    due_date: new Date().toISOString().slice(0, 10),
    completed: false,
    notes: 'Confirm full iron set is complete before driving over.',
    created_at: nowIso(),
  },
]
