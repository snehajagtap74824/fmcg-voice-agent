import { CheckCircle2, MessageSquarePlus } from 'lucide-react'
import SummaryView from './SummaryView.jsx'

// Shown in place of the chat after End: the saved summary, or a note when there was nothing to save.
export default function CallEnded({ result, onStartNew }) {
  const startButton = (
    <button type="button" className="btn btn--primary btn--icon" onClick={onStartNew}>
      <MessageSquarePlus size={18} aria-hidden="true" /> Start new conversation
    </button>
  )

  if (!result.saved) {
    return (
      <section className="card call-ended">
        <p className="muted">Nothing to save – no messages yet.</p>
        {startButton}
      </section>
    )
  }

  return (
    <section className="card call-ended">
      <h2 className="call-ended__title">
        <CheckCircle2 size={22} aria-hidden="true" /> Conversation saved
      </h2>
      <SummaryView record={result.conversation} />
      {startButton}
    </section>
  )
}
