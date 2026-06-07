import type { ClubValueEstimate, SoldComp } from '../types/clubFlip'

function median(nums: number[]) {
  if (!nums.length) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2) {
    return sorted[mid]
  }
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
}

function avg(nums: number[]) {
  if (!nums.length) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
}

export function buildPgaValueGuideUrl(query: string) {
  const clean = encodeURIComponent(query.trim())
  return `https://www.google.com/search?q=${clean}+site%3Apga.com%2Fvalue-guide+OR+%22PGA+Value+Guide%22`
}

export function buildEbayManualSoldSearchUrl(query: string) {
  const clean = encodeURIComponent(query.trim())
  return `https://www.ebay.com/sch/i.html?_nkw=${clean}&LH_Sold=1&LH_Complete=1`
}

export function estimateClubValue(query: string, comps: SoldComp[]): ClubValueEstimate {
  const totals = comps
    .map((c) => Number(c.totalPrice || c.soldPrice || 0))
    .filter((n) => Number.isFinite(n) && n > 0)

  const low = totals.length ? Math.min(...totals) : null
  const high = totals.length ? Math.max(...totals) : null
  const med = median(totals)
  const average = avg(totals)

  const recommendedListPrice = med ? Math.round(med * 0.92) : null
  const recommendedBuyMax = med
    ? med < 75
      ? Math.round(med * 0.35)
      : med < 150
        ? Math.round(med * 0.42)
        : Math.round(med * 0.48)
    : null

  return {
    query,
    compCount: comps.length,
    low,
    median: med,
    average,
    high,
    recommendedBuyMax,
    recommendedListPrice,
    notes: [
      'Use sold comps, not asking prices.',
      'Ignore damaged clubs unless your item is damaged too.',
      'Local pickup prices should usually be below clean eBay sold prices.',
      'For bags/sets, price premium clubs individually before bundle pricing.',
    ],
    comps,
  }
}

export function buildFacebookListingText(input: {
  brand: string
  model: string
  clubType: string
  loft?: string
  shaftBrand?: string
  shaftFlex?: string
  handedness?: string
  condition?: string
  price?: number
  pickupArea?: string
  notes?: string
}) {
  const title = [
    input.brand,
    input.model,
    input.loft,
    input.clubType,
    input.shaftFlex ? `${input.shaftFlex} Flex` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const body = [
    title,
    '',
    `Price: $${input.price || ''}`,
    `Condition: ${input.condition || 'Good used condition'}`,
    input.handedness ? `Handedness: ${input.handedness}` : '',
    input.shaftBrand ? `Shaft: ${input.shaftBrand}` : '',
    input.shaftFlex ? `Flex: ${input.shaftFlex}` : '',
    input.loft ? `Loft: ${input.loft}` : '',
    '',
    input.notes || 'Used golf club. See photos for condition.',
    '',
    `Pickup/meetup: ${input.pickupArea || 'Long Island / NYC area'}`,
    'Cash, Zelle, or agreed local payment only.',
  ]
    .filter(Boolean)
    .join('\n')

  return { title, body }
}

export function toCsv(items: Record<string, unknown>[]) {
  if (!items.length) return ''
  const headers = Array.from(
    items.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>()),
  )

  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value)
    return `"${text.replace(/"/g, '""')}"`
  }

  return [
    headers.map(escape).join(','),
    ...items.map((row) => headers.map((header) => escape(row[header])).join(',')),
  ].join('\n')
}
