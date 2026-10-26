import { useCallback, useRef, useState } from 'react'
import { endConversation, sendChat, startConversation } from '../api.js'

const now = () => new Date().toISOString()

// Holds the whole conversation in the browser (the server is stateless).
// start() and send() return the agent's text so the screen can speak it.
// status: 'idle' | 'active' | 'sending' | 'ending' | 'ended'
export function useConversation() {
  const [status, setStatus] = useState('idle')
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [capturedItems, setCapturedItems] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [enquiryTotal, setEnquiryTotal] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  // Blocks a second request (send or end) while one is in flight, including late voice results.
  const busyRef = useRef(false)

  // Also used for "Start new conversation": every piece of state is replaced.
  const start = useCallback(async (retailerId) => {
    setError(null)
    setResult(null)
    setConversation(null)
    setStatus('idle')
    busyRef.current = false
    try {
      const data = await startConversation(retailerId)
      setConversation({ id: data.conversationId, startedAt: data.startedAt, retailer: data.retailer })
      setMessages([{ role: 'agent', text: data.greeting, ts: data.startedAt, intent: 'greeting' }])
      setCapturedItems([])
      setFollowUps([])
      setEnquiryTotal(0)
      setStatus('active')
      return data.greeting
    } catch (err) {
      setError(err.message)
      return null
    }
  }, [])

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim()
      if (!trimmed || !conversation || status !== 'active' || busyRef.current) return null

      busyRef.current = true
      setError(null)
      setStatus('sending')
      const nextMessages = [...messages, { role: 'retailer', text: trimmed, ts: now() }]
      setMessages(nextMessages)

      try {
        const data = await sendChat({
          retailerId: conversation.retailer.id,
          messages: nextMessages,
          capturedItems: capturedItems.map(({ productId, quantity }) => ({ productId, quantity })),
          followUps,
        })
        setMessages([...nextMessages, { role: 'agent', text: data.reply, ts: now(), intent: data.intent }])
        setCapturedItems(data.capturedItems)
        setFollowUps(data.followUps)
        setEnquiryTotal(data.enquiryTotal)
        return data.reply
      } catch (err) {
        // The retailer's message stays in the chat so nothing typed is lost.
        setError(err.message)
        return null
      } finally {
        busyRef.current = false
        setStatus('active')
      }
    },
    [conversation, status, messages, capturedItems, followUps],
  )

  // Asks the server to summarise and save. On failure the conversation stays on screen so End can be retried.
  const end = useCallback(async () => {
    if (!conversation || status !== 'active' || busyRef.current) return

    busyRef.current = true
    setError(null)
    setStatus('ending')
    try {
      const data = await endConversation({
        conversationId: conversation.id,
        retailerId: conversation.retailer.id,
        startedAt: conversation.startedAt,
        messages,
        capturedItems: capturedItems.map(({ productId, quantity }) => ({ productId, quantity })),
        followUps,
      })
      setResult(data)
      setStatus('ended')
    } catch (err) {
      setError(`Could not end the conversation: ${err.message}. Please try again.`)
      busyRef.current = false
      setStatus('active')
    }
  }, [conversation, status, messages, capturedItems, followUps])

  return { status, conversation, messages, capturedItems, followUps, enquiryTotal, result, error, start, send, end }
}
