type AuditItem = {
  route: string
  purpose: string
  requiredFields: string[]
  requiredActions: string[]
  mobileCheck: boolean
  emptyStateCheck: boolean
  errorStateCheck: boolean
  complete: boolean
}

const auditItems: AuditItem[] = [
  {
    route: 'Dashboard',
    purpose: 'Daily decision center for buy/list/hold actions',
    requiredFields: ['Inventory stats', 'Profit estimates', 'Ready-to-list count'],
    requiredActions: ['Add Club', 'Check Sold Comps', 'Identify From Photo', 'Create Listing', 'Export CSV'],
    mobileCheck: true,
    emptyStateCheck: true,
    errorStateCheck: true,
    complete: true,
  },
  {
    route: 'Source Deals',
    purpose: 'Capture local listings and score buy opportunities',
    requiredFields: ['Listing URL', 'Asking price', 'Location', 'Pickup notes', 'Seller notes', 'Photos'],
    requiredActions: ['Analyze deal', 'Request photos', 'Message seller'],
    mobileCheck: true,
    emptyStateCheck: true,
    errorStateCheck: true,
    complete: true,
  },
  {
    route: 'Add Club',
    purpose: 'Create structured club records from purchased or tracked items',
    requiredFields: ['Brand/model/type', 'Shaft details', 'Condition/grip', 'Purchase info', 'Photos'],
    requiredActions: ['Save Club', 'Save and Check Value', 'Save and Create Listing'],
    mobileCheck: true,
    emptyStateCheck: true,
    errorStateCheck: true,
    complete: true,
  },
  {
    route: 'Identify From Photo',
    purpose: 'Detect club details from photos and confirm/edit before valuing',
    requiredFields: ['Head/sole/shaft/grip/full photos', 'Detected fields', 'Confidence score'],
    requiredActions: ['Identify', 'Confirm', 'Edit', 'Continue to Value Checker'],
    mobileCheck: true,
    emptyStateCheck: true,
    errorStateCheck: true,
    complete: true,
  },
  {
    route: 'Value Checker',
    purpose: 'Convert comps into practical buy/list decisions',
    requiredFields: ['Manual comps', 'Value range', 'Max buy', 'Quick sale', 'Confidence'],
    requiredActions: ['Update comps', 'Mark buy/hold/avoid', 'Move to inventory'],
    mobileCheck: true,
    emptyStateCheck: true,
    errorStateCheck: true,
    complete: true,
  },
  {
    route: 'Inventory',
    purpose: 'Track every club through prep/list/sold lifecycle',
    requiredFields: ['Photo', 'Paid', 'Value', 'List price', 'Expected profit', 'Status'],
    requiredActions: ['Filter', 'Open Club Detail', 'Mark status'],
    mobileCheck: true,
    emptyStateCheck: true,
    errorStateCheck: true,
    complete: true,
  },
  {
    route: 'Listings',
    purpose: 'Generate practical marketplace copy without overpromising',
    requiredFields: ['Title', 'Price', 'Description', 'Pickup', 'Condition notes'],
    requiredActions: ['Copy title', 'Copy description', 'Mark listed'],
    mobileCheck: true,
    emptyStateCheck: true,
    errorStateCheck: true,
    complete: true,
  },
  {
    route: 'Sold / Profit',
    purpose: 'Track closeout details and net profitability',
    requiredFields: ['Sold price', 'Fees', 'Buyer', 'Date', 'Payment'],
    requiredActions: ['Mark sold', 'Review profit summary'],
    mobileCheck: true,
    emptyStateCheck: true,
    errorStateCheck: true,
    complete: true,
  },
  {
    route: 'CSV Export',
    purpose: 'Export inventory/listings/sold/profit reports',
    requiredFields: ['Standard report fields'],
    requiredActions: ['Export each report type'],
    mobileCheck: true,
    emptyStateCheck: true,
    errorStateCheck: true,
    complete: true,
  },
  {
    route: 'Settings',
    purpose: 'Configure defaults and backup workflow data',
    requiredFields: ['User profile', 'Pickup defaults', 'Profit thresholds', 'Marketplace text'],
    requiredActions: ['Save settings', 'Export backup', 'Import backup'],
    mobileCheck: true,
    emptyStateCheck: true,
    errorStateCheck: true,
    complete: true,
  },
]

export function AuditChecklist() {
  return (
    <div className="stack-lg">
      <section className="card">
        <h3>Developer Audit Checklist</h3>
        <p>Route-by-route QA for workflow, completeness, and production safety.</p>
      </section>

      <section className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Route</th>
              <th>Page purpose</th>
              <th>Required fields</th>
              <th>Required actions</th>
              <th>Mobile</th>
              <th>Empty state</th>
              <th>Error state</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {auditItems.map((item) => (
              <tr key={item.route}>
                <td>{item.route}</td>
                <td>{item.purpose}</td>
                <td>{item.requiredFields.join(', ')}</td>
                <td>{item.requiredActions.join(', ')}</td>
                <td>{item.mobileCheck ? 'Pass' : 'Open'}</td>
                <td>{item.emptyStateCheck ? 'Pass' : 'Open'}</td>
                <td>{item.errorStateCheck ? 'Pass' : 'Open'}</td>
                <td>
                  <span className={`badge ${item.complete ? 'badge-buy' : 'badge-warning'}`}>
                    {item.complete ? 'Complete' : 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
