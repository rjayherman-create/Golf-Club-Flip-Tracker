import http from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI from 'openai'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT) || 3001
const dbFile = path.join(__dirname, 'data', 'db.json')
const distDir = path.join(__dirname, 'dist')
const indexHtmlFile = path.join(distDir, 'index.html')

const mimeByExt = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
}

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
  sourcing_runtime: {},
  deals: [],
  deal_analyses: [],
}

function getDateKey(value = new Date()) {
  return value.toISOString().slice(0, 10)
}

function getSourcingRuntime(db) {
  const runtime = db.sourcing_runtime ?? {}
  if (!runtime.auto_fetch_runs_by_day || typeof runtime.auto_fetch_runs_by_day !== 'object') {
    runtime.auto_fetch_runs_by_day = {}
  }
  if (!runtime.auto_fetch_imports_by_day || typeof runtime.auto_fetch_imports_by_day !== 'object') {
    runtime.auto_fetch_imports_by_day = {}
  }
  db.sourcing_runtime = runtime
  return runtime
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

function isPathInside(parent, child) {
  const relative = path.relative(parent, child)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

async function serveFile(res, filePath) {
  try {
    const data = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const contentType = mimeByExt[ext] ?? 'application/octet-stream'
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    })
    res.end(data)
    return true
  } catch {
    return false
  }
}

async function serveFrontendRoute(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false

  const normalizedPath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname)
  const requestedPath = path.join(distDir, normalizedPath)

  if (isPathInside(distDir, requestedPath)) {
    const served = await serveFile(res, requestedPath)
    if (served) return true
  }

  const fallbackServed = await serveFile(res, indexHtmlFile)
  if (fallbackServed) return true

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('Frontend build not found. Run npm run build first.')
  return true
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

function rejectIfShippingDeal(lead) {
  if (lead?.shipping_required) {
    return 'Shipping deals are not allowed. Only local pickup or local delivery deals are supported.'
  }
  return ''
}

function lookupSource(db, sourceType) {
  const sources = db.sourcing_sources ?? []
  if (sourceType === 'facebook_manual') {
    return sources.find((source) => source.source_type === 'facebook_manual') ?? sources[0]
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

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, num) => String.fromCharCode(Number.parseInt(num, 10)))
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function extractTagText(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i')
  const match = regex.exec(xml)
  if (!match) return ''
  const value = match[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, '$1')
  return decodeHtmlEntities(value).trim()
}

function parseRssItems(xmlText) {
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  const items = []
  let match = itemRegex.exec(xmlText)

  while (match) {
    const itemXml = match[1]
    const title = extractTagText(itemXml, 'title')
    const link = extractTagText(itemXml, 'link')
    const descriptionHtml = extractTagText(itemXml, 'description')
    const pubDate = extractTagText(itemXml, 'dc:date') || extractTagText(itemXml, 'pubDate')

    if (title && link) {
      items.push({
        title,
        link,
        descriptionHtml,
        descriptionText: stripHtml(descriptionHtml),
        pubDate,
      })
    }

    match = itemRegex.exec(xmlText)
  }

  return items
}

function parseCraigslistPrice(...values) {
  for (const value of values) {
    const priceMatch = String(value ?? '').match(/\$(\d{2,5})\b/)
    if (!priceMatch) continue
    const parsed = Number(priceMatch[1])
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return 0
}

function parseCraigslistArea(title) {
  const areaMatch = String(title ?? '').match(/\(([^)]+)\)\s*$/)
  return areaMatch ? areaMatch[1].trim() : ''
}

