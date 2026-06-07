import { useMemo, useState } from 'react'
import type { AppSettings, DashboardStats, Lead, LeadStatus, SourceType } from '../types'
import type { GolfLeadRadar } from '../types'
import { calculateValuation } from '../utils/valuation'

function parseNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

interface DashboardSourcingSummary {
  totalLeads: number
  strongBuys: number
  manualFacebookLeads: number
  radarLeads: number
  followupsDueToday: number
}

interface DashboardProps {
  stats: DashboardStats
  settings: AppSettings
  sourcingSummary: DashboardSourcingSummary
  onAddLead: () => void
  onOpenSourcing: () => void
  onOpenIdentify: () => void
  onOpenListings: () => void
  onOpenCsvExport: () => void
  onOpenValueGuide: () => void
  onQuickSaveLead: (lead: Lead) => void
  onFetchDeals: () => Promise<GolfLeadRadar[]>
  fetchingDeals: boolean
}

export function Dashboard({
  stats,
  settings,
  sourcingSummary,
  onAddLead,
  onOpenSourcing,
  onOpenIdentify,
  onOpenListings,
  onOpenCsvExport,
  onOpenValueGuide,
  onQuickSaveLead,
  onFetchDeals,
  fetchingDeals,
}: DashboardProps) {
  const [quickAddOpen, setQuickAddOpen] = useState(true)
  const [quickLead, setQuickLead] = useState({
    title: '',
    sourceType: 'Facebook Marketplace' as SourceType,
    sellerName: '',
    town: '',
    askingPrice: '',
    itemType: 'Full bag / lot',
    brand: '',
    model: '',
    notes: '',
    status: 'New' as LeadStatus,
  })

  const quickDraft = useMemo<Lead>(() => {
    return calculateValuation({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      title: quickLead.title,
      sourceType: quickLead.sourceType,
      sellerName: quickLead.sellerName,
      town: quickLead.town,
      distance: 0,
      askingPrice: parseNumber(quickLead.askingPrice),
      sellerDescription: quickLead.notes,
      listingUrl: '',
      itemType: quickLead.itemType,
      brand: quickLead.brand,
      model: quickLead.model,
      loft: '',
      shaftFlex: 'Unknown',
      hand: 'Unknown',
      condition: 'Good',
      gripCondition: 'Unknown',
      notes: quickLead.notes,
      status: quickLead.status,
      ebayLow: 0,
      ebayAverage: 0,
      ebayHigh: 0,
      pgaValue: 0,
      retailUsedValue: 0,
      facebookEstimate: 0,
      manualEstimate: parseNumber(quickLead.askingPrice) * 1.8,
      cleaningCost: settings.defaultCleaningCost,
      gripCost: settings.defaultGripReplacementCost,
      travelCost: settings.defaultTravelCost,
      conservativeResale: 0,
      fastSalePrice: 0,
      maxSafeOffer: 0,
      repairAdjustedMaxOffer: 0,
      expectedProfit: 0,
      roi: 0,
      dealGrade: 'F',
      recommendation: 'WATCH',
      redFlags: [],
    })
  }, [quickLead, settings])

  function updateQuickLead<K extends keyof typeof quickLead>(key: K, value: (typeof quickLead)[K]) {
    setQuickLead((prev) => ({ ...prev, [key]: value }))
  }

  function handleQuickSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onQuickSaveLead(quickDraft)
    setQuickLead({
      title: '',
      sourceType: 'Facebook Marketplace',
      sellerName: '',
      town: '',
      askingPrice: '',
      itemType: 'Full bag / lot',
      brand: '',
      model: '',
      notes: '',
      status: 'New',
    })
    setQuickAddOpen(true)
  }

  const quickStats = [
    { label: 'Clubs in inventory', value: stats.clubsInInventory },
    { label: 'Total invested', value: `$${stats.totalInvested.toFixed(2)}` },
    { label: 'Estimated resale value', value: `$${stats.expectedResaleValue.toFixed(2)}` },
    { label: 'Estimated profit', value: `$${stats.estimatedProfit.toFixed(2)}` },
    { label: 'Items ready to list', value: stats.readyToList },
  ]

  return (
    <div className="stack-lg">
      <section className="hero-card">
        <h3>Golf Flip Tracker</h3>
        <p>
          Buy used golf clubs with discipline. Identify quickly, value from sold comps, and only buy
          when margin survives travel, cleanup, and relisting.
        </p>
        <div className="workflow-strip">
          <span>Source</span>
          <span>Identify</span>
          <span>Value</span>
          <span>Buy</span>
          <span>List</span>
          <span>Sell</span>
          <span>Profit</span>
        </div>
        <p className="muted-copy">Never price from asking prices alone.</p>
      </section>

      <section className="stats-grid compact-grid">
        {quickStats.map((stat) => (
          <article key={stat.label} className="card">
            <h4>{stat.label}</h4>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>

      <section className="card">
        <h4>Quick actions</h4>
        <div className="quick-action-grid">
          <button className="deal-card" onClick={onAddLead}>
            <strong>Add Club</strong>
            <p>Create a structured club record for this deal.</p>
          </button>
          <button className="deal-card" onClick={onOpenValueGuide}>
            <strong>Check Sold Comps</strong>
            <p>Use comp-based value ranges before making an offer.</p>
          </button>
          <button className="deal-card" onClick={onOpenIdentify}>
            <strong>Identify From Photo</strong>
            <p>Confirm model, loft, shaft, and confidence before pricing.</p>
          </button>
          <button className="deal-card" onClick={onOpenListings}>
            <strong>Create Facebook Listing</strong>
            <p>Generate practical copy with condition honesty.</p>
          </button>
          <button className="deal-card" onClick={onOpenCsvExport}>
            <strong>Export CSV</strong>
            <p>Download inventory, listing, sold, and profit reports.</p>
          </button>
        </div>
      </section>

      {quickAddOpen && (
        <section className="card form-grid quick-add-card">
          <div className="row-wrap space-between">
            <div>
              <h4>Quick Add Deal</h4>
              <p className="muted-copy">Fill this in from the dashboard, then send it straight into analysis.</p>
            </div>
            <button className="btn" type="button" onClick={onAddLead}>
              Open Full Form
            </button>
          </div>
          <form className="form-grid span-2" onSubmit={handleQuickSubmit}>
            <label>
              Lead title
              <input value={quickLead.title} onChange={(event) => updateQuickLead('title', event.target.value)} required />
            </label>
            <label>
              Source type
              <select value={quickLead.sourceType} onChange={(event) => updateQuickLead('sourceType', event.target.value as SourceType)}>
                {['Facebook Marketplace', 'Facebook Group', 'Garage Sale', 'Estate Sale', 'Craigslist', 'Play It Again Sports', 'Thrift Store', 'Golf Course / Range', 'Referral', 'Other'].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              Seller town / location
              <input value={quickLead.town} onChange={(event) => updateQuickLead('town', event.target.value)} />
            </label>
            <label>
              Asking price
              <input type="number" value={quickLead.askingPrice} onChange={(event) => updateQuickLead('askingPrice', event.target.value)} />
            </label>
            <label>
              Item type
              <input value={quickLead.itemType} onChange={(event) => updateQuickLead('itemType', event.target.value)} />
            </label>
            <label>
              Brand
              <input value={quickLead.brand} onChange={(event) => updateQuickLead('brand', event.target.value)} />
            </label>
            <label>
              Model
              <input value={quickLead.model} onChange={(event) => updateQuickLead('model', event.target.value)} />
            </label>
            <label className="span-2">
              Notes
              <textarea rows={3} value={quickLead.notes} onChange={(event) => updateQuickLead('notes', event.target.value)} />
            </label>
            <div className="span-2 row-wrap">
              <button className="btn btn-primary" type="submit">
                Save Deal
              </button>
              <button className="btn" type="button" onClick={() => setQuickAddOpen(false)}>
                Hide Quick Form
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="card">
        <h4>Source Finder</h4>
        <p className="muted-copy">
          Put sourcing on the dashboard first: find clubs and bags, then decide whether they are worth buying.
        </p>
        <div className="stats-grid compact-grid">
          <article className="card tone-blue">
            <h4>Total sourcing leads</h4>
            <strong>{sourcingSummary.totalLeads}</strong>
          </article>
          <article className="card tone-green">
            <h4>Strong buy leads</h4>
            <strong>{sourcingSummary.strongBuys}</strong>
          </article>
          <article className="card tone-gold">
            <h4>Manual Facebook</h4>
            <strong>{sourcingSummary.manualFacebookLeads}</strong>
          </article>
          <article className="card tone-muted">
            <h4>Radar sources</h4>
            <strong>{sourcingSummary.radarLeads}</strong>
          </article>
          <article className="card tone-blue">
            <h4>Follow-ups due today</h4>
            <strong>{sourcingSummary.followupsDueToday}</strong>
          </article>
        </div>
        <div className="row-wrap">
          <button className="btn btn-primary" onClick={onOpenSourcing}>
            Open Source Finder
          </button>
          <button className="btn btn-secondary" onClick={() => void onFetchDeals()} disabled={fetchingDeals}>
            {fetchingDeals ? 'Fetching Deals...' : 'Fetch Deals Now'}
          </button>
        </div>
        {fetchingDeals && <p className="muted-copy">Pulling in new public-source leads from the server.</p>}
      </section>

      <section className="stats-grid">
        <article className="card">
          <h4>Total leads</h4>
          <strong>{stats.totalLeads}</strong>
        </article>
        <article className="card">
          <h4>Active watchlist</h4>
          <strong>{stats.activeWatchlist}</strong>
        </article>
        <article className="card">
          <h4>Purchased inventory</h4>
          <strong>{stats.purchasedInventory}</strong>
        </article>
        <article className="card">
          <h4>Total invested</h4>
          <strong>${stats.totalInvested.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Expected resale value</h4>
          <strong>${stats.expectedResaleValue.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Total profit</h4>
          <strong className="profit">${stats.totalProfit.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Average ROI</h4>
          <strong>{stats.averageRoi.toFixed(1)}%</strong>
        </article>
        <article className="card">
          <h4>Best brands found</h4>
          <strong>{stats.bestBrands.join(', ') || 'No sales data yet'}</strong>
        </article>
        <article className="card">
          <h4>Items needing action today</h4>
          <strong>{stats.itemsNeedingAction}</strong>
        </article>
      </section>

      <section className="card">
        <h4>Today's Buy Rules</h4>
        <ul className="plain-list">
          <li>Buy known brands only.</li>
          <li>Verify sold comps before pickup.</li>
          <li>Deduct for bad grips and travel.</li>
          <li>Avoid cracked heads or damaged shafts.</li>
          <li>Try to buy at 40%-50% of realistic resale value.</li>
          <li>Focus on drivers, putters, wedges, hybrids, and clean iron sets.</li>
        </ul>
      </section>
    </div>
  )
}
