import { useMemo, useState } from 'react'
import type { InventoryItem } from '../types'
import { generateFacebookListing } from '../utils/valuation'

interface ListingGeneratorProps {
  inventory: InventoryItem[]
}

export function ListingGenerator({ inventory }: ListingGeneratorProps) {
  const [selectedItemId, setSelectedItemId] = useState(inventory[0]?.id ?? '')
  const selectedItem = useMemo(
    () => inventory.find((item) => item.id === selectedItemId) ?? inventory[0],
    [inventory, selectedItemId],
  )

  const [pickupLocation, setPickupLocation] = useState('Long Island, NY')
  const [defects, setDefects] = useState('')
  const [notes, setNotes] = useState('')

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
          Notes
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </section>

      <section className="card">
        <h4>Generated title</h4>
        <textarea value={listing.title} readOnly rows={2} />
      </section>

      <section className="card">
        <h4>Generated description</h4>
        <textarea value={`${listing.description}\n\n${notes}`} readOnly rows={12} />
      </section>

      <section className="card">
        <h4>Photo Guide</h4>
        <ol className="plain-list">
          <li>Full club</li>
          <li>Face</li>
          <li>Sole</li>
          <li>Shaft label</li>
          <li>Grip</li>
          <li>Damage if any</li>
          <li>Clean angled cover photo</li>
        </ol>
      </section>

      <div className="row-wrap">
        <button className="btn btn-primary">Generate Listing</button>
        <button className="btn">Facebook listing export placeholder</button>
      </div>
    </div>
  )
}
