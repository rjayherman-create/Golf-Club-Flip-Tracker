import { useMemo, useState } from 'react'
import type { InventoryItem } from '../types'
import { calculateBundleCostAllocation } from '../utils/valuation'

interface InventoryProps {
  inventory: InventoryItem[]
  onUpdateInventory: (item: InventoryItem) => void
  onCreateFromBundle: (items: InventoryItem[]) => void
  onOpenValueChecker: () => void
  onOpenListings: () => void
}

export function Inventory({
  inventory,
  onUpdateInventory,
  onCreateFromBundle,
  onOpenValueChecker,
  onOpenListings,
}: InventoryProps) {
  const [bundlePrice, setBundlePrice] = useState('150')
  const [activeFilter, setActiveFilter] = useState('All')
  const [selectedInventoryId, setSelectedInventoryId] = useState(inventory[0]?.id ?? '')
  const [bundleRows, setBundleRows] = useState([
    { name: 'TaylorMade driver', estimatedResale: '150' },
    { name: 'Odyssey putter', estimatedResale: '100' },
    { name: 'Vokey wedge', estimatedResale: '85' },
    { name: 'Callaway hybrid', estimatedResale: '90' },
    { name: 'Golf bag', estimatedResale: '70' },
  ])

  const allocations = useMemo(() => {
    const rows = bundleRows.map((row) => ({
      name: row.name,
      estimatedResale: Number(row.estimatedResale) || 0,
    }))

    return calculateBundleCostAllocation(rows, Number(bundlePrice) || 0)
  }, [bundleRows, bundlePrice])

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      if (activeFilter === 'All') return true
      if (activeFilter === 'Needs value check') return item.estimatedResale <= 0
      if (activeFilter === 'Ready to list') return item.status === 'Ready to List'
      if (activeFilter === 'Listed') return item.status === 'Listed'
      if (activeFilter === 'Sold') return item.status === 'Sold'
      if (activeFilter === 'High profit') return item.targetListPrice - item.totalCost >= 80
      if (activeFilter === 'Low profit') return item.targetListPrice - item.totalCost < 40
      return item.clubType.toLowerCase().includes(activeFilter.toLowerCase().slice(0, -1))
    })
  }, [activeFilter, inventory])

  const selectedItem = filteredInventory.find((item) => item.id === selectedInventoryId) ?? filteredInventory[0]
  const expectedProfit = selectedItem ? selectedItem.targetListPrice - selectedItem.totalCost : 0

  return (
    <div className="stack-lg">
      <section className="card">
        <h3>Inventory</h3>
        <p>Use sold comps, condition, and repair cost. Every record should answer buy, list, hold, sell, or avoid.</p>
        <div className="chip-grid" style={{ marginTop: '10px' }}>
          {['All', 'Needs value check', 'Ready to list', 'Listed', 'Sold', 'High profit', 'Low profit', 'Bags', 'Drivers', 'Irons', 'Wedges', 'Putters'].map((filter) => (
            <button
              key={filter}
              className={`chip ${activeFilter === filter ? 'selected red' : ''}`}
              type="button"
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      <section className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Photo</th>
              <th>Brand / Model</th>
              <th>Club type</th>
              <th>Condition</th>
              <th>Paid</th>
              <th>Estimated value</th>
              <th>List price</th>
              <th>Expected profit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map((item) => (
              <tr key={item.id} onClick={() => setSelectedInventoryId(item.id)}>
                <td><span className="badge">No photo</span></td>
                <td>{item.brand} {item.model}</td>
                <td>{item.clubType}</td>
                <td>{item.condition}</td>
                <td>${item.totalCost.toFixed(2)}</td>
                <td>${item.estimatedResale.toFixed(2)}</td>
                <td>${item.targetListPrice.toFixed(2)}</td>
                <td className={item.targetListPrice - item.totalCost >= 0 ? 'profit' : 'loss'}>
                  ${(item.targetListPrice - item.totalCost).toFixed(2)}
                </td>
                <td><span className="badge">{item.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selectedItem && (
        <section className="card">
          <h4>Club Detail</h4>
          <div className="stats-grid compact-grid">
            <article className="card"><h4>Paid price</h4><strong>${selectedItem.totalCost.toFixed(2)}</strong></article>
            <article className="card"><h4>Estimated value</h4><strong>${selectedItem.estimatedResale.toFixed(2)}</strong></article>
            <article className="card"><h4>List price</h4><strong>${selectedItem.targetListPrice.toFixed(2)}</strong></article>
            <article className="card"><h4>Minimum sale price</h4><strong>${selectedItem.lowestAcceptablePrice.toFixed(2)}</strong></article>
            <article className="card"><h4>Expected profit</h4><strong className={expectedProfit >= 0 ? 'profit' : 'loss'}>${expectedProfit.toFixed(2)}</strong></article>
            <article className="card"><h4>Margin</h4><strong>{selectedItem.totalCost > 0 ? ((expectedProfit / selectedItem.totalCost) * 100).toFixed(1) : '0.0'}%</strong></article>
          </div>
          <p className="muted-copy" style={{ marginTop: '8px' }}>Comps used: eBay sold + local marketplace estimates captured in Value Checker.</p>
          <div className="row-wrap" style={{ marginTop: '8px' }}>
            <button className="btn" onClick={() => onUpdateInventory({ ...selectedItem, notes: `${selectedItem.notes}\nEdited ${new Date().toISOString()}`.trim() })}>Add Note</button>
            <button className="btn" onClick={onOpenValueChecker}>Check Value</button>
            <button className="btn" onClick={onOpenListings}>Create Listing</button>
            <button className="btn btn-primary" onClick={() => onUpdateInventory({ ...selectedItem, status: 'Listed' })}>Mark Listed</button>
            <button className="btn btn-success" onClick={() => onUpdateInventory({ ...selectedItem, status: 'Sold' })}>Mark Sold</button>
            <button className="btn btn-danger" onClick={() => onUpdateInventory({ ...selectedItem, status: 'Archived' })}>Archive</button>
          </div>
        </section>
      )}

      <details>
        <summary>Advanced bundle split</summary>
      <section className="form-grid" style={{ marginTop: '12px' }}>
        <h3>Bundle Split Tool</h3>
        <label>
          Purchase lot price
          <input type="number" value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} />
        </label>
        {bundleRows.map((row, index) => (
          <div key={index} className="inline-grid span-2">
            <label>
              Item
              <input
                value={row.name}
                onChange={(e) =>
                  setBundleRows((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)),
                  )
                }
              />
            </label>
            <label>
              Estimated resale
              <input
                type="number"
                value={row.estimatedResale}
                onChange={(e) =>
                  setBundleRows((prev) =>
                    prev.map((item, i) =>
                      i === index ? { ...item, estimatedResale: e.target.value } : item,
                    ),
                  )
                }
              />
            </label>
          </div>
        ))}

        <div className="span-2 table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Estimated Resale</th>
                <th>Allocated Cost</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>${item.estimatedResale.toFixed(2)}</td>
                  <td>${item.allocatedCost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          className="btn btn-success"
          onClick={() => {
            const today = new Date().toISOString().slice(0, 10)
            const created = allocations.map((row) => ({
              id: crypto.randomUUID(),
              leadId: '',
              purchaseDate: today,
              source: 'Bundle split',
              town: 'Long Island',
              itemName: row.name,
              brand: row.name.split(' ')[0] ?? 'Unknown',
              model: row.name,
              clubType: 'Mixed lot',
              loft: '',
              shaftFlex: 'Unknown',
              hand: 'Unknown',
              condition: 'Good',
              gripCondition: 'Usable',
              purchasePrice: row.allocatedCost,
              allocatedCost: row.allocatedCost,
              cleaningCost: 0,
              repairCost: 0,
              totalCost: row.allocatedCost,
              estimatedResale: row.estimatedResale,
              targetListPrice: row.estimatedResale,
              lowestAcceptablePrice: row.estimatedResale * 0.8,
              status: 'Ready to List' as const,
              storageLocation: '',
              notes: 'Created from bundle split tool',
              cleaned: false,
              photographed: false,
            }))
            onCreateFromBundle(created)
          }}
        >
          Split Bundle Into Inventory Items
        </button>
      </section>
      </details>
    </div>
  )
}
