import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppSettings, DashboardStats, PageKey } from '../types'
import { Sidebar } from './Sidebar'

interface LayoutProps {
  activePage: PageKey
  setActivePage: (page: PageKey) => void
  pageTitle: string
  pageDescription: string
  businessName: string
  currentTheme: AppSettings['themePreference']
  onToggleTheme: () => void
  stats: DashboardStats
  onQuickAdd: () => void
  children: ReactNode
}

export function Layout({
  activePage,
  setActivePage,
  pageTitle,
  pageDescription,
  businessName,
  currentTheme,
  onToggleTheme,
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
      <Sidebar activePage={activePage} onNavigate={setActivePage} variant="desktop" />

      <div className="mobile-topbar">
        <button className="menu-btn" onClick={() => setMobileMenuOpen(true)}>
          ☰
        </button>
        <div className="mobile-brand">Reseller Workflow</div>
        <button className="quick-btn" onClick={onQuickAdd}>
          + Club
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
          <div>
            <p className="eyebrow">Protect your margin before buying.</p>
            <h2>{pageTitle}</h2>
            <p className="page-subtitle">{pageDescription}</p>
          </div>
          <div className="header-actions">
            <div className="score-pill">Today's Sourcing Score: {sourcingScore}</div>
            <button className="btn" onClick={onToggleTheme}>
              {currentTheme === 'premium-navy-amber' ? 'Use Local Theme' : 'Use Premium Theme'}
            </button>
            <button className="quick-btn" onClick={onQuickAdd}>
              Quick Add Club
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
          <p>© {new Date().getFullYear()} {businessName || 'Golf Flip Tracker'}. All rights reserved.</p>
        </footer>
      </main>
    </div>
  )
}
