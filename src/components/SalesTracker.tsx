import { useMemo, useState } from 'react'
import type { InventoryItem, Sale } from '../types'
import { calculateProfit } from '../utils/valuation'

interface SalesTrackerProps {
  sales: Sale[]
  inventory: InventoryItem[]
  onAddSale: (sale: Sale) => void
}

export function SalesTracker({ sales, inventory, onAddSale }: SalesTrackerProps) {
  const [form, setForm] = useState({
    inventoryItemId: inventory[0]?.id ?? '',
    dateListed: new Date().toISOString().slice(0, 10),
    dateSold: new Date().toISOString().slice(0, 10),
    listedPrice: '',
    soldPrice: '',
    platform: 'Facebook Marketplace',
    buyerTown: '',
    notes: '',
  })

  const selectedItem = useMemo(
    () => inventory.find((item) => item.id === form.inventoryItemId),
    [inventory, form.inventoryItemId],
  )

  const totalSales = sales.length
  const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0)
  const averageDays = sales.length
    ? sales.reduce((sum, sale) => sum + sale.daysToSell, 0) / sales.length
    : 0

  const bestRoiItem = sales.slice().sort((a, b) => b.roi - a.roi)[0]
  const slowestItem = sales.slice().sort((a, b) => b.daysToSell - a.daysToSell)[0]

  const brandProfitMap: Record<string, number> = {}
  const sourceProfitMap: Record<string, number> = {}

  sales.forEach((sale) => {
    const matchedItem = inventory.find((item) => item.id === sale.inventoryItemId)
    const brand = matchedItem?.brand ?? 'Unknown'
    const source = matchedItem?.source ?? 'Unknown'
    brandProfitMap[brand] = (brandProfitMap[brand] ?? 0) + sale.profit
    sourceProfitMap[source] = (sourceProfitMap[source] ?? 0) + sale.profit
  })

  const bestBrand = Object.entries(brandProfitMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'
  const bestSource = Object.entries(sourceProfitMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'

  function submitSale(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedItem) return

    const sale = calculateProfit({
      id: crypto.randomUUID(),
      inventoryItemId: selectedItem.id,
      itemName: selectedItem.itemName,
      dateListed: form.dateListed,
      dateSold: form.dateSold,
      listedPrice: Number(form.listedPrice) || selectedItem.targetListPrice,
      soldPrice: Number(form.soldPrice) || selectedItem.lowestAcceptablePrice,
      totalCost: selectedItem.totalCost,
      profit: 0,
      roi: 0,
      platform: form.platform,
      buyerTown: form.buyerTown,
      daysToSell: 0,
      notes: form.notes,
    })

    onAddSale(sale)
    setForm((prev) => ({
      ...prev,
      listedPrice: '',
      soldPrice: '',
      buyerTown: '',
      notes: '',
    }))
  }

  return (
    <div className="stack-lg">
      <section className="stats-grid">
        <article className="card">
          <h4>Total sales</h4>
          <strong>{totalSales}</strong>
        </article>
        <article className="card">
          <h4>Total profit</h4>
          <strong className="profit">${totalProfit.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Best ROI item</h4>
          <strong>{bestRoiItem?.itemName ?? '-'}</strong>
        </article>
        <article className="card">
          <h4>Slowest item</h4>
          <strong>{slowestItem?.itemName ?? '-'}</strong>
        </article>
        <article className="card">
          <h4>Average days to sell</h4>
          <strong>{averageDays.toFixed(1)}</strong>
        </article>
        <article className="card">
          <h4>Best brand by profit</h4>
          <strong>{bestBrand}</strong>
        </article>
        <article className="card">
          <h4>Best source by profit</h4>
          <strong>{bestSource}</strong>
        </article>
      </section>

      <section className="card form-grid">
        <h3>Add Sale</h3>
        <form className="form-grid span-2" onSubmit={submitSale}>
          <label>
            Item
            <select
              value={form.inventoryItemId}
              onChange={(e) => setForm((prev) => ({ ...prev, inventoryItemId: e.target.value }))}
            >
              {inventory.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.itemName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date listed
            <input
              type="date"
              value={form.dateListed}
              onChange={(e) => setForm((prev) => ({ ...prev, dateListed: e.target.value }))}
            />
          </label>
          <label>
            Date sold
            <input
              type="date"
              value={form.dateSold}
              onChange={(e) => setForm((prev) => ({ ...prev, dateSold: e.target.value }))}
            />
          </label>
          <label>
            Listed price
            <input
              type="number"
              value={form.listedPrice}
              onChange={(e) => setForm((prev) => ({ ...prev, listedPrice: e.target.value }))}
            />
          </label>
          <label>
            Sold price
            <input
              type="number"
              value={form.soldPrice}
              onChange={(e) => setForm((prev) => ({ ...prev, soldPrice: e.target.value }))}
            />
          </label>
          <label>
            Platform
            <input
              value={form.platform}
              onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))}
            />
          </label>
          <label>
            Buyer town
            <input
              value={form.buyerTown}
              onChange={(e) => setForm((prev) => ({ ...prev, buyerTown: e.target.value }))}
            />
          </label>
          <label className="span-2">
            Notes
            <textarea
              value={form.notes}
              rows={3}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </label>
          <button className="btn btn-primary" type="submit">
            Mark Sold
          </button>
        </form>
      </section>

      <section className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Date listed</th>
              <th>Date sold</th>
              <th>Listed price</th>
              <th>Sold price</th>
              <th>Purchase cost</th>
              <th>Platform</th>
              <th>Buyer town</th>
              <th>Days to sell</th>
              <th>Profit</th>
              <th>ROI</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{sale.itemName}</td>
                <td>{sale.dateListed}</td>
                <td>{sale.dateSold}</td>
                <td>${sale.listedPrice.toFixed(2)}</td>
                <td>${sale.soldPrice.toFixed(2)}</td>
                <td>${sale.totalCost.toFixed(2)}</td>
                <td>{sale.platform}</td>
                <td>{sale.buyerTown}</td>
                <td>{sale.daysToSell}</td>
                <td className={sale.profit >= 0 ? 'profit' : 'loss'}>${sale.profit.toFixed(2)}</td>
                <td>{sale.roi.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
