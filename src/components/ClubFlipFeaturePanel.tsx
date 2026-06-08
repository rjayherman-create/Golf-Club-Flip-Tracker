import { useEffect, useMemo, useState } from 'react'

type ClubCondition = 'poor' | 'fair' | 'good' | 'very_good'

type ScannedClub = {
  id: string
  brand: string
  model: string
  clubType: string
  loftOrNumber?: string
  shaft?: string
  confidence: number
  condition: ClubCondition
  estimatedLow: number
  estimatedHigh: number
  notes: string
}

type DealSummary = {
  askingPrice: number
  targetBuyPrice: number
  estimatedLotLow: number
  estimatedLotHigh: number
  estimatedBreakoutLow: number
  estimatedBreakoutHigh: number
  recommendation: 'BUY' | 'NEGOTIATE' | 'PASS'
}

type ClubOcrResponse = {
  identification?: {
    brand: string
    model: string
    clubType: string
    loft?: string
    shaftBrand?: string
    shaftFlex?: string
    handedness?: 'Right' | 'Left' | 'Unknown'
    conditionGuess?: 'New' | 'Like New' | 'Excellent' | 'Very Good' | 'Good' | 'Fair' | 'Poor'
    visibleNotes?: string[]
    confidence: number
    searchQuery: string
  }
  warning?: string
  error?: string
}

const CONDITION_LABELS: Record<ClubCondition, string> = {
  poor: 'Poor',
  fair: 'Fair',
  good: 'Good',
  very_good: 'Very Good',
}

const CLUB_VALUE_BY_TYPE: Record<string, { low: number; high: number }> = {
  driver: { low: 12, high: 28 },
  'driver / wood': { low: 10, high: 22 },
  'fairway wood': { low: 10, high: 20 },
  hybrid: { low: 12, high: 24 },
  iron: { low: 5, high: 14 },
  wedge: { low: 8, high: 18 },
  putter: { low: 8, high: 20 },
  bag: { low: 20, high: 45 },
  set: { low: 35, high: 85 },
  'iron set pieces': { low: 4, high: 10 },
  unknown: { low: 5, high: 15 },
}

