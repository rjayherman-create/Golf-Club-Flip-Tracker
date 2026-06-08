import { type MouseEvent, useMemo, useRef, useState } from 'react'
import type {
  GolfLeadItem,
  GolfLeadRadar,
  LeadFollowup,
  SourcingLocation,
  SourcingRadarSettings,
  SourcingRadarView,
  SourcingSource,
} from '../types'
import {
  classifyPickupDifficulty,
  estimateGolfValue,
  generateSellerMessage,
  isLocalPickupDeal,
} from '../utils/valuation'

interface LocalSourcingRadarProps {
  view: SourcingRadarView
  leadId?: string
  leads: GolfLeadRadar[]
  leadItems: GolfLeadItem[]
  followups: LeadFollowup[]
  sources: SourcingSource[]
  locations: SourcingLocation[]
  settings: SourcingRadarSettings
  onFetchDeals: () => Promise<GolfLeadRadar[]>
  onImportFacebookListings: (
    urls: string[],
    sourceId: string,
    rawText?: string,
  ) => Promise<{
    imported: GolfLeadRadar[]
    summary: {
      requested: number
      imported: number
      skipped: number
      duplicateSkipped: number
      unverifiedSkipped: number
      onlyRealData: boolean
    }
  }>
  onNavigate: (path: string) => void
  onSaveLead: (lead: GolfLeadRadar, items?: GolfLeadItem[], followups?: LeadFollowup[]) => void
  onUpdateLead: (lead: GolfLeadRadar) => void
  onDeleteLead: (leadId: string) => void
  onUpdateSettings: (settings: SourcingRadarSettings) => void
  onToggleSource: (sourceId: string, enabled: boolean) => void
  onAddFollowup: (followup: LeadFollowup) => void
}

type SourceHubTab = 'inbox' | 'facebook' | 'scan' | 'followups' | 'settings'

function currency(value: number) {
  return `$${value.toFixed(2)}`
}

function getRiskFlags(lead: GolfLeadRadar, settings: SourcingRadarSettings) {
  const flags = [
    lead.shipping_required ? 'Shipping required - avoid for this business model' : '',
    !lead.brand_detected ? 'No brand detected' : '',
    !lead.model_detected ? 'No model detected' : '',
    !lead.image_urls.length ? 'No original photos' : '',
    lead.asking_price > lead.estimated_resale_average ? 'Low profit margin' : '',
    lead.description.length < 25 ? 'Seller description unclear' : '',
    lead.shipping_required ? 'Avoid shipping' : '',
  ].filter(Boolean)

  const pickupOk = isLocalPickupDeal({
    shipping_required: lead.shipping_required,
    pickup_available: lead.pickup_available,
    local_delivery_available: lead.local_delivery_available,
    distance_miles: lead.distance_miles,
    estimated_drive_minutes: lead.estimated_drive_minutes,
    maxDriveMinutes: settings.max_drive_time_minutes,
    maxRadiusMiles: 50,
    inZone: true,
  })

  if (!pickupOk) {
    flags.push('Too far for pickup')
  }

  if (lead.brand_detected && /fake|replica|authentic/i.test(lead.description)) {
    flags.push('Possible counterfeit risk')
  }

  if (lead.image_urls.length === 0) {
    flags.push('Needs manual value check')
  }

  return flags
}

function scoreToBadge(score: number) {
  if (score >= 85) return 'Strong Buy'
  if (score >= 70) return 'Good Lead'
  if (score >= 55) return 'Maybe / Research More'
  if (score >= 40) return 'Weak Deal'
  return 'Avoid'
}

function hasExternalUrl(value: string) {
  return /^https?:\/\//i.test(value.trim())
}

function isRealListingLead(lead: GolfLeadRadar) {
  const url = String(lead.source_url ?? '').toLowerCase()
  return hasExternalUrl(url) && /(facebook\.com|craigslist\.org)/.test(url)
}

function getFacebookItemId(url: string) {
  const match = String(url ?? '').match(/facebook\.com\/marketplace\/item\/(\d+)/i)
  return match?.[1] ?? ''
}

function getSuggestedMaxBuy(lead: GolfLeadRadar) {
  return Math.max(0, Math.min(lead.estimated_resale_low * 0.45, lead.estimated_resale_average * 0.6))
}

function getPrimaryContactUrl(lead: GolfLeadRadar) {
  if (hasExternalUrl(lead.seller_contact_optional)) {
    return lead.seller_contact_optional.trim()
  }
  if (hasExternalUrl(lead.source_url)) {
    return lead.source_url.trim()
  }
  return ''
}

function getPrimaryContactLabel(lead: GolfLeadRadar) {
  return hasExternalUrl(lead.seller_contact_optional) ? 'Open original message' : 'Open original listing'
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  return date.toLocaleString()
}

