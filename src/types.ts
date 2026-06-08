export type PageKey =
  | 'dashboard'
  | 'terms'
  | 'privacy'
  | 'analyze-loader'
  | 'saved-analyses'
  | 'club-flip'
  | 'lead-form'
  | 'lead-analyzer'
  | 'inventory'
  | 'listings'
  | 'sales'
  | 'csv-export'
  | 'sources'
  | 'value-guide'
  | 'settings'
  | 'audit'
  | 'sourcing-radar'
  | 'sourcing-add-facebook'
  | 'sourcing-craigslist'
  | 'sourcing-lead'
  | 'sourcing-settings'

export type LeadStatus =
  | 'New'
  | 'Research'
  | 'Watch'
  | 'Make Offer'
  | 'Negotiating'
  | 'Purchased'
  | 'Passed'
  | 'Lost'

export type InventoryStatus =
  | 'Needs Cleaning'
  | 'Ready to Photograph'
  | 'Ready to List'
  | 'Listed'
  | 'Sold'
  | 'Keep'
  | 'Bundle'
  | 'Archived'

export type Recommendation = 'BUY NOW' | 'NEGOTIATE' | 'WATCH' | 'PASS'

export type SourceType =
  | 'Facebook Marketplace'
  | 'Facebook Group'
  | 'Garage Sale'
  | 'Estate Sale'
  | 'Craigslist'
  | 'Play It Again Sports'
  | 'Thrift Store'
  | 'Golf Course / Range'
  | 'Referral'
  | 'Other'

export interface Lead {
  id: string
  createdAt: string
  title: string
  sourceType: SourceType
  sellerName: string
  town: string
  distance: number
  askingPrice: number
  sellerDescription: string
  listingUrl: string
  itemType: string
  brand: string
  model: string
  loft: string
  shaftFlex: 'Regular' | 'Stiff' | 'Senior' | 'Ladies' | 'Extra Stiff' | 'Unknown'
  hand: 'Right' | 'Left' | 'Unknown'
  condition: 'Excellent' | 'Very Good' | 'Good' | 'Fair' | 'Poor' | 'Damaged'
  gripCondition: 'Good' | 'Usable' | 'Needs replacement' | 'Unknown'
  notes: string
  status: LeadStatus
  ebayLow: number
  ebayAverage: number
  ebayHigh: number
  pgaValue: number
  retailUsedValue: number
  facebookEstimate: number
  manualEstimate: number
  cleaningCost: number
  gripCost: number
  travelCost: number
  conservativeResale: number
  fastSalePrice: number
  maxSafeOffer: number
  repairAdjustedMaxOffer: number
  expectedProfit: number
  roi: number
  dealGrade: string
  recommendation: Recommendation
  redFlags: string[]
}

export interface InventoryItem {
  id: string
  leadId: string
  purchaseDate: string
  source: string
  town: string
  itemName: string
  brand: string
  model: string
  clubType: string
  loft: string
  shaftFlex: string
  hand: string
  condition: string
  gripCondition: string
  purchasePrice: number
  allocatedCost: number
  cleaningCost: number
  repairCost: number
  totalCost: number
  estimatedResale: number
  targetListPrice: number
  lowestAcceptablePrice: number
  status: InventoryStatus
  storageLocation: string
  notes: string
  cleaned?: boolean
  photographed?: boolean
}

export interface Sale {
  id: string
  inventoryItemId: string
  itemName: string
  dateListed: string
  dateSold: string
  listedPrice: number
  soldPrice: number
  fees?: number
  paymentType?: 'Cash' | 'Zelle' | 'Venmo' | 'PayPal' | 'Other'
  buyerName?: string
  totalCost: number
  profit: number
  netProfit?: number
  roi: number
  platform: string
  buyerTown: string
  daysToSell: number
  notes: string
}

export interface Source {
  id: string
  name: string
  sourceType: string
  town: string
  county: 'Nassau' | 'Suffolk' | 'Queens' | 'Brooklyn' | 'Other'
  contactInfo: string
  notes: string
  lastChecked: string
  qualityRating: number
  dealRating: number
  usualInventory: string[]
  status: 'Active' | 'Check weekly' | 'Occasional' | 'Dead source'
}

export interface AppSettings {
  themePreference: 'premium-navy-amber'
  operatingRegion: 'long-island-ny' | 'south-florida'
  legalLastUpdated: string
  legalContactEmail: string
  userName: string
  businessName: string
  defaultPickupArea: string
  defaultListingLocation: string
  defaultMarketplaceText: string
  preferredProfitMarginPercent: number
  defaultLocation: string
  defaultResaleDiscount: number
  defaultMaxBuyPercentage: number
  defaultFastSaleDiscount: number
  defaultGripReplacementCost: number
  defaultCleaningCost: number
  defaultTravelCost: number
  preferredMinimumRoi: number
  preferredMinimumProfit: number
}

