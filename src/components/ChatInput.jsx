import { useState } from 'react'

// TODO(step 5): mic button with listening state, interim transcript and mute toggle.
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
      <button type="submit" className="btn btn--primary" disabled={disabled || !text.trim()}>
        Send
      </button>
    </form>
  )
}
