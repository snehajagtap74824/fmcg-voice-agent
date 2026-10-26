const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

// Display only: the numbers themselves always come from the server.
export function formatINR(amount) {
  return inrFormatter.format(amount ?? 0)
}

// TODO(step 7): formatDateTime(), outcome labels.
