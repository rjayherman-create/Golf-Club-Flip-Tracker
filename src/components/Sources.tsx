import { useState } from 'react'
import type { Source } from '../types'

interface SourcesProps {
  sources: Source[]
  onAddSource: (source: Source) => void
}

const categories = [
  'Facebook Marketplace saved search',
  'Facebook local group',
  'Estate sale company',
  'Garage sale area',
  'Golf course',
  'Driving range',
  'Thrift store',
  'Play It Again Sports',
  'Senior community',
  'Referral source',
]

export function Sources({ sources, onAddSource }: SourcesProps) {
  const [form, setForm] = useState({
    name: '',
    sourceType: categories[0],
    town: '',
    county: 'Nassau' as Source['county'],
    contactInfo: '',
    notes: '',
    qualityRating: 3,
    dealRating: 3,
    usualInventory: 'Clubs,Bags',
    status: 'Active' as Source['status'],
  })

  return (
    <div className="stack-lg">
      <section className="card form-grid">
        <h3>Source Map / Source List</h3>
        <label>
          Source name
          <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
        </label>
        <label>
          Source type
          <select
            value={form.sourceType}
            onChange={(e) => setForm((prev) => ({ ...prev, sourceType: e.target.value }))}
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Town
          <input value={form.town} onChange={(e) => setForm((prev) => ({ ...prev, town: e.target.value }))} />
        </label>
        <label>
          County
          <select
            value={form.county}
            onChange={(e) => setForm((prev) => ({ ...prev, county: e.target.value as Source['county'] }))}
          >
            {['Nassau', 'Suffolk', 'Queens', 'Brooklyn', 'Other'].map((county) => (
              <option key={county}>{county}</option>
            ))}
          </select>
        </label>
        <label>
          Contact info
          <input
            value={form.contactInfo}
            onChange={(e) => setForm((prev) => ({ ...prev, contactInfo: e.target.value }))}
          />
        </label>
        <label>
          Last checked
          <input value={new Date().toISOString().slice(0, 10)} disabled />
        </label>
        <label>
          Quality rating 1-5
          <input
            type="number"
            min={1}
            max={5}
            value={form.qualityRating}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, qualityRating: Math.max(1, Math.min(5, Number(e.target.value) || 1)) }))
            }
          />
        </label>
        <label>
          Deal rating 1-5
          <input
            type="number"
            min={1}
            max={5}
            value={form.dealRating}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, dealRating: Math.max(1, Math.min(5, Number(e.target.value) || 1)) }))
            }
          />
        </label>
        <label>
          Usual inventory (comma separated)
          <input
            value={form.usualInventory}
            onChange={(e) => setForm((prev) => ({ ...prev, usualInventory: e.target.value }))}
          />
        </label>
        <label>
          Status
          <select
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Source['status'] }))}
          >
            {['Active', 'Check weekly', 'Occasional', 'Dead source'].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label className="span-2">
          Notes
          <textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows={3} />
        </label>
        <button
          className="btn btn-primary"
          onClick={() => {
            onAddSource({
              id: crypto.randomUUID(),
              name: form.name,
              sourceType: form.sourceType,
              town: form.town,
              county: form.county,
              contactInfo: form.contactInfo,
              notes: form.notes,
              lastChecked: new Date().toISOString().slice(0, 10),
              qualityRating: form.qualityRating,
              dealRating: form.dealRating,
              usualInventory: form.usualInventory.split(',').map((part) => part.trim()),
              status: form.status,
            })
          }}
        >
          Save Source
        </button>
      </section>

      <section className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Source name</th>
              <th>Type</th>
              <th>Town</th>
              <th>County</th>
              <th>Last checked</th>
              <th>Quality</th>
              <th>Deal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>{source.name}</td>
                <td>{source.sourceType}</td>
                <td>{source.town}</td>
                <td>{source.county}</td>
                <td>{source.lastChecked}</td>
                <td>{source.qualityRating}</td>
                <td>{source.dealRating}</td>
                <td>{source.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
