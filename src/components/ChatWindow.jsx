import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble.jsx'

export default function ChatWindow({ messages, thinking }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking])

  return (
    <div className="chat-window" aria-live="polite">
      {messages.map((m, index) => (
        <MessageBubble key={`${m.ts}-${index}`} message={m} />
      ))}
      {thinking && <div className="bubble bubble--agent bubble--thinking">Agent is thinking...</div>}
      <div ref={endRef} />
    </div>
  )
}
