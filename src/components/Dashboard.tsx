import type { DashboardStats, Lead } from '../types'

interface DashboardProps {
  stats: DashboardStats
  leads: Lead[]
  onAddLead: () => void
  onAnalyze: () => void
}

export function Dashboard({ stats, leads, onAddLead, onAnalyze }: DashboardProps) {
  const cards = [
    { label: 'New Leads', value: leads.filter((lead) => lead.status === 'New').length, tone: 'blue' },
    { label: 'Ready to Buy', value: stats.readyToBuy, tone: 'green' },
    {
      label: 'Needs Research',
      value: leads.filter((lead) => ['Research', 'Watch'].includes(lead.status)).length,
      tone: 'muted',
    },
    {
      label: 'Ready to List',
      value: leads.filter((lead) => lead.status === 'Purchased').length,
      tone: 'gold',
    },
    { label: 'Listed', value: stats.listedItems, tone: 'blue' },
    { label: 'Sold', value: stats.soldItems, tone: 'green' },
  ]

  return (
    <div className="stack-lg">
      <section className="hero-card">
        <h3>Golf Flip Tracker</h3>
        <p>
          Source used golf clubs, calculate real resale value, and know exactly what to offer before
          you buy.
        </p>
        <div className="row-wrap">
          <button className="btn btn-primary" onClick={onAddLead}>
            Add New Lead
          </button>
          <button className="btn btn-secondary" onClick={onAnalyze}>
            Analyze a Deal
          </button>
        </div>
        <p className="muted-copy">Never price from asking prices alone.</p>
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

      <section className="dashboard-card-grid">
        {cards.map((card) => (
          <article key={card.label} className={`card tone-${card.tone}`}>
            <h4>{card.label}</h4>
            <strong>{card.value}</strong>
          </article>
        ))}
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
