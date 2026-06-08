import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { DashboardStats, PageKey } from '../types'
import { Sidebar } from './Sidebar'
import { TutorialSystem } from './TutorialSystem'

interface LayoutProps {
  activePage: PageKey
  setActivePage: (page: PageKey) => void
  pageTitle: string
  pageDescription: string
  businessName: string
  stats: DashboardStats
  onQuickAdd: () => void
  onFindDeals: () => void
  children: ReactNode
}

export function Layout({
  activePage,
  setActivePage,
  pageTitle,
  pageDescription,
  businessName,
  stats,
  onQuickAdd,
  onFindDeals,
  children,
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const sourcingScore = useMemo(() => {
    const base = Math.min(100, Math.max(0, Math.round(stats.averageRoi + stats.readyToBuy * 5)))
    return Number.isNaN(base) ? 0 : base
  }, [stats.averageRoi, stats.readyToBuy])

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} variant="desktop" />

      <div className="mobile-topbar">
        <button className="menu-btn" onClick={() => setMobileMenuOpen(true)}>
          Menu
        </button>
        <div className="mobile-brand">Sourcing Workflow</div>
        <button className="quick-btn" onClick={onFindDeals}>
          Find Deals
        </button>
      </div>

      <div className={`mobile-overlay ${mobileMenuOpen ? 'show' : ''}`} onClick={() => setMobileMenuOpen(false)} />
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        variant="mobile"
      />

      <main className="main-area">
        <header className="page-header">
          <div data-tour-dashboard="main">
            <p className="eyebrow">Protect your margin before buying.</p>
            <h2>{pageTitle}</h2>
            <p className="page-subtitle">{pageDescription}</p>
          </div>
          <div className="header-actions">
            <div className="score-pill">Today's Sourcing Score: {sourcingScore}</div>
            <button className="quick-btn" data-tour-primary-action="source" onClick={onFindDeals}>
              Find Deals
            </button>
            <button className="btn btn-outline" data-tour-primary-action="add" onClick={onQuickAdd}>
              Quick Add
            </button>
          </div>
        </header>

        <section className="page-content">{children}</section>

        <footer className="footer-note">
          <p>
            Values are estimates for resale planning only. Always verify current sold comps, condition,
            authenticity, and local demand before buying.
          </p>
          <div className="footer-legal-row">
            <a href="/terms">Terms of Service</a>
            <span aria-hidden="true">|</span>
            <a href="/privacy">Privacy Policy</a>
          </div>
          <p>(c) {new Date().getFullYear()} {businessName || 'Golf Flip Tracker'}. All rights reserved.</p>
        </footer>

        <TutorialSystem appName="Golf Flip Tracker" activePage={activePage} onGoDashboard={() => setActivePage('dashboard')} />
      </main>
    </div>
  )
}
