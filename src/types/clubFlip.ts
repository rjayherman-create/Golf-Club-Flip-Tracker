export type ClubCondition =
  | 'New'
  | 'Like New'
  | 'Excellent'
  | 'Very Good'
  | 'Good'
  | 'Fair'
  | 'Poor'

export type ClubIdentification = {
  brand: string
  model: string
  clubType: string
  loft?: string
  shaftBrand?: string
  shaftFlex?: string
  handedness?: 'Right' | 'Left' | 'Unknown'
  conditionGuess?: ClubCondition
  visibleNotes?: string[]
  confidence: number
  searchQuery: string
}

export type SoldComp = {
  title: string
  soldPrice: number
  shippingPrice?: number
  totalPrice: number
  soldDate?: string
  source: 'eBay' | 'Manual' | 'Provider'
  url?: string
}

export type ClubValueEstimate = {
  query: string
  compCount: number
  low: number | null
  median: number | null
  average: number | null
  high: number | null
  recommendedBuyMax: number | null
  recommendedListPrice: number | null
  notes: string[]
  comps: SoldComp[]
}

export type ClubInventoryItem = {
  id: string
  createdAt: string
  photoUrl?: string
  brand: string
  model: string
  clubType: string
  loft?: string
  shaftBrand?: string
  shaftFlex?: string
  handedness?: string
  condition: ClubCondition
  purchasePrice?: number
  estimatedValue?: number
  recommendedListPrice?: number
  source?: string
  location?: string
  notes?: string
}
