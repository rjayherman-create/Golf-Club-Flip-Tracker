import type { InventoryItem, Sale } from '../types'

interface CsvExportProps {
  inventory: InventoryItem[]
  sales: Sale[]
}

function toCsv(headers: string[], rows: Array<Record<string, string | number>>) {
  const escape = (value: string | number) => {
    const text = String(value ?? '')
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replaceAll('"', '""')}"`
    }
    return text
  }

  const body = rows
    .map((row) => headers.map((header) => escape(row[header] ?? '')).join(','))
    .join('\n')

  return `${headers.join(',')}\n${body}`
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function CsvExport({ inventory, sales }: CsvExportProps) {
  const baseHeaders = [
    'Date Purchased',
    'Brand',
    'Model',
    'Club Type',
    'Paid',
    'Listed Price',
    'Sold Price',
    'Fees',
    'Net Profit',
    'Source',
    'Buyer',
    'Status',
    'Notes',
  ]

  function buildRows(scope: 'full' | 'active' | 'sold' | 'profit') {
    const source =
      scope === 'active'
        ? inventory.filter((item) => item.status === 'Listed' || item.status === 'Ready to List')
        : scope === 'sold'
          ? inventory.filter((item) => item.status === 'Sold')
          : inventory

    const rows = source.map((item) => {
      const sale = sales.find((entry) => entry.inventoryItemId === item.id)
      return {
        'Date Purchased': item.purchaseDate,
        Brand: item.brand,
        Model: item.model,
        'Club Type': item.clubType,
        Paid: item.totalCost.toFixed(2),
        'Listed Price': item.targetListPrice.toFixed(2),
        'Sold Price': sale ? sale.soldPrice.toFixed(2) : '',
        Fees: sale ? String((sale.fees ?? 0).toFixed(2)) : '',
        'Net Profit': sale ? String((sale.netProfit ?? sale.profit).toFixed(2)) : '',
        Source: item.source,
        Buyer: sale?.buyerName ?? '',
        Status: item.status,
        Notes: item.notes,
      }
    })

    if (scope !== 'profit') return rows

    return sales.map((sale) => {
      const item = inventory.find((entry) => entry.id === sale.inventoryItemId)
      return {
        'Date Purchased': item?.purchaseDate ?? '',
        Brand: item?.brand ?? '',
        Model: item?.model ?? '',
        'Club Type': item?.clubType ?? '',
        Paid: String(item?.totalCost?.toFixed(2) ?? ''),
        'Listed Price': sale.listedPrice.toFixed(2),
        'Sold Price': sale.soldPrice.toFixed(2),
        Fees: String((sale.fees ?? 0).toFixed(2)),
        'Net Profit': String((sale.netProfit ?? sale.profit).toFixed(2)),
        Source: item?.source ?? '',
        Buyer: sale.buyerName ?? '',
        Status: 'Sold',
        Notes: sale.notes,
      }
    })
  }

  return (
    <div className="stack-lg">
      <section className="card">
        <h3>CSV Export</h3>
        <p>Export clean reseller reports for bookkeeping, sourcing review, and monthly profit tracking.</p>
      </section>

      <section className="card">
        <h4>Export options</h4>
        <div className="row-wrap">
          <button
            className="btn btn-primary"
            onClick={() => downloadCsv('full-inventory.csv', toCsv(baseHeaders, buildRows('full')))}
          >
            Export Full Inventory
          </button>
          <button
            className="btn"
            onClick={() => downloadCsv('active-listings.csv', toCsv(baseHeaders, buildRows('active')))}
          >
            Export Active Listings
          </button>
          <button
            className="btn"
            onClick={() => downloadCsv('sold-items.csv', toCsv(baseHeaders, buildRows('sold')))}
          >
            Export Sold Items
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => downloadCsv('profit-report.csv', toCsv(baseHeaders, buildRows('profit')))}
          >
            Export Profit Report
          </button>
        </div>
      </section>

      <section className="card">
        <h4>Included CSV fields</h4>
        <p className="muted-copy">Date Purchased, Brand, Model, Club Type, Paid, Listed Price, Sold Price, Fees, Net Profit, Source, Buyer, Status, Notes.</p>
      </section>
    </div>
  )
}
