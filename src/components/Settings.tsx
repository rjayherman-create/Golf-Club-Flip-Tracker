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
        Operating region
        <select
          value={draft.operatingRegion}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              operatingRegion: e.target.value as AppSettings['operatingRegion'],
            }))
          }
        >
          <option value="long-island-ny">Long Island / NYC</option>
          <option value="south-florida">South Florida</option>
        </select>
      </label>
      <label>
        User profile name
        <input value={draft.userName} onChange={(e) => setDraft((prev) => ({ ...prev, userName: e.target.value }))} />
      </label>
      <label>
        Business name
        <input value={draft.businessName} onChange={(e) => setDraft((prev) => ({ ...prev, businessName: e.target.value }))} />
      </label>
      <label>
        Default pickup area
        <input value={draft.defaultPickupArea} onChange={(e) => setDraft((prev) => ({ ...prev, defaultPickupArea: e.target.value }))} />
      </label>
      <label>
        Default listing location
        <input value={draft.defaultListingLocation} onChange={(e) => setDraft((prev) => ({ ...prev, defaultListingLocation: e.target.value }))} />
      </label>
      <label className="span-2">
        Default marketplace text
        <textarea rows={3} value={draft.defaultMarketplaceText} onChange={(e) => setDraft((prev) => ({ ...prev, defaultMarketplaceText: e.target.value }))} />
      </label>
      <details className="span-2">
        <summary>Advanced defaults</summary>
        <div className="inline-grid">
          <label>
            Legal last updated
            <input
              type="date"
              value={draft.legalLastUpdated}
              onChange={(e) => setDraft((prev) => ({ ...prev, legalLastUpdated: e.target.value }))}
            />
          </label>
          <label>
            Legal contact email
            <input
              type="email"
              value={draft.legalContactEmail}
              onChange={(e) => setDraft((prev) => ({ ...prev, legalContactEmail: e.target.value }))}
              placeholder="legal@example.com"
            />
          </label>
          <label>
            Preferred profit margin %
            <input type="number" value={draft.preferredProfitMarginPercent} onChange={(e) => setNumber('preferredProfitMarginPercent', e.target.value)} />
          </label>
          <label>
            Default resale discount
            <input type="number" value={draft.defaultResaleDiscount} onChange={(e) => setNumber('defaultResaleDiscount', e.target.value)} />
          </label>
          <label>
            Default max buy percentage
            <input type="number" value={draft.defaultMaxBuyPercentage} onChange={(e) => setNumber('defaultMaxBuyPercentage', e.target.value)} />
          </label>
          <label>
            Default fast-sale discount
            <input type="number" value={draft.defaultFastSaleDiscount} onChange={(e) => setNumber('defaultFastSaleDiscount', e.target.value)} />
          </label>
          <label>
            Grip replacement cost
            <input type="number" value={draft.defaultGripReplacementCost} onChange={(e) => setNumber('defaultGripReplacementCost', e.target.value)} />
          </label>
          <label>
            Cleaning cost
            <input type="number" value={draft.defaultCleaningCost} onChange={(e) => setNumber('defaultCleaningCost', e.target.value)} />
          </label>
          <label>
            Travel cost
            <input type="number" value={draft.defaultTravelCost} onChange={(e) => setNumber('defaultTravelCost', e.target.value)} />
          </label>
          <label>
            Minimum ROI
            <input type="number" value={draft.preferredMinimumRoi} onChange={(e) => setNumber('preferredMinimumRoi', e.target.value)} />
          </label>
          <label>
            Minimum profit
            <input type="number" value={draft.preferredMinimumProfit} onChange={(e) => setNumber('preferredMinimumProfit', e.target.value)} />
          </label>
        </div>
      </details>
      <button className="btn btn-primary" onClick={() => onSave({ ...draft, themePreference: 'premium-navy-amber' })}>
        Save Settings
      </button>
      <div className="row-wrap span-2">
        <button
          className="btn"
          type="button"
          onClick={() => {
            const snapshot = {
              timestamp: new Date().toISOString(),
              settings: draft,
              backup: Object.fromEntries(
                Object.entries(localStorage).filter(([key]) => key.startsWith('gft.')),
              ),
            }
            const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = 'golf-flip-backup.json'
            link.click()
            URL.revokeObjectURL(url)
          }}
        >
          Export Backup
        </button>
        <label className="btn" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
          Import Backup
          <input
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              try {
                const text = await file.text()
                const parsed = JSON.parse(text) as { backup?: Record<string, string> }
                if (!parsed.backup) return
                Object.entries(parsed.backup).forEach(([key, value]) => localStorage.setItem(key, value))
                window.location.reload()
              } catch {
                // Ignore malformed backup files.
              }
            }}
          />
        </label>
      </div>

    </section>
  )
}