function parseCityStateText(value) {
  const match = String(value ?? '').match(/([A-Za-z .'-]+,\s*(?:New York|NY))/i)
  return match ? match[1].trim() : ''
}

function extractFacebookTitleAndLocation(html) {
  const titleTagMatch = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const pageTitle = stripHtml(titleTagMatch?.[1] ?? '')
  if (!pageTitle) {
    return { listingTitle: '', locationText: '' }
  }

  const cleaned = pageTitle.replace(/\s+/g, ' ').trim()
  const normalized = cleaned.replace(/\s*\|\s*Facebook(?: Marketplace)?\s*\|\s*Facebook\s*$/i, '')
  const parts = normalized.split(' - ').map((part) => part.trim()).filter(Boolean)

  if (parts.length >= 3) {
    return {
      listingTitle: parts[0],
      locationText: parts[2],
    }
  }

  return { listingTitle: parts[0] ?? normalized, locationText: '' }
}

function inferClubType(text) {
  const value = String(text ?? '').toLowerCase()
  if (/iron\s*set|\birons\b|\b4-pw\b/.test(value)) return 'iron_set'
  if (/driver/.test(value)) return 'driver'
  if (/putter/.test(value)) return 'putter'
  if (/wedge/.test(value)) return 'wedge'
  if (/hybrid/.test(value)) return 'hybrid'
  if (/fairway|3 wood|5 wood|7 wood/.test(value)) return 'fairway_wood'
  if (/bag|stand bag|cart bag/.test(value)) return 'bag'
  if (/full set|golf set/.test(value)) return 'full_set'
  return 'unknown'
}

function inferBrand(text, settings) {
  const haystack = String(text ?? '').toLowerCase()
  const rankedBrands = Array.isArray(settings?.brand_priority) ? settings.brand_priority : []
  const defaults = ['Titleist', 'Callaway', 'TaylorMade', 'Ping', 'Mizuno', 'Cobra', 'Cleveland', 'Odyssey', 'Vokey']
  const brands = [...rankedBrands, ...defaults]

  for (const brand of brands) {
    if (!brand) continue
    if (haystack.includes(String(brand).toLowerCase())) return brand
  }

  return 'Unknown'
}

function inferModel(title, brand) {
  const base = String(title ?? '')
    .replace(/\s*\([^)]+\)\s*$/g, '')
    .replace(/^\$?\d+\s*/g, '')
  if (!base) return 'Unknown'

  const compact = brand && brand !== 'Unknown'
    ? base.replace(new RegExp(String(brand), 'i'), '').trim()
    : base.trim()

  return compact || base || 'Unknown'
}

function inferCounty(locationText) {
  const value = String(locationText ?? '').toLowerCase()
  if (/queens/.test(value)) return 'Queens'
  if (/brooklyn/.test(value)) return 'Kings'
  if (/bronx/.test(value)) return 'Bronx'
  if (/manhattan|new york/.test(value)) return 'New York'
  if (/staten island/.test(value)) return 'Richmond'
  if (/suffolk/.test(value)) return 'Suffolk'
  if (/nassau/.test(value) || /long island/.test(value)) return 'Nassau'
  return 'Nassau'
}

function inferDistanceAndDriveMinutes(county) {
  if (county === 'Queens' || county === 'Kings' || county === 'Nassau') return { distance_miles: 18, estimated_drive_minutes: 32 }
  if (county === 'Suffolk') return { distance_miles: 28, estimated_drive_minutes: 45 }
  return { distance_miles: 24, estimated_drive_minutes: 40 }
}

function normalizeCraigslistBaseUrl(baseUrl) {
  const normalized = normalizeHttpUrl(baseUrl)
  if (!normalized) return 'https://newyork.craigslist.org/'
  try {
    const url = new URL(normalized)
    return `${url.protocol}//${url.host}/`
  } catch {
    return 'https://newyork.craigslist.org/'
  }
}

function buildCraigslistRssUrls(source, settings, category = 'sss') {
  const baseRoot = normalizeCraigslistBaseUrl(source?.base_url)
  const keywords = Array.isArray(settings?.keyword_rules) && settings.keyword_rules.length
    ? settings.keyword_rules.slice(0, 4)
    : ['golf clubs', 'golf iron set', 'golf driver']

  return keywords.map((keyword) => {
    const search = new URL(`search/${category}`, baseRoot)
    search.searchParams.set('query', keyword)
    search.searchParams.set('sort', 'date')
    search.searchParams.set('format', 'rss')
    return search.toString()
  })
}

function buildEstateSaleSearchUrls(source, settings) {
  const root = normalizeHttpUrl(source?.base_url) || 'https://www.estatesales.net/'
  const normalizedRoot = root.endsWith('/') ? root : `${root}/`
  const keywords = Array.isArray(settings?.keyword_rules) && settings.keyword_rules.length
    ? settings.keyword_rules.slice(0, 3)
    : ['golf clubs', 'golf set']

  const urls = []
  for (const keyword of keywords) {
    const encoded = encodeURIComponent(keyword)
    urls.push(`${normalizedRoot}search?q=${encoded}`)
    urls.push(`${normalizedRoot}search?query=${encoded}`)
    urls.push(`${normalizedRoot}search?keyword=${encoded}`)
  }

  return Array.from(new Set(urls))
}

async function fetchCraigslistRssItems(urls) {
  const responses = await Promise.all(
    urls.map(async (rssUrl) => {
      try {
        const response = await fetch(rssUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; GolfFlipTracker/1.0)',
            Accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.1',
          },
          signal: AbortSignal.timeout(7000),
        })

        if (!response.ok) return []
        const xmlText = await response.text()
        return parseRssItems(xmlText)
      } catch {
        return []
      }
    }),
  )

  return responses.flat()
}