function getLeadPhotos(lead: GolfLeadRadar) {
  const blockedHosts = [
    'unsplash.com',
    'images.unsplash.com',
    'pexels.com',
    'pixabay.com',
    'picsum.photos',
    'placehold.co',
    'placeholder.com',
  ]

  return lead.image_urls
    .map((url) => String(url ?? '').replace(/&amp;/g, '&').trim())
    .filter((url) => {
      const trimmed = url.trim()
    if (!/^https?:\/\//i.test(trimmed)) return false
    const lower = trimmed.toLowerCase()
    if (blockedHosts.some((host) => lower.includes(host))) return false
    if (/landscape|mountain|nature|hero|banner/.test(lower)) return false
    return true
    })
}

function hasNoOriginalPhotos(lead: GolfLeadRadar) {
  return getLeadPhotos(lead).length === 0
}

function getProductShotSearchUrl(lead: GolfLeadRadar) {
  const terms = [lead.brand_detected, lead.model_detected, lead.club_type_detected, 'golf club exact model']
    .filter(Boolean)
    .join(' ')
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(terms)}`
}

function getLeadNextStep(lead: GolfLeadRadar) {
  if (lead.status === 'sold') return 'Sold, no action needed'
  if (lead.status === 'passed') return 'Passed, archive or remove'
  if (hasNoOriginalPhotos(lead)) return 'Request exact seller photos first'
  if (lead.status === 'new') return 'Send first seller message'
  if (lead.status === 'contacted') return 'Ask condition questions and negotiate'
  if (lead.status === 'negotiating') return 'Set pickup plan and close deal'
  if (lead.status === 'bought') return 'Create listing and post for sale'
  return 'Review deal details'
}

function parsePhotoUrls(raw: string) {
  return raw
    .split(/\r?\n|,/) 
    .map((value) => value.trim())
    .filter((value) => /^https?:\/\//i.test(value))
}

function parsePastedUrls(raw: string) {
  const direct = String(raw ?? '')
    .split(/\r?\n|,/) 
    .map((value) => value.trim())
    .filter(Boolean)

  const discovered = Array.from(String(raw ?? '').matchAll(/https?:\/\/[^\s)\]]+/gi)).map((match) => match[0])

  const normalized = [...direct, ...discovered]
    .map((value) => value.replace(/[)>.,;]+$/g, '').trim())
    .filter((value) => /^https?:\/\//i.test(value))

  return Array.from(new Set(normalized))
}

function DealPhotoCarousel({ lead }: { lead: GolfLeadRadar }) {
  const photos = getLeadPhotos(lead)
  const [photoIndex, setPhotoIndex] = useState(0)

  if (!photos.length) {
    return (
      <div style={{ marginBottom: '8px', border: '1px dashed rgba(255,255,255,0.3)', borderRadius: '10px', padding: '10px' }}>
        <div className="row-wrap" style={{ marginBottom: '6px' }}>
          <span className="badge badge-pass">Exact seller photos required before purchase</span>
        </div>
        <div className="muted-copy" style={{ marginTop: '2px' }}>
          No original ad photo available
        </div>
        <div className="row-wrap" style={{ marginTop: '6px' }}>
          <a
            className="btn btn-secondary"
            href={getProductShotSearchUrl(lead)}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            Find exact model photos
          </a>
        </div>
      </div>
    )
  }

  const current = photos[photoIndex] ?? photos[0]

  return (
    <div style={{ marginBottom: '8px' }}>
      <img
        src={current}
        alt={lead.title}
        style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '10px' }}
      />
      {photos.length > 1 && (
        <div className="row-wrap" style={{ marginTop: '6px' }}>
          <button
            className="btn"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setPhotoIndex((index) => (index - 1 + photos.length) % photos.length)
            }}
          >
            Prev
          </button>
          <span className="muted-copy">Photo {photoIndex + 1} / {photos.length}</span>
          <button
            className="btn"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setPhotoIndex((index) => (index + 1) % photos.length)
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

function buildSellerDraft(lead: GolfLeadRadar) {
  const noteLine = lead.notes ? `Note: ${lead.notes}\n` : ''
  const photoRequestLine = hasNoOriginalPhotos(lead)
    ? 'I do not see listing photos yet. Could you send clear photos of the club face, shaft label, grip, sole, and any wear or damage?'
    : ''
  return [
    `Hi, is your ${lead.title} still available?`,
    'I can do local pickup and pay cash.',
    'If everything looks good in person, I can meet quickly.',
    noteLine.trim(),
    photoRequestLine,
    generateSellerMessage('initial'),
  ]
    .filter(Boolean)
    .join('\n')
}

function buildBuyerDraft(lead: GolfLeadRadar) {
  return [
    `Hi, the ${lead.title} is available.`,
    `Condition: ${lead.club_type_detected} in good used shape.`,
    `Price: ${currency(Math.max(lead.estimated_resale_low, lead.asking_price + 25))}.`,
    'Local pickup preferred. I can share close-up photos of face, shaft, and grip.',
  ].join('\n')
}

export function LocalSourcingRadar({
  view,
  leadId,
  leads,
  leadItems,
  followups,
  sources,
  locations,
  settings,
  onNavigate,
  onSaveLead,
  onUpdateLead,
  onDeleteLead,
  onUpdateSettings,
  onToggleSource,
  onAddFollowup,
  onFetchDeals,
  onImportFacebookListings,
}: LocalSourcingRadarProps) {
  const hubTopRef = useRef<HTMLElement | null>(null)
  const facebookImportRef = useRef<HTMLElement | null>(null)
  const publicSourcesRef = useRef<HTMLElement | null>(null)
  const settingsRef = useRef<HTMLElement | null>(null)
  const [copiedLeadId, setCopiedLeadId] = useState<string | null>(null)
  const [lastSentMessage, setLastSentMessage] = useState<{ leadId: string | null; message: string }>({
    leadId: null,
    message: '',
  })
  const [sellerDraftByLeadId, setSellerDraftByLeadId] = useState<Record<string, string>>({})
  const [buyerDraftByLeadId, setBuyerDraftByLeadId] = useState<Record<string, string>>({})
  const [searchText, setSearchText] = useState('')
  const [countyFilter, setCountyFilter] = useState('All')
  const [sourceFilter, setSourceFilter] = useState('All')
  const [quickFilter, setQuickFilter] = useState<'all' | 'no-photo' | 'due' | 'strong-buy'>('all')
  const [mapMode, setMapMode] = useState<'list' | 'map'>('list')
  const [sourceHubTab, setSourceHubTab] = useState<SourceHubTab>('inbox')
  const [scanResults, setScanResults] = useState<GolfLeadRadar[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState('')
  const [facebookSelectedUrls, setFacebookSelectedUrls] = useState('')
  const [facebookImporting, setFacebookImporting] = useState(false)
  const [facebookImportMessage, setFacebookImportMessage] = useState('')
  const [showAdvancedManual, setShowAdvancedManual] = useState(false)
  const [lastImportedLeads, setLastImportedLeads] = useState<GolfLeadRadar[]>([])
  const [lastImportSummary, setLastImportSummary] = useState<{
    requested: number
    imported: number
    skipped: number
    duplicateSkipped: number
    unverifiedSkipped: number
    onlyRealData: boolean
  } | null>(null)
  const [facebookForm, setFacebookForm] = useState({
    sourceId: sources[0]?.id ?? '',
    sourceUrl: '',
    messageUrl: '',
    title: '',
    askingPrice: '',
    locationText: '',
    description: '',
    photoUrls: '',
    pickupChoice: 'pickup' as 'pickup' | 'delivery' | 'shipping',
    notes: '',
    uploadedPhotos: 0,
  })
  const [craigslistForm, setCraigslistForm] = useState({
    sourceId:
      sources.find((source) => source.source_type === 'facebook_manual')?.id ??
      sources.find((source) => source.source_type === 'craigslist')?.id ??
      sources[0]?.id ??
      '',
    county: 'Nassau',
    keyword: settings.keyword_rules[0] ?? 'golf clubs',
    minPrice: '0',
    maxPrice: '500',
  })

  const eligibleLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          !lead.shipping_required &&
          (lead.pickup_available || lead.local_delivery_available) &&
          lead.estimated_drive_minutes <= settings.max_drive_time_minutes,
      ),
    [leads, settings.max_drive_time_minutes],
  )

  const selectedLead = eligibleLeads.find((lead) => lead.id === leadId) ?? eligibleLeads[0]
  const manualFacebookSources = useMemo(
    () => sources.filter((source) => source.source_type === 'facebook_manual' && source.enabled),
    [sources],
  )
  const radarSources = useMemo(
    () => sources.filter((source) => source.source_type !== 'facebook_manual' && source.enabled),
    [sources],
  )
  const enabledPublicSourceNames = useMemo(
    () => radarSources.map((source) => source.source_name),
    [radarSources],
  )
  const sourceFilterOptions = useMemo(
    () => [
      { value: 'All', label: 'All Sources' },
      ...manualFacebookSources.map((source) => ({
        value: source.source_name,
        label: source.source_name,
      })),
      ...radarSources.map((source) => ({
        value: source.source_name,
        label: source.source_name,
      })),
    ],
    [manualFacebookSources, radarSources],
  )

  const strongBuys = useMemo(
    () => eligibleLeads.filter((lead) => lead.deal_label === 'Strong Buy'),
    [eligibleLeads],
  )
  const todaysLeads = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return eligibleLeads.filter((lead) => lead.created_at.slice(0, 10) === today)
  }, [eligibleLeads])
  const followupsDueToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return followups.filter((followup) => followup.due_date === today && !followup.completed)
  }, [followups])

  const dueLeadIds = useMemo(() => new Set(followupsDueToday.map((item) => item.lead_id)), [followupsDueToday])
  const noPhotoLeads = useMemo(
    () => eligibleLeads.filter((lead) => hasNoOriginalPhotos(lead) && lead.status !== 'sold'),
    [eligibleLeads],
  )
  const strongBuyOpenLeads = useMemo(
    () =>
      eligibleLeads.filter(
        (lead) => lead.deal_label === 'Strong Buy' && lead.status !== 'sold' && lead.status !== 'passed',
      ),
    [eligibleLeads],
  )

  const filteredLeads = useMemo(() => {
    const lowered = searchText.trim().toLowerCase()
    return eligibleLeads.filter((lead) => {
      const countyMatch = countyFilter === 'All' || lead.county.toLowerCase() === countyFilter.toLowerCase()
      const sourceMatch = sourceFilter === 'All' || lead.source_name === sourceFilter
      const textMatch =
        !lowered ||
        [lead.title, lead.description, lead.brand_detected, lead.model_detected, lead.location_text]
          .join(' ')
          .toLowerCase()
          .includes(lowered)
      let quickMatch = true
      if (quickFilter === 'no-photo') quickMatch = hasNoOriginalPhotos(lead) && lead.status !== 'sold'
      if (quickFilter === 'due') quickMatch = dueLeadIds.has(lead.id)
      if (quickFilter === 'strong-buy') quickMatch = lead.deal_label === 'Strong Buy' && lead.status !== 'sold'

      return countyMatch && sourceMatch && textMatch && quickMatch
    })
  }, [countyFilter, dueLeadIds, eligibleLeads, quickFilter, searchText, sourceFilter])

  const averageExpectedProfit = eligibleLeads.length
    ? eligibleLeads.reduce((sum, lead) => sum + lead.estimated_profit_low, 0) / eligibleLeads.length
    : 0

  const zoneBoard = useMemo(() => {
    const grouped = new Map<string, GolfLeadRadar[]>()
    for (const lead of filteredLeads) {
      const key = lead.county || 'Unknown zone'
      grouped.set(key, [...(grouped.get(key) ?? []), lead])
    }

    return Array.from(grouped.entries())
      .map(([county, items]) => {
        const strongBuyCount = items.filter((lead) => lead.deal_label === 'Strong Buy').length
        const noPhotoCount = items.filter((lead) => hasNoOriginalPhotos(lead)).length
        const potentialProfit = items.reduce((sum, lead) => sum + Math.max(0, lead.estimated_profit_high), 0)
        const averageDrive = items.length
          ? items.reduce((sum, lead) => sum + lead.estimated_drive_minutes, 0) / items.length
          : 0
        const bestLead = [...items].sort((left, right) => right.deal_score - left.deal_score)[0]

        return {
          county,
          items,
          strongBuyCount,
          noPhotoCount,
          potentialProfit,
          averageDrive,
          bestLead,
        }
      })
      .sort((left, right) => right.strongBuyCount - left.strongBuyCount || right.potentialProfit - left.potentialProfit)
  }, [filteredLeads])

  const currentLead = selectedLead
  const itemRows = leadItems.filter((item) => item.lead_id === currentLead?.id)
  const currentFollowups = followups.filter((followup) => followup.lead_id === currentLead?.id)

  const currentSellerDraft = currentLead
    ? (sellerDraftByLeadId[currentLead.id] ?? buildSellerDraft(currentLead))
    : ''
  const currentBuyerDraft = currentLead
    ? (buyerDraftByLeadId[currentLead.id] ?? buildBuyerDraft(currentLead))
    : ''
  const currentLeadMessage =
    currentLead && lastSentMessage.leadId === currentLead.id ? lastSentMessage.message : ''

  const facebookSearchUrl = useMemo(() => {
    const sourceBase =
      sources.find((source) => source.source_type === 'facebook_manual')?.base_url ||
      'https://www.facebook.com/marketplace/'

    try {
      const url = new URL(sourceBase)
      url.pathname = '/marketplace/search/'
      url.searchParams.set('query', 'golf clubs')
      return url.toString()
    } catch {
      return 'https://www.facebook.com/marketplace/search/?query=golf%20clubs'
    }
  }, [sources])

  function sendDirectMessage(target: 'seller' | 'buyer') {
    if (!currentLead) return

    const message = target === 'seller' ? currentSellerDraft.trim() : currentBuyerDraft.trim()
    if (!message) {
      setLastSentMessage({ leadId: currentLead.id, message: `Cannot send empty ${target} message.` })
      return
    }

    const now = new Date().toISOString()
    const followupType = target === 'seller' ? 'message_seller' : 'message_buyer'

    onAddFollowup({
      id: crypto.randomUUID(),
      lead_id: currentLead.id,
      followup_type: followupType,
      due_date: now.slice(0, 10),
      completed: true,
      notes: `Sent from app at ${formatDateTime(now)}:\n${message}`,
      created_at: now,
    })

    if (target === 'seller' && currentLead.status !== 'sold' && currentLead.status !== 'passed') {
      onUpdateLead({
        ...currentLead,
        status: 'contacted',
        updated_at: now,
      })
    }

    setLastSentMessage({
      leadId: currentLead.id,
      message: `${target === 'seller' ? 'Seller' : 'Buyer'} follow-up logged at ${formatDateTime(now)}.`,
    })
  }

  function saveManualFacebookLead() {
    const source = sources.find((item) => item.id === facebookForm.sourceId) ?? sources[0]
    const valuation = estimateGolfValue({
      asking_price: Number(facebookForm.askingPrice) || 0,
      brand_detected: facebookForm.title.split(' ')[0] ?? '',
      model_detected: facebookForm.title,
      club_type_detected: 'unknown',
      pickup_available: facebookForm.pickupChoice !== 'shipping',
      local_delivery_available: facebookForm.pickupChoice === 'delivery',
      shipping_required: facebookForm.pickupChoice === 'shipping',
      distance_miles: 0,
      estimated_drive_minutes: 0,
      condition_grade: 'Good',
    })

    const nextLead: GolfLeadRadar = {
      id: crypto.randomUUID(),
      source_id: source?.id ?? '',
      source_name: source?.source_name ?? 'Facebook Marketplace',
      source_url: facebookForm.sourceUrl,
      title: facebookForm.title,
      description: facebookForm.description,
      asking_price: Number(facebookForm.askingPrice) || 0,
      location_text: facebookForm.locationText,
      city: facebookForm.locationText.split(',')[0] ?? '',
      county: facebookForm.locationText.split(',')[1]?.trim() ?? 'Unknown',
      state: 'NY',
      latitude: null,
      longitude: null,
      distance_miles: 0,
      estimated_drive_minutes: 0,
      pickup_available: facebookForm.pickupChoice !== 'shipping',
      local_delivery_available: facebookForm.pickupChoice === 'delivery',
      shipping_required: false,
      brand_detected: facebookForm.title.split(' ')[0] ?? '',
      model_detected: facebookForm.title,
      club_type_detected: 'unknown',
      estimated_resale_low: valuation.estimated_resale_low,
      estimated_resale_high: valuation.estimated_resale_high,
      estimated_resale_average: valuation.estimated_resale_average,
      estimated_profit_low: valuation.expected_profit,
      estimated_profit_high: valuation.expected_profit,
      deal_score: Math.min(100, Math.round(valuation.confidence_score + 10)),
      deal_label: scoreToBadge(Math.min(100, Math.round(valuation.confidence_score + 10))),
      status: 'new',
      seller_name_optional: '',
      seller_contact_optional: facebookForm.messageUrl,
      buyer_contact_optional: '',
      image_urls: parsePhotoUrls(facebookForm.photoUrls),
      notes: `${facebookForm.notes}${facebookForm.uploadedPhotos ? `\nUploaded photos: ${facebookForm.uploadedPhotos}` : ''}`.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
    }

    const newFollowup: LeadFollowup = {
      id: crypto.randomUUID(),
      lead_id: nextLead.id,
      followup_type: 'message_seller',
      due_date: new Date().toISOString().slice(0, 10),
      completed: false,
      notes: 'Send first manual import message.',
      created_at: new Date().toISOString(),
    }

    onSaveLead(nextLead, [], [newFollowup])
    onNavigate(`/sourcing/lead/${nextLead.id}`)
  }

  async function importSelectedFacebookListings() {
    const urls = parsePastedUrls(facebookSelectedUrls)

    if (urls.length === 0) {
      setFacebookImportMessage('Paste one or more Facebook listing URLs first. You can paste raw links or markdown links.')
      return
    }

    setFacebookImporting(true)
    setFacebookImportMessage('Importing selected Facebook listings...')

    try {
      const result = await onImportFacebookListings(urls, facebookForm.sourceId, facebookSelectedUrls)
      const imported = result.imported
      setLastImportedLeads(imported)
      setLastImportSummary(result.summary)

      if (imported.length === 0) {
        setFacebookImportMessage(
          `No verified real listings were imported. Skipped ${result.summary.skipped}. Try public listing URLs with visible title/price/photos.`,
        )
        return
      }

      for (const lead of imported) {
        const followup: LeadFollowup = {
          id: crypto.randomUUID(),
          lead_id: lead.id,
          followup_type: 'message_seller',
          due_date: new Date().toISOString().slice(0, 10),
          completed: false,
          notes: 'Imported from selected Facebook URL. Review and send first seller message.',
          created_at: new Date().toISOString(),
        }
        onSaveLead(lead, [], [followup])
      }

      setFacebookImportMessage(
        `Autoload complete: ${result.summary.imported} real listing${result.summary.imported > 1 ? 's' : ''} imported, ${result.summary.skipped} skipped.`,
      )
      setFacebookSelectedUrls('')
    } finally {
      setFacebookImporting(false)
    }
  }

  function saveCraigslistSearch() {
    const keyword = craigslistForm.keyword.toLowerCase()
    const genericKeyword =
      keyword.includes('golf') || keyword.includes('club') || keyword.includes('set') || keyword.includes('bag')
    const minPrice = Number(craigslistForm.minPrice) || 0
    const maxPrice = Number(craigslistForm.maxPrice) || 999999

    const strictMatches = eligibleLeads.filter((lead) => {
      const keywordMatch = [lead.title, lead.description, lead.brand_detected, lead.model_detected]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
      const broadGolfMatch =
        genericKeyword &&
        [lead.club_type_detected, lead.brand_detected, lead.model_detected, lead.title]
          .join(' ')
          .toLowerCase()
          .match(/driver|iron|wedge|putter|hybrid|wood|club|golf|bag|set/)
      const priceMatch = lead.asking_price >= minPrice && lead.asking_price <= maxPrice
      const countyMatch =
        craigslistForm.county === 'All' || lead.county.toLowerCase() === craigslistForm.county.toLowerCase()
      return (keywordMatch || broadGolfMatch) && priceMatch && countyMatch
    })

    if (strictMatches.length > 0) {
      return strictMatches
    }

    // Fallback: show eligible local leads so search never appears broken.
    return eligibleLeads.filter((lead) => {
      const priceMatch = lead.asking_price >= minPrice && lead.asking_price <= maxPrice
      const countyMatch =
        craigslistForm.county === 'All' || lead.county.toLowerCase() === craigslistForm.county.toLowerCase()
      return priceMatch && countyMatch
    })
  }

  async function copySellerOutreach(lead: GolfLeadRadar, event?: MouseEvent) {
    event?.stopPropagation()
    const text = buildSellerDraft(lead)

    try {
      await navigator.clipboard.writeText(text)
      setCopiedLeadId(lead.id)
      setTimeout(() => setCopiedLeadId((current) => (current === lead.id ? null : current)), 1600)
    } catch {
      window.prompt('Copy this seller message', text)
    }
  }

  async function copyDealSummary(lead: GolfLeadRadar) {
    const text = [
      `Deal: ${lead.title}`,
      `Source: ${lead.source_name}`,
      `Ask: ${currency(lead.asking_price)}`,
      `Profit range: ${currency(lead.estimated_profit_low)} - ${currency(lead.estimated_profit_high)}`,
      `Location: ${lead.location_text}`,
      `Status: ${lead.status}`,
      `Created: ${formatDateTime(lead.created_at)}`,
      `Updated: ${formatDateTime(lead.updated_at)}`,
      lead.source_url ? `Listing: ${lead.source_url}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopiedLeadId(lead.id)
      setTimeout(() => setCopiedLeadId((current) => (current === lead.id ? null : current)), 1600)
    } catch {
      window.prompt('Copy this deal summary', text)
    }
  }

  function handleDeleteLead(lead: GolfLeadRadar) {
    const ok = window.confirm(`Delete this deal?\n\n${lead.title}`)
    if (!ok) return
    onDeleteLead(lead.id)
    onNavigate('/sourcing')
  }

  async function handleCraigslistScan() {
    setScanning(true)
    setScanMessage('Searching live public sources...')
    try {
      const imported = await onFetchDeals()
      if (imported.length > 0) {
        setScanResults(imported)
        setScanMessage(`Search complete: imported ${imported.length} new deal${imported.length > 1 ? 's' : ''} from live public sources.`)
      } else {
        // If no new leads were imported, still show matching leads from current data.
        const matches = saveCraigslistSearch()
        setScanResults(matches)
        setScanMessage(
          matches.length > 0
            ? 'No new deals were imported. Showing matching public leads already in your radar.'
            : 'No matching public leads found. Try changing county, keyword, or price range.',
        )
      }
    } finally {
      setScanning(false)
    }
  }

  function scrollToHubSection(section: 'top' | 'facebook' | 'sources' | 'settings') {
    if (section === 'facebook') setSourceHubTab('facebook')
    if (section === 'sources') setSourceHubTab('scan')
    if (section === 'settings') setSourceHubTab('settings')
    if (section === 'top') setSourceHubTab('inbox')

    const target =
      section === 'facebook'
        ? facebookImportRef.current
        : section === 'sources'
          ? publicSourcesRef.current
          : section === 'settings'
            ? settingsRef.current
            : hubTopRef.current

    target?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  function renderDashboard() {
    const nextBestAction =
      followupsDueToday.length > 0
        ? `Message ${followupsDueToday.length} seller follow-up${followupsDueToday.length === 1 ? '' : 's'} due today.`
        : strongBuyOpenLeads.length > 0
          ? `Review ${strongBuyOpenLeads.length} active strong buy lead${strongBuyOpenLeads.length === 1 ? '' : 's'}.`
          : noPhotoLeads.length > 0
            ? `Request photos for ${noPhotoLeads.length} lead${noPhotoLeads.length === 1 ? '' : 's'} before buying.`
            : 'Scan public sources or import fresh Facebook listings.'

    return (
      <div className="stack-lg">
        <section className="hero-card" ref={hubTopRef}>
          <h3>Source Deals Hub</h3>
          <p>
            Find local golf club and bag deals first, then value them before buying. This hub focuses on
            Facebook Marketplace and Craigslist opportunities in local pickup and local delivery zones.
          </p>
          <div className="source-tabbar">
            <button className={`source-tab ${sourceHubTab === 'inbox' ? 'active' : ''}`} type="button" onClick={() => scrollToHubSection('top')}>
              Lead Inbox
            </button>
            <button className={`source-tab ${sourceHubTab === 'facebook' ? 'active' : ''}`} type="button" onClick={() => scrollToHubSection('facebook')}>
              Import Facebook
            </button>
            <button className={`source-tab ${sourceHubTab === 'scan' ? 'active' : ''}`} type="button" onClick={() => scrollToHubSection('sources')}>
              Scan Public Sources
            </button>
            <button className={`source-tab ${sourceHubTab === 'followups' ? 'active' : ''}`} type="button" onClick={() => setSourceHubTab('followups')}>
              Follow-ups
            </button>
            <button className={`source-tab ${sourceHubTab === 'settings' ? 'active' : ''}`} type="button" onClick={() => scrollToHubSection('settings')}>
              Settings
            </button>
          </div>
          <div className="business-rule-banner" style={{ marginTop: '10px' }}>
            <strong>Facebook import:</strong> paste a real Marketplace item URL on the next screen. <strong>Public scan:</strong> searches enabled public sources like Craigslist, garage-sale feeds, and estate-sale listings.
          </div>
        </section>

        <section className="business-rule-banner">
          <strong>Next best sourcing action:</strong> {nextBestAction}
        </section>

        <section className="source-workflow">
          <button className="workflow-step-card" type="button" onClick={() => setSourceHubTab('facebook')}>
            <span className="badge">1. Get leads</span>
            <strong>Import Facebook</strong>
            <p>Paste real marketplace URLs or enter a clean manual lead.</p>
          </button>
          <button className="workflow-step-card" type="button" onClick={() => {
            setSourceHubTab('inbox')
            setQuickFilter(strongBuyOpenLeads.length > 0 ? 'strong-buy' : 'no-photo')
          }}>
            <span className="badge">2. Vet leads</span>
            <strong>{strongBuyOpenLeads.length} strong buys</strong>
            <p>{noPhotoLeads.length} still need seller photos before buying.</p>
          </button>
          <button className="workflow-step-card" type="button" onClick={() => setSourceHubTab('followups')}>
            <span className="badge">3. Follow up</span>
            <strong>{followupsDueToday.length} due today</strong>
            <p>Message sellers, confirm photos, and move hot deals forward.</p>
          </button>
        </section>

        {sourceHubTab === 'inbox' && (
          <>
        <section className="stats-grid">
          <article className="card"><h4>New leads today</h4><strong>{todaysLeads.length}</strong></article>
          <article className="card"><h4>Strong Buy leads</h4><strong>{strongBuys.length}</strong></article>
          <article className="card"><h4>Average expected profit</h4><strong>{currency(averageExpectedProfit)}</strong></article>
          <article className="card"><h4>Follow-ups due today</h4><strong>{followupsDueToday.length}</strong></article>
        </section>

        <section className="card form-grid">
          <h4>Lead Queue Controls</h4>
          <label>
            Search keywords
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Titleist, Vokey, golf clubs lot" />
          </label>
          <label>
            County / region
            <select value={countyFilter} onChange={(event) => setCountyFilter(event.target.value)}>
              <option>All</option>
              {[...new Set(locations.map((location) => location.county))].map((county) => (
                <option key={county}>{county}</option>
              ))}
            </select>
          </label>
          <label>
            Source
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              {sourceFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            View
            <div className="row-wrap">
              <button className={`btn ${mapMode === 'list' ? 'btn-primary' : ''}`} type="button" onClick={() => setMapMode('list')}>
                List
              </button>
              <button className={`btn ${mapMode === 'map' ? 'btn-primary' : ''}`} type="button" onClick={() => setMapMode('map')}>
                Map
              </button>
            </div>
          </label>
          <div className="span-2 row-wrap">
            <button className={`chip ${quickFilter === 'all' ? 'selected red' : ''}`} type="button" onClick={() => setQuickFilter('all')}>
              All
            </button>
            <button className={`chip ${quickFilter === 'no-photo' ? 'selected red' : ''}`} type="button" onClick={() => setQuickFilter('no-photo')}>
              Needs photos
            </button>
            <button className={`chip ${quickFilter === 'due' ? 'selected red' : ''}`} type="button" onClick={() => setQuickFilter('due')}>
              Due today
            </button>
            <button className={`chip ${quickFilter === 'strong-buy' ? 'selected red' : ''}`} type="button" onClick={() => setQuickFilter('strong-buy')}>
              Strong buy
            </button>
          </div>
        </section>

        <section className="card">
          <h4>Lead Queue</h4>
          {mapMode === 'map' ? (
            <div className="zone-board">
              {zoneBoard.length > 0 ? zoneBoard.map((zone) => (
                <button key={zone.county} className="zone-card" type="button" onClick={() => setCountyFilter(zone.county)}>
                  <div className="row-wrap space-between">
                    <strong>{zone.county}</strong>
                    <span className="badge">{zone.items.length} leads</span>
                  </div>
                  <p>{zone.strongBuyCount} strong buys</p>
                  <p>{zone.noPhotoCount} need seller photos</p>
                  <p>{currency(zone.potentialProfit)} potential profit</p>
                  <p className="muted-copy">Avg drive: {Math.round(zone.averageDrive)} min</p>
                  {zone.bestLead && <p className="muted-copy">Best lead: {zone.bestLead.title}</p>}
                </button>
              )) : (
                <div className="empty-state">
                  <strong>No zones match the current filters.</strong>
                  <p>Clear filters, import Facebook leads, or scan public sources.</p>
                  <div className="row-wrap">
                    <button className="btn" type="button" onClick={() => {
                      setCountyFilter('All')
                      setSourceFilter('All')
                      setQuickFilter('all')
                      setSearchText('')
                    }}>
                      Clear Filters
                    </button>
                    <button className="btn btn-info" type="button" onClick={() => setSourceHubTab('scan')}>
                      Scan Public Sources
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="deal-card-grid">
              {filteredLeads.length > 0 ? filteredLeads.map((lead) => {
                const pickupDifficulty = classifyPickupDifficulty(lead.distance_miles, lead.estimated_drive_minutes)
                const riskFlags = getRiskFlags(lead, settings)
                const sold = lead.status === 'sold'
                return (
                  <div key={lead.id} className="deal-card" onClick={() => onNavigate(`/sourcing/lead/${lead.id}`)} role="button" tabIndex={0}>
                    <DealPhotoCarousel lead={lead} />
                    <div className="row-wrap space-between">
                      <strong>{lead.title}</strong>
                      <span className={`badge ${sold ? 'badge-pass' : ''}`}>{sold ? 'Already Sold' : lead.deal_label}</span>
                    </div>
                    <p>{lead.location_text}</p>
                    <p>{currency(lead.asking_price)} asking</p>
                    <p>{currency(lead.estimated_resale_average)} avg resale</p>
                    <p>{currency(lead.estimated_profit_low)} - {currency(lead.estimated_profit_high)} profit</p>
                    <p className="muted-copy">Next: {getLeadNextStep(lead)}</p>
                    <p className="muted-copy">Updated {formatDateTime(lead.updated_at)}</p>
                    <div className="row-wrap">
                      {isRealListingLead(lead) && <span className="badge badge-good">Real listing URL</span>}
                      {getFacebookItemId(lead.source_url) && (
                        <span className="badge">FB item #{getFacebookItemId(lead.source_url)}</span>
                      )}
                      <span className="badge">Pickup {pickupDifficulty}</span>
                      <span className="badge">Buy max {currency(getSuggestedMaxBuy(lead))}</span>
                      {lead.pickup_available && <span className="badge">Pickup Only</span>}
                      {lead.local_delivery_available && <span className="badge">Local Delivery</span>}
                      {lead.shipping_required && <span className="badge badge-pass">Avoid Shipping</span>}
                      {riskFlags.slice(0, 2).map((flag) => (
                        <span key={flag} className="badge badge-pass">{flag}</span>
                      ))}
                    </div>
                    <div className="row-wrap" style={{ marginTop: '8px' }}>
                      {!sold && hasExternalUrl(getPrimaryContactUrl(lead)) && (
                        <a
                          className="btn btn-secondary"
                          href={getPrimaryContactUrl(lead)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {getPrimaryContactLabel(lead)}
                        </a>
                      )}
                      {!sold ? (
                        <button className="btn" type="button" onClick={(event) => void copySellerOutreach(lead, event)}>
                          {copiedLeadId === lead.id ? 'Copied' : hasNoOriginalPhotos(lead) ? 'Request photos' : 'Message seller'}
                        </button>
                      ) : (
                        <span className="muted-copy">This deal is marked sold</span>
                      )}
                    </div>
                  </div>
                )
              }) : (
                <div className="empty-state">
                  <strong>No leads match the current filters.</strong>
                  <p>Clear filters or add a fresh source lead.</p>
                  <div className="row-wrap">
                    <button className="btn" type="button" onClick={() => {
                      setCountyFilter('All')
                      setSourceFilter('All')
                      setQuickFilter('all')
                      setSearchText('')
                    }}>
                      Clear Filters
                    </button>
                    <button className="btn btn-success" type="button" onClick={() => setSourceHubTab('facebook')}>
                      Import Facebook
                    </button>
                    <button className="btn btn-info" type="button" onClick={() => setSourceHubTab('scan')}>
                      Scan Public Sources
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
          </>
        )}
      </div>
    )
  }

  function renderFacebookImport() {
    const previewScore = estimateGolfValue({
      asking_price: Number(facebookForm.askingPrice) || 0,
      brand_detected: facebookForm.title.split(' ')[0] ?? '',
      model_detected: facebookForm.title,
      pickup_available: facebookForm.pickupChoice !== 'shipping',
      local_delivery_available: facebookForm.pickupChoice === 'delivery',
      shipping_required: facebookForm.pickupChoice === 'shipping',
      condition_grade: 'Good',
    })

    return (
      <section className="card form-grid" ref={facebookImportRef}>
        <h3>Facebook URL Autoload (Recommended)</h3>
        <p className="span-2">Compliant workflow: copy listing details from Facebook Marketplace only. No automated scraping.</p>
        <p className="span-2 muted-copy">Only this is required: paste URL and click Autoload Selected URLs. Everything below is optional manual entry.</p>
        <p className="span-2 muted-copy">This page does not scan by itself. It only imports the Facebook URL(s) you paste below.</p>
        <section className="card span-2">
          <h4>Quick steps</h4>
          <ol className="plain-list">
            <li>Open the Facebook listing and copy its URL.</li>
            <li>Paste URL(s) below, one per line.</li>
            <li>Click Autoload Selected URLs.</li>
            <li>Open lead from Autoload Results.</li>
          </ol>
        </section>
        <label className="span-2">
          Paste Facebook listing URL(s) here (required)
          <textarea
            rows={4}
            value={facebookSelectedUrls}
            onChange={(event) => setFacebookSelectedUrls(event.target.value)}
            placeholder="https://www.facebook.com/marketplace/item/..."
          />
        </label>
        <p className="span-2 muted-copy">
          URLs detected: {parsePastedUrls(facebookSelectedUrls).length}. You can paste plain links, comma-separated links, or markdown links.
        </p>
        <div className="span-2 row-wrap">
          <a className="btn btn-info" href={facebookSearchUrl} target="_blank" rel="noreferrer">
            Open Facebook Golf Search
          </a>
          <button className="btn btn-success" type="button" onClick={() => void importSelectedFacebookListings()} disabled={facebookImporting}>
            {facebookImporting ? 'Autoloading...' : 'Autoload Selected URLs'}
          </button>
          {facebookImportMessage && <span className="muted-copy">{facebookImportMessage}</span>}
        </div>
        <div className="span-2 row-wrap">
          <button className="btn" type="button" onClick={() => setShowAdvancedManual((prev) => !prev)}>
            {showAdvancedManual ? 'Hide optional manual fields' : 'Show optional manual fields'}
          </button>
          <button className="btn" type="button" onClick={() => scrollToHubSection('top')}>
            Back to Top
          </button>
        </div>

        {showAdvancedManual && (
          <>
            <label className="span-2">
              Facebook listing URL
              <input value={facebookForm.sourceUrl} onChange={(event) => setFacebookForm((prev) => ({ ...prev, sourceUrl: event.target.value }))} />
            </label>
            <label className="span-2">
              Seller message URL (optional)
              <input
                value={facebookForm.messageUrl}
                onChange={(event) => setFacebookForm((prev) => ({ ...prev, messageUrl: event.target.value }))}
                placeholder="https://www.facebook.com/messages/..."
              />
            </label>
            <label className="span-2">
              Listing title
              <input value={facebookForm.title} onChange={(event) => setFacebookForm((prev) => ({ ...prev, title: event.target.value }))} />
            </label>
            <label>
              Asking price
              <input type="number" value={facebookForm.askingPrice} onChange={(event) => setFacebookForm((prev) => ({ ...prev, askingPrice: event.target.value }))} />
            </label>
            <label>
              Location
              <input value={facebookForm.locationText} onChange={(event) => setFacebookForm((prev) => ({ ...prev, locationText: event.target.value }))} />
            </label>
            <label className="span-2">
              Description
              <textarea rows={5} value={facebookForm.description} onChange={(event) => setFacebookForm((prev) => ({ ...prev, description: event.target.value }))} />
            </label>
            <label className="span-2">
              Photo URLs (one per line)
              <textarea
                rows={3}
                value={facebookForm.photoUrls}
                onChange={(event) => setFacebookForm((prev) => ({ ...prev, photoUrls: event.target.value }))}
                placeholder="https://...image1.jpg\nhttps://...image2.jpg"
              />
            </label>
            <label className="span-2">
              Screenshot / photo upload
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setFacebookForm((prev) => ({ ...prev, uploadedPhotos: event.target.files?.length ?? 0 }))}
              />
            </label>
            <label>
              Pickup or local delivery
              <select value={facebookForm.pickupChoice} onChange={(event) => setFacebookForm((prev) => ({ ...prev, pickupChoice: event.target.value as 'pickup' | 'delivery' | 'shipping' }))}>
                <option value="pickup">Pickup</option>
                <option value="delivery">Local delivery</option>
              </select>
            </label>
            <label>
              Notes
              <input value={facebookForm.notes} onChange={(event) => setFacebookForm((prev) => ({ ...prev, notes: event.target.value }))} />
            </label>
            <div className="span-2 row-wrap">
              <button className="btn btn-primary" type="button" onClick={saveManualFacebookLead}>
                Analyze Deal
              </button>
            </div>
            <section className="card span-2">
              <h4>Deal score preview</h4>
              <div className="stats-grid compact-grid">
                <article className="card"><h4>Estimated resale value</h4><strong>{currency(previewScore.estimated_resale_average)}</strong></article>
                <article className="card"><h4>Max recommended buy</h4><strong>{currency(previewScore.suggested_max_buy_price)}</strong></article>
                <article className="card"><h4>Expected profit</h4><strong className={previewScore.expected_profit >= 0 ? 'profit' : 'loss'}>{currency(previewScore.expected_profit)}</strong></article>
                <article className="card"><h4>Pickup distance</h4><strong>Set on lead detail</strong></article>
              </div>
              <p className="muted-copy">Risk notes: verify exact model, request close-up photos, and confirm pickup before committing.</p>
            </section>
          </>
        )}

        {lastImportSummary && (
          <section className="card span-2">
            <h4>Autoload Results (Real Data Only)</h4>
            <div className="chip-grid" style={{ marginBottom: '10px' }}>
              <span className="badge">Requested: {lastImportSummary.requested}</span>
              <span className="badge badge-good">Imported: {lastImportSummary.imported}</span>
              <span className="badge">Skipped: {lastImportSummary.skipped}</span>
              <span className="badge">Duplicate skipped: {lastImportSummary.duplicateSkipped}</span>
              <span className="badge">Unverified skipped: {lastImportSummary.unverifiedSkipped}</span>
            </div>

            {lastImportedLeads.length > 0 ? (
              <div className="stack-sm">
                {lastImportedLeads.map((lead) => (
                  <div key={lead.id} className="card">
                    {lead.image_urls.length > 0 ? (
                      <img
                        src={lead.image_urls[0]}
                        alt={lead.title}
                        style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '10px', marginBottom: '8px' }}
                      />
                    ) : (
                      <div className="muted-copy" style={{ marginBottom: '8px' }}>No photo was captured from Facebook; open the original listing to verify images.</div>
                    )}
                    <strong>{lead.title}</strong>
                    <p>{lead.source_name}</p>
                    <p>City/Town: {lead.location_text}</p>
                    <p className="muted-copy">{lead.source_url}</p>
                    <p>Suggested max buy: {currency(getSuggestedMaxBuy(lead))}</p>
                    <div className="row-wrap">
                      <button className="btn btn-primary" type="button" onClick={() => onNavigate(`/sourcing/lead/${lead.id}`)}>
                        Open lead
                      </button>
                      {hasExternalUrl(lead.source_url) && (
                        <a className="btn btn-secondary" href={lead.source_url} target="_blank" rel="noreferrer">
                          Open original listing
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-copy">No verified listings were added in the last import attempt.</p>
            )}

            <div className="row-wrap" style={{ marginTop: '8px' }}>
              <button className="btn" type="button" onClick={() => scrollToHubSection('top')}>
                Back to Top
              </button>
            </div>
          </section>
        )}
      </section>
    )
  }

  function renderCraigslist() {
    const preview = scanResults && scanResults.length > 0 ? scanResults : saveCraigslistSearch()
    return (
      <div className="stack-lg">
        <section className="card form-grid" ref={publicSourcesRef}>
          <h3>Facebook Marketplace + Scan Sources</h3>
          <p className="span-2">Search now auto-adds local deals from all enabled public sources. Shipping-only deals are excluded automatically.</p>
          <p className="muted-copy span-2">Enabled scan sources: {enabledPublicSourceNames.length > 0 ? enabledPublicSourceNames.join(', ') : 'none selected in settings'}.</p>
          {scanMessage && <p className="span-2 muted-copy">{scanMessage}</p>}
          <label>
            County / region
            <select value={craigslistForm.county} onChange={(event) => setCraigslistForm((prev) => ({ ...prev, county: event.target.value }))}>
              <option>All</option>
              {locations.map((location) => (
                <option key={location.location_name}>{location.county}</option>
              ))}
            </select>
          </label>
          <label>
            Keyword
            <select value={craigslistForm.keyword} onChange={(event) => setCraigslistForm((prev) => ({ ...prev, keyword: event.target.value }))}>
              {settings.keyword_rules.map((keyword) => (
                <option key={keyword}>{keyword}</option>
              ))}
            </select>
          </label>
          <label>
            Min price
            <input type="number" value={craigslistForm.minPrice} onChange={(event) => setCraigslistForm((prev) => ({ ...prev, minPrice: event.target.value }))} />
          </label>
          <label>
            Max price
            <input type="number" value={craigslistForm.maxPrice} onChange={(event) => setCraigslistForm((prev) => ({ ...prev, maxPrice: event.target.value }))} />
          </label>
          <div className="span-2 row-wrap">
            <button className="btn btn-primary" type="button" onClick={() => void handleCraigslistScan()} disabled={scanning}>
              {scanning ? 'Searching...' : 'Search now'}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                onUpdateSettings({
                  ...settings,
                  keyword_rules: Array.from(new Set([craigslistForm.keyword, ...settings.keyword_rules])),
                })
                setScanMessage(`Saved search: ${craigslistForm.keyword} in ${craigslistForm.county}.`)
              }}
            >
              Save search
            </button>
            <button className="btn" type="button" onClick={() => scrollToHubSection('top')}>
              Back to Top
            </button>
          </div>
        </section>
        <section className="card">
          <h4>New leads preview</h4>
          <div className="deal-card-grid">
            {preview.slice(0, 8).map((lead) => (
              <div key={lead.id} className="deal-card" onClick={() => onNavigate(`/sourcing/lead/${lead.id}`)} role="button" tabIndex={0}>
                <DealPhotoCarousel lead={lead} />
                <strong>{lead.title}</strong>
                <p>City/Town: {lead.location_text}</p>
                <p>{lead.source_name}</p>
                <p>{lead.status === 'sold' ? 'Already Sold' : lead.deal_label}</p>
                <p>Suggested max buy: {currency(getSuggestedMaxBuy(lead))}</p>
                <p className="muted-copy">Found {formatDateTime(lead.created_at)}</p>
                <div className="row-wrap" style={{ marginTop: '8px' }}>
                  {lead.status !== 'sold' && hasExternalUrl(getPrimaryContactUrl(lead)) && (
                    <a
                      className="btn btn-secondary"
                      href={getPrimaryContactUrl(lead)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {getPrimaryContactLabel(lead)}
                    </a>
                  )}
                  {lead.status !== 'sold' ? (
                    <button className="btn" type="button" onClick={(event) => void copySellerOutreach(lead, event)}>
                      {copiedLeadId === lead.id ? 'Copied' : hasNoOriginalPhotos(lead) ? 'Request photos' : 'Message seller'}
                    </button>
                  ) : (
                    <span className="muted-copy">This deal is marked sold</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  function renderLeadDetail() {
    if (!currentLead) {
      return <section className="card"><h3>Lead not found</h3></section>
    }

    const riskFlags = getRiskFlags(currentLead, settings)
    const sold = currentLead.status === 'sold'
    const offer = Math.min(currentLead.estimated_resale_average * 0.5, currentLead.estimated_resale_low * 0.45)
    const sellerMessage = generateSellerMessage('initial')
    const details = itemRows.length > 0 ? itemRows : leadItems.filter((item) => item.lead_id === currentLead.id)

    return (
      <div className="stack-lg">
        <section className="card">
          <div className="row-wrap space-between">
            <div>
              <h3>{currentLead.title}</h3>
              <p>{currentLead.source_name}</p>
              <p className="muted-copy">City/Town: {currentLead.location_text}</p>
              {getFacebookItemId(currentLead.source_url) && (
                <p className="muted-copy">Facebook item ID: {getFacebookItemId(currentLead.source_url)}</p>
              )}
              <p className="muted-copy">Created {formatDateTime(currentLead.created_at)}</p>
              <p className="muted-copy">Last update {formatDateTime(currentLead.updated_at)}</p>
              <p className="muted-copy">Last checked {formatDateTime(currentLead.last_checked_at)}</p>
            </div>
            <span className={`badge ${sold ? 'badge-pass' : 'badge-buy'}`}>{sold ? 'Already Sold' : currentLead.deal_label}</span>
          </div>
          <div className="row-wrap" style={{ marginTop: '12px' }}>
            <span className="badge">{currency(currentLead.asking_price)} asking</span>
            <span className="badge">{currency(currentLead.estimated_resale_average)} avg resale</span>
            <span className="badge">{currency(currentLead.estimated_profit_high)} profit high</span>
            <span className="badge">Pickup difficulty {classifyPickupDifficulty(currentLead.distance_miles, currentLead.estimated_drive_minutes)}</span>
            {currentLead.pickup_available && <span className="badge">Pickup Only</span>}
            {currentLead.local_delivery_available && <span className="badge">Local Delivery</span>}
            {currentLead.shipping_required && <span className="badge badge-pass">Avoid Shipping</span>}
          </div>
        </section>

        <section className="stats-grid">
          <article className="card"><h4>Deal score</h4><strong>{currentLead.deal_score}</strong></article>
          <article className="card"><h4>Suggested max buy</h4><strong>{currency(Math.min(currentLead.estimated_resale_average * 0.6, currentLead.estimated_resale_low * 0.45))}</strong></article>
          <article className="card"><h4>Suggested first offer</h4><strong>{currency(offer)}</strong></article>
          <article className="card"><h4>Confidence score</h4><strong>{estimateGolfValue({ asking_price: currentLead.asking_price, brand_detected: currentLead.brand_detected, model_detected: currentLead.model_detected, pickup_available: currentLead.pickup_available, local_delivery_available: currentLead.local_delivery_available, shipping_required: currentLead.shipping_required, condition_grade: 'Good' }).confidence_score}</strong></article>
        </section>

        <section className="card">
          <h4>Risk flags</h4>
          <div className="chip-grid">
            {riskFlags.map((flag) => (
              <span key={flag} className="badge badge-pass">{flag}</span>
            ))}
          </div>
        </section>

        <section className="card">
          <h4>Contact and follow-up checklist</h4>
          {sold && <p className="muted-copy">This lead is already sold. Messaging and seller contact actions are disabled.</p>}
          {!sold && hasExternalUrl(getPrimaryContactUrl(currentLead)) && (
            <p>
              <a className="btn btn-secondary" href={getPrimaryContactUrl(currentLead)} target="_blank" rel="noreferrer">
                {getPrimaryContactLabel(currentLead)}
              </a>
              <button className="btn" type="button" style={{ marginLeft: '8px' }} onClick={() => void copySellerOutreach(currentLead)}>
                {copiedLeadId === currentLead.id ? 'Copied' : hasNoOriginalPhotos(currentLead) ? 'Request photos' : 'Message seller'}
              </button>
            </p>
          )}
          <div className="row-wrap" style={{ marginBottom: '10px' }}>
            <button className="btn" type="button" onClick={() => void copyDealSummary(currentLead)}>
              {copiedLeadId === currentLead.id ? 'Copied' : 'Copy deal'}
            </button>
            <button className="btn btn-danger" type="button" onClick={() => handleDeleteLead(currentLead)}>
              Delete deal
            </button>
            <button className="btn" type="button" onClick={() => window.print()}>
              Print deal
            </button>
          </div>
          {currentLead.seller_contact_optional && (
            <p className="muted-copy">Seller contact: {currentLead.seller_contact_optional}</p>
          )}
          <ul className="plain-list">
            <li>Confirm pickup or local delivery.</li>
            <li>Ask for close photos of face, shaft, and grip.</li>
            <li>Inspect for cracks, counterfeit signs, and missing pieces.</li>
            <li>Log a follow-up before negotiating.</li>
          </ul>
          <div className="row-wrap" style={{ marginTop: '12px' }}>
            <button className="btn btn-secondary" disabled={sold} onClick={() => onUpdateLead({ ...currentLead, status: 'contacted', updated_at: new Date().toISOString() })}>
              Mark contacted
            </button>
            <button className="btn" disabled={sold} onClick={() => onUpdateLead({ ...currentLead, status: 'negotiating', updated_at: new Date().toISOString() })}>
              Mark negotiating
            </button>
            <button className="btn btn-primary" disabled={sold} onClick={() => onUpdateLead({ ...currentLead, status: 'bought', updated_at: new Date().toISOString() })}>
              Mark bought
            </button>
            <button className="btn" onClick={() => onUpdateLead({ ...currentLead, status: 'sold', updated_at: new Date().toISOString() })}>
              Mark sold
            </button>
            <button className="btn btn-danger" onClick={() => onUpdateLead({ ...currentLead, status: 'passed', updated_at: new Date().toISOString() })}>
              Pass
            </button>
          </div>
        </section>

        <section className="card">
          <h4>In-app messaging</h4>
          <p className="muted-copy">Write your message here, then copy and paste into Facebook, Craigslist, SMS, or email.</p>
          {currentLeadMessage && <p className="muted-copy">{currentLeadMessage}</p>}
          <label>
            Message seller
            <textarea
              rows={5}
              value={currentSellerDraft}
              onChange={(event) => {
                if (!currentLead) return
                setSellerDraftByLeadId((prev) => ({ ...prev, [currentLead.id]: event.target.value }))
              }}
            />
          </label>
          <div className="row-wrap" style={{ marginTop: '8px' }}>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(currentSellerDraft)
                  setCopiedLeadId(currentLead.id)
                  setTimeout(() => setCopiedLeadId((current) => (current === currentLead.id ? null : current)), 1600)
                } catch {
                  window.prompt('Copy this seller message', currentSellerDraft)
                }
              }}
            >
              {copiedLeadId === currentLead.id ? 'Copied' : 'Copy seller message'}
            </button>
            <button className="btn btn-primary" type="button" disabled={sold} onClick={() => sendDirectMessage('seller')}>
              Log seller follow-up
            </button>
          </div>

          <label style={{ marginTop: '12px' }}>
            Message buyer
            <textarea
              rows={5}
              value={currentBuyerDraft}
              onChange={(event) => {
                if (!currentLead) return
                setBuyerDraftByLeadId((prev) => ({ ...prev, [currentLead.id]: event.target.value }))
              }}
            />
          </label>
          <div className="row-wrap" style={{ marginTop: '8px' }}>
            <button
              className="btn"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(currentBuyerDraft)
                  setCopiedLeadId(currentLead.id)
                  setTimeout(() => setCopiedLeadId((current) => (current === currentLead.id ? null : current)), 1600)
                } catch {
                  window.prompt('Copy this buyer message', currentBuyerDraft)
                }
              }}
            >
              {copiedLeadId === currentLead.id ? 'Copied' : 'Copy buyer message'}
            </button>
            <button className="btn btn-primary" type="button" onClick={() => sendDirectMessage('buyer')}>
              Log buyer follow-up
            </button>
          </div>
        </section>

        <section className="card">
          <h4>Resale listing draft</h4>
          <p>Title: {currentLead.brand_detected} {currentLead.model_detected} - {currentLead.club_type_detected} - Local Pickup</p>
          <textarea readOnly rows={6} value={`${currentLead.brand_detected} ${currentLead.model_detected} ${currentLead.club_type_detected}\nCondition: Good used condition with normal wear.\nLocal pickup available.\nMessage with questions.\n\nSuggested photos: face, sole, shaft, grip, and any damage.`} />
          <p className="muted-copy" style={{ marginTop: '8px' }}>{sellerMessage}</p>
        </section>

        <section className="card">
          <h4>Lead items</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Brand</th>
                  <th>Model</th>
                  <th>Low</th>
                  <th>High</th>
                </tr>
              </thead>
              <tbody>
                {details.map((item) => (
                  <tr key={item.id}>
                    <td>{item.item_type}</td>
                    <td>{item.brand}</td>
                    <td>{item.model}</td>
                    <td>{currency(item.estimated_individual_resale_low)}</td>
                    <td>{currency(item.estimated_individual_resale_high)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h4>Follow-ups</h4>
          <div className="stack-sm">
            {currentFollowups.map((followup) => (
              <div key={followup.id} className="card">
                <strong>{followup.followup_type.replaceAll('_', ' ')}</strong>
                <p>Due: {followup.due_date}</p>
                <p>{followup.notes}</p>
              </div>
            ))}
          </div>
          <button
            className="btn btn-secondary"
            onClick={() =>
              onAddFollowup({
                id: crypto.randomUUID(),
                lead_id: currentLead.id,
                followup_type: 'message_seller',
                due_date: new Date().toISOString().slice(0, 10),
                completed: false,
                notes: 'Auto-created from lead detail page',
                created_at: new Date().toISOString(),
              })
            }
          >
            Add follow-up
          </button>
        </section>
      </div>
    )
  }

  function renderFollowups() {
    return (
      <div className="stack-lg">
        <section className="card">
          <h3>Follow-ups</h3>
          <p>Work today's sourcing queue without digging through every lead.</p>
          <div className="workflow-grid" style={{ marginTop: '12px' }}>
            <article className="workflow-card">
              <p className="muted-copy">Photo requests</p>
              <strong>{noPhotoLeads.length}</strong>
              <p>Ask for exact seller photos before any buy decision.</p>
              <button className="btn btn-primary" type="button" onClick={() => {
                setQuickFilter('no-photo')
                setSourceHubTab('inbox')
              }}>
                Queue no-photo leads
              </button>
            </article>
            <article className="workflow-card">
              <p className="muted-copy">Due today</p>
              <strong>{followupsDueToday.length}</strong>
              <p>Message sellers and keep hot deals moving.</p>
              <button className="btn" type="button" onClick={() => {
                setQuickFilter('due')
                setSourceHubTab('inbox')
              }}>
                Queue due follow-ups
              </button>
            </article>
            <article className="workflow-card">
              <p className="muted-copy">Best margins</p>
              <strong>{strongBuyOpenLeads.length}</strong>
              <p>Prioritize strong buys before lower-confidence leads.</p>
              <button className="btn btn-success" type="button" onClick={() => {
                setQuickFilter('strong-buy')
                setSourceHubTab('inbox')
              }}>
                Queue strong buys
              </button>
            </article>
          </div>
        </section>

        <section className="card">
          <h4>Due Today</h4>
          <div className="stack-sm">
            {followupsDueToday.length > 0 ? (
              followupsDueToday.map((followup) => {
                const lead = leads.find((item) => item.id === followup.lead_id)
                return (
                  <button key={followup.id} className="deal-card compact" onClick={() => onNavigate(`/sourcing/lead/${followup.lead_id}`)}>
                    <strong>{lead?.title ?? 'Lead'}</strong>
                    <p>{followup.followup_type.replaceAll('_', ' ')}</p>
                    <p>Due {followup.due_date}</p>
                    {lead && <p className="muted-copy">{lead.location_text} - {currency(lead.asking_price)} asking</p>}
                  </button>
                )
              })
            ) : (
              <div className="empty-state">
                <strong>No follow-ups are due today.</strong>
                <p>Use this time to scan for fresh local pickup deals or import a Facebook listing you already found.</p>
                <div className="row-wrap">
                  <button className="btn btn-success" type="button" onClick={() => setSourceHubTab('facebook')}>
                    Import Facebook
                  </button>
                  <button className="btn btn-info" type="button" onClick={() => setSourceHubTab('scan')}>
                    Scan Public Sources
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    )
  }

  function renderSettings() {
    return (
      <section className="card form-grid" ref={settingsRef}>
          <h3>Sourcing Settings</h3>
        <label>
          Home/base zip code
          <input value={settings.base_zip_code} onChange={(event) => onUpdateSettings({ ...settings, base_zip_code: event.target.value })} />
        </label>
        <label>
          Max drive time
          <input type="number" value={settings.max_drive_time_minutes} onChange={(event) => onUpdateSettings({ ...settings, max_drive_time_minutes: Number(event.target.value) || 0 })} />
        </label>
        <label>
          Minimum profit target
          <input type="number" value={settings.minimum_profit_target} onChange={(event) => onUpdateSettings({ ...settings, minimum_profit_target: Number(event.target.value) || 0 })} />
        </label>
        <label>
          Minimum deal score
          <input type="number" value={settings.minimum_deal_score} onChange={(event) => onUpdateSettings({ ...settings, minimum_deal_score: Number(event.target.value) || 0 })} />
        </label>
        <label className="span-2">
          Primary counties
          <input value={settings.primary_counties.join(', ')} onChange={(event) => onUpdateSettings({ ...settings, primary_counties: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} />
        </label>
        <label className="span-2">
          Secondary counties
          <input value={settings.secondary_counties.join(', ')} onChange={(event) => onUpdateSettings({ ...settings, secondary_counties: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} />
        </label>
        <label className="span-2">
          Keyword management
          <textarea rows={4} value={settings.keyword_rules.join('\n')} onChange={(event) => onUpdateSettings({ ...settings, keyword_rules: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} />
        </label>
        <label className="span-2">
          Brand priority settings
          <textarea rows={4} value={settings.brand_priority.join('\n')} onChange={(event) => onUpdateSettings({ ...settings, brand_priority: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} />
        </label>
        <section className="card span-2">
          <h4>Source enable / disable</h4>
          <div className="stack-sm">
            {[...manualFacebookSources, ...radarSources].map((source) => (
              <label key={source.id} className="row-wrap">
                <input type="checkbox" checked={source.enabled} onChange={(event) => onToggleSource(source.id, event.target.checked)} />
                <span>{source.source_name}</span>
                <span className="muted-copy">{source.compliance_notes}</span>
              </label>
            ))}
          </div>
        </section>
      </section>
    )
  }

  if (view === 'lead') {
    return <div className="stack-lg">{renderLeadDetail()}</div>
  }

  return (
    <div className="stack-lg">
      {renderDashboard()}
      {sourceHubTab === 'facebook' && renderFacebookImport()}
      {sourceHubTab === 'scan' && renderCraigslist()}
      {sourceHubTab === 'followups' && renderFollowups()}
      {sourceHubTab === 'settings' && renderSettings()}
    </div>
  )
}
