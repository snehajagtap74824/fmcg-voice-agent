import { Bot } from 'lucide-react'
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
      {thinking && (
        <div className="message message--agent">
          <span className="avatar avatar--bot" aria-hidden="true">
            <Bot size={16} />
          </span>
          <div className="message__body">
            <div className="bubble bubble--thinking">
              <span className="dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="sr-only">Assistant is thinking</span>
            </div>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
