import { useEffect, useMemo, useState } from 'react'
import type { PageKey } from '../types'

type TutorialSystemProps = {
  appName: string
  activePage: PageKey
  onGoDashboard: () => void
}

type TourStep = {
  selector: string
  title: string
  message: string
}

type HelpArticle = {
  id: string
  title: string
  body: string
}

const TOUR_COMPLETED_KEY = 'gft.tourCompleted'
const ANALYTICS_KEY = 'gft.tutorial.analytics'

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour-nav="main"]',
    title: 'Main Navigation',
    message: 'This menu contains everything you need.',
  },
  {
    selector: '[data-tour-primary-action="add"]',
    title: 'Primary Action',
    message: 'Most users start here.',
  },
  {
    selector: '[data-tour-dashboard="main"]',
    title: 'Dashboard',
    message: 'This dashboard shows your most important information.',
  },
  {
    selector: '[data-tour-reports="reports"]',
    title: 'Reports',
    message: 'Reports can be downloaded, printed, or shared.',
  },
  {
    selector: '[data-tour-help="center"]',
    title: 'Help',
    message: 'Need assistance? Help is always available here.',
  },
]

const CONTEXT_HELP: Record<PageKey, { purpose: string; why: string; mistakes: string; best: string }> = {
  dashboard: {
    purpose: 'Monitor the flip pipeline and daily opportunities.',
    why: 'Use this page to decide what to source, value, and follow up on next.',
    mistakes: 'Ignoring follow-ups and buying from asking prices without comp checks.',
    best: 'Start each day by checking source leads, then quick-add any promising deals.',
  },
  terms: {
    purpose: 'Review legal terms for using the app.',
    why: 'Use this before sharing with a partner, employee, or contractor.',
    mistakes: 'Skipping legal review before team onboarding.',
    best: 'Keep contact email and legal date current in settings.',
  },
  privacy: {
    purpose: 'Understand how data is handled.',
    why: 'Use this when importing backups or handling client/team data.',
    mistakes: 'Assuming cloud sync behavior without verifying settings.',
    best: 'Export backups regularly and verify local storage/import flow.',
  },
  'analyze-loader': {
    purpose: 'Load and analyze incoming deals.',
    why: 'Use it to validate profitability before purchase.',
    mistakes: 'Submitting incomplete item details.',
    best: 'Capture model, condition, and realistic costs first.',
  },
  'saved-analyses': {
    purpose: 'Review analysis history.',
    why: 'Compare prior pricing decisions with outcomes.',
    mistakes: 'Not revisiting old analyses to tune thresholds.',
    best: 'Filter by brand/type and compare against final sale results.',
  },
  'club-flip': {
    purpose: 'Identify clubs and estimate values.',
    why: 'Use this before making an offer.',
    mistakes: 'Skipping photo verification and sold comp checks.',
    best: 'Confirm model and shaft details before adding to inventory.',
  },
  'lead-form': {
    purpose: 'Create a complete deal record quickly.',
    why: 'Use this to standardize every sourcing lead.',
    mistakes: 'Missing location, costs, or condition details.',
    best: 'Fill critical fields first, then refine with valuation data.',
  },
  'lead-analyzer': {
    purpose: 'Evaluate expected margin and risk.',
    why: 'Use this to avoid bad buys and prioritize strong opportunities.',
    mistakes: 'Overestimating resale and underestimating costs.',
    best: 'Use sold comps and realistic cleanup/repair assumptions.',
  },
  inventory: {
    purpose: 'Track purchased clubs and status.',
    why: 'Use this to move items from bought to listed to sold.',
    mistakes: 'Not updating item status after listing/sale.',
    best: 'Keep notes, storage location, and list-price updates current.',
  },
  listings: {
    purpose: 'Generate listing-ready copy.',
    why: 'Use this for faster, consistent listing creation.',
    mistakes: 'Posting without accurate condition details or photos.',
    best: 'Tailor copy to local pickup and include honest wear notes.',
  },
  sales: {
    purpose: 'Track completed sales and profit.',
    why: 'Use this to validate sourcing strategy by actual outcomes.',
    mistakes: 'Forgetting fees and pickup costs in net profit.',
    best: 'Log every sale with platform and total costs.',
  },
  'csv-export': {
    purpose: 'Export reports for sharing and bookkeeping.',
    why: 'Use this for print, accounting, and partner updates.',
    mistakes: 'Exporting outdated status data.',
    best: 'Update inventory/sales statuses before exporting.',
  },
  sources: {
    purpose: 'Manage sourcing channels.',
    why: 'Use this to focus on high-quality lead sources.',
    mistakes: 'Keeping low-performing sources enabled too long.',
    best: 'Review source performance monthly and prune weak channels.',
  },
  'value-guide': {
    purpose: 'Reference value guidance by club types/brands.',
    why: 'Use it for quick pricing sanity checks.',
    mistakes: 'Relying on guidance without checking live sold comps.',
    best: 'Treat this as a baseline, not final pricing truth.',
  },
  settings: {
    purpose: 'Control defaults, legal, and region setup.',
    why: 'Use this before expanding to new markets.',
    mistakes: 'Forgetting to switch operating region when changing market.',
    best: 'Update region first, then run source scans for the new area.',
  },
  audit: {
    purpose: 'Review app readiness and completeness.',
    why: 'Use this before rollout or deployment.',
    mistakes: 'Ignoring unresolved high-priority items.',
    best: 'Close critical findings before production pushes.',
  },
  'sourcing-radar': {
    purpose: 'Find and triage sourcing opportunities.',
    why: 'Use this for daily lead intake and follow-up planning.',
    mistakes: 'Skipping lead qualification and distance filters.',
    best: 'Prioritize strong buys and follow-ups due today first.',
  },
  'sourcing-add-facebook': {
    purpose: 'Import selected Facebook listings.',
    why: 'Use this when you have URLs ready to evaluate quickly.',
    mistakes: 'Importing without verifying listing details and photos.',
    best: 'Paste clean URLs, then review imported fields before outreach.',
  },
  'sourcing-craigslist': {
    purpose: 'Scan live source feeds for new leads.',
    why: 'Use this for periodic market sweeps.',
    mistakes: 'Running too frequently without reviewing previous results.',
    best: 'Use default cadence and manual scan when needed.',
  },
  'sourcing-lead': {
    purpose: 'Work one lead end-to-end.',
    why: 'Use this to decide buy/pass and manage messaging.',
    mistakes: 'Proceeding without photos, comps, or pickup validation.',
    best: 'Send structured outreach and schedule next follow-up immediately.',
  },
  'sourcing-settings': {
    purpose: 'Configure sourcing thresholds and zones.',
    why: 'Use this when market conditions or region changes.',
    mistakes: 'Leaving old county/zip settings after relocation.',
    best: 'Tune score and profit thresholds monthly.',
  },
}

