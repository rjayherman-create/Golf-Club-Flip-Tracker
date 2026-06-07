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
    fees: '0',
    paymentType: 'Cash' as Sale['paymentType'],
    buyerName: '',
    platform: 'Facebook Marketplace',
    buyerTown: '',
    notes: '',
  })

  const selectedItem = useMemo(
    () => inventory.find((item) => item.id === form.inventoryItemId),
    [inventory, form.inventoryItemId],
  )

  const totalSales = sales.length
  const totalInvested = sales.reduce((sum, sale) => sum + sale.totalCost, 0)
  const totalSold = sales.reduce((sum, sale) => sum + sale.soldPrice, 0)
  const grossProfit = sales.reduce((sum, sale) => sum + sale.profit, 0)
  const netProfit = sales.reduce((sum, sale) => sum + (sale.netProfit ?? sale.profit), 0)
  const averageDays = sales.length
    ? sales.reduce((sum, sale) => sum + sale.daysToSell, 0) / sales.length
    : 0

  const worstFlip = sales.slice().sort((a, b) => (a.netProfit ?? a.profit) - (b.netProfit ?? b.profit))[0]
  const bestFlip = sales.slice().sort((a, b) => (b.netProfit ?? b.profit) - (a.netProfit ?? a.profit))[0]
  const unsoldInventoryValue = inventory
    .filter((item) => item.status !== 'Sold')
    .reduce((sum, item) => sum + item.estimatedResale, 0)

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
      fees: Number(form.fees) || 0,
      paymentType: form.paymentType,
      buyerName: form.buyerName,
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
      fees: '0',
      paymentType: 'Cash',
      buyerName: '',
      buyerTown: '',
      notes: '',
    }))
  }

  return (
    <div className="stack-lg">
      <section className="stats-grid">
        <article className="card">
          <h4>Total invested</h4>
          <strong>${totalInvested.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Total sold</h4>
          <strong>${totalSold.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Gross profit</h4>
          <strong className="profit">${grossProfit.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Net profit</h4>
          <strong className="profit">${netProfit.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Average profit per club</h4>
          <strong>${(totalSales ? netProfit / totalSales : 0).toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Best flip</h4>
          <strong>{bestFlip?.itemName ?? '-'}</strong>
        </article>
        <article className="card">
          <h4>Worst flip</h4>
          <strong>{worstFlip?.itemName ?? '-'}</strong>
        </article>
        <article className="card">
          <h4>Average days to sell</h4>
          <strong>{averageDays.toFixed(1)}</strong>
        </article>
        <article className="card">
          <h4>Unsold inventory value</h4>
          <strong>${unsoldInventoryValue.toFixed(2)}</strong>
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
            Fees
            <input
              type="number"
              value={form.fees}
              onChange={(e) => setForm((prev) => ({ ...prev, fees: e.target.value }))}
            />
          </label>
          <label>
            Payment type
            <select value={form.paymentType} onChange={(e) => setForm((prev) => ({ ...prev, paymentType: e.target.value as Sale['paymentType'] }))}>
              {['Cash', 'Zelle', 'Venmo', 'PayPal', 'Other'].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Buyer name
            <input
              value={form.buyerName}
              onChange={(e) => setForm((prev) => ({ ...prev, buyerName: e.target.value }))}
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
          <button className="btn btn-success" type="submit">
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
              <th>Fees</th>
              <th>Purchase cost</th>
              <th>Platform</th>
              <th>Payment</th>
              <th>Buyer</th>
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
                <td>${(sale.fees ?? 0).toFixed(2)}</td>
                <td>${sale.totalCost.toFixed(2)}</td>
                <td>{sale.platform}</td>
                <td>{sale.paymentType ?? '-'}</td>
                <td>{sale.buyerName ?? '-'}</td>
                <td>{sale.buyerTown}</td>
                <td>{sale.daysToSell}</td>
                <td className={(sale.netProfit ?? sale.profit) >= 0 ? 'profit' : 'loss'}>${(sale.netProfit ?? sale.profit).toFixed(2)}</td>
                <td>{sale.roi.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