function parseEstateSaleItems(htmlText, pageUrl) {
  const anchors = []
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match = anchorRegex.exec(htmlText)

  while (match) {
    const href = toAbsoluteUrl(pageUrl, match[1])
    const text = stripHtml(match[2])
    if (!href || !text) {
      match = anchorRegex.exec(htmlText)
      continue
    }

    if (!/estatesales\.net/i.test(href)) {
      match = anchorRegex.exec(htmlText)
      continue
    }

    if (!/golf|club|driver|putter|wedge|iron|bag/i.test(text)) {
      match = anchorRegex.exec(htmlText)
      continue
    }

    anchors.push({ href, title: text })
    match = anchorRegex.exec(htmlText)
  }

  const deduped = []
  const seen = new Set()
  for (const item of anchors) {
    if (seen.has(item.href)) continue
    seen.add(item.href)
    deduped.push(item)
  }

  return deduped.slice(0, 20)
}

async function fetchEstateSaleItems(urls) {
  const responses = await Promise.all(
    urls.map(async (pageUrl) => {
      try {
        const response = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; GolfFlipTracker/1.0)',
            Accept: 'text/html,application/xhtml+xml',
          },
          signal: AbortSignal.timeout(7000),
        })

        if (!response.ok) return []
        const htmlText = await response.text()
        return parseEstateSaleItems(htmlText, pageUrl)
      } catch {
        return []
      }
    }),
  )

  return responses.flat()
}

