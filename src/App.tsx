import { useEffect, useMemo, useState } from 'react'
import { AuditChecklist } from './components/AuditChecklist'
import { CsvExport } from './components/CsvExport'
import { Dashboard } from './components/Dashboard'
import { ClubFlipFeaturePanel } from './components/ClubFlipFeaturePanel'
import { Inventory } from './components/Inventory'
import { Layout } from './components/Layout'
import { LeadAnalyzer } from './components/LeadAnalyzer'
import { LeadForm } from './components/LeadForm'
import { ListingGenerator } from './components/ListingGenerator'
import { LocalSourcingRadar } from './components/LocalSourcingRadar'
import { SalesTracker } from './components/SalesTracker'
import { Settings } from './components/Settings'
import { Sources } from './components/Sources'
import { PrivacyPolicy } from './components/PrivacyPolicy'
import { TermsOfService } from './components/TermsOfService'
import { ValueGuide } from './components/ValueGuide'
import {
  defaultSettings,
  sampleInventory,
  sampleLeads,
  sampleSales,
  sampleSources,
} from './data/sampleData'
import {
  golfLeadItemSeeds,
  golfLeadRadarSeeds,
  leadFollowupSeeds,
  sourcingLocationSeeds,
  sourcingRadarSeedSettings,
  sourcingSourceSeeds,
} from './data/sourcingSeed'
import type {
  AppSettings,
  GolfLeadItem,
  GolfLeadRadar,
  InventoryItem,
  Lead,
  LeadFollowup,
  PageKey,
  Sale,
  Source,
  SourcingLocation,
  SourcingRadarSettings,
  SourcingRadarView,
  SourcingSource,
} from './types'
import { calculateDashboardStats, calculateValuation } from './utils/valuation'

type AppRoute = {
  page: PageKey
  sourcingView?: SourcingRadarView
  leadId?: string
}

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function getRouteFromPath(pathname: string): AppRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/'

  if (normalized === '/sourcing') return { page: 'sourcing-radar', sourcingView: 'dashboard' }
  if (normalized === '/source-deals') return { page: 'sourcing-radar', sourcingView: 'dashboard' }
  if (normalized === '/source-deals/add-facebook') return { page: 'sourcing-radar', sourcingView: 'add-facebook' }
  if (normalized === '/source-deals/craigslist') return { page: 'sourcing-radar', sourcingView: 'craigslist' }
  if (normalized === '/source-deals/settings') return { page: 'sourcing-radar', sourcingView: 'settings' }
  if (normalized === '/sourcing/add-facebook') return { page: 'sourcing-radar', sourcingView: 'add-facebook' }
  if (normalized === '/sourcing/craigslist') return { page: 'sourcing-radar', sourcingView: 'craigslist' }
  if (normalized === '/sourcing/settings') return { page: 'sourcing-radar', sourcingView: 'settings' }

  const leadMatch = normalized.match(/^\/sourcing\/lead\/([^/]+)$/)
  if (leadMatch) return { page: 'sourcing-radar', sourcingView: 'lead', leadId: leadMatch[1] }
  const sourceDealsLeadMatch = normalized.match(/^\/source-deals\/lead\/([^/]+)$/)
  if (sourceDealsLeadMatch) return { page: 'sourcing-radar', sourcingView: 'lead', leadId: sourceDealsLeadMatch[1] }

  const map: Record<string, PageKey> = {
    '/': 'dashboard',
    '/terms': 'terms',
    '/privacy': 'privacy',
    '/add-club': 'lead-form',
    '/identify-from-photo': 'club-flip',
    '/value-checker': 'lead-analyzer',
    '/inventory': 'inventory',
    '/listings': 'listings',
    '/sold-profit': 'sales',
    '/csv-export': 'csv-export',
    '/audit': 'audit',
    '/club-flip': 'club-flip',
    '/lead-form': 'lead-form',
    '/lead-analyzer': 'lead-analyzer',
    '/sales': 'sales',
    '/sources': 'sources',
    '/value-guide': 'value-guide',
    '/settings': 'settings',
  }

  return { page: map[normalized] ?? 'dashboard', sourcingView: 'dashboard' }
}

