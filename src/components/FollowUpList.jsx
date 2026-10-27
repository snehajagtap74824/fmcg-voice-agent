import { CalendarClock } from 'lucide-react'
import { FOLLOW_UP_LABELS } from '../format.js'

export default function FollowUpList({ followUps, emptyText = 'No follow-ups yet.' }) {
  if (followUps.length === 0) return <p className="muted small">{emptyText}</p>

  return (
    <ul className="follow-ups">
      {followUps.map((f) => (
        <li key={`${f.type}-${f.details}`}>
          <span className="tag">{FOLLOW_UP_LABELS[f.type] ?? f.type}</span>
          <span>{f.details}</span>
          {f.dueDate && (
            <span className="follow-ups__due">
              <CalendarClock size={13} aria-hidden="true" /> Due {f.dueDate}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
