import type {
  DashboardStats,
  InventoryItem,
  Lead,
  Recommendation,
  Sale,
  GolfLeadRadar,
  SourcingLocation,
} from '../types'

const premiumBrands = [
  'Scotty Cameron',
  'Titleist',
  'Vokey',
  'Ping',
  'TaylorMade',
  'Callaway',
  'Odyssey',
  'Mizuno',
  'Cobra',
  'Cleveland',
  'Bettinardi',
  'PXG',
]

const goodBrands = ['Wilson Staff', 'Srixon', 'Adams', 'Tour Edge', 'Nike Golf']

const weakBrands = [
  'No-name',
  'Top Flite',
  'Old starter set',
  'Mixed unknown set',
  'Damaged clubs',
]

export function getBrandScore(brand: string): number {
  const normalized = brand.trim().toLowerCase()
  if (!normalized) return 1
  if (premiumBrands.some((b) => b.toLowerCase() === normalized)) return 10
  if (goodBrands.some((b) => b.toLowerCase() === normalized)) return 7
  if (weakBrands.some((b) => normalized.includes(b.toLowerCase()))) return 2
  return 5
}

export function getConditionDeduction(condition: Lead['condition']): number {
  const map: Record<Lead['condition'], number> = {
    Excellent: 0,
    'Very Good': 0.05,
    Good: 0.1,
    Fair: 0.25,
    Poor: 0.45,
    Damaged: 0.65,
  }
  return map[condition]
}


export function calculateDealGrade(roi: number, brandScore: number, condition: Lead['condition']): string {
  if (roi > 120 && brandScore >= 10 && ['Excellent', 'Very Good', 'Good'].includes(condition)) return 'A+'
  if (roi >= 80) return 'A'
  if (roi >= 50) return 'B'
  if (roi >= 25) return 'C'
  if (roi >= 1) return 'D'
  return 'F'
}

export function generateRecommendation(lead: Lead): Recommendation {
  const brandScore = getBrandScore(lead.brand)
  const goodCondition = ['Excellent', 'Very Good', 'Good'].includes(lead.condition)
  const hasRedFlag = lead.redFlags.length > 0

  if (
    lead.condition === 'Damaged' ||
    brandScore <= 2 ||
    hasRedFlag ||
    lead.roi < 1 ||
    lead.expectedProfit < 0
  ) {
    return 'PASS'
  }

  if (lead.roi >= 80 && goodCondition && brandScore >= 7) {
    return 'BUY NOW'
  }

  if (lead.roi >= 25 && lead.roi < 80) {
    return 'NEGOTIATE'
  }

  if (lead.roi > 0) {
    return 'WATCH'
  }

  return 'PASS'
}

export function calculateValuation(lead: Lead): Lead {
  const conditionDeduction = getConditionDeduction(lead.condition)

  const candidateValues = [
    lead.ebayAverage > 0 ? lead.ebayAverage * 0.85 : 0,
    lead.facebookEstimate > 0 ? lead.facebookEstimate : 0,
    lead.retailUsedValue > 0 ? lead.retailUsedValue * 0.75 : 0,
  ].filter((value) => value > 0)

  const conservativeBase =
    candidateValues.length > 0
      ? Math.min(...candidateValues)
      : lead.manualEstimate > 0
        ? lead.manualEstimate
        : lead.askingPrice

  const conservativeResale = conservativeBase * (1 - conditionDeduction)
  const fastSalePrice = conservativeResale * 0.85
  const maxSafeOffer = conservativeResale * 0.45

  const repairAdjustedMaxOffer =
    maxSafeOffer - lead.cleaningCost - lead.gripCost - lead.travelCost

  const totalCost = lead.askingPrice + lead.cleaningCost + lead.gripCost + lead.travelCost
  const expectedProfit = conservativeResale - totalCost
  const roi = totalCost > 0 ? (expectedProfit / totalCost) * 100 : 0

  const redFlags = [...lead.redFlags]
  if (lead.condition === 'Damaged' && !redFlags.includes('Damaged condition')) {
    redFlags.push('Damaged condition')
  }
  if (lead.askingPrice > conservativeResale && !redFlags.includes('Asking price higher than sold comps')) {
    redFlags.push('Asking price higher than sold comps')
  }

  const brandScore = getBrandScore(lead.brand)
  const dealGrade = calculateDealGrade(roi, brandScore, lead.condition)

  const enriched: Lead = {
    ...lead,
    conservativeResale: round2(conservativeResale),
    fastSalePrice: round2(fastSalePrice),
    maxSafeOffer: round2(maxSafeOffer),
    repairAdjustedMaxOffer: round2(repairAdjustedMaxOffer),
    expectedProfit: round2(expectedProfit),
    roi: round2(roi),
    dealGrade,
    redFlags,
    recommendation: 'WATCH',
  }

  return {
    ...enriched,
    recommendation: generateRecommendation(enriched),
  }
}

