import { useMemo, useState } from 'react'
import type { InventoryItem } from '../types'
import { generateFacebookListing } from '../utils/valuation'

interface ListingGeneratorProps {
  inventory: InventoryItem[]
  onUpdateInventory: (item: InventoryItem) => void
}

export function ListingGenerator({ inventory, onUpdateInventory }: ListingGeneratorProps) {
  const [selectedItemId, setSelectedItemId] = useState(inventory[0]?.id ?? '')
  const selectedItem = useMemo(
    () => inventory.find((item) => item.id === selectedItemId) ?? inventory[0],
    [inventory, selectedItemId],
  )

  const [pickupLocation, setPickupLocation] = useState('Long Island, NY')
  const [defects, setDefects] = useState('')
  const [conditionNotes, setConditionNotes] = useState('')

  if (!selectedItem) {
    return (
      <section className="card">
        <h3>Listing Generator</h3>
        <p>Add inventory first to generate listing copy.</p>
      </section>
    )
  }

  const listing = generateFacebookListing({
    brand: selectedItem.brand,
    model: selectedItem.model,
    clubType: selectedItem.clubType,
    loft: selectedItem.loft || 'N/A',
    shaftFlex: selectedItem.shaftFlex,
    hand: selectedItem.hand,
    condition: selectedItem.condition,
    gripCondition: selectedItem.gripCondition,
    price: selectedItem.targetListPrice,
    defects,
    pickupLocation,
  })

  return (
    <div className="stack-lg">
      <section className="card form-grid">
        <h3>Facebook Listing Generator</h3>
        <label className="span-2">
          Inventory item
          <select value={selectedItem.id} onChange={(e) => setSelectedItemId(e.target.value)}>
            {inventory.map((item) => (
              <option key={item.id} value={item.id}>
                {item.itemName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pickup location
          <input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} />
        </label>
        <label>
          Defects
          <input value={defects} onChange={(e) => setDefects(e.target.value)} />
        </label>
        <label className="span-2">
          Condition notes
          <textarea rows={3} value={conditionNotes} onChange={(e) => setConditionNotes(e.target.value)} />
        </label>
      </section>

      <section className="card">
        <h4>Generated title</h4>
        <textarea value={listing.title} readOnly rows={2} />
      </section>

      <section className="card">
        <h4>Generated description</h4>
        <textarea value={`${listing.description}\n\n${conditionNotes}`} readOnly rows={12} />
      </section>

      <div className="row-wrap">
        <span className="badge badge-good">Listing updates automatically</span>
        <button className="btn" onClick={() => void navigator.clipboard.writeText(listing.title)}>
          Copy Title
        </button>
        <button className="btn" onClick={() => void navigator.clipboard.writeText(`${listing.description}\n\n${conditionNotes}`)}>
          Copy Description
        </button>
        <button className="btn btn-success" onClick={() => onUpdateInventory({ ...selectedItem, status: 'Listed' })}>
          Mark as Listed
        </button>
      </div>
    </div>
  )
}
