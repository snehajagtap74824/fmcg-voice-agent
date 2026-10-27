import MessageBubble from './MessageBubble.jsx'

export default function Transcript({ messages }) {
  return (
    <div className="transcript">
      {messages.map((m, index) => (
        <MessageBubble key={`${m.ts}-${index}`} message={m} retailerLabel="Retailer" />
      ))}
    </div>
  )
}
