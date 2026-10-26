import { useCallback, useRef, useState } from 'react'
import { sendChat, startConversation } from '../api.js'

const now = () => new Date().toISOString()

// Holds the whole conversation in the browser (the server is stateless).
// start() and send() return the agent's text so the screen can speak it.
export function useConversation() {
  const [status, setStatus] = useState('idle')
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [capturedItems, setCapturedItems] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [enquiryTotal, setEnquiryTotal] = useState(0)
  const [error, setError] = useState(null)
  const sendingRef = useRef(false)

  const start = useCallback(async (retailerId) => {
    setError(null)
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
      if (!trimmed || !conversation || sendingRef.current) return null

      sendingRef.current = true
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
        sendingRef.current = false
        setStatus('active')
      }
    },
    [conversation, messages, capturedItems, followUps],
  )

  // TODO(step 6): end(), reset() and result.

  return { status, conversation, messages, capturedItems, followUps, enquiryTotal, error, start, send }
}
