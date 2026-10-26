const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const timeFormatter = new Intl.DateTimeFormat('en-IN', { timeStyle: 'short' })

// Display only: the numbers themselves always come from the server.
export function formatINR(amount) {
  return inrFormatter.format(amount ?? 0)
}

export function formatDateTime(iso) {
  return iso ? dateTimeFormatter.format(new Date(iso)) : ''
}

export function formatTime(iso) {
  return iso ? timeFormatter.format(new Date(iso)) : ''
}

// "4 min 45 s" or "38 s".
export function formatDuration(startIso, endIso) {
  const seconds = Math.max(0, Math.round((new Date(endIso) - new Date(startIso)) / 1000))
  if (!Number.isFinite(seconds)) return ''
  const minutes = Math.floor(seconds / 60)
  return minutes > 0 ? `${minutes} min ${seconds % 60} s` : `${seconds} s`
}

export const OUTCOME_LABELS = {
  order_enquiry: 'Order enquiry',
  follow_up_required: 'Follow-up required',
  info_only: 'Info only',
  no_interest: 'No interest',
}

export const FOLLOW_UP_LABELS = {
  callback: 'Callback',
  sample_request: 'Sample request',
  credit_query: 'Credit query',
  delivery_query: 'Delivery query',
  complaint: 'Complaint',
  rep_visit: 'Rep visit',
  other: 'Other',
}