const HELP_ARTICLES: HelpArticle[] = [
  { id: 'add-tenant', title: 'How to add a lead', body: 'Open Add Club, fill core fields, then save to analyzer or inventory.' },
  { id: 'create-report', title: 'How to create a report', body: 'Go to CSV Export and generate/share the current inventory and sales data.' },
  { id: 'compare-prices', title: 'How to compare prices', body: 'Use Value Checker with sold comps and include all cleanup/repair/travel costs.' },
  { id: 'run-test', title: 'How to run a source scan', body: 'Open Source Deals > Craigslist and run Search now for live feed results.' },
]

function readFlag(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeFlag(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore storage write errors.
  }
}

function trackTutorialEvent(event: string, payload: Record<string, unknown> = {}) {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY)
    const entries = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : []
    entries.push({ event, payload, ts: new Date().toISOString() })
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(entries.slice(-500)))
  } catch {
    // Ignore analytics storage errors.
  }
}

function useElementRect(selector: string) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!selector) {
      queueMicrotask(() => setRect(null))
      return
    }

    const update = () => {
      const target = document.querySelector(selector)
      if (!(target instanceof HTMLElement)) {
        setRect(null)
        return
      }
      target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
      setRect(target.getBoundingClientRect())
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const timer = window.setTimeout(update, 220)

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.clearTimeout(timer)
    }
  }, [selector])

  return rect
}

