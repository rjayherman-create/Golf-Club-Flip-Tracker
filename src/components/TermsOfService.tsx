interface TermsOfServiceProps {
  legalLastUpdated: string
  legalContactEmail: string
}

function formatEffectiveDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || 'Not specified'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function TermsOfService({ legalLastUpdated, legalContactEmail }: TermsOfServiceProps) {
  const effectiveDate = legalLastUpdated || '2026-06-07'
  const contactEmail = legalContactEmail || 'owner@example.com'

  return (
    <section className="card stack-lg legal-copy">
      <h3>Terms of Service</h3>
      <p>Effective date: {formatEffectiveDate(effectiveDate)}</p>

      <section className="stack-sm">
        <h4>1. Use of the App</h4>
        <p>
          Golf Flip Tracker is provided for resale planning and workflow support. You are responsible
          for all buying, selling, pricing, communication, and listing decisions.
        </p>
      </section>

      <section className="stack-sm">
        <h4>2. Estimates and No Financial Advice</h4>
        <p>
          Pricing outputs, deal scores, and profit ranges are estimates only. They do not guarantee
          resale value, profitability, authenticity, or market demand.
        </p>
      </section>

      <section className="stack-sm">
        <h4>3. Third-Party Sources</h4>
        <p>
          The app may link to third-party marketplaces and public sources. We do not control those
          sources and are not responsible for their content, availability, or policies.
        </p>
      </section>

      <section className="stack-sm">
        <h4>4. User Responsibilities</h4>
        <p>
          You agree to follow all marketplace terms, applicable laws, and local regulations. You are
          solely responsible for legal compliance, tax reporting, and transaction outcomes.
        </p>
      </section>

      <section className="stack-sm">
        <h4>5. Limitation of Liability</h4>
        <p>
          To the maximum extent permitted by law, Golf Flip Tracker is provided "as is" without
          warranties, and liability is excluded for indirect or consequential losses.
        </p>
      </section>

      <section className="stack-sm">
        <h4>6. Contact</h4>
        <p>
          For legal inquiries, contact the app owner at{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </section>
    </section>
  )
}
