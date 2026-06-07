import { useMemo, useState } from 'react'
import type { Lead } from '../types'
import {
  calculateValuation,
  generateSellerMessage,
  getBrandScore,
} from '../utils/valuation'

interface LeadAnalyzerProps {
  leads: Lead[]
  onUpdateLead: (lead: Lead) => void
  onMoveToInventory: (lead: Lead) => void
}

const redFlagChoices = [
  'Cracked driver head',
  'Dented crown',
  'Bent shaft',
  'Loose head',
  'Missing iron set clubs',
  'Fake/counterfeit concern',
  'Seller refuses more pictures',
  'No brand/model visible',
  'Asking price higher than sold comps',
  'Bad grips on multiple clubs',
  'Too far to drive for small profit',
]

const photoChecklist = [
  'Full club photo',
  'Club face photo',
  'Sole/bottom photo',
  'Shaft label photo',
  'Grip photo',
  'Brand/model closeup',
  'Any damage photo',
  'All clubs laid out if full bag',
]

function numberValue(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function LeadAnalyzer({ leads, onUpdateLead, onMoveToInventory }: LeadAnalyzerProps) {
  const [selectedLeadId, setSelectedLeadId] = useState(leads[0]?.id ?? '')

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? leads[0],
    [leads, selectedLeadId],
  )

  if (!selectedLead) {
    return (
      <section className="card">
        <h3>Lead Analyzer</h3>
        <p>Add your first lead to start analyzing deals.</p>
      </section>
    )
  }

  const brandScore = getBrandScore(selectedLead.brand)

  function updateLead(partial: Partial<Lead>) {
    const next = calculateValuation({ ...selectedLead, ...partial })
    onUpdateLead(next)
  }

  function toggleRedFlag(flag: string) {
    const exists = selectedLead.redFlags.includes(flag)
    const nextFlags = exists
      ? selectedLead.redFlags.filter((item) => item !== flag)
      : [...selectedLead.redFlags, flag]

    updateLead({ redFlags: nextFlags })
  }

  const fullBagMessage = generateSellerMessage('fullBag')
  const initialMessage = generateSellerMessage('initial')
  const negotiationMessage = generateSellerMessage('negotiation', Math.max(1, Math.round(selectedLead.repairAdjustedMaxOffer)))
  const staleMessage = generateSellerMessage('stale', Math.max(1, Math.round(selectedLead.maxSafeOffer)))

  return (
    <div className="stack-lg">
      <section className="card form-grid">
        <h3>Lead Analyzer</h3>
        <label className="span-2">
          Select lead
          <select value={selectedLead.id} onChange={(e) => setSelectedLeadId(e.target.value)}>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.title}
              </option>
            ))}
          </select>
        </label>

        <details open>
          <summary>Seller info</summary>
          <div className="inline-grid">
            <label>
              Asking price
              <input
                type="number"
                value={selectedLead.askingPrice}
                onChange={(e) => updateLead({ askingPrice: numberValue(e.target.value) })}
              />
            </label>
            <label>
              Seller town
              <input value={selectedLead.town} onChange={(e) => updateLead({ town: e.target.value })} />
            </label>
            <label>
              Distance
              <input
                type="number"
                value={selectedLead.distance}
                onChange={(e) => updateLead({ distance: numberValue(e.target.value) })}
              />
            </label>
          </div>
        </details>

        <details open>
          <summary>Club details</summary>
          <div className="inline-grid">
            <label>
              Brand
              <input value={selectedLead.brand} onChange={(e) => updateLead({ brand: e.target.value })} />
            </label>
            <label>
              Model
              <input value={selectedLead.model} onChange={(e) => updateLead({ model: e.target.value })} />
            </label>
            <label>
              Condition
              <select
                value={selectedLead.condition}
                onChange={(e) => updateLead({ condition: e.target.value as Lead['condition'] })}
              >
                {['Excellent', 'Very Good', 'Good', 'Fair', 'Poor', 'Damaged'].map((condition) => (
                  <option key={condition}>{condition}</option>
                ))}
              </select>
            </label>
          </div>
        </details>

        <details open>
          <summary>Value comps</summary>
          <div className="inline-grid">
            <label>
              eBay sold low
              <input
                type="number"
                value={selectedLead.ebayLow}
                onChange={(e) => updateLead({ ebayLow: numberValue(e.target.value) })}
              />
            </label>
            <label>
              eBay sold average
              <input
                type="number"
                value={selectedLead.ebayAverage}
                onChange={(e) => updateLead({ ebayAverage: numberValue(e.target.value) })}
              />
            </label>
            <label>
              eBay sold high
              <input
                type="number"
                value={selectedLead.ebayHigh}
                onChange={(e) => updateLead({ ebayHigh: numberValue(e.target.value) })}
              />
            </label>
            <label>
              PGA Value Guide
              <input
                type="number"
                value={selectedLead.pgaValue}
                onChange={(e) => updateLead({ pgaValue: numberValue(e.target.value) })}
              />
            </label>
            <label>
              2nd Swing estimate
              <input
                type="number"
                value={selectedLead.retailUsedValue}
                onChange={(e) => updateLead({ retailUsedValue: numberValue(e.target.value) })}
              />
            </label>
            <label>
              Local Facebook estimate
              <input
                type="number"
                value={selectedLead.facebookEstimate}
                onChange={(e) => updateLead({ facebookEstimate: numberValue(e.target.value) })}
              />
            </label>
            <label>
              Manual estimate
              <input
                type="number"
                value={selectedLead.manualEstimate}
                onChange={(e) => updateLead({ manualEstimate: numberValue(e.target.value) })}
              />
            </label>
          </div>
        </details>

        <details open>
          <summary>Costs</summary>
          <div className="inline-grid">
            <label>
              Cleaning cost
              <input
                type="number"
                value={selectedLead.cleaningCost}
                onChange={(e) => updateLead({ cleaningCost: numberValue(e.target.value) })}
              />
            </label>
            <label>
              Grip replacement cost
              <input
                type="number"
                value={selectedLead.gripCost}
                onChange={(e) => updateLead({ gripCost: numberValue(e.target.value) })}
              />
            </label>
            <label>
              Gas/travel cost
              <input
                type="number"
                value={selectedLead.travelCost}
                onChange={(e) => updateLead({ travelCost: numberValue(e.target.value) })}
              />
            </label>
          </div>
        </details>
      </section>

      <section className="stats-grid">
        <article className="card">
          <h4>Estimated resale value</h4>
          <strong>${selectedLead.manualEstimate.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Conservative resale</h4>
          <strong>${selectedLead.conservativeResale.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Fast-sale price</h4>
          <strong>${selectedLead.fastSalePrice.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Maximum safe offer</h4>
          <strong>${selectedLead.maxSafeOffer.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Repair-adjusted max offer</h4>
          <strong>${selectedLead.repairAdjustedMaxOffer.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Estimated gross profit</h4>
          <strong className={selectedLead.expectedProfit >= 0 ? 'profit' : 'loss'}>
            ${selectedLead.expectedProfit.toFixed(2)}
          </strong>
        </article>
        <article className="card">
          <h4>Estimated ROI</h4>
          <strong>{selectedLead.roi.toFixed(1)}%</strong>
        </article>
        <article className="card">
          <h4>Deal grade</h4>
          <strong>{selectedLead.dealGrade}</strong>
        </article>
        <article className="card">
          <h4>Recommendation</h4>
          <span className={`badge badge-${selectedLead.recommendation.toLowerCase().replace(' ', '-')}`}>
            {selectedLead.recommendation}
          </span>
        </article>
        <article className="card">
          <h4>Brand score</h4>
          <strong>{brandScore}/10</strong>
        </article>
      </section>

      <section className="card">
        <h4>Red Flag System</h4>
        <div className="chip-grid">
          {redFlagChoices.map((flag) => (
            <button
              key={flag}
              type="button"
              className={`chip ${selectedLead.redFlags.includes(flag) ? 'selected red' : ''}`}
              onClick={() => toggleRedFlag(flag)}
            >
              {flag}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h4>Photo Checklist</h4>
        <div className="checklist">
          {photoChecklist.map((item) => (
            <label key={item}>
              <input type="checkbox" /> {item}
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h4>Seller Message Generator</h4>
        <div className="stack-sm">
          <textarea value={initialMessage} readOnly rows={3} />
          <textarea value={fullBagMessage} readOnly rows={2} />
          <textarea value={negotiationMessage} readOnly rows={3} />
          <textarea value={staleMessage} readOnly rows={2} />
        </div>
      </section>

      <section className="row-wrap analyzer-actions">
        <button className="btn btn-danger" onClick={() => updateLead({ status: 'Passed' })}>
          Pass
        </button>
        <button className="btn" onClick={() => updateLead({ status: 'Watch' })}>
          Watch
        </button>
        <button className="btn btn-secondary" onClick={() => updateLead({ status: 'Make Offer' })}>
          Make Offer
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            const purchased = calculateValuation({ ...selectedLead, status: 'Purchased' })
            onUpdateLead(purchased)
            onMoveToInventory(purchased)
          }}
        >
          Move to Inventory
        </button>
      </section>

      <section className="sticky-action-bar">
        <button className="btn btn-danger" onClick={() => updateLead({ status: 'Passed' })}>
          Pass
        </button>
        <button className="btn" onClick={() => updateLead({ status: 'Watch' })}>
          Watch
        </button>
        <button className="btn btn-secondary" onClick={() => updateLead({ status: 'Make Offer' })}>
          Offer
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            const purchased = calculateValuation({ ...selectedLead, status: 'Purchased' })
            onUpdateLead(purchased)
            onMoveToInventory(purchased)
          }}
        >
          Buy
        </button>
      </section>
    </div>
  )
}
