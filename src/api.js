// Small fetch wrappers for the Express API (proxied by Vite in development).

// Longer than the server's worst case (two 15s Gemini attempts), so the server's fallback reply normally arrives first.
const REQUEST_TIMEOUT_MS = 35000

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response
  let data
  try {
    response = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      signal: controller.signal,
    })
    data = await response.json().catch(() => null)
  } catch {
    if (controller.signal.aborted) throw new Error('The assistant took too long – please try again')
    throw new Error('Cannot reach server')
  } finally {
    clearTimeout(timer)
  }

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
