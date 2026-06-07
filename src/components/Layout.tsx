import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { DashboardStats, PageKey } from '../types'
import { Sidebar } from './Sidebar'

interface LayoutProps {
  activePage: PageKey
  setActivePage: (page: PageKey) => void
  pageTitle: string
  stats: DashboardStats
  onQuickAdd: () => void
  children: ReactNode
}

export function Layout({
  activePage,
  setActivePage,
  pageTitle,
  stats,
  onQuickAdd,
  children,
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const sourcingScore = useMemo(() => {
    const base = Math.min(100, Math.max(0, Math.round(stats.averageRoi + stats.readyToBuy * 5)))
    return Number.isNaN(base) ? 0 : base
  }, [stats.averageRoi, stats.readyToBuy])

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <div className="mobile-topbar">
        <button className="menu-btn" onClick={() => setMobileMenuOpen(true)}>
          ☰
        </button>
        <div className="mobile-brand">Golf Flip Tracker</div>
        <button className="quick-btn" onClick={onQuickAdd}>
          + Lead
        </button>
      </div>

      <div className={`mobile-overlay ${mobileMenuOpen ? 'show' : ''}`} onClick={() => setMobileMenuOpen(false)} />
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="main-area">
        <header className="page-header">
          <div>
            <p className="eyebrow">Protect your margin before buying.</p>
            <h2>{pageTitle}</h2>
          </div>
          <div className="header-actions">
            <div className="score-pill">Today's Sourcing Score: {sourcingScore}</div>
            <button className="quick-btn" onClick={onQuickAdd}>
              Quick Add Lead
            </button>
          </div>
        </header>

        <section className="page-content">{children}</section>

        <footer className="footer-note">
          Values are estimates for resale planning only. Always verify current sold comps, condition,
          authenticity, and local demand before buying.
        </footer>
      </main>
    </div>
  )
}
