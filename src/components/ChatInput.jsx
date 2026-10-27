import { Send } from 'lucide-react'
import { useState } from 'react'

// Text box + Send is always available, whether or not voice works.
export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    if (!text.trim() || disabled) return
    onSend(text)
    setText('')
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your message..."
        aria-label="Message"
        autoFocus
      />
      <button type="submit" className="btn btn--primary btn--send" disabled={disabled || !text.trim()} aria-label="Send">
        <Send size={18} aria-hidden="true" />
      </button>
    </form>
  )
}
