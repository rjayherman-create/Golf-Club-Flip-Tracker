export type PageKey =
  | 'dashboard'
  | 'lead-form'
  | 'lead-analyzer'
  | 'inventory'
  | 'listings'
  | 'sales'
  | 'sources'
  | 'value-guide'
  | 'settings'

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
  totalCost: number
  profit: number
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
  listedItems: number
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
