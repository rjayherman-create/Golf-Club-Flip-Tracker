import { useMemo, useState } from 'react'
import { buildFacebookListingText } from '../lib/clubValue'
import type {
  ClubCondition,
  ClubIdentification,
  ClubInventoryItem,
  ClubValueEstimate,
} from '../types/clubFlip'

const conditions: ClubCondition[] = ['Like New', 'Excellent', 'Very Good', 'Good', 'Fair', 'Poor']

function money(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '-'
  return `$${Math.round(value)}`
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

interface ClubFlipFeaturePanelProps {
  onConfirmToValue?: () => void
}

export function ClubFlipFeaturePanel({ onConfirmToValue }: ClubFlipFeaturePanelProps) {
  const apiBase = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:3001'
  const [photo, setPhoto] = useState<File | null>(null)
  const [headPhoto, setHeadPhoto] = useState<File | null>(null)
  const [solePhoto, setSolePhoto] = useState<File | null>(null)
  const [shaftPhoto, setShaftPhoto] = useState<File | null>(null)
  const [gripPhoto, setGripPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [identification, setIdentification] = useState<ClubIdentification | null>(null)
  const [condition, setCondition] = useState<ClubCondition>('Good')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [pickupArea, setPickupArea] = useState(import.meta.env.VITE_DEFAULT_MARKET || 'Long Island / NYC / Westchester')
  const [estimate, setEstimate] = useState<ClubValueEstimate | null>(null)
  const [links, setLinks] = useState<{ ebaySoldManualSearch?: string; pgaValueGuideSearch?: string } | null>(null)
  const [inventory, setInventory] = useState<ClubInventoryItem[]>([])
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')

  const facebookText = useMemo(() => {
    if (!identification) return { title: '', body: '' }
    return buildFacebookListingText({
      brand: identification.brand,
      model: identification.model,
      clubType: identification.clubType,
      loft: identification.loft,
      shaftBrand: identification.shaftBrand,
      shaftFlex: identification.shaftFlex,
      handedness: identification.handedness,
      condition,
      price: estimate?.recommendedListPrice || undefined,
      pickupArea,
      notes: identification.visibleNotes?.join('; '),
    })
  }, [identification, condition, estimate, pickupArea])

  function onPhotoChange(file: File | null) {
    setPhoto(file)
    setIdentification(null)
    setEstimate(null)
    setLinks(null)
    setError('')
    setPhotoPreview(file ? URL.createObjectURL(file) : '')
  }

  async function identifyClub() {
    if (!photo) {
      setError('Upload a club photo first.')
      return
    }

    setLoading('Identifying club from photo...')
    setError('')
    try {
      const photoDataUrl = await readFileAsDataUrl(photo)
      const response = await fetch(`${apiBase}/api/club-ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoDataUrl }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Identification failed')
      setIdentification(data.identification)
      setCondition(data.identification.conditionGuess || 'Good')
      if (data.warning) setError(data.warning)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identification failed')
    } finally {
      setLoading('')
    }
  }

  async function lookupComps() {
    if (!identification?.searchQuery) {
      setError('Identify the club first or enter a search query.')
      return
    }

    setLoading('Looking up sold comps...')
    setError('')
    try {
      const response = await fetch(`${apiBase}/api/club-comps?q=${encodeURIComponent(identification.searchQuery)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Comp lookup failed')
      setEstimate(data.estimate)
      setLinks(data.links)
      if (data.warning) setError(data.warning)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comp lookup failed')
    } finally {
      setLoading('')
    }
  }

  function addToInventory() {
    if (!identification) return
    const item: ClubInventoryItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      photoUrl: photoPreview,
      brand: identification.brand,
      model: identification.model,
      clubType: identification.clubType,
      loft: identification.loft,
      shaftBrand: identification.shaftBrand,
      shaftFlex: identification.shaftFlex,
      handedness: identification.handedness,
      condition,
      purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
      estimatedValue: estimate?.median || undefined,
      recommendedListPrice: estimate?.recommendedListPrice || undefined,
      source: 'Manual / Photo Upload',
      location: pickupArea,
      notes: identification.visibleNotes?.join('; '),
    }
    setInventory((prev) => [item, ...prev])
  }

  async function exportCsv() {
    const response = await fetch(`${apiBase}/api/export-csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: inventory }),
    })
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'golf-club-inventory.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function copyFacebookText() {
    await navigator.clipboard.writeText(`TITLE:\n${facebookText.title}\n\nDESCRIPTION:\n${facebookText.body}`)
  }

  return (
    <div className="stack-lg">
      <section className="hero-card">
        <h3>Identify From Photo</h3>
        <p>Upload key photos, detect club details with confidence, confirm/edit, then move into Value Checker.</p>
      </section>

      <section className="card form-grid">
        <h4>1. Photo Upload + OCR Club ID</h4>
        <label>
          Club head photo
          <input type="file" accept="image/*" onChange={(event) => setHeadPhoto(event.target.files?.[0] ?? null)} />
        </label>
        <label>
          Sole photo
          <input type="file" accept="image/*" onChange={(event) => setSolePhoto(event.target.files?.[0] ?? null)} />
        </label>
        <label>
          Shaft label photo
          <input type="file" accept="image/*" onChange={(event) => setShaftPhoto(event.target.files?.[0] ?? null)} />
        </label>
        <label>
          Grip photo
          <input type="file" accept="image/*" onChange={(event) => setGripPhoto(event.target.files?.[0] ?? null)} />
        </label>
        <label className="span-2">
          Full club photo
          <input type="file" accept="image/*" onChange={(event) => onPhotoChange(event.target.files?.[0] ?? null)} />
        </label>
        {photoPreview && (
          <div className="span-2">
            <img src={photoPreview} alt="Uploaded golf club" style={{ width: '100%', maxHeight: '340px', objectFit: 'contain', borderRadius: '12px' }} />
          </div>
        )}
        <div className="span-2 row-wrap">
          <button className="btn btn-primary" onClick={() => void identifyClub()} disabled={Boolean(loading)}>
            Identify Club
          </button>
          <span className="muted-copy">
            Uploaded: {[headPhoto, solePhoto, shaftPhoto, gripPhoto, photo].filter(Boolean).length}/5
          </span>
        </div>

        {identification && (
          <>
            <label>
              Brand
              <input value={identification.brand} readOnly />
            </label>
            <label>
              Model
              <input value={identification.model} readOnly />
            </label>
            <label>
              Type
              <input value={identification.clubType} readOnly />
            </label>
            <label>
              Confidence
              <input value={`${Math.round((identification.confidence || 0) * 100)}%`} readOnly />
            </label>
            <label>
              Condition
              <select value={condition} onChange={(event) => setCondition(event.target.value as ClubCondition)}>
                {conditions.map((entry) => (
                  <option key={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label>
              Purchase Price
              <input type="number" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} />
            </label>
            <label className="span-2">
              Comp Search Query
              <input
                value={identification.searchQuery}
                onChange={(event) => setIdentification({ ...identification, searchQuery: event.target.value })}
              />
            </label>
            <div className="span-2 row-wrap">
              <button className="btn" type="button">
                Edit Detection
              </button>
              <button className="btn btn-primary" type="button" onClick={() => onConfirmToValue?.()}>
                Confirm and Open Value Checker
              </button>
              <button className="btn btn-secondary" onClick={() => void lookupComps()} disabled={Boolean(loading)}>
                Lookup eBay Sold Comps
              </button>
            </div>
          </>
        )}

        {loading && <p className="span-2 muted-copy">{loading}</p>}
        {error && <p className="span-2 muted-copy">{error}</p>}
      </section>

      <section className="card form-grid">
        <h4>2. Value Estimate + PGA Lookup</h4>
        {estimate ? (
          <>
            <label>
              Sold Comp Count
              <input value={String(estimate.compCount)} readOnly />
            </label>
            <label>
              Median Sold
              <input value={money(estimate.median)} readOnly />
            </label>
            <label>
              Suggested List
              <input value={money(estimate.recommendedListPrice)} readOnly />
            </label>
            <label>
              Max Buy Price
              <input value={money(estimate.recommendedBuyMax)} readOnly />
            </label>
            <div className="span-2 row-wrap">
              {links?.ebaySoldManualSearch && (
                <a className="btn" href={links.ebaySoldManualSearch} target="_blank" rel="noreferrer">
                  Open eBay Sold Search
                </a>
              )}
              {links?.pgaValueGuideSearch && (
                <a className="btn" href={links.pgaValueGuideSearch} target="_blank" rel="noreferrer">
                  Open PGA Value Guide Search
                </a>
              )}
              <button className="btn btn-success" onClick={addToInventory}>
                Add to Inventory
              </button>
            </div>
          </>
        ) : (
          <p className="span-2 muted-copy">Identify a club and run sold comps to see pricing guidance.</p>
        )}
      </section>

      <section className="card form-grid">
        <h4>3. Facebook Listing Export</h4>
        <label className="span-2">
          Pickup Area
          <input value={pickupArea} onChange={(event) => setPickupArea(event.target.value)} />
        </label>
        <label className="span-2">
          Facebook Title
          <input value={facebookText.title} readOnly />
        </label>
        <label className="span-2">
          Facebook Description
          <textarea rows={8} value={facebookText.body} readOnly />
        </label>
        <div className="span-2 row-wrap">
          <button className="btn btn-secondary" onClick={() => void copyFacebookText()}>
            Copy Facebook Listing
          </button>
        </div>
      </section>

      <section className="card">
        <h4>4. Inventory + CSV Export</h4>
        <div className="row-wrap" style={{ marginBottom: '12px' }}>
          <button className="btn" onClick={() => void exportCsv()} disabled={!inventory.length}>
            Export CSV
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Club</th>
                <th>Buy</th>
                <th>List</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id}>
                  <td>{item.brand} {item.model} {item.clubType}</td>
                  <td>{money(item.purchasePrice)}</td>
                  <td>{money(item.recommendedListPrice)}</td>
                  <td>{money(item.estimatedValue)}</td>
                </tr>
              ))}
              {!inventory.length && (
                <tr>
                  <td colSpan={4}>No inventory added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