function money(value: number) {
  return `$${value.toLocaleString()}`
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

const MAX_SCAN_PHOTOS = 8

function extractUrlsFromText(raw: string) {
  const matches = raw.match(/https?:\/\/[^\s<>")]+/gi) || []

  return Array.from(
    new Set(
      matches
        .map((entry) => entry.replace(/[),.;!?]+$/, '').trim())
        .filter(Boolean),
    ),
  )
}

function extractImagesFromClipboard(data: DataTransfer | null) {
  if (!data) return []

  const files: File[] = []
  Array.from(data.items || []).forEach((item, index) => {
    if (!item.type.startsWith('image/')) return
    const file = item.getAsFile()
    if (!file) return
    files.push(new File([file], file.name || `clipboard-photo-${Date.now()}-${index}.png`, { type: file.type }))
  })

  return files
}

function calculateRecommendation(
  askingPrice: number,
  estimatedLotLow: number,
  estimatedLotHigh: number,
): DealSummary['recommendation'] {
  const midpoint = (estimatedLotLow + estimatedLotHigh) / 2

  if (askingPrice <= midpoint * 0.4) return 'BUY'
  if (askingPrice <= midpoint * 0.65) return 'NEGOTIATE'
  return 'PASS'
}

function normalizeCondition(value?: string): ClubCondition {
  switch (value) {
    case 'Poor':
    case 'poor':
      return 'poor'
    case 'Fair':
    case 'fair':
      return 'fair'
    case 'Good':
    case 'good':
      return 'good'
    case 'Very Good':
    case 'very_good':
    case 'Very good':
      return 'very_good'
    default:
      return 'good'
  }
}

function estimateClubRange(clubType: string, condition: ClubCondition) {
  const key = clubType.trim().toLowerCase()
  const base = CLUB_VALUE_BY_TYPE[key] ?? CLUB_VALUE_BY_TYPE.unknown
  const conditionMultiplier = {
    poor: 0.72,
    fair: 0.88,
    good: 1,
    very_good: 1.12,
  }[condition]

  return {
    low: Math.max(1, Math.round(base.low * conditionMultiplier)),
    high: Math.max(2, Math.round(base.high * conditionMultiplier)),
  }
}

function buildScannedClub(identification: NonNullable<ClubOcrResponse['identification']>, index: number): ScannedClub {
  const condition = normalizeCondition(identification.conditionGuess)
  const estimated = estimateClubRange(identification.clubType, condition)

  return {
    id: crypto.randomUUID(),
    brand: identification.brand || 'Unknown',
    model: identification.model || `Photo ${index + 1}`,
    clubType: identification.clubType || 'Unknown',
    loftOrNumber: identification.loft || '',
    shaft:
      [identification.shaftBrand, identification.shaftFlex].filter(Boolean).join(' ') || undefined,
    confidence: Math.max(0, Math.min(100, Math.round((identification.confidence || 0) * 100))),
    condition,
    estimatedLow: estimated.low,
    estimatedHigh: estimated.high,
    notes: (identification.visibleNotes || []).join(' ') || 'AI scan result from uploaded photo.',
  }
}

type ClubFlipFeaturePanelProps = {
  onConfirmToValue?: () => void
}

export function ClubFlipFeaturePanel({ onConfirmToValue }: ClubFlipFeaturePanelProps) {
  const apiBase = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:3001'
  const [photos, setPhotos] = useState<File[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [photoLinkInput, setPhotoLinkInput] = useState('')
  const [clubs, setClubs] = useState<ScannedClub[]>([])
  const [askingPrice, setAskingPrice] = useState<number>(40)
  const [isScanning, setIsScanning] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')

  const photoPreviews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos])

  useEffect(() => {
    return () => {
      photoPreviews.forEach((src) => URL.revokeObjectURL(src))
    }
  }, [photoPreviews])

  const estimatedBreakoutLow = clubs.reduce((sum, club) => sum + club.estimatedLow, 0)
  const estimatedBreakoutHigh = clubs.reduce((sum, club) => sum + club.estimatedHigh, 0)

  const estimatedLotLow = clubs.length ? Math.round(estimatedBreakoutLow * 0.65) : 0
  const estimatedLotHigh = clubs.length ? Math.round(estimatedBreakoutHigh * 0.75) : 0

  const targetBuyPrice = clubs.length ? Math.round(estimatedLotLow * 0.45) : 0

  const recommendation = clubs.length
    ? calculateRecommendation(askingPrice, estimatedLotLow, estimatedLotHigh)
    : 'PASS'

  function resetScanState() {
    setClubs([])
    setSavedMessage('')
  }

  function appendPhotos(incoming: File[]) {
    if (!incoming.length) return

    setPhotos((current) => {
      const room = Math.max(0, MAX_SCAN_PHOTOS - (current.length + photoUrls.length))
      const next = [...current, ...incoming.slice(0, room)]
      if (!room) {
        setSavedMessage(`Photo limit reached. Keep up to ${MAX_SCAN_PHOTOS} photos total.`)
      } else if (incoming.length > room) {
        setSavedMessage(`Added ${room} photos. Maximum is ${MAX_SCAN_PHOTOS} total photos.`)
      }
      return next
    })

    resetScanState()
  }

  function appendPhotoUrls(rawText: string) {
    const links = extractUrlsFromText(rawText)
    if (!links.length) return 0

    let addedCount = 0
    setPhotoUrls((current) => {
      const deduped = links.filter((url) => !current.includes(url))
      const room = Math.max(0, MAX_SCAN_PHOTOS - (photos.length + current.length))
      const toAdd = deduped.slice(0, room)
      addedCount = toAdd.length

      if (!room) {
        setSavedMessage(`Photo limit reached. Keep up to ${MAX_SCAN_PHOTOS} photos total.`)
      } else if (deduped.length > room) {
        setSavedMessage(`Added ${room} photo links. Maximum is ${MAX_SCAN_PHOTOS} total photos.`)
      }

      return [...current, ...toAdd]
    })

    if (addedCount) resetScanState()
    return addedCount
  }

  function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    appendPhotos(files)
    event.target.value = ''
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()
    setIsDragActive(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()
    setIsDragActive(false)
  }

  function handleDropOnUpload(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()
    setIsDragActive(false)

    const droppedFiles = Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith('image/'))
    appendPhotos(droppedFiles)

    const droppedText = [event.dataTransfer.getData('text/uri-list'), event.dataTransfer.getData('text/plain')]
      .join('\n')
      .trim()

    const addedLinks = droppedText ? appendPhotoUrls(droppedText) : 0

    if (droppedFiles.length || addedLinks) {
      setSavedMessage(
        `Added ${droppedFiles.length} dropped image${droppedFiles.length === 1 ? '' : 's'}${addedLinks ? ` and ${addedLinks} photo link${addedLinks === 1 ? '' : 's'}` : ''}.`,
      )
    }
  }

  function handlePasteOnUpload(event: React.ClipboardEvent<HTMLElement>) {
    const pastedImages = extractImagesFromClipboard(event.clipboardData)
    const pastedText = event.clipboardData.getData('text')

    if (!pastedImages.length && !pastedText.trim()) return

    event.preventDefault()
    appendPhotos(pastedImages)
    const addedLinks = appendPhotoUrls(pastedText)

    if (pastedImages.length || addedLinks) {
      setSavedMessage(
        `Added ${pastedImages.length} pasted image${pastedImages.length === 1 ? '' : 's'}${addedLinks ? ` and ${addedLinks} photo link${addedLinks === 1 ? '' : 's'}` : ''}.`,
      )
    }
  }

  async function pasteFromClipboard() {
    if (!navigator.clipboard?.read) {
      setSavedMessage('Clipboard read is not supported in this browser. Use Ctrl+V in the upload area instead.')
      return
    }

    try {
      const items = await navigator.clipboard.read()
      const pastedFiles: File[] = []
      const pastedTextChunks: string[] = []

      await Promise.all(
        items.map(async (item, itemIndex) => {
          for (const type of item.types) {
            const blob = await item.getType(type)
            if (type.startsWith('image/')) {
              pastedFiles.push(
                new File([blob], `clipboard-photo-${Date.now()}-${itemIndex}.${type.split('/')[1] || 'png'}`, {
                  type,
                }),
              )
              continue
            }

            if (type === 'text/plain') {
              pastedTextChunks.push(await blob.text())
            }
          }
        }),
      )

      appendPhotos(pastedFiles)
      const addedLinks = appendPhotoUrls(pastedTextChunks.join('\n'))

      if (!pastedFiles.length && !addedLinks) {
        setSavedMessage('Clipboard did not contain an image or photo URL.')
      } else {
        setSavedMessage(
          `Added ${pastedFiles.length} image${pastedFiles.length === 1 ? '' : 's'}${addedLinks ? ` and ${addedLinks} photo link${addedLinks === 1 ? '' : 's'}` : ''} from clipboard.`,
        )
      }
    } catch (error) {
      setSavedMessage(
        error instanceof Error
          ? `Could not read clipboard: ${error.message}`
          : 'Could not read clipboard. Grant clipboard permission and try again.',
      )
    }
  }

  function handleAddPhotoLinks() {
    const added = appendPhotoUrls(photoLinkInput)
    if (!added) {
      setSavedMessage('Paste at least one image URL starting with http:// or https://.')
      return
    }

    setPhotoLinkInput('')
    setSavedMessage(`Added ${added} photo link${added === 1 ? '' : 's'}.`)
  }

  async function runDemoScan(modeLabel = 'Scan complete. Review and edit the detected clubs before saving.') {
    setIsScanning(true)
    setSavedMessage('')

    try {
      if (!photos.length && !photoUrls.length) {
        throw new Error('Upload at least one photo before scanning.')
      }

      const photoPayloads = [
        ...(await Promise.all(photos.map((photo) => readFileAsDataUrl(photo)))),
        ...photoUrls,
      ]

      const identifications = await Promise.all(
        photoPayloads.map(async (photoDataUrl) => {
          const response = await fetch(`${apiBase}/api/club-ocr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoDataUrl }),
          })
          const data = (await response.json()) as ClubOcrResponse
          if (!response.ok) throw new Error(data.error || 'Identification failed')
          return data
        }),
      )

      const nextClubs = identifications
        .map((entry, index) => {
          if (!entry.identification) return null
          return buildScannedClub(entry.identification, index)
        })
        .filter((club): club is ScannedClub => club != null)

      setClubs(nextClubs)
      setSavedMessage(
        identifications.some((entry) => entry.warning)
          ? 'Scan complete with fallback identification. Review the notes before saving.'
          : modeLabel,
      )
    } catch (error) {
      setClubs([])
      setSavedMessage(error instanceof Error ? `Scan failed: ${error.message}` : 'Scan failed. Please try again.')
    } finally {
      setIsScanning(false)
    }
  }

  function updateClub(id: string, field: keyof ScannedClub, value: string | number) {
    setClubs((current) =>
      current.map((club) =>
        club.id === id
          ? {
              ...club,
              [field]: value,
            }
          : club,
      ),
    )
  }

  function removeClub(id: string) {
    setClubs((current) => current.filter((club) => club.id !== id))
  }

  function addManualClub() {
    setClubs((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        brand: '',
        model: '',
        clubType: 'Iron',
        loftOrNumber: '',
        shaft: '',
        confidence: 100,
        condition: 'fair',
        estimatedLow: 5,
        estimatedHigh: 10,
        notes: '',
      },
    ])
  }

  function saveAnalysis() {
    const payload = {
      createdAt: new Date().toISOString(),
      askingPrice,
      targetBuyPrice,
      estimatedLotLow,
      estimatedLotHigh,
      estimatedBreakoutLow,
      estimatedBreakoutHigh,
      recommendation,
      clubs,
    }

    localStorage.setItem('latestClubPhotoScanAnalysis', JSON.stringify(payload, null, 2))
    setSavedMessage('Analysis saved to this browser. Connect this to your deals database next.')
  }

  return (
    <section className="stack-lg scan-page">
      <div className="scan-hero">
        <div>
          <p className="eyebrow">Photo Deal Scanner</p>
          <h1>Scan golf club photos into inventory and resale prices</h1>
          <p className="hero-copy">
            Upload Facebook or Craigslist listing photos, identify visible clubs, estimate individual resale
            value, and decide whether the lot is worth buying.
          </p>
        </div>

        <div className={`deal-verdict ${recommendation.toLowerCase()}`}>
          <span>Deal Verdict</span>
          <strong>{clubs.length ? recommendation : 'WAITING'}</strong>
        </div>
      </div>

      <div className="scan-grid">
        <div className="scan-card card">
          <h2>1. Upload listing photos</h2>
          <p>
            Best photos: club faces, soles, shafts, grips, bag, and full set from above.
          </p>

          <label
            className={`upload-box ${isDragActive ? 'drag-active' : ''}`}
            onPaste={handlePasteOnUpload}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropOnUpload}
          >
            <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} />
            <strong>Choose photos</strong>
            <span>Upload, paste, or drop in 1-8 images from a local listing</span>
            {isDragActive && <span className="drop-hint">Drop images or photo links to add them</span>}
          </label>

          <div className="row-wrap upload-actions">
            <button className="secondary-btn btn btn-secondary" onClick={() => void pasteFromClipboard()} type="button">
              Paste From Clipboard
            </button>
          </div>

          <label className="photo-link-field">
            Paste photo links
            <textarea
              value={photoLinkInput}
              onChange={(event) => setPhotoLinkInput(event.target.value)}
              placeholder="Paste one or more image URLs or shared listing photo links"
            />
          </label>

          <div className="row-wrap upload-actions">
            <button className="secondary-btn btn btn-secondary" onClick={handleAddPhotoLinks} type="button">
              Add Photo Links
            </button>
          </div>

          {(photoPreviews.length > 0 || photoUrls.length > 0) && (
            <div className="photo-preview-grid">
              {photoPreviews.map((src, index) => (
                <img key={src} src={src} alt={`Uploaded club photo ${index + 1}`} />
              ))}
              {photoUrls.map((src, index) => (
                <img key={src} src={src} alt={`Pasted or shared club photo link ${index + 1}`} />
              ))}
            </div>
          )}

          <button className="primary-btn btn btn-primary" onClick={() => void runDemoScan()} disabled={isScanning}>
            {isScanning ? 'Scanning photos...' : 'Scan Photos'}
          </button>

          <button className="secondary-btn btn btn-secondary" onClick={() => void runDemoScan('All bag photos scanned. Review the detected clubs before saving.')} disabled={isScanning}>
            {isScanning ? 'Scanning all bag pics...' : 'Scan All Bag Pics'}
          </button>

          <p className="helper-note">
            Use the bag scan button when you want every uploaded bag photo scanned together. Both buttons send the
            uploaded or linked photos to the server's OCR endpoint.
          </p>
        </div>

        <div className="scan-card summary-card card">
          <h2>2. Deal math</h2>

          <label className="price-input">
            Seller asking price
            <input
              type="number"
              value={askingPrice}
              onChange={(event) => setAskingPrice(Number(event.target.value))}
              min={0}
            />
          </label>

          <div className="summary-list">
            <div>
              <span>Estimated local lot value</span>
              <strong>
                {money(estimatedLotLow)} – {money(estimatedLotHigh)}
              </strong>
            </div>

            <div>
              <span>Breakout individual value</span>
              <strong>
                {money(estimatedBreakoutLow)} – {money(estimatedBreakoutHigh)}
              </strong>
            </div>

            <div>
              <span>Target buy price</span>
              <strong>{money(targetBuyPrice)}</strong>
            </div>

            <div>
              <span>Suggested listing price</span>
              <strong>{clubs.length ? money(Math.round(estimatedLotHigh * 1.15)) : '$0'}</strong>
            </div>
          </div>

          <div className="strategy-box">
            <strong>Recommended strategy</strong>
            <p>
              {recommendation === 'BUY' &&
                'Buy if the photos are accurate. Leave room for cleaning, slow-moving clubs, and negotiation.'}
              {recommendation === 'NEGOTIATE' &&
                'Only buy after negotiating down. This looks like a starter set, not a strong breakout inventory set.'}
              {recommendation === 'PASS' &&
                'Pass unless the seller drops the price or better hidden clubs are found in closer photos.'}
            </p>
          </div>

          <div className="row-wrap">
            <button className="secondary-btn btn btn-secondary" onClick={saveAnalysis} disabled={!clubs.length}>
              Save Analysis
            </button>
            <button className="btn btn-outline" onClick={() => onConfirmToValue?.()}>
              Open Value Checker
            </button>
          </div>

          {savedMessage && <p className="saved-message">{savedMessage}</p>}
        </div>
      </div>

      <div className="inventory-card card">
        <div className="inventory-header">
          <div>
            <h2>3. Scanned inventory</h2>
            <p>Edit anything the scan gets wrong before saving the deal.</p>
          </div>

          <button className="secondary-btn btn btn-secondary" onClick={addManualClub}>
            Add Manual Club
          </button>
        </div>

        {clubs.length === 0 ? (
          <div className="empty-state">
            Upload photos and press scan to generate the inventory.
          </div>
        ) : (
          <div className="inventory-table-wrap table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Club</th>
                  <th>Type</th>
                  <th># / Loft</th>
                  <th>Condition</th>
                  <th>Value</th>
                  <th>Confidence</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {clubs.map((club) => (
                  <tr key={club.id}>
                    <td>
                      <input
                        value={club.brand}
                        placeholder="Brand"
                        onChange={(event) => updateClub(club.id, 'brand', event.target.value)}
                      />
                      <input
                        value={club.model}
                        placeholder="Model"
                        onChange={(event) => updateClub(club.id, 'model', event.target.value)}
                      />
                    </td>

                    <td>
                      <input
                        value={club.clubType}
                        onChange={(event) => updateClub(club.id, 'clubType', event.target.value)}
                      />
                    </td>

                    <td>
                      <input
                        value={club.loftOrNumber || ''}
                        onChange={(event) => updateClub(club.id, 'loftOrNumber', event.target.value)}
                      />
                    </td>

                    <td>
                      <select
                        value={club.condition}
                        onChange={(event) => updateClub(club.id, 'condition', event.target.value as ClubCondition)}
                      >
                        {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <div className="value-range">
                        <input
                          type="number"
                          value={club.estimatedLow}
                          onChange={(event) => updateClub(club.id, 'estimatedLow', Number(event.target.value))}
                        />
                        <span>to</span>
                        <input
                          type="number"
                          value={club.estimatedHigh}
                          onChange={(event) => updateClub(club.id, 'estimatedHigh', Number(event.target.value))}
                        />
                      </div>
                    </td>

                    <td>
                      <span className="confidence-pill badge">{club.confidence}%</span>
                    </td>

                    <td>
                      <textarea
                        value={club.notes}
                        onChange={(event) => updateClub(club.id, 'notes', event.target.value)}
                      />
                    </td>

                    <td>
                      <button className="delete-btn btn btn-danger" onClick={() => removeClub(club.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="listing-card card">
        <h2>4. Suggested resale listing</h2>

        <div className="listing-box">
          <strong>Used Golf Club Starter Set with Cart Bag — Mixed Irons, Woods, Putter</strong>
          <p>
            Used mixed golf club starter set with cart bag. Includes woods, irons, putter, and red/black golf bag.
            Good for beginner, casual golfer, garage set, or extra backyard practice set. Clubs show normal cosmetic wear.
          </p>
          <p>
            Suggested list price: <strong>{clubs.length ? money(Math.round(estimatedLotHigh * 1.15)) : '$0'}</strong> —
            expected sale range: <strong>{money(estimatedLotLow)} – {money(estimatedLotHigh)}</strong>
          </p>
        </div>
      </div>
    </section>
  )
}
