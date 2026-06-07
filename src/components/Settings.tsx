import { useState } from 'react'
import type { AppSettings } from '../types'

interface SettingsProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

export function Settings({ settings, onSave }: SettingsProps) {
  const [draft, setDraft] = useState(settings)

  function setNumber<K extends keyof AppSettings>(key: K, value: string) {
    const parsed = Number(value)
    setDraft((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? parsed : 0 }))
  }

  return (
    <section className="card form-grid">
      <h3>Settings</h3>
      <label>
        Default location
        <input
          value={draft.defaultLocation}
          onChange={(e) => setDraft((prev) => ({ ...prev, defaultLocation: e.target.value }))}
        />
      </label>
      <label>
        Default resale discount
        <input
          type="number"
          value={draft.defaultResaleDiscount}
          onChange={(e) => setNumber('defaultResaleDiscount', e.target.value)}
        />
      </label>
      <label>
        Default max buy percentage
        <input
          type="number"
          value={draft.defaultMaxBuyPercentage}
          onChange={(e) => setNumber('defaultMaxBuyPercentage', e.target.value)}
        />
      </label>
      <label>
        Default fast-sale discount
        <input
          type="number"
          value={draft.defaultFastSaleDiscount}
          onChange={(e) => setNumber('defaultFastSaleDiscount', e.target.value)}
        />
      </label>
      <label>
        Default grip replacement cost
        <input
          type="number"
          value={draft.defaultGripReplacementCost}
          onChange={(e) => setNumber('defaultGripReplacementCost', e.target.value)}
        />
      </label>
      <label>
        Default cleaning cost
        <input
          type="number"
          value={draft.defaultCleaningCost}
          onChange={(e) => setNumber('defaultCleaningCost', e.target.value)}
        />
      </label>
      <label>
        Default travel cost
        <input
          type="number"
          value={draft.defaultTravelCost}
          onChange={(e) => setNumber('defaultTravelCost', e.target.value)}
        />
      </label>
      <label>
        Preferred minimum ROI
        <input
          type="number"
          value={draft.preferredMinimumRoi}
          onChange={(e) => setNumber('preferredMinimumRoi', e.target.value)}
        />
      </label>
      <label>
        Preferred minimum profit
        <input
          type="number"
          value={draft.preferredMinimumProfit}
          onChange={(e) => setNumber('preferredMinimumProfit', e.target.value)}
        />
      </label>
      <button className="btn btn-primary" onClick={() => onSave(draft)}>
        Save Settings
      </button>

      <section className="card placeholder-box span-2">
        <h4>Future Features</h4>
        <ul className="plain-list">
          <li>eBay sold comp lookup</li>
          <li>PGA Value Guide lookup</li>
          <li>Photo upload</li>
          <li>OCR club identification from photos</li>
          <li>Facebook listing export</li>
          <li>CSV export</li>
          <li>Cloud sync</li>
          <li>User login</li>
          <li>Admin dashboard</li>
        </ul>
      </section>
    </section>
  )
}
