import { useMemo, useState } from 'react'
import type { AppSettings, Lead, LeadStatus, SourceType } from '../types'
import { calculateValuation } from '../utils/valuation'

interface LeadFormProps {
  onSave: (lead: Lead, nextPage?: 'inventory' | 'lead-analyzer' | 'listings') => void
  settings: AppSettings
}

const sourceTypes: SourceType[] = [
  'Facebook Marketplace',
  'Facebook Group',
  'Garage Sale',
  'Estate Sale',
  'Craigslist',
  'Play It Again Sports',
  'Thrift Store',
  'Golf Course / Range',
  'Referral',
  'Other',
]

const itemTypes = [
  'Full bag / lot',
  'Driver',
  'Fairway wood',
  'Hybrid',
  'Iron set',
  'Single iron',
  'Wedge',
  'Putter',
  'Golf bag',
  'Accessories',
  'Mixed lot',
]

const leadStatuses: LeadStatus[] = [
  'New',
  'Research',
  'Watch',
  'Make Offer',
  'Negotiating',
  'Purchased',
  'Passed',
  'Lost',
]

function parseNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function LeadForm({ onSave, settings }: LeadFormProps) {
  const [form, setForm] = useState({
    title: '',
    sourceType: 'Facebook Marketplace' as SourceType,
    sellerName: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    town: '',
    distance: '0',
    askingPrice: '',
    pickupNotes: '',
    sellerDescription: '',
    listingUrl: '',
    itemType: 'Driver',
    brand: '',
    model: '',
    loft: '',
    shaftModel: '',
    shaftFlex: 'Unknown' as Lead['shaftFlex'],
    hand: 'Unknown' as Lead['hand'],
    condition: 'Good' as Lead['condition'],
    gripCondition: 'Unknown' as Lead['gripCondition'],
    notes: '',
    status: 'New' as LeadStatus,
  })

  const draftLead = useMemo<Lead>(() => {
    return calculateValuation({
      id: crypto.randomUUID(),
      createdAt: new Date(`${form.purchaseDate}T12:00:00`).toISOString(),
      title: form.title,
      sourceType: form.sourceType,
      sellerName: form.sellerName,
      town: form.town,
      distance: parseNumber(form.distance),
      askingPrice: parseNumber(form.askingPrice),
      sellerDescription: form.sellerDescription,
      listingUrl: form.listingUrl,
      itemType: form.itemType,
      brand: form.brand,
      model: form.model,
      loft: form.loft,
      shaftFlex: form.shaftFlex,
      hand: form.hand,
      condition: form.condition,
      gripCondition: form.gripCondition,
      notes: [
        form.notes,
        form.pickupNotes ? `Pickup/Delivery: ${form.pickupNotes}` : '',
        form.shaftModel ? `Shaft model: ${form.shaftModel}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      status: form.status,
      ebayLow: 0,
      ebayAverage: 0,
      ebayHigh: 0,
      pgaValue: 0,
      retailUsedValue: 0,
      facebookEstimate: 0,
      manualEstimate: parseNumber(form.askingPrice) * 1.8,
      cleaningCost: settings.defaultCleaningCost,
      gripCost: settings.defaultGripReplacementCost,
      travelCost: settings.defaultTravelCost,
      conservativeResale: 0,
      fastSalePrice: 0,
      maxSafeOffer: 0,
      repairAdjustedMaxOffer: 0,
      expectedProfit: 0,
      roi: 0,
      dealGrade: 'F',
      recommendation: 'WATCH',
      redFlags: [],
    })
  }, [form, settings])

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function saveWith(nextPage: 'inventory' | 'lead-analyzer' | 'listings') {
    if (!form.title.trim()) return
    onSave(draftLead, nextPage)
    setForm({
      title: '',
      sourceType: 'Facebook Marketplace',
      sellerName: '',
      purchaseDate: new Date().toISOString().slice(0, 10),
      town: '',
      distance: '0',
      askingPrice: '',
      pickupNotes: '',
      sellerDescription: '',
      listingUrl: '',
      itemType: 'Driver',
      brand: '',
      model: '',
      loft: '',
      shaftModel: '',
      shaftFlex: 'Unknown',
      hand: 'Unknown',
      condition: 'Good',
      gripCondition: 'Unknown',
      notes: '',
      status: 'New',
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    saveWith('inventory')
  }

  return (
    <form className="stack-lg" onSubmit={handleSubmit}>
      <section className="card form-grid">
        <h3>Add Club</h3>
        <label>
          Listing title
          <input value={form.title} onChange={(e) => updateField('title', e.target.value)} required />
        </label>
        <label>
          Source type
          <select value={form.sourceType} onChange={(e) => updateField('sourceType', e.target.value as SourceType)}>
            {sourceTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          Seller name
          <input value={form.sellerName} onChange={(e) => updateField('sellerName', e.target.value)} />
        </label>
        <label>
          Purchase date
          <input type="date" value={form.purchaseDate} onChange={(e) => updateField('purchaseDate', e.target.value)} />
        </label>
        <label>
          Location
          <input value={form.town} onChange={(e) => updateField('town', e.target.value)} />
        </label>
        <label>
          Distance from me
          <input type="number" value={form.distance} onChange={(e) => updateField('distance', e.target.value)} />
        </label>
        <label>
          Purchase price
          <input type="number" value={form.askingPrice} onChange={(e) => updateField('askingPrice', e.target.value)} />
        </label>
        <label className="span-2">
          Pickup / delivery notes
          <input value={form.pickupNotes} onChange={(e) => updateField('pickupNotes', e.target.value)} />
        </label>
        <label className="span-2">
          Seller notes
          <textarea value={form.sellerDescription} onChange={(e) => updateField('sellerDescription', e.target.value)} rows={3} />
        </label>
        <label className="span-2">
          Link to listing
          <input value={form.listingUrl} onChange={(e) => updateField('listingUrl', e.target.value)} />
        </label>
        <label className="span-2">Photos
          <input type="file" accept="image/*" multiple />
        </label>
      </section>

      <section className="card form-grid">
        <h3>Club Details</h3>
        <label>
          Item type
          <select value={form.itemType} onChange={(e) => updateField('itemType', e.target.value)}>
            {itemTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          Brand
          <input value={form.brand} onChange={(e) => updateField('brand', e.target.value)} />
        </label>
        <label>
          Model
          <input value={form.model} onChange={(e) => updateField('model', e.target.value)} />
        </label>
        <label>
          Loft
          <input value={form.loft} onChange={(e) => updateField('loft', e.target.value)} />
        </label>
        <label>
          Shaft flex
          <select value={form.shaftFlex} onChange={(e) => updateField('shaftFlex', e.target.value as Lead['shaftFlex'])}>
            {['Regular', 'Stiff', 'Senior', 'Ladies', 'Extra Stiff', 'Unknown'].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          Shaft brand / model
          <input value={form.shaftModel} onChange={(e) => updateField('shaftModel', e.target.value)} placeholder="Project X HZRDUS" />
        </label>
        <label>
          Hand
          <select value={form.hand} onChange={(e) => updateField('hand', e.target.value as Lead['hand'])}>
            {['Right', 'Left', 'Unknown'].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          Condition
          <select value={form.condition} onChange={(e) => updateField('condition', e.target.value as Lead['condition'])}>
            {['Excellent', 'Very Good', 'Good', 'Fair', 'Poor', 'Damaged'].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          Grip condition
          <select
            value={form.gripCondition}
            onChange={(e) => updateField('gripCondition', e.target.value as Lead['gripCondition'])}
          >
            {['Good', 'Usable', 'Needs replacement', 'Unknown'].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={form.status} onChange={(e) => updateField('status', e.target.value as LeadStatus)}>
            {leadStatuses.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="span-2">
          Notes
          <textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={4} />
        </label>
      </section>

      <section className="card stat-row">
        <div>
          <h4>Quick estimated resale</h4>
          <strong>${draftLead.conservativeResale.toFixed(2)}</strong>
        </div>
        <div>
          <h4>Estimated profit</h4>
          <strong className={draftLead.expectedProfit >= 0 ? 'profit' : 'loss'}>
            ${draftLead.expectedProfit.toFixed(2)}
          </strong>
        </div>
        <div>
          <h4>Estimated ROI</h4>
          <strong>{draftLead.roi.toFixed(1)}%</strong>
        </div>
      </section>

      <section className="row-wrap">
        <button className="btn btn-success" type="button" onClick={() => saveWith('inventory')}>
          Save Club
        </button>
        <button className="btn btn-primary" type="button" onClick={() => saveWith('lead-analyzer')}>
          Save and Check Value
        </button>
        <button className="btn" type="button" onClick={() => saveWith('listings')}>
          Save and Create Listing
        </button>
      </section>
    </form>
  )
}