export function generateSellerMessage(type: 'initial' | 'fullBag' | 'negotiation' | 'stale', offer = 0): string {
  const templates = {
    initial:
      'Hi, I buy used golf clubs locally. Could you send clear pictures of the club faces, brand/model names, shafts, grips, and the bottom of the clubs? I can pick up quickly if the set works for me.',
    fullBag:
      'Could you send one picture with all the clubs laid out so I can see the brands and models?',
    negotiation: `I can pick up today. I am buying for resale, so I need some room after cleaning, photographing, and separating the clubs. Would you take $${offer} cash?`,
    stale: `I saw this has been listed a little while. I can pick it up today if $${offer} works.`,
  }

  return templates[type]
}

export function generateFacebookListing(item: {
  brand: string
  model: string
  clubType: string
  loft: string
  shaftFlex: string
  hand: string
  condition: string
  gripCondition: string
  price: number
  defects: string
  pickupLocation: string
}): { title: string; description: string } {
  const title = `${item.brand} ${item.model} ${item.clubType} ${item.loft} ${item.shaftFlex} Flex - Used Golf Club`

  let description = `${item.brand} ${item.model} ${item.clubType}\n\n`
  description += `Loft: ${item.loft}\n`
  description += `Shaft: ${item.shaftFlex} flex\n`
  description += `Hand: ${item.hand}\n`
  description += `Condition: ${item.condition}\n`
  description += `Grip: ${item.gripCondition}\n\n`
  description +=
    'Good used golf club. Normal cosmetic wear from play unless otherwise noted. No cracks or major damage noted.\n\n'
  if (item.defects.trim()) {
    description += `${item.defects}\nPlease see photos for condition details.\n\n`
  }
  description += `Pickup: ${item.pickupLocation}\n`
  description += `Price: $${item.price} or best reasonable offer`

  return { title, description }
}

export function calculateBundleCostAllocation(
  bundleItems: Array<{ name: string; estimatedResale: number }>,
  totalPurchasePrice: number,
): Array<{ name: string; estimatedResale: number; allocatedCost: number }> {
  const totalEstimatedBundleResale = bundleItems.reduce((sum, item) => sum + item.estimatedResale, 0)
  if (totalEstimatedBundleResale <= 0) {
    return bundleItems.map((item) => ({ ...item, allocatedCost: 0 }))
  }

  return bundleItems.map((item) => ({
    ...item,
    allocatedCost: round2(
      totalPurchasePrice * (item.estimatedResale / totalEstimatedBundleResale),
    ),
  }))
}

export function calculateProfit(sale: Sale): Sale {
  const fees = sale.fees ?? 0
  const profit = sale.soldPrice - sale.totalCost
  const netProfit = sale.soldPrice - fees - sale.totalCost
  const roi = sale.totalCost > 0 ? (netProfit / sale.totalCost) * 100 : 0

  let daysToSell = 0
  if (sale.dateListed && sale.dateSold) {
    const listed = new Date(sale.dateListed)
    const sold = new Date(sale.dateSold)
    const dayMs = 24 * 60 * 60 * 1000
    daysToSell = Math.max(0, Math.floor((sold.getTime() - listed.getTime()) / dayMs))
  }

  return {
    ...sale,
    profit: round2(profit),
    netProfit: round2(netProfit),
    roi: round2(roi),
    daysToSell,
  }
}

