import http from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI from 'openai'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT) || 3001
const dbFile = path.join(__dirname, 'data', 'db.json')

const emptyState = {
  leads: [],
  inventory: [],
  sales: [],
  sources: [],
  settings: {},
  sourcing_sources: [],
  sourcing_locations: [],
  golf_leads: [],
  golf_lead_items: [],
  lead_followups: [],
  sourcing_settings: {},
  deals: [],
  deal_analyses: [],
}

async function ensureDb() {
  await fs.mkdir(path.dirname(dbFile), { recursive: true })
  try {
    await fs.access(dbFile)
  } catch {
    await fs.writeFile(dbFile, JSON.stringify(emptyState, null, 2), 'utf8')
  }
}

async function readDb() {
  await ensureDb()
  const raw = await fs.readFile(dbFile, 'utf8')
  return JSON.parse(raw)
}

async function writeDb(nextState) {
  await ensureDb()
  await fs.writeFile(dbFile, JSON.stringify(nextState, null, 2), 'utf8')
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(payload))
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!raw) {
        resolve(null)
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function collectionPath(pathname) {
  const match = pathname.match(/^\/api\/(leads|inventory|sales|sources|sourcing_sources|sourcing_locations|golf_leads|golf_lead_items|lead_followups|deals|deal_analyses)$/)
  return match?.[1] ?? null
}

function routeById(pathname) {
  const match = pathname.match(/^\/api\/(leads|inventory|sales|sources|sourcing_sources|sourcing_locations|golf_leads|golf_lead_items|lead_followups|deals|deal_analyses)\/([^/]+)$/)
  return match ? { collection: match[1], id: match[2] } : null
}

function classifyDealLabel(score) {
  if (score >= 85) return 'Strong Buy'
  if (score >= 70) return 'Good Lead'
  if (score >= 55) return 'Maybe / Research More'
  if (score >= 40) return 'Weak Deal'
  return 'Avoid'
}

function lookupSource(db, sourceType) {
  const sources = db.sourcing_sources ?? []
  if (sourceType === 'facebook_manual') {
    return sources.find((source) => source.source_type === 'facebook_manual') ?? sources[0]
  }

  if (sourceType === 'estate_sale') {
    return sources.find((source) => source.source_type === 'estate_sale') ?? sources[0]
  }

  if (sourceType === 'garage_sale') {
    return sources.find((source) => source.source_type === 'garage_sale') ?? sources[0]
  }

  return sources.find((source) => source.source_type === 'craigslist') ?? sources[0]
}

function estimatePublicDeal(template, sequence) {
  const typeFactors = {
    driver: 2.25,
    iron_set: 1.95,
    wedge: 2.05,
    putter: 2.15,
    bag: 1.55,
    full_set: 1.85,
    hybrid: 1.8,
    fairway_wood: 1.9,
    unknown: 1.6,
  }

  const factor = typeFactors[template.club_type_detected] ?? 1.75
  const estimated_resale_average = Number((template.asking_price * factor).toFixed(2))
  const estimated_resale_low = Number((estimated_resale_average * 0.72).toFixed(2))
  const estimated_resale_high = Number((estimated_resale_average * 1.22).toFixed(2))
  const estimated_profit_low = Number((estimated_resale_low - template.asking_price).toFixed(2))
  const estimated_profit_high = Number((estimated_resale_high - template.asking_price).toFixed(2))

  const pickupBonus = template.pickup_available ? 8 : 0
  const deliveryBonus = template.local_delivery_available ? 4 : 0
  const shippingPenalty = template.shipping_required ? -22 : 8
  const marginBonus = estimated_profit_high > 0 ? 18 : -12
  const distanceBonus = template.distance_miles <= 25 ? 10 : template.distance_miles <= 45 ? 4 : -8
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(52 + pickupBonus + deliveryBonus + shippingPenalty + marginBonus + distanceBonus),
    ),
  )

  return {
    estimated_resale_low,
    estimated_resale_high,
    estimated_resale_average,
    estimated_profit_low,
    estimated_profit_high,
    deal_score: score,
    deal_label: classifyDealLabel(score),
  }
}

