import type { PageKey } from '../types'

interface SidebarProps {
  activePage: PageKey
  onNavigate: (page: PageKey) => void
  isOpen?: boolean
  onClose?: () => void
  variant?: 'desktop' | 'mobile'
}

const navItems: Array<{ key: PageKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'sourcing-radar', label: 'Source Deals' },
  { key: 'lead-form', label: 'Add Club' },
  { key: 'club-flip', label: 'Identify From Photo' },
  { key: 'lead-analyzer', label: 'Value Checker' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'listings', label: 'Listings' },
  { key: 'sales', label: 'Sold / Profit' },
  { key: 'csv-export', label: 'CSV Export' },
  { key: 'settings', label: 'Settings' },
]

export function Sidebar({
  activePage,
  onNavigate,
  isOpen = false,
  onClose,
  variant = 'desktop',
}: SidebarProps) {
  return (
    <aside className={`sidebar sidebar-${variant} ${isOpen ? 'open' : ''}`}>
      <div className="logo-wrap">
        <h1>Golf Flip Tracker</h1>
        <p>Buy bundles, sell individual clubs.</p>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`nav-btn ${activePage === item.key ? 'active' : ''}`}
            data-tour-nav={item.key === 'dashboard' ? 'main' : undefined}
            data-tour-reports={item.key === 'csv-export' ? 'reports' : undefined}
            onClick={() => {
              onNavigate(item.key)
              onClose?.()
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <p>Find the source before you price the flip.</p>
      </div>
    </aside>
  )
}
