import { useEffect, useMemo, useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { Inventory } from './components/Inventory'
import { Layout } from './components/Layout'
import { LeadAnalyzer } from './components/LeadAnalyzer'
import { LeadForm } from './components/LeadForm'
import { ListingGenerator } from './components/ListingGenerator'
import { SalesTracker } from './components/SalesTracker'
import { Settings } from './components/Settings'
import { Sources } from './components/Sources'
import { ValueGuide } from './components/ValueGuide'
import {
  defaultSettings,
  sampleInventory,
  sampleLeads,
  sampleSales,
  sampleSources,
} from './data/sampleData'
import type { AppSettings, InventoryItem, Lead, PageKey, Sale, Source } from './types'
import { calculateDashboardStats, calculateValuation } from './utils/valuation'

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function App() {
  const [activePage, setActivePage] = useState<PageKey>('dashboard')
  const [leads, setLeads] = useState<Lead[]>(() => loadLocal('gft.leads', sampleLeads))
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadLocal('gft.inventory', sampleInventory))
  const [sales, setSales] = useState<Sale[]>(() => loadLocal('gft.sales', sampleSales))
  const [sources, setSources] = useState<Source[]>(() => loadLocal('gft.sources', sampleSources))
  const [settings, setSettings] = useState<AppSettings>(() => loadLocal('gft.settings', defaultSettings))

  useEffect(() => localStorage.setItem('gft.leads', JSON.stringify(leads)), [leads])
  useEffect(() => localStorage.setItem('gft.inventory', JSON.stringify(inventory)), [inventory])
  useEffect(() => localStorage.setItem('gft.sales', JSON.stringify(sales)), [sales])
  useEffect(() => localStorage.setItem('gft.sources', JSON.stringify(sources)), [sources])
  useEffect(() => localStorage.setItem('gft.settings', JSON.stringify(settings)), [settings])

  const stats = useMemo(() => calculateDashboardStats(leads, inventory, sales), [leads, inventory, sales])

  const pageTitle: Record<PageKey, string> = {
    dashboard: 'Dashboard',
    'lead-form': 'New Lead',
    'lead-analyzer': 'Lead Analyzer',
    inventory: 'Inventory',
    listings: 'Listing Generator',
    sales: 'Sales Tracker',
    sources: 'Source Map / Source List',
    'value-guide': 'Brand Value Guide',
    settings: 'Settings',
  }

  function addLead(lead: Lead) {
    setLeads((prev) => [calculateValuation(lead), ...prev])
    setActivePage('lead-analyzer')
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
    setActivePage('inventory')
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

  function renderPage() {
    switch (activePage) {
      case 'dashboard':
        return (
          <Dashboard
            stats={stats}
            leads={leads}
            onAddLead={() => setActivePage('lead-form')}
            onAnalyze={() => setActivePage('lead-analyzer')}
          />
        )
      case 'lead-form':
        return <LeadForm onSave={addLead} settings={settings} />
      case 'lead-analyzer':
        return (
          <LeadAnalyzer
            leads={leads}
            onUpdateLead={updateLead}
            onMoveToInventory={moveLeadToInventory}
          />
        )
      case 'inventory':
        return (
          <Inventory
            inventory={inventory}
            onUpdateInventory={updateInventory}
            onCreateFromBundle={createFromBundle}
          />
        )
      case 'listings':
        return <ListingGenerator inventory={inventory} />
      case 'sales':
        return <SalesTracker sales={sales} inventory={inventory} onAddSale={addSale} />
      case 'sources':
        return <Sources sources={sources} onAddSource={addSource} />
      case 'value-guide':
        return <ValueGuide />
      case 'settings':
        return <Settings settings={settings} onSave={setSettings} />
      default:
        return null
    }
  }

  return (
    <Layout
      activePage={activePage}
      setActivePage={setActivePage}
      pageTitle={pageTitle[activePage]}
      stats={stats}
      onQuickAdd={() => setActivePage('lead-form')}
    >
      {renderPage()}
    </Layout>
  )
}

export default App
