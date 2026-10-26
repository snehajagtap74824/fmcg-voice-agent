// Small fetch wrappers for the Express API (proxied by Vite in development).

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error('Cannot reach server')
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return data
}

export function startConversation(retailerId) {
  return request('/conversations/start', { method: 'POST', body: JSON.stringify({ retailerId }) })
}

export function sendChat({ retailerId, messages, capturedItems, followUps }) {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({ retailerId, messages, capturedItems, followUps }),
  })
}

// Ends the call: the server summarises and saves it. Returns { saved, conversation?, reason? }.
export function endConversation({ conversationId, retailerId, startedAt, messages, capturedItems, followUps }) {
  return request('/summary', {
    method: 'POST',
    body: JSON.stringify({ conversationId, retailerId, startedAt, messages, capturedItems, followUps }),
  })
}

export function getConversations() {
  return request('/conversations')
}

export function getConversation(id) {
  return request(`/conversations/${encodeURIComponent(id)}`)
}