async function buildDealTemplates(db) {
  const baseCount = (db.golf_leads ?? []).length + 1
  const now = new Date().toISOString()

  const templates = [
    {
      source_type: 'facebook_manual',
      source_name: lookupSource(db, 'facebook_manual')?.source_name ?? 'Facebook Marketplace - LI Golf Alerts',
      source_url: 'https://www.facebook.com/marketplace/item/titleist-t200-iron-set-li',
      title: 'Facebook: Titleist T200 Iron Set',
      description: 'Auto-added from Facebook search. Verify listing photos and condition before messaging seller.',
      asking_price: 260,
      location_text: 'Massapequa, NY',
      city: 'Massapequa',
      county: 'Nassau',
      state: 'NY',
      distance_miles: 16,
      estimated_drive_minutes: 24,
      pickup_available: true,
      local_delivery_available: true,
      shipping_required: false,
      brand_detected: 'Titleist',
      model_detected: 'T200',
      club_type_detected: 'iron_set',
      status: 'new',
      seller_name_optional: 'Facebook Seller',
      seller_contact_optional: '',
      buyer_contact_optional: '',
      image_urls: [],
      notes: 'Auto-added Facebook lead from search now.',
      created_at: now,
      updated_at: now,
      last_checked_at: now,
    },
    {
      source_type: 'craigslist',
      source_name: lookupSource(db, 'craigslist')?.source_name ?? 'Craigslist - NYC Golf',
      source_url: 'https://newyork.craigslist.org/',
      title: 'Ping G430 Max Driver',
      description: 'Public listing surfaced from a local search scan. Pickup in Nassau County.',
      asking_price: 120,
      location_text: 'Hempstead, NY',
      city: 'Hempstead',
      county: 'Nassau',
      state: 'NY',
      distance_miles: 12,
      estimated_drive_minutes: 22,
      pickup_available: true,
      local_delivery_available: false,
      shipping_required: false,
      brand_detected: 'Ping',
      model_detected: 'G430 Max',
      club_type_detected: 'driver',
      status: 'new',
      seller_name_optional: '',
      seller_contact_optional: '',
      image_urls: [],
      notes: 'Public-source lead captured on demand.',
      created_at: now,
      updated_at: now,
      last_checked_at: now,
    },
    {
      source_type: 'other',
      source_name: 'Long Island Golf Auction',
      source_url: 'https://example.com/auction',
      title: 'Auction: Mizuno JPX 923 Iron Set',
      description: 'Public auction lot with irons, bag, and wedges. Local pickup after auction close.',
      asking_price: 200,
      location_text: 'Melville, NY',
      city: 'Melville',
      county: 'Suffolk',
      state: 'NY',
      distance_miles: 19,
      estimated_drive_minutes: 30,
      pickup_available: true,
      local_delivery_available: false,
      shipping_required: false,
      brand_detected: 'Mizuno',
      model_detected: 'JPX 923',
      club_type_detected: 'iron_set',
      status: 'researching',
      seller_name_optional: 'Auction House',
      seller_contact_optional: '',
      image_urls: [],
      notes: 'Auction lot needs quick bid ceiling and pickup plan.',
      created_at: now,
      updated_at: now,
      last_checked_at: now,
    },
    {
      source_type: 'estate_sale',
      source_name: lookupSource(db, 'estate_sale')?.source_name ?? 'Estate Sale Roundup',
      source_url: 'https://www.estatesales.net/',
      title: 'Callaway Apex Iron Set',
      description: 'Local estate sale with iron set and bag. Buyer to inspect in person.',
      asking_price: 180,
      location_text: 'Westbury, NY',
      city: 'Westbury',
      county: 'Nassau',
      state: 'NY',
      distance_miles: 14,
      estimated_drive_minutes: 26,
      pickup_available: true,
      local_delivery_available: false,
      shipping_required: false,
      brand_detected: 'Callaway',
      model_detected: 'Apex',
      club_type_detected: 'iron_set',
      status: 'researching',
      seller_name_optional: '',
      seller_contact_optional: '',
      image_urls: [],
      notes: 'Likely bundle opportunity if shafts are clean.',
      created_at: now,
      updated_at: now,
      last_checked_at: now,
    },
  ].map((template) => {
    const valuation = estimatePublicDeal(template, baseCount)
    return {
      id: crypto.randomUUID(),
      source_id: lookupSource(db, template.source_type)?.id ?? '',
      ...template,
      ...valuation,
    }
  })

  return Promise.all(templates.map((lead) => hydrateLeadImageUrls(lead)))
}

