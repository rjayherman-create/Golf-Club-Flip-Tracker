import { type MouseEvent, useMemo, useState } from 'react'
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
  onNavigate: (path: string) => void
  onSaveLead: (lead: GolfLeadRadar, items?: GolfLeadItem[], followups?: LeadFollowup[]) => void
  onUpdateLead: (lead: GolfLeadRadar) => void
  onDeleteLead: (leadId: string) => void
  onUpdateSettings: (settings: SourcingRadarSettings) => void
  onToggleSource: (sourceId: string, enabled: boolean) => void
  onAddFollowup: (followup: LeadFollowup) => void
}

function percent(value: number) {
  return `${value.toFixed(0)}%`
}

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

  return lead.image_urls.filter((url) => {
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
        style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '10px' }}
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
}: LocalSourcingRadarProps) {
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
  const [scanResults, setScanResults] = useState<GolfLeadRadar[] | null>(null)
  const [scanning, setScanning] = useState(false)
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
  const scanSources = useMemo(() => sources.filter((source) => source.enabled), [sources])

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

  const totalPotentialProfit = eligibleLeads.reduce((sum, lead) => sum + Math.max(0, lead.estimated_profit_high), 0)
  const averageExpectedProfit = eligibleLeads.length
    ? eligibleLeads.reduce((sum, lead) => sum + lead.estimated_profit_low, 0) / eligibleLeads.length
    : 0

  const leadsByCounty = useMemo(() => {
    const grouped: Record<string, number> = {}
    eligibleLeads.forEach((lead) => {
      grouped[lead.county] = (grouped[lead.county] ?? 0) + 1
    })
    return grouped
  }, [eligibleLeads])

  const leadsBySource = useMemo(() => {
    const grouped: Record<string, number> = {}
    eligibleLeads.forEach((lead) => {
      grouped[lead.source_name] = (grouped[lead.source_name] ?? 0) + 1
    })
    return grouped
  }, [eligibleLeads])

  const monthKey = new Date().toISOString().slice(0, 7)
  const boughtThisMonth = eligibleLeads.filter((lead) => lead.status === 'bought' && lead.updated_at.startsWith(monthKey)).length
  const soldThisMonth = eligibleLeads.filter((lead) => lead.status === 'sold' && lead.updated_at.startsWith(monthKey)).length
  const roiThisMonth = eligibleLeads.length
    ? eligibleLeads
        .filter((lead) => lead.updated_at.startsWith(monthKey))
        .reduce((sum, lead) => sum + lead.deal_score, 0) /
      Math.max(1, eligibleLeads.filter((lead) => lead.updated_at.startsWith(monthKey)).length)
    : 0

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
      message: `${target === 'seller' ? 'Seller' : 'Buyer'} message sent from app at ${formatDateTime(now)}.`,
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
    try {
      const imported = await onFetchDeals()
      if (imported.length > 0) {
        setScanResults(imported)
      } else {
        // If no new leads were imported, still show matching leads from current data.
        setScanResults(saveCraigslistSearch())
      }
    } finally {
      setScanning(false)
    }
  }

  function renderDashboard() {
    return (
      <div className="stack-lg">
        <section className="hero-card">
          <h3>LOCAL SOURCING RADAR</h3>
          <p>
            The main job is to find a source of golf clubs and bags first. Scan local used clubs, golf
            bags, and club lots across Long Island, NYC, and nearby tri-state pickup zones. The module
              focuses on local pickup and local delivery only.
          </p>
          <div className="row-wrap">
            <button className="btn btn-success" onClick={() => onNavigate('/sourcing/add-facebook')}>
              Find Clubs & Bags
            </button>
            <button className="btn btn-info" onClick={() => onNavigate('/sourcing/craigslist')}>
              Radar Scan
            </button>
          </div>
          <div className="business-rule-banner">
            <strong>Source finder:</strong> Facebook Marketplace and Craigslist only. No shipping-only opportunities.
          </div>
        </section>

        <section className="card">
          <h4>Lead source priority</h4>
          <div className="chip-grid">
            <span className="badge badge-strong-buy">Facebook manual import</span>
            <span className="badge badge-good">Craigslist</span>
            <span className="badge">Inspect Facebook leads first</span>
            <span className="badge">Focus on pickup, local delivery, and margin</span>
          </div>
        </section>

        <section className="stats-grid">
          <article className="card"><h4>New leads today</h4><strong>{todaysLeads.length}</strong></article>
          <article className="card"><h4>Strong Buy leads</h4><strong>{strongBuys.length}</strong></article>
          <article className="card"><h4>Average expected profit</h4><strong>{currency(averageExpectedProfit)}</strong></article>
          <article className="card"><h4>Total potential profit</h4><strong>{currency(totalPotentialProfit)}</strong></article>
          <article className="card"><h4>Follow-ups due today</h4><strong>{followupsDueToday.length}</strong></article>
          <article className="card"><h4>Bought this month</h4><strong>{boughtThisMonth}</strong></article>
          <article className="card"><h4>Sold this month</h4><strong>{soldThisMonth}</strong></article>
          <article className="card"><h4>ROI this month</h4><strong>{percent(roiThisMonth)}</strong></article>
        </section>

        <section className="card">
          <h4>Workflow Coach</h4>
          <div className="workflow-grid">
            <article className="workflow-card">
              <p className="muted-copy">Step 1</p>
              <strong>{noPhotoLeads.length} leads missing photos</strong>
              <p>Get seller photos before any purchase decision.</p>
              <button className="btn btn-primary" type="button" onClick={() => setQuickFilter('no-photo')}>
                Review no-photo leads
              </button>
            </article>
            <article className="workflow-card">
              <p className="muted-copy">Step 2</p>
              <strong>{followupsDueToday.length} follow-ups due today</strong>
              <p>Keep momentum so good deals do not go cold.</p>
              <button className="btn" type="button" onClick={() => setQuickFilter('due')}>
                Focus due follow-ups
              </button>
            </article>
            <article className="workflow-card">
              <p className="muted-copy">Step 3</p>
              <strong>{strongBuyOpenLeads.length} active strong buys</strong>
              <p>Prioritize best-margin opportunities first.</p>
              <button className="btn btn-success" type="button" onClick={() => setQuickFilter('strong-buy')}>
                Focus strong buys
              </button>
            </article>
          </div>
          <div className="row-wrap" style={{ marginTop: '10px' }}>
            <button className={`chip ${quickFilter === 'all' ? 'selected red' : ''}`} type="button" onClick={() => setQuickFilter('all')}>
              All leads
            </button>
            <button className={`chip ${quickFilter === 'no-photo' ? 'selected red' : ''}`} type="button" onClick={() => setQuickFilter('no-photo')}>
              No photos
            </button>
            <button className={`chip ${quickFilter === 'due' ? 'selected red' : ''}`} type="button" onClick={() => setQuickFilter('due')}>
              Due today
            </button>
            <button className={`chip ${quickFilter === 'strong-buy' ? 'selected red' : ''}`} type="button" onClick={() => setQuickFilter('strong-buy')}>
              Strong buy
            </button>
          </div>
        </section>

        <section className="card form-grid">
          <h4>Search and Filter</h4>
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
              <option>All</option>
              <optgroup label="Manual Facebook">
                {manualFacebookSources.map((source) => (
                  <option key={source.id}>{source.source_name}</option>
                ))}
              </optgroup>
              <optgroup label="Radar / public sources">
                {radarSources.map((source) => (
                  <option key={source.id}>{source.source_name}</option>
                ))}
              </optgroup>
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
        </section>

        <section className="card">
          <h4>Strong Buy Leads</h4>
          <div className="deal-card-grid">
            {strongBuys.slice(0, 6).map((lead) => {
              const flags = getRiskFlags(lead, settings)
              const sold = lead.status === 'sold'
              return (
                <div key={lead.id} className="deal-card" onClick={() => onNavigate(`/sourcing/lead/${lead.id}`)} role="button" tabIndex={0}>
                  <DealPhotoCarousel lead={lead} />
                  <div className="row-wrap space-between">
                    <strong>{lead.title}</strong>
                    <span className={`badge ${sold ? 'badge-pass' : 'badge-buy'}`}>{sold ? 'Already Sold' : 'Strong Buy'}</span>
                  </div>
                  <p>{lead.location_text}</p>
                  <p>{currency(lead.asking_price)} asking</p>
                  <p>{currency(lead.estimated_profit_high)} potential profit</p>
                  <p className="muted-copy">Next: {getLeadNextStep(lead)}</p>
                  <p className="muted-copy">Updated {formatDateTime(lead.updated_at)}</p>
                  <div className="row-wrap">
                    {lead.pickup_available && <span className="badge">Pickup Only</span>}
                    {lead.local_delivery_available && <span className="badge">Local Delivery</span>}
                    {lead.shipping_required && <span className="badge badge-pass">Avoid Shipping</span>}
                    {flags.length > 0 && <span className="badge">Needs Research</span>}
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
            })}
          </div>
        </section>

        <section className="card">
          <h4>Leads by county</h4>
          <div className="chip-grid">
            {Object.entries(leadsByCounty).map(([county, count]) => (
              <span key={county} className="badge">
                {county}: {count}
              </span>
            ))}
          </div>
        </section>

        <section className="card">
          <h4>Leads by source</h4>
          <div className="chip-grid">
            {Object.entries(leadsBySource).map(([source, count]) => (
              <span key={source} className="badge">
                {source}: {count}
              </span>
            ))}
          </div>
        </section>

        <section className="card">
          <h4>Leads needing follow-up</h4>
          <div className="stack-sm">
            {followupsDueToday.slice(0, 6).map((followup) => {
              const lead = leads.find((item) => item.id === followup.lead_id)
              return (
                <button key={followup.id} className="deal-card compact" onClick={() => onNavigate(`/sourcing/lead/${followup.lead_id}`)}>
                  <strong>{lead?.title ?? 'Lead'}</strong>
                  <p>{followup.followup_type.replaceAll('_', ' ')}</p>
                  <p>Due {followup.due_date}</p>
                </button>
              )
            })}
          </div>
        </section>

        <section className="card">
          <h4>Filtered leads</h4>
          {mapMode === 'map' ? (
            <div className="placeholder-map">
              Map placeholder for Long Island, NYC, and Westchester sourcing zones.
            </div>
          ) : (
            <div className="deal-card-grid">
              {filteredLeads.map((lead) => {
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
                      <span className="badge">Pickup {pickupDifficulty}</span>
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
              })}
            </div>
          )}
        </section>
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
      <section className="card form-grid">
        <h3>Manual Facebook Marketplace Import</h3>
          <p className="span-2">Compliant workflow: copy listing details from Facebook Marketplace only. No automated scraping.</p>
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
          <button className="btn" type="button" onClick={() => onNavigate('/sourcing')}>
            Back to Radar
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
      </section>
    )
  }

  function renderCraigslist() {
    const preview = scanResults && scanResults.length > 0 ? scanResults : saveCraigslistSearch()
    return (
      <div className="stack-lg">
        <section className="card form-grid">
          <h3>Facebook Marketplace + Craigslist Connector</h3>
          <p className="span-2">Search now auto-adds deals only from Facebook Marketplace and Craigslist. Shipping-only deals are excluded automatically.</p>
          <label>
            Source selector
            <select value={craigslistForm.sourceId} onChange={(event) => setCraigslistForm((prev) => ({ ...prev, sourceId: event.target.value }))}>
                {scanSources.map((source) => (
                <option key={source.id} value={source.id}>{source.source_name}</option>
              ))}
            </select>
          </label>
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
            <button className="btn btn-secondary" type="button">
              Save search
            </button>
            <button className="btn" type="button" onClick={() => onNavigate('/sourcing')}>
              Back to Radar
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
                <p>{lead.location_text}</p>
                <p>{lead.status === 'sold' ? 'Already Sold' : lead.deal_label}</p>
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
              Send seller message from app
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
              Send buyer message from app
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

  function renderSettings() {
    return (
      <section className="card form-grid">
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

  return (
    <div className="stack-lg">
      <section className="row-wrap">
        <button className="btn btn-primary" onClick={() => onNavigate('/sourcing')}>Dashboard</button>
        <button className="btn btn-success" onClick={() => onNavigate('/sourcing/add-facebook')}>Add Facebook</button>
        <button className="btn btn-info" onClick={() => onNavigate('/sourcing/craigslist')}>Craigslist</button>
        <button className="btn btn-secondary" onClick={() => onNavigate(`/sourcing/lead/${selectedLead?.id ?? ''}`)}>Lead Detail</button>
        <button className="btn btn-outline" onClick={() => onNavigate('/sourcing/settings')}>Settings</button>
      </section>
      <section className="card">
        <p>
          This tracker focuses only on Facebook Marketplace and Craigslist golf club deals in the Long Island, NYC, Westchester, and nearby tristate area. The goal is to find local pickup or delivery opportunities with strong resale potential.
        </p>
      </section>

      {view === 'dashboard' && renderDashboard()}
      {view === 'add-facebook' && renderFacebookImport()}
      {view === 'craigslist' && renderCraigslist()}
      {view === 'lead' && renderLeadDetail()}
      {view === 'settings' && renderSettings()}
    </div>
  )
}
