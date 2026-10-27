import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getConversation } from '../api.js'
import { formatDateTime, formatDuration } from '../format.js'
import SummaryView from './SummaryView.jsx'
import Transcript from './Transcript.jsx'

export default function ConversationDetail({ id, onBack }) {
  const [record, setRecord] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getConversation(id)
      .then((data) => !cancelled && setRecord(data))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [id])

  const backButton = (
    <button type="button" className="btn btn--ghost btn--small btn--icon" onClick={onBack}>
      <ArrowLeft size={16} aria-hidden="true" /> Back to list
    </button>
  )

  if (error || !record) {
    return (
      <section className="card history-detail">
        {backButton}
        {error ? <p className="error">Could not load conversation: {error}</p> : <p className="muted">Loading...</p>}
      </section>
    )
  }

  return (
    <div className="history-detail">
      <section className="card">
        {backButton}
        <div className="history-detail__header">
          <h2>{record.retailerName}</h2>
          <p className="muted">
            {formatDateTime(record.startedAt)} · {formatDuration(record.startedAt, record.endedAt)}
          </p>
        </div>
        <SummaryView record={record} />
      </section>
      <section className="card">
        <h3>Transcript</h3>
        <Transcript messages={record.transcript} />
      </section>
    </div>
  )
}
