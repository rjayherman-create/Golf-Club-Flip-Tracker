import { useMemo, useState } from 'react'
import type { Lead } from '../types'
import {
  calculateValuation,
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
        <h3>Value Checker</h3>
        <p>Add your first lead to start analyzing deals.</p>
      </section>
    )
  }

  const compSearchQuery = [selectedLead.brand, selectedLead.model, selectedLead.itemType, selectedLead.loft]
    .filter(Boolean)
    .join(' ')
    .trim()
  const ebaySoldSearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
    `${compSearchQuery || selectedLead.title} golf club`,
  )}&_sacat=0&LH_Sold=1&LH_Complete=1`
  const pgaValueGuideSearchUrl = `https://valueguide.pga.com/search-exec/brand/${encodeURIComponent(
    selectedLead.brand || selectedLead.title || 'golf',
  )}/`

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

  const valueRangeLow = Math.max(0, selectedLead.ebayLow || selectedLead.fastSalePrice)
  const valueRangeHigh = Math.max(valueRangeLow, selectedLead.ebayHigh || selectedLead.conservativeResale)
  const confidenceScore = Math.max(
    30,
    Math.min(
      100,
      [selectedLead.ebayLow, selectedLead.ebayAverage, selectedLead.ebayHigh, selectedLead.pgaValue]
        .filter((value) => value > 0).length * 20 + (selectedLead.brand ? 20 : 0),
    ),
  )
  const compCount = [
    selectedLead.ebayLow,
    selectedLead.ebayAverage,
    selectedLead.ebayHigh,
    selectedLead.pgaValue,
    selectedLead.retailUsedValue,
    selectedLead.facebookEstimate,
    selectedLead.manualEstimate,
  ].filter((value) => value > 0).length
  const confidenceStates = [
    {
      label: 'Sold comps',
      value: compCount >= 3 ? `${compCount} values entered` : compCount > 0 ? `${compCount} value entered` : 'Needs comps',
      tone: compCount >= 3 ? 'good' : compCount > 0 ? 'warning' : 'pass',
    },
    {
      label: 'Brand/model',
      value: selectedLead.brand && selectedLead.model ? 'Complete' : 'Incomplete',
      tone: selectedLead.brand && selectedLead.model ? 'good' : 'warning',
    },
    {
      label: 'Listing URL',
      value: selectedLead.listingUrl ? 'Captured' : 'Missing',
      tone: selectedLead.listingUrl ? 'good' : 'warning',
    },
    {
      label: 'Cost inputs',
      value:
        selectedLead.cleaningCost + selectedLead.gripCost + selectedLead.travelCost > 0
          ? 'Included'
          : 'No added costs',
      tone: selectedLead.cleaningCost + selectedLead.gripCost + selectedLead.travelCost > 0 ? 'good' : 'warning',
    },
    {
      label: 'Risk flags',
      value: selectedLead.redFlags.length ? `${selectedLead.redFlags.length} selected` : 'None selected',
      tone: selectedLead.redFlags.length ? 'pass' : 'good',
    },
    {
      label: 'Decision',
      value: selectedLead.recommendation,
      tone: selectedLead.recommendation === 'PASS' ? 'pass' : selectedLead.recommendation === 'WATCH' ? 'warning' : 'good',
    },
  ]

  return (
    <div className="stack-lg">
      <section className="card form-grid">
        <h3>Value Checker</h3>
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
          <p className="muted-copy">Manual comp entry drives the valuation. Use the lookup links to verify sold comps, then enter the numbers here.</p>
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
          <div className="row-wrap" style={{ marginTop: '8px' }}>
            <a className="btn" href={ebaySoldSearchUrl} target="_blank" rel="noreferrer">
              Open eBay sold search
            </a>
            <a className="btn" href={pgaValueGuideSearchUrl} target="_blank" rel="noreferrer">
              Open PGA Value Guide
            </a>
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
          <h4>Estimated resale value range</h4>
          <strong>${valueRangeLow.toFixed(2)} - ${valueRangeHigh.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Recommended Facebook list price</h4>
          <strong>${selectedLead.conservativeResale.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Maximum recommended buy price</h4>
          <strong>${selectedLead.maxSafeOffer.toFixed(2)}</strong>
        </article>
        <article className="card">
          <h4>Estimated profit</h4>
          <strong className={selectedLead.expectedProfit >= 0 ? 'profit' : 'loss'}>
            ${selectedLead.expectedProfit.toFixed(2)}
          </strong>
        </article>
        <article className="card">
          <h4>Buy/Hold/Avoid</h4>
          <span className={`badge badge-${selectedLead.recommendation.toLowerCase().replace(' ', '-')}`}>
            {selectedLead.recommendation}
          </span>
        </article>
      </section>

      <section className="card">
        <div className="row-wrap space-between">
          <div>
            <h4>Valuation Confidence</h4>
            <p className="muted-copy">Use these trust checks before making an offer. Green means usable, blue means verify, red means slow down.</p>
          </div>
          <strong>{confidenceScore}%</strong>
        </div>
        <div className="trust-grid">
          {confidenceStates.map((state) => (
            <article key={state.label} className="trust-item">
              <span className={`badge badge-${state.tone}`}>{state.label}</span>
              <strong>{state.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <details>
        <summary>Advanced risk checks</summary>
        <div className="chip-grid" style={{ marginTop: '10px' }}>
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
      </details>

      <section className="row-wrap analyzer-actions">
        <button className="btn btn-danger" onClick={() => updateLead({ status: 'Passed' })}>
          Pass
        </button>
        <button className="btn" onClick={() => updateLead({ status: 'Watch' })}>
          Watch
        </button>
        <button className="btn btn-primary" onClick={() => updateLead({ status: 'Make Offer' })}>
          Make Offer
        </button>
        <button
          className="btn btn-success"
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
        <button className="btn btn-primary" onClick={() => updateLead({ status: 'Make Offer' })}>
          Offer
        </button>
        <button
          className="btn btn-success"
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