export function calculateDashboardStats(
  leads: Lead[],
  inventory: InventoryItem[],
  sales: Sale[],
): DashboardStats {
  const listedItems = inventory.filter((item) => item.status === 'Listed').length
  const readyToList = inventory.filter((item) => item.status === 'Ready to List').length
  const soldItems = sales.length
  const totalInvested = inventory.reduce((sum, item) => sum + item.totalCost, 0)
  const expectedResaleValue = inventory.reduce((sum, item) => sum + item.estimatedResale, 0)
  const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0)
  const projectedOpenInventoryProfit = inventory.reduce(
    (sum, item) => sum + Math.max(0, item.estimatedResale - item.totalCost),
    0,
  )
  const averageRoi = sales.length
    ? sales.reduce((sum, sale) => sum + sale.roi, 0) / sales.length
    : leads.length
      ? leads.reduce((sum, lead) => sum + lead.roi, 0) / leads.length
      : 0

  const brandMap: Record<string, number> = {}
  inventory.forEach((item) => {
    brandMap[item.brand] = (brandMap[item.brand] ?? 0) + item.estimatedResale
  })

  const bestBrands = Object.entries(brandMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([brand]) => brand)

  return {
    totalLeads: leads.length,
    activeWatchlist: leads.filter((lead) => lead.status === 'Watch').length,
    purchasedInventory: inventory.length,
    clubsInInventory: inventory.length,
    listedItems,
    readyToList,
    soldItems,
    totalInvested: round2(totalInvested),
    expectedResaleValue: round2(expectedResaleValue),
    totalProfit: round2(totalProfit),
    averageRoi: round2(averageRoi),
    bestBrands,
    itemsNeedingAction: inventory.filter((item) =>
      ['Needs Cleaning', 'Ready to Photograph', 'Ready to List'].includes(item.status),
    ).length,
    readyToBuy: leads.filter((lead) => lead.recommendation === 'BUY NOW').length,
    passed: leads.filter((lead) => lead.status === 'Passed').length,
    estimatedProfit: round2(projectedOpenInventoryProfit),
  }
}

export const brandCollections = {
  premiumBrands,
  goodBrands,
}

const highValueBrandKeywords = [
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
]

const highValueModelKeywords = [
  'Scotty Cameron Newport',
  'Vokey SM7',
  'Vokey SM8',
  'Vokey SM9',
  'Vokey SM10',
  'TaylorMade Stealth',
  'TaylorMade Qi10',
  'TaylorMade SIM',
  'Callaway Paradym',
  'Callaway Rogue',
  'Callaway Epic',
  'Ping G425',
  'Ping G430',
  'Ping G410',
  'Mizuno JPX',
  'Mizuno Pro',
  'Titleist T100',
  'Titleist T200',
  'Titleist AP2',
  'Odyssey White Hot',
  'Odyssey Stroke Lab',
]