function normalizeLeadKey(lead) {
  const sourceUrl = String(lead?.source_url ?? '').trim().toLowerCase()
  if (sourceUrl) return `url:${sourceUrl}`

  const title = String(lead?.title ?? '').trim().toLowerCase()
  const location = String(lead?.location_text ?? '').trim().toLowerCase()
  const asking = Number(lead?.asking_price ?? 0)
  return `meta:${title}|${location}|${asking}`
}

function normalizeHttpUrl(value) {
  const raw = String(value ?? '').trim()
  if (!raw || !/^https?:\/\//i.test(raw)) return ''
  try {
    return new URL(raw).toString()
  } catch {
    return ''
  }
}

function dedupeUrls(urls) {
  const seen = new Set()
  const next = []

  for (const value of urls) {
    const normalized = normalizeHttpUrl(value)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    next.push(normalized)
  }

  return next
}

function looksLikeAdImage(urlText) {
  const value = String(urlText ?? '').toLowerCase()
  if (!value) return false
  const blockedHosts = [
    'unsplash.com',
    'images.unsplash.com',
    'pexels.com',
    'pixabay.com',
    'picsum.photos',
    'placehold.co',
    'placeholder.com',
  ]
  if (blockedHosts.some((host) => value.includes(host))) return false
  const blockedTokens = ['logo', 'sprite', 'icon', 'avatar', 'profile', 'favicon', 'blank.gif', 'spacer']
  if (/landscape|mountain|nature|hero|banner/.test(value)) return false
  return !blockedTokens.some((token) => value.includes(token))
}

function extractMetaImageUrls(html) {
  const matches = []
  const metaRegex = /<meta[^>]+(?:property|name|itemprop)=["'](?:og:image|og:image:url|twitter:image|twitter:image:src|image)["'][^>]*content=["']([^"']+)["'][^>]*>/gi
  let match = metaRegex.exec(html)
  while (match) {
    matches.push(match[1])
    match = metaRegex.exec(html)
  }
  return matches
}

function extractImgSrcUrls(html) {
  const matches = []
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let match = imgRegex.exec(html)
  while (match) {
    matches.push(match[1])
    match = imgRegex.exec(html)
  }
  return matches
}

function toAbsoluteUrl(baseUrl, maybeRelativeUrl) {
  const candidate = String(maybeRelativeUrl ?? '').trim()
  if (!candidate) return ''
  try {
    return new URL(candidate, baseUrl).toString()
  } catch {
    return ''
  }
}

async function fetchListingImageUrls(listingUrl) {
  const normalizedListingUrl = normalizeHttpUrl(listingUrl)
  if (!normalizedListingUrl) return []

  try {
    const response = await fetch(normalizedListingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GolfFlipTracker/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(6000),
    })

    const contentType = String(response.headers.get('content-type') ?? '').toLowerCase()
    if (!response.ok || !contentType.includes('text/html')) {
      return []
    }

    const html = await response.text()
    const extracted = [...extractMetaImageUrls(html), ...extractImgSrcUrls(html).slice(0, 24)]

    const absoluteUrls = extracted
      .map((value) => toAbsoluteUrl(normalizedListingUrl, value))
      .filter((value) => value && looksLikeAdImage(value))

    return dedupeUrls(absoluteUrls).slice(0, 6)
  } catch {
    return []
  }
}

async function hydrateLeadImageUrls(lead) {
  const existing = dedupeUrls(Array.isArray(lead?.image_urls) ? lead.image_urls : [])
  if (existing.length > 0) {
    return { ...lead, image_urls: existing }
  }

  const candidates = [lead?.source_url, lead?.seller_contact_optional]
  for (const candidate of candidates) {
    const discovered = await fetchListingImageUrls(candidate)
    if (discovered.length > 0) {
      return { ...lead, image_urls: discovered }
    }
  }

  return { ...lead, image_urls: [] }
}

function stripJsonFence(text) {
  return String(text || '').replace(/```json/g, '').replace(/```/g, '').trim()
}

function buildPgaValueGuideUrl(query) {
  const clean = encodeURIComponent(String(query || '').trim())
  return `https://www.google.com/search?q=${clean}+site%3Apga.com%2Fvalue-guide+OR+%22PGA+Value+Guide%22`
}

function buildEbayManualSoldSearchUrl(query) {
  const clean = encodeURIComponent(String(query || '').trim())
  return `https://www.ebay.com/sch/i.html?_nkw=${clean}&LH_Sold=1&LH_Complete=1`
}

function median(nums) {
  if (!nums.length) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2) return sorted[mid]
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
}

function avg(nums) {
  if (!nums.length) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
}

function estimateClubValue(query, comps) {
  const totals = comps
    .map((comp) => Number(comp.totalPrice || comp.soldPrice || 0))
    .filter((value) => Number.isFinite(value) && value > 0)

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
      'For bags/sets, break out premium clubs before pricing a bundle.',
    ],
    comps,
  }
}

