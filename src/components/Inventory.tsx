import { useMemo, useState } from 'react'
import type { InventoryItem } from '../types'
import { calculateBundleCostAllocation } from '../utils/valuation'

interface InventoryProps {
  inventory: InventoryItem[]
  onUpdateInventory: (item: InventoryItem) => void
  onCreateFromBundle: (items: InventoryItem[]) => void
}

export function Inventory({ inventory, onUpdateInventory, onCreateFromBundle }: InventoryProps) {
  const [bundlePrice, setBundlePrice] = useState('150')
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

  return (
    <div className="stack-lg">
      <section className="card">
        <h3>Inventory</h3>
        <p>Use sold comps, condition, and repair cost.</p>
      </section>

      <section className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Inventory ID</th>
              <th>Item</th>
              <th>Brand</th>
              <th>Status</th>
              <th>Total Cost</th>
              <th>Target List</th>
              <th>Estimated Resale</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              <tr key={item.id}>
                <td>{item.id.slice(0, 8)}</td>
                <td>{item.itemName}</td>
                <td>{item.brand}</td>
                <td>
                  <span className="badge">{item.status}</span>
                </td>
                <td>${item.totalCost.toFixed(2)}</td>
                <td>${item.targetListPrice.toFixed(2)}</td>
                <td>${item.estimatedResale.toFixed(2)}</td>
                <td>
                  <div className="row-wrap">
                    <button
                      className="btn"
                      onClick={() => onUpdateInventory({ ...item, cleaned: true, status: 'Ready to Photograph' })}
                    >
                      Mark cleaned
                    </button>
                    <button
                      className="btn"
                      onClick={() => onUpdateInventory({ ...item, photographed: true, status: 'Ready to List' })}
                    >
                      Mark photographed
                    </button>
                    <button className="btn btn-secondary" onClick={() => onUpdateInventory({ ...item, status: 'Listed' })}>
                      Mark listed
                    </button>
                    <button className="btn btn-danger" onClick={() => onUpdateInventory({ ...item, status: 'Archived' })}>
                      Archive
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card form-grid">
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
          className="btn btn-primary"
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
    </div>
  )
}
