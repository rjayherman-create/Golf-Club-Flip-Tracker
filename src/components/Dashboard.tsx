import type { DashboardStats } from '../types'

interface DashboardSourcingSummary {
  totalLeads: number
  strongBuys: number
  manualFacebookLeads: number
  radarLeads: number
  followupsDueToday: number
}

interface DashboardProps {
  stats: DashboardStats
  sourcingSummary: DashboardSourcingSummary
  onAddLead: () => void
  onOpenSourcing: () => void
  onOpenValueGuide: () => void
  onFetchDeals: () => Promise<unknown>
  fetchingDeals: boolean
  hasDemoData: boolean
  onStartClean: () => void
}

export function Dashboard({
  stats,
  sourcingSummary,
  onAddLead,
  onOpenSourcing,
  onOpenValueGuide,
  onFetchDeals,
  fetchingDeals,
  hasDemoData,
  onStartClean,
}: DashboardProps) {
  const focusStats = [
    { label: 'Source leads', value: sourcingSummary.totalLeads },
    { label: 'Strong buys', value: sourcingSummary.strongBuys },
    { label: 'Follow-ups today', value: sourcingSummary.followupsDueToday },
    { label: 'Open inventory profit', value: `$${stats.estimatedProfit.toFixed(2)}` },
  ]

  return (
    <div className="stack-lg">
      <section className="hero-card">
        <h3>Golf Flip Tracker</h3>
        <p>Find local golf deals, verify value, then track inventory and profit without extra noise.</p>
        <div className="row-wrap" style={{ marginTop: '14px' }}>
          <button className="btn btn-success" type="button" onClick={onOpenSourcing}>
            Find Source Deals
          </button>
          <button className="btn btn-primary" type="button" onClick={onOpenValueGuide}>
            Check Deal Value
          </button>
          <button className="btn btn-outline" type="button" onClick={onAddLead}>
            Add Manual Club
          </button>
        </div>
      </section>

      {hasDemoData && (
        <section className="business-rule-banner">
          <div className="row-wrap space-between">
            <div>
              <strong>Demo data is loaded.</strong>
              <p className="muted-copy">Start clean before tracking real sourcing and profit.</p>
            </div>
            <button className="btn btn-outline" type="button" onClick={onStartClean}>
              Start Clean
            </button>
          </div>
        </section>
      )}

      <section className="stats-grid compact-grid">
        {focusStats.map((stat) => (
          <article key={stat.label} className="card">
            <h4>{stat.label}</h4>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>

      <section className="card">
        <div className="row-wrap space-between">
          <div>
            <h4>Source Finder</h4>
            <p className="muted-copy">
              Facebook manual imports: {sourcingSummary.manualFacebookLeads}. Public radar leads: {sourcingSummary.radarLeads}.
            </p>
          </div>
          <div className="row-wrap">
            <button className="btn btn-primary" type="button" onClick={onOpenSourcing}>
              Open Source Deals
            </button>
            <button className="btn btn-info" type="button" onClick={() => void onFetchDeals()} disabled={fetchingDeals}>
              {fetchingDeals ? 'Fetching...' : 'Fetch Deals'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