async function getCompsFromApify(query) {
  const token = process.env.APIFY_TOKEN
  const actorId = process.env.APIFY_EBAY_SOLD_ACTOR_ID
  if (!token || !actorId) return []

  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, maxItems: 20, country: 'US', soldOnly: true }),
    },
  )

  if (!runResponse.ok) return []
  const run = await runResponse.json()
  const runId = run?.data?.id
  if (!runId) return []

  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1200))
    const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`)
    if (!statusResponse.ok) return []
    const status = await statusResponse.json()
    const state = status?.data?.status
    if (state === 'SUCCEEDED') break
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(state)) return []
  }

  const itemsResponse = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${token}`,
  )
  if (!itemsResponse.ok) return []
  const items = await itemsResponse.json()

  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const soldPrice = Number(item.soldPrice || item.price || item.currentPrice || item.finalPrice || 0) || 0
      const shippingPrice = Number(item.shippingPrice || item.shipping || 0) || 0
      return {
        title: item.title || 'eBay sold item',
        soldPrice,
        shippingPrice,
        totalPrice: soldPrice + shippingPrice,
        soldDate: item.soldDate || item.endedAt || item.dateSold || '',
        source: 'eBay',
        url: item.url || item.itemUrl || '',
      }
    })
    .filter((item) => item.totalPrice > 0)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'golf-flip-tracker-api' })
    return
  }

  if (url.pathname === '/api/bootstrap' && req.method === 'GET') {
    const db = await readDb()
    sendJson(res, 200, db)
    return
  }

  if (url.pathname === '/api/bootstrap' && req.method === 'PUT') {
    const body = await parseBody(req)
    await writeDb(body ?? emptyState)
    sendJson(res, 200, { ok: true })
    return
  }

  if (url.pathname === '/api/state' && req.method === 'GET') {
    const db = await readDb()
    sendJson(res, 200, db)
    return
  }

  if (url.pathname === '/api/state' && req.method === 'PUT') {
    const body = await parseBody(req)
    await writeDb(body ?? emptyState)
    sendJson(res, 200, { ok: true })
    return
  }

  if (url.pathname === '/api/club-ocr' && req.method === 'POST') {
    const body = await parseBody(req)
    const photoDataUrl = body?.photoDataUrl

    if (!photoDataUrl || typeof photoDataUrl !== 'string') {
      sendJson(res, 400, { error: 'Missing photoDataUrl' })
      return
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      sendJson(res, 200, {
        identification: {
          brand: 'Unknown',
          model: 'Unknown',
          clubType: 'Unknown',
          loft: '',
          shaftBrand: '',
          shaftFlex: '',
          handedness: 'Unknown',
          conditionGuess: 'Good',
          visibleNotes: ['Set OPENAI_API_KEY for automated image identification.'],
          confidence: 0,
          searchQuery: 'used golf club',
        },
        warning: 'OPENAI_API_KEY is not configured. Returned fallback identification.',
      })
      return
    }

    try {
      const openai = new OpenAI({ apiKey })
      const prompt = [
        'You identify used golf clubs from photos for resale.',
        'Return ONLY valid JSON.',
        'Find brand, model, clubType, loft, shaftBrand, shaftFlex, handedness, conditionGuess, visibleNotes, confidence, searchQuery.',
        'clubType should be one of Driver, Fairway Wood, Hybrid, Iron, Wedge, Putter, Bag, Set, Unknown.',
        'If a field is not visible, use empty string or Unknown.',
      ].join(' ')

      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: photoDataUrl } },
            ],
          },
        ],
        temperature: 0.1,
      })

      const raw = completion.choices?.[0]?.message?.content || '{}'
      const parsed = JSON.parse(stripJsonFence(raw))

      const identification = {
        brand: parsed.brand || 'Unknown',
        model: parsed.model || 'Unknown',
        clubType: parsed.clubType || 'Unknown',
        loft: parsed.loft || '',
        shaftBrand: parsed.shaftBrand || '',
        shaftFlex: parsed.shaftFlex || '',
        handedness: parsed.handedness || 'Unknown',
        conditionGuess: parsed.conditionGuess || 'Good',
        visibleNotes: Array.isArray(parsed.visibleNotes) ? parsed.visibleNotes : [],
        confidence: Number(parsed.confidence || 0),
        searchQuery:
          parsed.searchQuery ||
          [parsed.brand || 'Unknown', parsed.model || 'Unknown', parsed.clubType || 'golf club']
            .filter(Boolean)
            .join(' '),
      }

      sendJson(res, 200, { identification })
      return
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'OCR failed' })
      return
    }
  }

  if (url.pathname === '/api/club-comps' && req.method === 'GET') {
    const query = String(url.searchParams.get('q') || '').trim()
    if (!query) {
      sendJson(res, 400, { error: 'Missing q search query' })
      return
    }

    try {
      const provider = process.env.SOLD_COMPS_PROVIDER || 'manual'
      let comps = []
      if (provider === 'apify') {
        comps = await getCompsFromApify(query)
      }

      const estimate = estimateClubValue(query, comps)
      sendJson(res, 200, {
        estimate,
        links: {
          ebaySoldManualSearch: buildEbayManualSoldSearchUrl(query),
          pgaValueGuideSearch: buildPgaValueGuideUrl(query),
        },
        providerUsed: provider,
        warning:
          comps.length === 0
            ? 'No automated sold comps returned. Use eBay sold search and PGA Value Guide link to verify manually.'
            : '',
      })
      return
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Comp lookup failed' })
      return
    }
  }

  if (url.pathname === '/api/export-csv' && req.method === 'POST') {
    const body = await parseBody(req)
    const items = Array.isArray(body?.items) ? body.items : []

    const headers = Array.from(
      items.reduce((set, row) => {
        Object.keys(row).forEach((key) => set.add(key))
        return set
      }, new Set()),
    )

    const escape = (value) => {
      const text = value == null ? '' : String(value)
      return `"${text.replace(/"/g, '""')}"`
    }

    const csv = !items.length
      ? ''
      : [
          headers.map(escape).join(','),
          ...items.map((row) => headers.map((header) => escape(row[header])).join(',')),
        ].join('\n')

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="golf-club-inventory.csv"',
      'Access-Control-Allow-Origin': '*',
    })
    res.end(csv)
    return
  }

  if (url.pathname === '/api/fetch-deals-now' && req.method === 'POST') {
    const db = await readDb()
    const imported = await buildDealTemplates(db)
    const existingKeys = new Set((db.golf_leads ?? []).map((lead) => normalizeLeadKey(lead)))
    const existingLeadByKey = new Map((db.golf_leads ?? []).map((lead) => [normalizeLeadKey(lead), lead]))
    const uniqueImported = imported.filter((lead) => {
      const key = normalizeLeadKey(lead)
      if (existingKeys.has(key)) return false
      existingKeys.add(key)
      return true
    })

    const now = new Date().toISOString()
    for (const importedLead of imported) {
      const key = normalizeLeadKey(importedLead)
      const existingLead = existingLeadByKey.get(key)
      if (!existingLead) continue

      const currentImages = dedupeUrls(Array.isArray(existingLead.image_urls) ? existingLead.image_urls : [])
      const importedImages = dedupeUrls(Array.isArray(importedLead.image_urls) ? importedLead.image_urls : [])

      if (currentImages.length === 0 && importedImages.length > 0) {
        existingLead.image_urls = importedImages
        existingLead.updated_at = now
      }
    }
    const importedItems = uniqueImported.map((lead) => ({
      id: crypto.randomUUID(),
      lead_id: lead.id,
      item_type: lead.club_type_detected === 'iron_set' ? 'iron_set' : lead.club_type_detected,
      brand: lead.brand_detected,
      model: lead.model_detected,
      shaft: 'Unknown',
      flex: 'Unknown',
      condition_grade: 'Good',
      estimated_individual_resale_low: lead.estimated_resale_low,
      estimated_individual_resale_high: lead.estimated_resale_high,
      notes: 'Imported from on-demand public-source fetch.',
    }))
    const importedFollowups = uniqueImported.map((lead) => ({
      id: crypto.randomUUID(),
      lead_id: lead.id,
      followup_type: 'message_seller',
      due_date: new Date().toISOString().slice(0, 10),
      completed: false,
      notes: 'Follow up on on-demand fetch lead.',
      created_at: new Date().toISOString(),
    }))

    db.golf_leads = [...uniqueImported, ...(db.golf_leads ?? [])]
    db.golf_lead_items = [...importedItems, ...(db.golf_lead_items ?? [])]
    db.lead_followups = [...importedFollowups, ...(db.lead_followups ?? [])]

    await writeDb(db)
    sendJson(res, 200, { ok: true, imported: uniqueImported, items: importedItems, followups: importedFollowups })
    return
  }

  const collection = collectionPath(url.pathname)
  if (collection) {
    const db = await readDb()

    if (req.method === 'GET') {
      sendJson(res, 200, db[collection] ?? [])
      return
    }

    if (req.method === 'POST') {
      const body = await parseBody(req)
      let nextItem = { ...(body ?? {}), id: body?.id ?? crypto.randomUUID() }
      if (collection === 'golf_leads') {
        nextItem = await hydrateLeadImageUrls(nextItem)
      }
      db[collection] = [nextItem, ...(db[collection] ?? [])]
      await writeDb(db)
      sendJson(res, 201, nextItem)
      return
    }

    res.writeHead(405, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  const itemRoute = routeById(url.pathname)
  if (itemRoute) {
    const db = await readDb()
    const currentItems = db[itemRoute.collection] ?? []
    const currentIndex = currentItems.findIndex((item) => item.id === itemRoute.id)

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = await parseBody(req)
      if (currentIndex === -1) {
        sendJson(res, 404, { error: 'Not found' })
        return
      }
      const updated = { ...currentItems[currentIndex], ...(body ?? {}), id: itemRoute.id }
      currentItems[currentIndex] = updated
      db[itemRoute.collection] = currentItems
      await writeDb(db)
      sendJson(res, 200, updated)
      return
    }

    if (req.method === 'DELETE') {
      if (currentIndex === -1) {
        sendJson(res, 404, { error: 'Not found' })
        return
      }
      const removed = currentItems.splice(currentIndex, 1)[0]
      db[itemRoute.collection] = currentItems
      await writeDb(db)
      sendJson(res, 200, removed)
      return
    }
  }

  sendJson(res, 404, { error: 'Route not found' })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Golf Flip Tracker API listening on http://127.0.0.1:${port}`)
})