async function buildDealTemplates(db) {
  const enabledSources = (db.sourcing_sources ?? []).filter((source) => source.enabled)
  const craigslistSources = enabledSources.filter((source) => source.source_type === 'craigslist')
  const garageSources = enabledSources.filter((source) => source.source_type === 'garage_sale')
  const estateSources = enabledSources.filter((source) => source.source_type === 'estate_sale')

  if (craigslistSources.length === 0 && garageSources.length === 0 && estateSources.length === 0) {
    return []
  }

  const settings = db.sourcing_settings ?? {}
  const now = new Date().toISOString()
  const rawDeals = []

  for (const source of craigslistSources) {
    const rssUrls = buildCraigslistRssUrls(source, settings, 'sss')
    const items = await fetchCraigslistRssItems(rssUrls)

    for (const item of items) {
      const price = parseCraigslistPrice(item.title, item.descriptionText)
      if (!price || price > 5000) continue

      const locationText = parseCraigslistArea(item.title) || 'Local pickup area'
      const county = inferCounty(locationText)
      const { distance_miles, estimated_drive_minutes } = inferDistanceAndDriveMinutes(county)
      const mergedText = `${item.title} ${item.descriptionText}`
      const brand = inferBrand(mergedText, settings)
      const model = inferModel(item.title, brand)
      const clubType = inferClubType(mergedText)
      const listingUrl = normalizeHttpUrl(item.link)
      if (!listingUrl) continue

      const imageCandidates = dedupeUrls(extractImgSrcUrls(item.descriptionHtml)).filter(looksLikeAdImage)

      rawDeals.push({
        id: crypto.randomUUID(),
        source_id: source.id ?? lookupSource(db, 'craigslist')?.id ?? '',
        source_type: 'craigslist',
        source_name: source.source_name ?? 'Craigslist - NYC Golf',
        source_url: listingUrl,
        title: item.title.replace(/\s*\([^)]+\)\s*$/, '').trim(),
        description: item.descriptionText || 'Real listing captured from Craigslist RSS feed.',
        asking_price: price,
        location_text: locationText,
        city: locationText,
        county,
        state: 'NY',
        distance_miles,
        estimated_drive_minutes,
        pickup_available: true,
        local_delivery_available: false,
        shipping_required: false,
        brand_detected: brand,
        model_detected: model,
        club_type_detected: clubType,
        status: 'new',
        seller_name_optional: '',
        seller_contact_optional: '',
        buyer_contact_optional: '',
        image_urls: imageCandidates,
        notes: 'Imported from live Craigslist RSS listing.',
        created_at: item.pubDate || now,
        updated_at: now,
        last_checked_at: now,
      })
    }
  }

  for (const source of garageSources) {
    const rssUrls = buildCraigslistRssUrls(source, settings, 'gms')
    const items = await fetchCraigslistRssItems(rssUrls)

    for (const item of items) {
      const price = parseCraigslistPrice(item.title, item.descriptionText)
      if (!price || price > 5000) continue

      const locationText = parseCraigslistArea(item.title) || 'Local pickup area'
      const county = inferCounty(locationText)
      const { distance_miles, estimated_drive_minutes } = inferDistanceAndDriveMinutes(county)
      const mergedText = `${item.title} ${item.descriptionText}`
      const brand = inferBrand(mergedText, settings)
      const model = inferModel(item.title, brand)
      const clubType = inferClubType(mergedText)
      const listingUrl = normalizeHttpUrl(item.link)
      if (!listingUrl) continue

      const imageCandidates = dedupeUrls(extractImgSrcUrls(item.descriptionHtml)).filter(looksLikeAdImage)

      rawDeals.push({
        id: crypto.randomUUID(),
        source_id: source.id ?? '',
        source_type: 'garage_sale',
        source_name: source.source_name ?? 'Garage Sale Scout',
        source_url: listingUrl,
        title: item.title.replace(/\s*\([^)]+\)\s*$/, '').trim(),
        description: item.descriptionText || 'Real listing captured from Craigslist garage-sale RSS feed.',
        asking_price: price,
        location_text: locationText,
        city: locationText,
        county,
        state: 'NY',
        distance_miles,
        estimated_drive_minutes,
        pickup_available: true,
        local_delivery_available: false,
        shipping_required: false,
        brand_detected: brand,
        model_detected: model,
        club_type_detected: clubType,
        status: 'new',
        seller_name_optional: '',
        seller_contact_optional: '',
        buyer_contact_optional: '',
        image_urls: imageCandidates,
        notes: 'Imported from live garage-sale feed.',
        created_at: item.pubDate || now,
        updated_at: now,
        last_checked_at: now,
      })
    }
  }

  for (const source of estateSources) {
    const pageUrls = buildEstateSaleSearchUrls(source, settings)
    const items = await fetchEstateSaleItems(pageUrls)

    for (const item of items) {
      const price = parseCraigslistPrice(item.title)
      const locationText = 'Estate sale listing'
      const county = 'Nassau'
      const { distance_miles, estimated_drive_minutes } = inferDistanceAndDriveMinutes(county)
      const mergedText = item.title
      const brand = inferBrand(mergedText, settings)
      const model = inferModel(item.title, brand)
      const clubType = inferClubType(mergedText)
      const listingUrl = normalizeHttpUrl(item.href)
      if (!listingUrl) continue

      rawDeals.push({
        id: crypto.randomUUID(),
        source_id: source.id ?? '',
        source_type: 'estate_sale',
        source_name: source.source_name ?? 'Estate Sale Roundup',
        source_url: listingUrl,
        title: item.title,
        description: 'Imported from live estate sale public listing.',
        asking_price: price,
        location_text: locationText,
        city: locationText,
        county,
        state: 'NY',
        distance_miles,
        estimated_drive_minutes,
        pickup_available: true,
        local_delivery_available: false,
        shipping_required: false,
        brand_detected: brand,
        model_detected: model,
        club_type_detected: clubType,
        status: 'new',
        seller_name_optional: '',
        seller_contact_optional: '',
        buyer_contact_optional: '',
        image_urls: [],
        notes: 'Imported from live estate sale feed.',
        created_at: now,
        updated_at: now,
        last_checked_at: now,
      })
    }
  }

  const dedupedByUrl = []
  const seenUrls = new Set()
  for (const lead of rawDeals) {
    if (seenUrls.has(lead.source_url)) continue
    seenUrls.add(lead.source_url)
    dedupedByUrl.push(lead)
  }

  const valued = dedupedByUrl
    .map((template) => ({
      ...template,
      ...estimatePublicDeal(template),
    }))
    .slice(0, 12)

  return Promise.all(valued.map((lead) => hydrateLeadImageUrls(lead)))
}