function getPathFromRoute(route: AppRoute): string {
  if (route.page === 'sourcing-radar') {
    switch (route.sourcingView) {
      case 'add-facebook':
        return '/source-deals/add-facebook'
      case 'craigslist':
        return '/source-deals/craigslist'
      case 'lead':
        return route.leadId ? `/sourcing/lead/${route.leadId}` : '/source-deals'
      case 'settings':
        return '/source-deals/settings'
      default:
        return '/source-deals'
    }
  }

  const map: Partial<Record<PageKey, string>> = {
    dashboard: '/',
    terms: '/terms',
    privacy: '/privacy',
    'club-flip': '/identify-from-photo',
    'lead-form': '/add-club',
    'lead-analyzer': '/value-checker',
    inventory: '/inventory',
    listings: '/listings',
    sales: '/sold-profit',
    'csv-export': '/csv-export',
    audit: '/audit',
    sources: '/sources',
    'value-guide': '/value-guide',
    settings: '/settings',
  }

  return map[route.page] ?? '/'
}

function leadIdentityKey(lead: GolfLeadRadar): string {
  const sourceUrl = lead.source_url.trim().toLowerCase()
  if (sourceUrl) return `url:${sourceUrl}`
  return `meta:${lead.title.trim().toLowerCase()}|${lead.location_text.trim().toLowerCase()}|${lead.asking_price}`
}

function dedupeRadarLeads(leads: GolfLeadRadar[]): GolfLeadRadar[] {
  const seen = new Set<string>()
  const deduped: GolfLeadRadar[] = []

  for (const lead of leads) {
    const key = leadIdentityKey(lead)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(lead)
  }

  return deduped
}

function enforcePremiumTheme(settings: AppSettings): AppSettings {
  return {
    ...settings,
    themePreference: 'premium-navy-amber',
  }
}

