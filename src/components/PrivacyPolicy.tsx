interface PrivacyPolicyProps {
  legalLastUpdated: string
  legalContactEmail: string
}

function formatEffectiveDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || 'Not specified'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function PrivacyPolicy({ legalLastUpdated, legalContactEmail }: PrivacyPolicyProps) {
  const effectiveDate = legalLastUpdated || '2026-06-07'
  const contactEmail = legalContactEmail || 'owner@example.com'

  return (
    <section className="card stack-lg legal-copy">
      <h3>Privacy Policy</h3>
      <p>Effective date: {formatEffectiveDate(effectiveDate)}</p>

      <section className="stack-sm">
        <h4>1. Data You Enter</h4>
        <p>
          The app stores inventory, sourcing, settings, and sales data that you provide. In local mode,
          this data is stored in your browser and local API environment.
        </p>
      </section>

      <section className="stack-sm">
        <h4>2. How Data Is Used</h4>
        <p>
          Data is used to render app features such as valuations, sourcing workflows, and reporting. The
          app does not sell user data.
        </p>
      </section>

      <section className="stack-sm">
        <h4>3. Third-Party Services</h4>
        <p>
          Optional integrations (for example OpenAI or comp providers) may process request payloads to
          return feature results. Use of those services is subject to their own terms and privacy policies.
        </p>
      </section>

      <section className="stack-sm">
        <h4>4. Data Retention and Deletion</h4>
        <p>
          You can export backups and delete local records from the app workflows. If you deploy server
          storage, you are responsible for retention and deletion policies.
        </p>
      </section>

      <section className="stack-sm">
        <h4>5. Security Notice</h4>
        <p>
          Reasonable safeguards are used, but no system is guaranteed 100% secure. Avoid storing highly
          sensitive personal or financial information unless your deployment is hardened accordingly.
        </p>
      </section>

      <section className="stack-sm">
        <h4>6. Contact</h4>
        <p>
          For privacy requests, contact the app owner at{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </section>
    </section>
  )
}
