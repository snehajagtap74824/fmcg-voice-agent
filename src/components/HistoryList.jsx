import { useEffect, useState } from 'react'
import { getConversations } from '../api.js'
import { formatDateTime, formatINR } from '../format.js'
import ConversationDetail from './ConversationDetail.jsx'
import OutcomeBadge from './OutcomeBadge.jsx'

// Mounted each time the History tab opens, so the list is always fresh (including a call just saved).
export default function HistoryList() {
  const [conversations, setConversations] = useState(null)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    let cancelled = false
    getConversations()
      .then((data) => !cancelled && setConversations(data))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [])

  if (selectedId) return <ConversationDetail id={selectedId} onBack={() => setSelectedId(null)} />

  return (
    <section className="card history">
      <h2>Previous conversations</h2>
      {error && <p className="error">Could not load history: {error}</p>}
      {!error && !conversations && <p className="muted">Loading...</p>}
      {conversations?.length === 0 && <p className="muted">No saved conversations yet. End a conversation to see it here.</p>}
      {conversations?.length > 0 && (
        <ul className="history-list">
          {conversations.map((c) => (
            <li key={c.id}>
              <button type="button" className="history-row" onClick={() => setSelectedId(c.id)}>
                <span className="history-row__top">
                  <strong>{c.retailerName}</strong>
                  <span className="muted small">{formatDateTime(c.startedAt)}</span>
                  <OutcomeBadge outcome={c.outcome} />
                </span>
                <span className="history-row__summary">{c.summary}</span>
                <span className="muted small">
                  {c.itemCount} {c.itemCount === 1 ? 'item' : 'items'} · {formatINR(c.enquiryTotal)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
