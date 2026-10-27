import { CalendarClock, ChevronRight, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getConversations } from '../api.js'
import { formatDateTime, formatINR } from '../format.js'
import ConversationDetail from './ConversationDetail.jsx'
import OutcomeBadge from './OutcomeBadge.jsx'

// Mounted each time the History view opens, so the list is always fresh (including a call just saved).
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
    <section className="history">
      <div className="page-head">
        <h2>Conversation History</h2>
        <p className="muted">Saved conversations, newest first. Select one to see the full details.</p>
      </div>
      {error && <p className="error">Could not load history: {error}</p>}
      {!error && !conversations && <p className="muted">Loading...</p>}
      {conversations?.length === 0 && (
        <div className="card empty">No saved conversations yet. End a conversation to see it here.</div>
      )}
      {conversations?.length > 0 && (
        <ul className="history-list">
          {conversations.map((c) => (
            <li key={c.id}>
              <button type="button" className="card history-card" onClick={() => setSelectedId(c.id)}>
                <span className="history-card__top">
                  <span className="history-card__retailer">
                    <Store size={16} aria-hidden="true" />
                    <strong>{c.retailerName}</strong>
                  </span>
                  <OutcomeBadge outcome={c.outcome} />
                </span>
                <span className="history-card__meta">
                  <span>
                    <CalendarClock size={14} aria-hidden="true" /> {formatDateTime(c.startedAt)}
                  </span>
                  <span>
                    {c.itemCount} {c.itemCount === 1 ? 'item' : 'items'} · <strong>{formatINR(c.enquiryTotal)}</strong>
                  </span>
                </span>
                <span className="history-card__summary">{c.summary}</span>
                <ChevronRight className="history-card__chevron" size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
