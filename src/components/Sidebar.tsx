import type { PageKey } from '../types'

interface SidebarProps {
  activePage: PageKey
  onNavigate: (page: PageKey) => void
  isOpen?: boolean
  onClose?: () => void
}

const navItems: Array<{ key: PageKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'lead-form', label: 'Add Lead' },
  { key: 'lead-analyzer', label: 'Analyze Deal' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'listings', label: 'Listings' },
  { key: 'sales', label: 'Sales' },
  { key: 'sources', label: 'Sources' },
  { key: 'value-guide', label: 'Value Guide' },
  { key: 'settings', label: 'Settings' },
]

export function Sidebar({ activePage, onNavigate, isOpen = true, onClose }: SidebarProps) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="logo-wrap">
        <h1>Golf Flip Tracker</h1>
        <p>Buy bundles, sell individual clubs.</p>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`nav-btn ${activePage === item.key ? 'active' : ''}`}
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
        <p>Know your max offer before you drive.</p>
      </div>
    </aside>
  )
}