async function buildFacebookImportedLeads(db, urls, sourceId) {
  const source =
    (db.sourcing_sources ?? []).find(
      (item) => item.id === sourceId && item.source_type === 'facebook_manual',
    ) ??
    lookupSource(db, 'facebook_manual')

  const settings = db.sourcing_settings ?? {}
  const now = new Date().toISOString()
  const normalizedUrls = dedupeUrls(Array.isArray(urls) ? urls : []).filter((urlText) =>
    /facebook\.com\/(marketplace|share)/i.test(urlText),
  )

  const leads = []
  let unverifiedSkipped = 0

  for (const listingUrl of normalizedUrls.slice(0, 20)) {
    let title = 'Facebook Marketplace listing'
    let description = 'Imported from manually selected Facebook listing URL.'
    let imageUrls = []
    let hasFetchedMetadata = false
    let listingReachable = false

    try {
      const response = await fetch(listingUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GolfFlipTracker/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(7000),
      })

      if (response.ok) {
        listingReachable = true
        const html = await response.text()
        const ogTitle = extractMetaContent(html, 'og:title')
        const ogDescription = extractMetaContent(html, 'og:description')
        const parsedTitle = extractFacebookTitleAndLocation(html)
        title = stripHtml(ogTitle || parsedTitle.listingTitle || title)
        description = stripHtml(ogDescription || description)
        imageUrls = dedupeUrls([
          ...extractMetaImageUrls(html),
          ...extractImgSrcUrls(html).slice(0, 12),
        ]).filter(looksLikeAdImage)
        hasFetchedMetadata = Boolean(ogTitle || ogDescription || imageUrls.length)

        if (parsedTitle.locationText) {
          description = `${description} ${parsedTitle.locationText}`.trim()
        }
      }
    } catch {
      // Keep minimal listing data when fetch cannot read page metadata.
    }

    const askingPrice = parseCraigslistPrice(title, description)
    const locationText =
      parseCraigslistArea(title) ||
      parseCityStateText(title) ||
      parseCraigslistArea(description) ||
      parseCityStateText(description) ||
      'Local pickup area'
    const county = inferCounty(locationText)
    const { distance_miles, estimated_drive_minutes } = inferDistanceAndDriveMinutes(county)
    const mergedText = `${title} ${description}`
    const brand = inferBrand(mergedText, settings)
    const model = inferModel(title, brand)
    const clubType = inferClubType(mergedText)

    const hasMeaningfulTitle = title !== 'Facebook Marketplace listing'
    const hasMeaningfulDescription = description !== 'Imported from manually selected Facebook listing URL.'
    const hasMeaningfulListingData = hasMeaningfulTitle || hasMeaningfulDescription || imageUrls.length > 0
    const hasGolfSignal =
      /golf|driver|putter|wedge|iron|hybrid|fairway|club|bag|set/i.test(mergedText) ||
      brand !== 'Unknown' ||
      clubType !== 'unknown' ||
      askingPrice > 0
    const facebookItemIdMatch = String(listingUrl).match(/facebook\.com\/marketplace\/item\/(\d+)/i)
    const isValidFacebookItemUrl = Boolean(facebookItemIdMatch)

    if (!isValidFacebookItemUrl || !listingReachable) {
      unverifiedSkipped += 1
      continue
    }

    // Facebook often blocks metadata for non-authenticated fetches; keep valid item URLs instead of skipping.
    if ((!hasFetchedMetadata || !hasMeaningfulListingData || !hasGolfSignal) && isValidFacebookItemUrl) {
      const itemId = facebookItemIdMatch?.[1] ?? 'unknown'
      title = `Facebook listing #${itemId}`
      description = `Imported from valid Facebook item URL. Metadata fetch was limited; open listing to confirm details.`
    }

    const template = {
      id: crypto.randomUUID(),
      source_id: source?.id ?? '',
      source_type: 'facebook_manual',
      source_name: source?.source_name ?? 'Facebook Marketplace - Manual',
      source_url: listingUrl,
      title,
      description,
      asking_price: askingPrice,
      location_text: locationText,
      city: locationText,
      county,
      state: 'NY',
      distance_miles,
      estimated_drive_minutes,
      pickup_available: true,
      local_delivery_available: true,
      shipping_required: false,
      brand_detected: brand,
      model_detected: model,
      club_type_detected: clubType,
      status: 'new',
      seller_name_optional: '',
      seller_contact_optional: '',
      buyer_contact_optional: '',
      image_urls: imageUrls,
      notes: 'Imported from selected Facebook listing URL.',
      created_at: now,
      updated_at: now,
      last_checked_at: now,
    }

    const lead = {
      ...template,
      ...estimatePublicDeal(template),
    }

    leads.push(await hydrateLeadImageUrls(lead))
  }

  return {
    leads,
    summary: {
      requested: normalizedUrls.slice(0, 20).length,
      unverifiedSkipped,
    },
  }
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
  const metaRegex = /<meta[^>]+(?:property|name|itemprop)=["'](?:og:image|og:image:url|og:image:secure_url|twitter:image|twitter:image:src|image)["'][^>]*content=["']([^"']+)["'][^>]*>/gi
  let match = metaRegex.exec(html)
  while (match) {
    matches.push(decodeHtmlEntities(match[1]))
    match = metaRegex.exec(html)
  }
  return matches
}

function extractMetaContent(html, metaKey) {
  const escaped = String(metaKey).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(
    `<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    'i',
  )
  const match = regex.exec(String(html ?? ''))
  return match ? decodeHtmlEntities(match[1]).trim() : ''
}

function extractImgSrcUrls(html) {
  const matches = []
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let match = imgRegex.exec(html)
  while (match) {
    matches.push(decodeHtmlEntities(match[1]))
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
    const body = (await parseBody(req)) ?? {}
    const mode = body?.mode === 'auto' ? 'auto' : 'manual'
    const settings = db.sourcing_settings ?? {}
    const dailyAutoLimit = Number(settings.auto_fetch_runs_per_day ?? 2)
    const allowHighFrequencyAuto = Boolean(settings.allow_high_frequency_auto)
    const todayKey = getDateKey()
    const runtime = getSourcingRuntime(db)
    const currentAutoRuns = Number(runtime.auto_fetch_runs_by_day[todayKey] ?? 0)

    if (mode === 'auto' && !allowHighFrequencyAuto && currentAutoRuns >= dailyAutoLimit) {
      sendJson(res, 429, {
        ok: false,
        error: `Daily auto-fetch limit reached (${dailyAutoLimit}). Manual scans remain available.`,
        policy: {
          mode,
          dailyAutoLimit,
          currentAutoRuns,
          allowHighFrequencyAuto,
        },
      })
      return
    }

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

    if (mode === 'auto') {
      runtime.auto_fetch_runs_by_day[todayKey] = currentAutoRuns + 1
      runtime.auto_fetch_imports_by_day[todayKey] =
        Number(runtime.auto_fetch_imports_by_day[todayKey] ?? 0) + uniqueImported.length
      runtime.last_auto_fetch_at = new Date().toISOString()
    } else {
      runtime.last_manual_fetch_at = new Date().toISOString()
    }

    await writeDb(db)
    sendJson(res, 200, {
      ok: true,
      mode,
      imported: uniqueImported,
      items: importedItems,
      followups: importedFollowups,
      policy: {
        dailyAutoLimit,
        currentAutoRuns: mode === 'auto' ? currentAutoRuns + 1 : currentAutoRuns,
        allowHighFrequencyAuto,
      },
    })
    return
  }

  if (url.pathname === '/api/import-facebook-listings' && req.method === 'POST') {
    const db = await readDb()
    const body = await parseBody(req)
    const urls = Array.isArray(body?.urls) ? body.urls : []
    const sourceId = typeof body?.sourceId === 'string' ? body.sourceId : ''

    if (urls.length === 0) {
      sendJson(res, 400, { error: 'No listing URLs provided' })
      return
    }

    const importResult = await buildFacebookImportedLeads(db, urls, sourceId)
    const imported = importResult.leads
    const existingKeys = new Set((db.golf_leads ?? []).map((lead) => normalizeLeadKey(lead)))
    const uniqueImported = imported.filter((lead) => {
      const key = normalizeLeadKey(lead)
      if (existingKeys.has(key)) return false
      existingKeys.add(key)
      return true
    })

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
      notes: 'Imported from selected Facebook listing URL.',
    }))

    const importedFollowups = uniqueImported.map((lead) => ({
      id: crypto.randomUUID(),
      lead_id: lead.id,
      followup_type: 'message_seller',
      due_date: new Date().toISOString().slice(0, 10),
      completed: false,
      notes: 'Review imported Facebook listing and send first message.',
      created_at: new Date().toISOString(),
    }))

    db.golf_leads = [...uniqueImported, ...(db.golf_leads ?? [])]
    db.golf_lead_items = [...importedItems, ...(db.golf_lead_items ?? [])]
    db.lead_followups = [...importedFollowups, ...(db.lead_followups ?? [])]

    await writeDb(db)
    const duplicateSkipped = Math.max(0, imported.length - uniqueImported.length)
    const unverifiedSkipped = Number(importResult.summary?.unverifiedSkipped ?? 0)
    const requested = Number(importResult.summary?.requested ?? urls.length)
    const skipped = Math.max(0, requested - uniqueImported.length)

    sendJson(res, 200, {
      ok: true,
      imported: uniqueImported,
      items: importedItems,
      followups: importedFollowups,
      skipped,
      summary: {
        requested,
        imported: uniqueImported.length,
        skipped,
        duplicateSkipped,
        unverifiedSkipped,
        onlyRealData: true,
      },
    })
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
      if (collection === 'golf_leads') {
        const shippingError = rejectIfShippingDeal(body)
        if (shippingError) {
          sendJson(res, 400, { error: shippingError })
          return
        }
      }
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
      if (itemRoute.collection === 'golf_leads') {
        const shippingError = rejectIfShippingDeal({ ...currentItems[currentIndex], ...(body ?? {}) })
        if (shippingError) {
          sendJson(res, 400, { error: shippingError })
          return
        }
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

  const servedFrontend = await serveFrontendRoute(req, res, url.pathname)
  if (servedFrontend) return

  sendJson(res, 404, { error: 'Route not found' })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Golf Flip Tracker fullstack server listening on http://0.0.0.0:${port}`)
})