function TipBubble({ selector, text, storageKey }: { selector: string; text: string; storageKey: string }) {
  const [visible, setVisible] = useState(false)
  const rect = useElementRect(visible ? selector : '')

  useEffect(() => {
    const key = `gft.tip.${storageKey}.count`
    const count = Number(readFlag(key) ?? '0')
    if (count >= 3) return

    let timer: number | undefined
    const showTimer = window.setTimeout(() => {
      writeFlag(key, String(count + 1))
      setVisible(true)
      timer = window.setTimeout(() => setVisible(false), 4200)
    }, 0)

    return () => {
      window.clearTimeout(showTimer)
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [storageKey])

  if (!visible || !rect) return null

  return (
    <div
      className="hint-bubble"
      style={{
        top: Math.max(16, rect.bottom + 8),
        left: Math.max(16, Math.min(window.innerWidth - 276, rect.left)),
      }}
    >
      {text}
    </div>
  )
}

export function TutorialSystem({ appName, activePage, onGoDashboard }: TutorialSystemProps) {
  const [tourStep, setTourStep] = useState<number | null>(null)
  const [disableTour, setDisableTour] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [faqQuery, setFaqQuery] = useState('')
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')

  const tourCompleted = readFlag(TOUR_COMPLETED_KEY) === 'true'
  const showWelcome = !tourCompleted && tourStep === null

  const activeStep = tourStep != null && tourStep >= 0 && tourStep < TOUR_STEPS.length ? TOUR_STEPS[tourStep] : null
  const stepRect = useElementRect(activeStep?.selector ?? '')
  const contextual = CONTEXT_HELP[activePage] ?? CONTEXT_HELP.dashboard

  const filteredArticles = useMemo(() => {
    const query = faqQuery.trim().toLowerCase()
    if (!query) return HELP_ARTICLES
    return HELP_ARTICLES.filter((article) => `${article.title} ${article.body}`.toLowerCase().includes(query))
  }, [faqQuery])

  function startTour() {
    setTourStep(0)
    trackTutorialEvent('tour_started', { page: activePage })
  }

  function completeTour() {
    writeFlag(TOUR_COMPLETED_KEY, 'true')
    setTourStep(null)
    trackTutorialEvent('tour_completed', { page: activePage })
  }

  function skipTour() {
    if (disableTour) {
      writeFlag(TOUR_COMPLETED_KEY, 'true')
    }
    setTourStep(null)
    trackTutorialEvent('tour_skipped', { page: activePage, disableTour })
  }

  function nextTourStep() {
    if (tourStep == null) return
    if (tourStep >= TOUR_STEPS.length - 1) {
      setTourStep(TOUR_STEPS.length)
      return
    }
    setTourStep((prev) => (prev == null ? prev : prev + 1))
  }

  function submitAiQuestion() {
    const normalized = aiQuestion.trim().toLowerCase()
    if (!normalized) return

    let answer = 'I can walk you through this step-by-step. Open Source Deals, pick the action you need, and I will guide each click.'
    if (normalized.includes('add') || normalized.includes('tenant') || normalized.includes('lead')) {
      answer = 'To add a lead: open Add Club, complete title, source, asking price, and save to analyzer. Then verify comps before purchase.'
    } else if (normalized.includes('report') || normalized.includes('csv')) {
      answer = 'To create a report: open CSV Export, choose the dataset, then download or print the generated file.'
    } else if (normalized.includes('compare') || normalized.includes('price') || normalized.includes('medication')) {
      answer = 'Compare pricing by checking sold comps first, then include total basket cost (item, fees, travel, repairs) before deciding.'
    } else if (normalized.includes('test') || normalized.includes('scan')) {
      answer = 'To run a source scan: open Source Deals > Craigslist and click Search now. Review imported leads and prioritize strong buys.'
    }

    setAiAnswer(answer)
    trackTutorialEvent('ai_tutorial_question', { question: aiQuestion.slice(0, 120) })
  }

  return (
    <>
      {showWelcome && (
        <div className="tour-modal-overlay">
          <div className="tour-modal">
            <h3>Welcome to {appName}</h3>
            <p>We&apos;ll show you the basics in under 60 seconds.</p>
            <label className="tour-skip-pref">
              <input
                type="checkbox"
                checked={disableTour}
                onChange={(event) => setDisableTour(event.target.checked)}
              />
              Do not show again
            </label>
            <div className="row-wrap">
              <button className="btn btn-primary" onClick={startTour}>Start Quick Tour</button>
              <button className="btn" onClick={skipTour}>Skip Tour</button>
            </div>
          </div>
        </div>
      )}

      {activeStep && stepRect && (
        <>
          <div className="tour-dim" />
          <div
            className="tour-highlight"
            style={{
              top: Math.max(0, stepRect.top - 6),
              left: Math.max(0, stepRect.left - 6),
              width: Math.max(0, stepRect.width + 12),
              height: Math.max(0, stepRect.height + 12),
            }}
          />
          <div
            className="tour-popover"
            style={{
              top: Math.min(window.innerHeight - 180, Math.max(16, stepRect.bottom + 10)),
              left: Math.min(window.innerWidth - 320, Math.max(16, stepRect.left)),
            }}
          >
            <h4>{activeStep.title}</h4>
            <p>{activeStep.message}</p>
            <label className="tour-skip-pref">
              <input
                type="checkbox"
                checked={disableTour}
                onChange={(event) => setDisableTour(event.target.checked)}
              />
              Do not show again
            </label>
            <div className="row-wrap">
              <button className="btn btn-primary" onClick={nextTourStep}>Next</button>
              <button className="btn" onClick={skipTour}>Skip</button>
            </div>
          </div>
        </>
      )}

      {tourStep === TOUR_STEPS.length && (
        <div className="tour-modal-overlay">
          <div className="tour-modal">
            <h3>You&apos;re Ready</h3>
            <p>Let&apos;s get started.</p>
            <div className="row-wrap">
              <button
                className="btn btn-success"
                onClick={() => {
                  completeTour()
                  onGoDashboard()
                }}
              >
                Go To Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className="context-help-btn"
        data-tour-help="center"
        onClick={() => {
          setContextOpen((prev) => !prev)
          trackTutorialEvent('context_help_click', { page: activePage })
        }}
        aria-label="Page help"
      >
        ?
      </button>

      {contextOpen && (
        <div className="context-help-card">
          <h4>What does this page do?</h4>
          <p>{contextual.purpose}</p>
          <h4>Why would I use it?</h4>
          <p>{contextual.why}</p>
          <h4>Common mistakes</h4>
          <p>{contextual.mistakes}</p>
          <h4>Best practices</h4>
          <p>{contextual.best}</p>
        </div>
      )}

      <button
        type="button"
        className="help-fab"
        onClick={() => {
          setHelpOpen((prev) => !prev)
          trackTutorialEvent('help_center_toggle', { open: !helpOpen })
        }}
      >
        Help
      </button>

      {helpOpen && (
        <aside className="help-center-card">
          <h4>Help Center</h4>
          <div className="row-wrap">
            <button className="btn btn-primary" onClick={startTour}>Quick Tour</button>
          </div>

          <h5>Video Tutorials</h5>
          <div className="stack-sm">
            <a href="/tutorials/getting-started.mp4" target="_blank" rel="noreferrer">Getting Started (2-3m)</a>
            <a href="/tutorials/core-features.mp4" target="_blank" rel="noreferrer">Core Features (3-5m)</a>
            <a href="/tutorials/advanced-features.mp4" target="_blank" rel="noreferrer">Advanced Features (5-10m)</a>
            <a href="/tutorials/troubleshooting.mp4" target="_blank" rel="noreferrer">Troubleshooting (2-3m)</a>
          </div>

          <h5>Search Knowledge Base</h5>
          <input
            value={faqQuery}
            onChange={(event) => {
              setFaqQuery(event.target.value)
              trackTutorialEvent('faq_search', { query: event.target.value.slice(0, 80) })
            }}
            placeholder="What do you need help with?"
          />
          <div className="stack-sm">
            {filteredArticles.map((article) => (
              <div key={article.id} className="help-article">
                <strong>{article.title}</strong>
                <p>{article.body}</p>
              </div>
            ))}
          </div>

          <h5>AI Tutorial Mode</h5>
          <input
            value={aiQuestion}
            onChange={(event) => setAiQuestion(event.target.value)}
            placeholder="Show me how..."
          />
          <button className="btn btn-info" onClick={submitAiQuestion}>Show Me How</button>
          {aiAnswer && <p className="muted-copy">{aiAnswer}</p>}

          <h5>Support</h5>
          <div className="row-wrap">
            <button className="btn btn-outline" onClick={() => trackTutorialEvent('contact_support_click')}>Contact Support</button>
            <button className="btn btn-outline" onClick={() => trackTutorialEvent('report_problem_click')}>Report Problem</button>
          </div>
        </aside>
      )}

      <TipBubble
        selector='[data-tour-primary-action="add"]'
        text="Create a lead and run valuation quickly."
        storageKey="primary-action"
      />
      <TipBubble
        selector='[data-tour-reports="reports"]'
        text="Generate a printable/exportable report here."
        storageKey="reports"
      />
    </>
  )
}
