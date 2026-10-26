import FollowUpList from './FollowUpList.jsx'
import ItemsTable from './ItemsTable.jsx'
import OutcomeBadge from './OutcomeBadge.jsx'

// One saved conversation record: shown right after End and reused in the history detail view.
export default function SummaryView({ record }) {
  const unavailable = record.summaryStatus === 'unavailable'

  return (
    <div className="summary-view">
      <div className="summary-view__badges">
        <OutcomeBadge outcome={record.outcome} />
        {record.sentiment && (
          <span className={`tag sentiment sentiment--${record.sentiment}`}>Sentiment: {record.sentiment}</span>
        )}
      </div>

      <h3>Summary</h3>
      <p className={unavailable ? 'muted' : undefined}>{record.summary}</p>
      {unavailable && (
        <p className="muted small">The AI summary could not be generated. The transcript and enquiry were still saved.</p>
      )}

      <h3>Product interests</h3>
      <ItemsTable items={record.productInterests} enquiryTotal={record.enquiryTotal} emptyText="No products captured." />

      <h3>Follow-ups</h3>
      <FollowUpList followUps={record.followUps} emptyText="No follow-ups." />
    </div>
  )
}