export interface DashboardStats {
  totalLeads: number
  activeWatchlist: number
  purchasedInventory: number
  clubsInInventory: number
  listedItems: number
  readyToList: number
  soldItems: number
  totalInvested: number
  expectedResaleValue: number
  totalProfit: number
  averageRoi: number
  bestBrands: string[]
  itemsNeedingAction: number
  readyToBuy: number
  passed: number
  estimatedProfit: number
}

export type DealQueueStatus = 'new' | 'analyzing' | 'saved' | 'rejected' | 'watchlist'

export interface Deal {
  id: string
  title: string
  brand: string
  model: string
  club_type: string
  shaft: string
  flex: string
  handedness: string
  condition: string
  asking_price: number
  seller_name: string
  seller_location: string
  marketplace_source: string
  listing_url: string
  photos: string[]
  description: string
  pickup_distance_miles: number
  date_found: string
  status: DealQueueStatus
  rejection_reason?: string
  watchlist_note?: string
  created_at: string
  updated_at: string
}

export interface DealAnalysis {
  id: string
  deal_id: string
  estimated_low_value: number
  estimated_high_value: number
  estimated_fast_sale_price: number
  estimated_profit: number
  max_buy_price: number
  margin_percent: number
  demand_score: number
  condition_score: number
  risk_score: number
  deal_grade: 'A' | 'B' | 'C' | 'D' | 'F'
  recommendation: 'Strong Buy' | 'Good Deal' | 'Negotiate' | 'Weak Deal' | 'Reject'
  analysis_notes: string
  resale_strategy: string
  saved_at?: string
  created_at: string
  updated_at: string
}

export type SourcingRadarView = 'dashboard' | 'add-facebook' | 'craigslist' | 'lead' | 'settings'

export interface SourcingRadarSettings {
  base_zip_code: string
  max_drive_time_minutes: number
  primary_counties: string[]
  secondary_counties: string[]
  minimum_profit_target: number
  minimum_deal_score: number
  auto_fetch_runs_per_day: number
  allow_high_frequency_auto: boolean
  source_enablement: Record<string, boolean>
  keyword_rules: string[]
  brand_priority: string[]
}

export type SourcingSourceType =
  | 'craigslist'
  | 'facebook_manual'
  | 'offerup_manual'
  | 'ebay_local_manual'
  | 'estate_sale'
  | 'garage_sale'
  | 'other'

export type SourcingZoneType = 'primary' | 'secondary'
export type LeadStatusRadar =
  | 'new'
  | 'researching'
  | 'contacted'
  | 'negotiating'
  | 'bought'
  | 'passed'
  | 'sold'
  | 'archived'

export type GolfLeadItemType =
  | 'driver'
  | 'fairway_wood'
  | 'hybrid'
  | 'iron_set'
  | 'wedge'
  | 'putter'
  | 'bag'
  | 'full_set'
  | 'unknown'

export type FollowupType =
  | 'message_seller'
  | 'message_buyer'
  | 'inspect_clubs'
  | 'make_offer'
  | 'pickup_scheduled'
  | 'price_check'
  | 'relist_plan'

export interface SourcingSource {
  id: string
  source_name: string
  source_type: SourcingSourceType
  base_url: string
  enabled: boolean
  compliance_notes: string
  created_at: string
  updated_at: string
}

export interface SourcingLocation {
  id: string
  location_name: string
  county: string
  state: string
  zone_type: SourcingZoneType
  priority_score: number
  max_drive_minutes: number
  created_at: string
}

export interface GolfLeadItem {
  id: string
  lead_id: string
  item_type: GolfLeadItemType
  brand: string
  model: string
  shaft: string
  flex: string
  condition_grade: string
  estimated_individual_resale_low: number
  estimated_individual_resale_high: number
  notes: string
}

export interface LeadFollowup {
  id: string
  lead_id: string
  followup_type: FollowupType
  due_date: string
  completed: boolean
  notes: string
  created_at: string
}

export interface GolfLeadRadar {
  id: string
  source_id: string
  source_name: string
  source_url: string
  title: string
  description: string
  asking_price: number
  location_text: string
  city: string
  county: string
  state: string
  latitude: number | null
  longitude: number | null
  distance_miles: number
  estimated_drive_minutes: number
  pickup_available: boolean
  local_delivery_available: boolean
  shipping_required: boolean
  brand_detected: string
  model_detected: string
  club_type_detected: string
  estimated_resale_low: number
  estimated_resale_high: number
  estimated_resale_average: number
  estimated_profit_low: number
  estimated_profit_high: number
  deal_score: number
  deal_label: string
  status: LeadStatusRadar
  seller_name_optional: string
  seller_contact_optional: string
  buyer_contact_optional: string
  image_urls: string[]
  notes: string
  created_at: string
  updated_at: string
  last_checked_at: string
}
