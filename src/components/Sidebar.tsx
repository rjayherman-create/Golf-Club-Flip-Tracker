import type { PageKey } from '../types'

interface SidebarProps {
  activePage: PageKey
  onNavigate: (page: PageKey) => void
  isOpen?: boolean
  onClose?: () => void
  variant?: 'desktop' | 'mobile'
}

type NavItem = {
  key: PageKey
  label: string
  activeFor: PageKey[]
}

const navItems: NavItem[] = [
  {
    key: 'sourcing-radar',
    label: 'Source Deals',
    activeFor: ['dashboard', 'sourcing-radar', 'sourcing-add-facebook', 'sourcing-craigslist', 'sourcing-lead', 'sourcing-settings'],
  },
  {
    key: 'club-flip',
    label: 'Photo Checker',
    activeFor: ['club-flip'],
  },
  {
    key: 'lead-analyzer',
    label: 'Value Checker',
    activeFor: ['lead-analyzer', 'lead-form', 'value-guide'],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    activeFor: ['inventory', 'listings', 'csv-export'],
  },
  {
    key: 'sales',
    label: 'Profit',
    activeFor: ['sales'],
  },
  {
    key: 'settings',
    label: 'Settings',
    activeFor: ['settings'],
  },
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
            className={`nav-btn ${item.activeFor.includes(activePage) ? 'active' : ''}`}
            data-tour-nav={item.key === 'sourcing-radar' ? 'main' : undefined}
            data-tour-reports={item.key === 'inventory' ? 'reports' : undefined}
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