function safeNumber(value: number | string | null | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function estimateGolfValue(lead: Partial<GolfLeadRadar> & {
  asking_price?: number
  brand_detected?: string
  model_detected?: string
  club_type_detected?: string
  estimated_resale_low?: number
  estimated_resale_high?: number
  estimated_resale_average?: number
  estimated_profit_low?: number
  estimated_profit_high?: number
  shipping_required?: boolean
  pickup_available?: boolean
  local_delivery_available?: boolean
  distance_miles?: number
  estimated_drive_minutes?: number
  condition_grade?: string
  source_url?: string
  title?: string
  description?: string
}) {
  const askingPrice = safeNumber(lead.asking_price)
  const brand = lead.brand_detected?.trim() || ''
  const model = lead.model_detected?.trim() || ''
  const conditionGrade = (lead.condition_grade ?? 'Good').toLowerCase()

  let estimated_resale_average = safeNumber(lead.estimated_resale_average)
  if (!estimated_resale_average) {
    const brandBoost = highValueBrandKeywords.some((keyword) =>
      brand.toLowerCase().includes(keyword.toLowerCase()),
    )
      ? 1.15
      : 1
    const modelBoost = highValueModelKeywords.some((keyword) =>
      `${brand} ${model}`.toLowerCase().includes(keyword.toLowerCase()),
    )
      ? 1.2
      : 1
    const base = askingPrice > 0 ? askingPrice * 1.55 : 100
    estimated_resale_average = base * brandBoost * modelBoost
  }

  const estimated_resale_low = safeNumber(lead.estimated_resale_low) || estimated_resale_average * 0.8
  const estimated_resale_high = safeNumber(lead.estimated_resale_high) || estimated_resale_average * 1.15
  const suggested_max_buy_price = Math.min(
    estimated_resale_average * 0.5,
    estimated_resale_low * 0.45,
    askingPrice > 0 ? askingPrice : estimated_resale_average * 0.6,
  )

  const offerBasedOnAsking = askingPrice > 0 ? askingPrice * 0.65 : suggested_max_buy_price
  const suggested_first_offer = Math.min(suggested_max_buy_price, offerBasedOnAsking)
  const estimated_cleaning_cost = 0
  const estimated_listing_fee = 0
  const estimated_transport_cost = 0
  const expected_profit =
    estimated_resale_average -
    askingPrice -
    estimated_cleaning_cost -
    estimated_listing_fee -
    estimated_transport_cost

  const confidence_score = Math.max(
    5,
    Math.min(
      100,
      Math.round(
        (brand ? 35 : 10) +
          (model ? 20 : 5) +
          (askingPrice > 0 ? 15 : 5) +
          (lead.pickup_available || lead.local_delivery_available ? 15 : 0) +
          (conditionGrade === 'good' || conditionGrade === 'very good' ? 15 : 5),
      ),
    ),
  )

  return {
    estimated_resale_low: round2(estimated_resale_low),
    estimated_resale_high: round2(estimated_resale_high),
    estimated_resale_average: round2(estimated_resale_average),
    suggested_max_buy_price: round2(suggested_max_buy_price),
    suggested_first_offer: round2(suggested_first_offer),
    expected_profit: round2(expected_profit),
    confidence_score,
  }
}

export function isLocalPickupDeal(
  lead: Pick<
    GolfLeadRadar,
    'shipping_required' | 'pickup_available' | 'local_delivery_available' | 'distance_miles' | 'estimated_drive_minutes'
  > & {
    maxDriveMinutes?: number
    maxRadiusMiles?: number
    inZone?: boolean
  },
) {
  if (lead.shipping_required) return false
  if (!lead.inZone) return false

  const maxDriveMinutes = lead.maxDriveMinutes ?? 60
  const maxRadiusMiles = lead.maxRadiusMiles ?? 50
  if (lead.distance_miles > maxRadiusMiles) return false
  if (lead.estimated_drive_minutes > maxDriveMinutes) return false

  return Boolean(lead.pickup_available || lead.local_delivery_available)
}

export function classifyDealLabel(score: number): string {
  if (score >= 85) return 'Strong Buy'
  if (score >= 70) return 'Good Lead'
  if (score >= 55) return 'Maybe / Research More'
  if (score >= 40) return 'Weak Deal'
  return 'Avoid'
}

export function classifyPickupDifficulty(distanceMiles: number, driveMinutes: number): 'Easy' | 'Medium' | 'Hard' {
  if (distanceMiles <= 15 && driveMinutes <= 30) return 'Easy'
  if (distanceMiles <= 35 && driveMinutes <= 60) return 'Medium'
  return 'Hard'
}

export function getZoneMatch(location: string, locations: SourcingLocation[]) {
  const normalized = location.toLowerCase()
  return locations.some((entry) => entry.location_name.toLowerCase().includes(normalized))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
