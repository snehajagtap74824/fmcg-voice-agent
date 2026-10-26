import FollowUpList from './FollowUpList.jsx'
import ItemsTable from './ItemsTable.jsx'

export default function CapturePanel({ items, enquiryTotal, followUps }) {
  return (
    <aside className="card capture-panel">
      <h3>Enquiry</h3>
      <ItemsTable items={items} enquiryTotal={enquiryTotal} />
      <h3>Follow-ups</h3>
      <FollowUpList followUps={followUps} />
      <p className="muted small">This is an enquiry, not a confirmed order.</p>
    </aside>
  )
}
