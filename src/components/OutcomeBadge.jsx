import { OUTCOME_LABELS } from '../format.js'

export default function OutcomeBadge({ outcome }) {
  return <span className={`badge badge--${outcome}`}>{OUTCOME_LABELS[outcome] ?? outcome}</span>
}
