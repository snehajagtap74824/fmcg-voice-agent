import { Bot, User } from 'lucide-react'
import { formatTime } from '../format.js'

// Agent messages on the left with a bot avatar, retailer messages on the right with a user icon.
export default function MessageBubble({ message, retailerLabel = 'You' }) {
  const isAgent = message.role === 'agent'
  return (
    <div className={`message message--${isAgent ? 'agent' : 'retailer'}`}>
      <span className={`avatar ${isAgent ? 'avatar--bot' : 'avatar--user'}`} aria-hidden="true">
        {isAgent ? <Bot size={16} /> : <User size={16} />}
      </span>
      <div className="message__body">
        <div className="bubble">
          <span className="sr-only">{isAgent ? 'Assistant' : retailerLabel}: </span>
          {message.text}
        </div>
        {message.ts && <time className="message__time">{formatTime(message.ts)}</time>}
      </div>
    </div>
  )
}
