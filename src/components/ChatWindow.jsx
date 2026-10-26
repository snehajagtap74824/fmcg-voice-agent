import { useEffect, useRef } from 'react'

export default function ChatWindow({ messages, thinking }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking])

  return (
    <div className="chat-window" aria-live="polite">
      {messages.map((m, index) => (
        <div key={`${m.ts}-${index}`} className={`bubble bubble--${m.role}`}>
          <span className="bubble__who">{m.role === 'agent' ? 'Meera' : 'You'}</span>
          <p>{m.text}</p>
        </div>
      ))}
      {thinking && <div className="bubble bubble--agent bubble--thinking">Agent is thinking...</div>}
      <div ref={endRef} />
    </div>
  )
}
