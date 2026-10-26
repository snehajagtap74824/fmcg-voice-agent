import { formatTime } from '../format.js'

// The live chat calls the retailer "You"; saved transcripts pass retailerLabel="Retailer" and showTime.
export default function MessageBubble({ message, retailerLabel = 'You', showTime = false }) {
  return (
    <div className={`bubble bubble--${message.role}`}>
      <span className="bubble__who">
        {message.role === 'agent' ? 'Meera' : retailerLabel}
        {showTime && message.ts && <span className="bubble__time"> · {formatTime(message.ts)}</span>}
      </span>
      <p>{message.text}</p>
    </div>
  )
}