function App() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromPath(window.location.pathname))
  const [leads, setLeads] = useState<Lead[]>(() => loadLocal('gft.leads', sampleLeads))
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadLocal('gft.inventory', sampleInventory))
  const [sales, setSales] = useState<Sale[]>(() => loadLocal('gft.sales', sampleSales))
  const [sources, setSources] = useState<Source[]>(() => loadLocal('gft.sources', sampleSources))
  const [settings, setSettings] = useState<AppSettings>(() =>
    enforcePremiumTheme({
      ...defaultSettings,
      ...loadLocal<Partial<AppSettings>>('gft.settings', defaultSettings),
    }),
  )

  const [sourcingSources, setSourcingSources] = useState<SourcingSource[]>(() =>
    loadLocal('gft.sourcing.sources', sourcingSourceSeeds),
  )
  const [sourcingLocations, setSourcingLocations] = useState<SourcingLocation[]>(() =>
    loadLocal('gft.sourcing.locations', sourcingLocationSeeds),
  )
  const [golfLeads, setGolfLeads] = useState<GolfLeadRadar[]>(() =>
    loadLocal('gft.sourcing.leads', golfLeadRadarSeeds),
  )
  const [golfLeadItems, setGolfLeadItems] = useState<GolfLeadItem[]>(() =>
    loadLocal('gft.sourcing.leadItems', golfLeadItemSeeds),
  )
  const [leadFollowups, setLeadFollowups] = useState<LeadFollowup[]>(() =>
    loadLocal('gft.sourcing.followups', leadFollowupSeeds),
  )
  const [sourcingSettings, setSourcingSettings] = useState<SourcingRadarSettings>(() =>
    loadLocal('gft.sourcing.settings', sourcingRadarSeedSettings),
  )
  const [fetchingDeals, setFetchingDeals] = useState(false)
  const [apiReady, setApiReady] = useState(false)

  const apiBase = 'http://127.0.0.1:3001'

  useEffect(() => localStorage.setItem('gft.leads', JSON.stringify(leads)), [leads])
  useEffect(() => localStorage.setItem('gft.inventory', JSON.stringify(inventory)), [inventory])
  useEffect(() => localStorage.setItem('gft.sales', JSON.stringify(sales)), [sales])
  useEffect(() => localStorage.setItem('gft.sources', JSON.stringify(sources)), [sources])
  useEffect(() => localStorage.setItem('gft.settings', JSON.stringify(settings)), [settings])
  useEffect(() => localStorage.setItem('gft.sourcing.sources', JSON.stringify(sourcingSources)), [sourcingSources])
  useEffect(() => localStorage.setItem('gft.sourcing.locations', JSON.stringify(sourcingLocations)), [sourcingLocations])
  useEffect(() => localStorage.setItem('gft.sourcing.leads', JSON.stringify(golfLeads)), [golfLeads])
  useEffect(() => localStorage.setItem('gft.sourcing.leadItems', JSON.stringify(golfLeadItems)), [golfLeadItems])
  useEffect(() => localStorage.setItem('gft.sourcing.followups', JSON.stringify(leadFollowups)), [leadFollowups])
  useEffect(() => localStorage.setItem('gft.sourcing.settings', JSON.stringify(sourcingSettings)), [sourcingSettings])

  useEffect(() => {
    document.documentElement.dataset.theme = 'premium-navy-amber'
  }, [])

  useEffect(() => {
    const onPopState = () => setRoute(getRouteFromPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadFromApi() {
      try {
        const response = await fetch(`${apiBase}/api/bootstrap`)
        if (!response.ok) return

        const remote = (await response.json()) as Partial<{
          leads: Lead[]
          inventory: InventoryItem[]
          sales: Sale[]
          sources: Source[]
          settings: AppSettings
          sourcing_sources: SourcingSource[]
          sourcing_locations: SourcingLocation[]
          golf_leads: GolfLeadRadar[]
          golf_lead_items: GolfLeadItem[]
          lead_followups: LeadFollowup[]
          sourcing_settings: SourcingRadarSettings
        }>

        if (cancelled) return

        if (remote.leads) setLeads(remote.leads)
        if (remote.inventory) setInventory(remote.inventory)
        if (remote.sales) setSales(remote.sales)
        if (remote.sources) setSources(remote.sources)
        if (remote.settings) {
          setSettings((prev) => ({
            ...defaultSettings,
            ...prev,
            ...remote.settings,
            themePreference: 'premium-navy-amber',
          }))
        }
        if (remote.sourcing_sources) setSourcingSources(remote.sourcing_sources)
        if (remote.sourcing_locations) setSourcingLocations(remote.sourcing_locations)
        if (remote.golf_leads) setGolfLeads(remote.golf_leads)
        if (remote.golf_lead_items) setGolfLeadItems(remote.golf_lead_items)
        if (remote.lead_followups) setLeadFollowups(remote.lead_followups)
        if (remote.sourcing_settings) setSourcingSettings(remote.sourcing_settings)
      } catch {
        // Keep localStorage/sample data if the API is unavailable.
      } finally {
        if (!cancelled) setApiReady(true)
      }
    }

    void loadFromApi()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!apiReady) return

    const payload = {
      leads,
      inventory,
      sales,
      sources,
      settings,
      sourcing_sources: sourcingSources,
      sourcing_locations: sourcingLocations,
      golf_leads: golfLeads,
      golf_lead_items: golfLeadItems,
      lead_followups: leadFollowups,
      sourcing_settings: sourcingSettings,
    }

    void fetch(`${apiBase}/api/bootstrap`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Preserve localStorage persistence if the API cannot be reached.
    })
  }, [
    apiReady,
    leads,
    inventory,
    sales,
    sources,
    settings,
    sourcingSources,
    sourcingLocations,
    golfLeads,
    golfLeadItems,
    leadFollowups,
    sourcingSettings,
  ])

  const stats = useMemo(() => calculateDashboardStats(leads, inventory, sales), [leads, inventory, sales])
  const sourcingSummary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return {
      totalLeads: golfLeads.length,
      strongBuys: golfLeads.filter((lead) => lead.deal_label === 'Strong Buy').length,
      manualFacebookLeads: golfLeads.filter((lead) => lead.source_name.toLowerCase().includes('facebook')).length,
      radarLeads: golfLeads.filter((lead) => !lead.source_name.toLowerCase().includes('facebook')).length,
      followupsDueToday: leadFollowups.filter((followup) => followup.due_date === today && !followup.completed).length,
    }
  }, [golfLeads, leadFollowups])

  const pageTitle: Record<PageKey, string> = {
    dashboard: 'Dashboard',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    'analyze-loader': 'Analyze Deal Loader',
    'saved-analyses': 'Saved Analyses',
    'club-flip': 'Identify From Photo',
    'lead-form': 'Add Club',
    'lead-analyzer': 'Value Checker',
    inventory: 'Inventory',
    listings: 'Listings',
    sales: 'Sold / Profit',
    'csv-export': 'CSV Export',
    sources: 'Source Map / Source List',
    'value-guide': 'Brand Value Guide',
    settings: 'Settings',
    audit: 'Developer Audit',
    'sourcing-radar':
      route.sourcingView === 'add-facebook'
        ? 'Source Deals'
        : route.sourcingView === 'craigslist'
          ? 'Source Deals'
          : route.sourcingView === 'lead'
            ? 'Source Deal Detail'
            : route.sourcingView === 'settings'
              ? 'Sourcing Settings'
              : 'Source Deals',
    'sourcing-add-facebook': 'Manual Facebook Import',
    'sourcing-craigslist': 'Craigslist Monitor',
    'sourcing-lead': 'Lead Detail',
    'sourcing-settings': 'Sourcing Settings',
  }

  const pageDescription: Record<PageKey, string> = {
    dashboard: 'Review pipeline health, inventory value, and next actions for your daily sourcing workflow.',
    terms: 'Read the rules, limitations, and responsibilities for using this application.',
    privacy: 'Understand what data is stored, how it is used, and your control over it.',
    'analyze-loader': 'Load one new deal at a time, analyze it, and save, reject, or watchlist with confidence.',
    'saved-analyses': 'Review previously analyzed deals with filters for grade, source, and profitability.',
    'club-flip': 'Upload photos to identify club details before valuing and listing.',
    'lead-form': 'Capture complete club and purchase details in a consistent, resale-ready format.',
    'lead-analyzer': 'Evaluate comps, value range, and buy thresholds before committing cash.',
    inventory: 'Track every club from purchase to listing to sold with clear status and margin visibility.',
    listings: 'Generate practical marketplace copy and mark items listed without overpromising condition.',
    sales: 'Track sold outcomes, fees, and net profit to improve future buying decisions.',
    'csv-export': 'Export inventory and profitability reports for bookkeeping and performance review.',
    sources: 'Manage local sourcing channels and monitor which pipelines produce quality deals.',
    'value-guide': 'Reference brand and condition guidance to support consistent pricing decisions.',
    settings: 'Set profile, defaults, and backup preferences for a consistent team workflow.',
    audit: 'Verify route-by-route completeness, mobile behavior, and production readiness.',
    'sourcing-radar':
      route.sourcingView === 'add-facebook'
        ? 'Add marketplace leads manually with compliant data capture and photo transparency.'
        : route.sourcingView === 'craigslist'
          ? 'Scan enabled public sources and prioritize leads with the best local margin potential.'
          : route.sourcingView === 'lead'
            ? 'Review deal photos, risk, outreach, and next actions in one place.'
            : route.sourcingView === 'settings'
              ? 'Configure sourcing radius, score thresholds, and source enablement rules.'
              : 'Find and triage local golf deals quickly using margin-first sourcing filters.',
    'sourcing-add-facebook': 'Add marketplace leads manually with compliant data capture and photo transparency.',
    'sourcing-craigslist': 'Scan enabled public sources and prioritize leads with the best local margin potential.',
    'sourcing-lead': 'Review deal photos, risk, outreach, and next actions in one place.',
    'sourcing-settings': 'Configure sourcing radius, score thresholds, and source enablement rules.',
  }

  function navigateRoute(nextRoute: AppRoute) {
    const nextPath = getPathFromRoute(nextRoute)
    window.history.pushState({}, '', nextPath)
    setRoute(nextRoute)
  }

  function navigatePage(page: PageKey) {
    if (page === 'sourcing-radar') {
      navigateRoute({ page: 'sourcing-radar', sourcingView: 'dashboard' })
      return
    }
    navigateRoute({ page })
  }

  function addLead(lead: Lead, nextPage: PageKey = 'lead-analyzer') {
    const valued = calculateValuation(lead)
    setLeads((prev) => [valued, ...prev])
    if (nextPage === 'inventory') {
      moveLeadToInventory(valued)
      return
    }
    navigatePage(nextPage)
  }

  function updateLead(updatedLead: Lead) {
    setLeads((prev) => prev.map((lead) => (lead.id === updatedLead.id ? calculateValuation(updatedLead) : lead)))
  }

  function moveLeadToInventory(lead: Lead) {
    const exists = inventory.some((item) => item.leadId === lead.id)
    if (exists) return

    const created: InventoryItem = {
      id: crypto.randomUUID(),
      leadId: lead.id,
      purchaseDate: new Date().toISOString().slice(0, 10),
      source: lead.sourceType,
      town: lead.town,
      itemName: `${lead.brand} ${lead.model} ${lead.itemType}`.trim(),
      brand: lead.brand,
      model: lead.model,
      clubType: lead.itemType,
      loft: lead.loft,
      shaftFlex: lead.shaftFlex,
      hand: lead.hand,
      condition: lead.condition,
      gripCondition: lead.gripCondition,
      purchasePrice: lead.askingPrice,
      allocatedCost: lead.askingPrice,
      cleaningCost: lead.cleaningCost,
      repairCost: lead.gripCost,
      totalCost: lead.askingPrice + lead.cleaningCost + lead.gripCost + lead.travelCost,
      estimatedResale: lead.conservativeResale,
      targetListPrice: lead.conservativeResale,
      lowestAcceptablePrice: lead.fastSalePrice,
      status: 'Needs Cleaning',
      storageLocation: '',
      notes: lead.notes,
      cleaned: false,
      photographed: false,
    }

    setInventory((prev) => [created, ...prev])
    navigatePage('inventory')
  }

  function updateInventory(item: InventoryItem) {
    setInventory((prev) => prev.map((record) => (record.id === item.id ? item : record)))
  }

  function createFromBundle(items: InventoryItem[]) {
    setInventory((prev) => [...items, ...prev])
  }

  function addSale(sale: Sale) {
    setSales((prev) => [sale, ...prev])
    setInventory((prev) =>
      prev.map((item) => (item.id === sale.inventoryItemId ? { ...item, status: 'Sold' } : item)),
    )
  }

  function addSource(source: Source) {
    setSources((prev) => [source, ...prev])
  }

  function saveRadarLead(lead: GolfLeadRadar, items: GolfLeadItem[] = [], followups: LeadFollowup[] = []) {
    setGolfLeads((prev) => [lead, ...prev.filter((item) => item.id !== lead.id)])
    if (items.length) {
      setGolfLeadItems((prev) => [...items, ...prev.filter((item) => item.lead_id !== lead.id)])
    }
    if (followups.length) {
      setLeadFollowups((prev) => [...followups, ...prev.filter((item) => item.lead_id !== lead.id)])
    }
  }

  function updateRadarLead(lead: GolfLeadRadar) {
    setGolfLeads((prev) => prev.map((item) => (item.id === lead.id ? lead : item)))
  }

  function deleteRadarLead(leadId: string) {
    setGolfLeads((prev) => prev.filter((item) => item.id !== leadId))
    setGolfLeadItems((prev) => prev.filter((item) => item.lead_id !== leadId))
    setLeadFollowups((prev) => prev.filter((item) => item.lead_id !== leadId))
  }

  function toggleRadarSource(sourceId: string, enabled: boolean) {
    setSourcingSources((prev) =>
      prev.map((source) =>
        source.id === sourceId ? { ...source, enabled, updated_at: new Date().toISOString() } : source,
      ),
    )
  }

  function addRadarFollowup(followup: LeadFollowup) {
    setLeadFollowups((prev) => [followup, ...prev])
  }

  function updateRadarSettings(nextSettings: SourcingRadarSettings) {
    setSourcingSettings(nextSettings)
  }

  async function fetchDealsNow(): Promise<GolfLeadRadar[]> {
    if (fetchingDeals) return []
    setFetchingDeals(true)

    try {
      const response = await fetch(`${apiBase}/api/fetch-deals-now`, { method: 'POST' })
      if (!response.ok) {
        throw new Error('Unable to fetch deals now')
      }

      const result = (await response.json()) as Partial<{
        imported: GolfLeadRadar[]
        items: GolfLeadItem[]
        followups: LeadFollowup[]
      }>

      if (result.imported?.length) {
        setGolfLeads((prev) => dedupeRadarLeads([...result.imported!, ...prev]))
      }

      if (result.items?.length) {
        setGolfLeadItems((prev) => [
          ...result.items!.filter((item) => !prev.some((existing) => existing.id === item.id)),
          ...prev,
        ])
      }

      if (result.followups?.length) {
        setLeadFollowups((prev) => [
          ...result.followups!.filter((item) => !prev.some((existing) => existing.id === item.id)),
          ...prev,
        ])
      }

      return result.imported ?? []
    } catch {
      return []
    } finally {
      setFetchingDeals(false)
    }
  }

  function renderPage() {
    switch (route.page) {
      case 'dashboard':
        return (
          <Dashboard
            stats={stats}
            settings={settings}
            sourcingSummary={sourcingSummary}
            onAddLead={() => navigatePage('lead-form')}
            onOpenSourcing={() => navigatePage('sourcing-radar')}
            onOpenIdentify={() => navigatePage('club-flip')}
            onOpenListings={() => navigatePage('listings')}
            onOpenCsvExport={() => navigatePage('csv-export')}
            onOpenValueGuide={() => navigatePage('lead-analyzer')}
            onQuickSaveLead={addLead}
            onFetchDeals={fetchDealsNow}
            fetchingDeals={fetchingDeals}
          />
        )
      case 'lead-form':
        return <LeadForm onSave={addLead} settings={settings} />
      case 'club-flip':
        return <ClubFlipFeaturePanel onConfirmToValue={() => navigatePage('lead-analyzer')} />
      case 'lead-analyzer':
        return (
          <LeadAnalyzer leads={leads} onUpdateLead={updateLead} onMoveToInventory={moveLeadToInventory} />
        )
      case 'inventory':
        return <Inventory inventory={inventory} onUpdateInventory={updateInventory} onCreateFromBundle={createFromBundle} />
      case 'listings':
        return <ListingGenerator inventory={inventory} onUpdateInventory={updateInventory} />
      case 'sales':
        return <SalesTracker sales={sales} inventory={inventory} onAddSale={addSale} />
      case 'csv-export':
        return <CsvExport inventory={inventory} sales={sales} />
      case 'audit':
        return <AuditChecklist />
      case 'sources':
        return <Sources sources={sources} onAddSource={addSource} />
      case 'value-guide':
        return <ValueGuide />
      case 'settings':
        return <Settings settings={settings} onSave={(next) => setSettings(enforcePremiumTheme(next))} />
      case 'terms':
        return (
          <TermsOfService
            legalLastUpdated={settings.legalLastUpdated}
            legalContactEmail={settings.legalContactEmail}
          />
        )
      case 'privacy':
        return (
          <PrivacyPolicy
            legalLastUpdated={settings.legalLastUpdated}
            legalContactEmail={settings.legalContactEmail}
          />
        )
      case 'sourcing-radar':
        return (
          <LocalSourcingRadar
            view={route.sourcingView ?? 'dashboard'}
            leadId={route.leadId}
            leads={golfLeads}
            leadItems={golfLeadItems}
            followups={leadFollowups}
            sources={sourcingSources}
            locations={sourcingLocations}
            settings={sourcingSettings}
            onFetchDeals={fetchDealsNow}
            onNavigate={(path) => navigateRoute(getRouteFromPath(path))}
            onSaveLead={saveRadarLead}
            onUpdateLead={updateRadarLead}
            onDeleteLead={deleteRadarLead}
            onUpdateSettings={updateRadarSettings}
            onToggleSource={toggleRadarSource}
            onAddFollowup={addRadarFollowup}
          />
        )
      default:
        return null
    }
  }

  return (
    <Layout
      activePage={route.page}
      setActivePage={navigatePage}
      pageTitle={pageTitle[route.page]}
      pageDescription={pageDescription[route.page]}
      businessName={settings.businessName}
      stats={stats}
      onQuickAdd={() => navigatePage('lead-form')}
    >
      {renderPage()}
    </Layout>
  )
}

export default App
