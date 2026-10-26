import { useState } from 'react'

// Text box + Send is always available; `mic` is the optional mic button rendered beside it.
export default function ChatInput({ onSend, disabled, mic }) {
  const [text, setText] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    if (!text.trim() || disabled) return
    onSend(text)
    setText('')
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      {mic}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your message..."
        aria-label="Message"
        autoFocus
      />
      <button type="submit" className="btn btn--primary" disabled={disabled || !text.trim()}>
        Send
      </button>
    </form>
  )
}
