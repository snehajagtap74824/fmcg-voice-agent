import { Bot } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getProducts } from '../api.js'
import { useConversation } from '../hooks/useConversation.js'
import { useSpeech } from '../hooks/useSpeech.js'
import CallEnded from './CallEnded.jsx'
import CapturedItems from './CapturedItems.jsx'
import ChatInput from './ChatInput.jsx'
import ChatWindow from './ChatWindow.jsx'
import CurrentRetailer from './CurrentRetailer.jsx'
import FollowUpList from './FollowUpList.jsx'
import ProductQuickReference from './ProductQuickReference.jsx'
import VoiceBar from './VoiceBar.jsx'
import VoiceToggle from './VoiceToggle.jsx'

// Wires the two hooks together: useConversation returns the agent's text, useSpeech speaks it.
// Renders the centre (chat) and right (enquiry) columns of the dashboard.
export default function ConversationScreen({ retailerId }) {
  const convo = useConversation()
  const speech = useSpeech({ lang: 'en-IN', onFinalText: handleSend })
  const startedRef = useRef(false)
  const [products, setProducts] = useState([])

  async function handleStart() {
    // Browsers may block speech before the first click, so the greeting can be text-only.
    speech.speak(await convo.start(retailerId))
  }

  // Start straight away when the page opens. The ref stops StrictMode's double effect from starting two calls.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    handleStart()
    // Reference data for the quick-reference card and item icons; the chat works without it.
    getProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSend(text) {
    speech.speak(await convo.send(text))
  }

  async function handleEnd() {
    speech.stopListening()
    speech.stopSpeaking()
    await convo.end()
  }

  function toggleListening() {
    if (speech.listening) speech.stopListening()
    else speech.startListening()
  }

  const sending = convo.status === 'sending'
  const ending = convo.status === 'ending'
  const ended = convo.status === 'ended'
  const busy = sending || ending

  let centre
  if (!convo.conversation) {
    centre = (
      <section className="card chat chat--placeholder">
        {convo.error ? (
          <>
            <p className="error">Could not start conversation: {convo.error}</p>
            <button type="button" className="btn btn--primary" onClick={handleStart}>
              Try again
            </button>
          </>
        ) : (
          <p className="muted">Connecting to the assistant...</p>
        )}
      </section>
    )
  } else if (ended) {
    centre = <CallEnded result={convo.result} onStartNew={handleStart} />
  } else {
    centre = (
      <section className="card chat">
        <header className="chat__header">
          <span className="avatar avatar--bot">
            <Bot size={20} aria-hidden="true" />
          </span>
          <div className="chat__title">
            <h2>AI Retailer Assistant</h2>
            <p>
              {speech.speaking ? 'Speaking…' : 'Ask about products, prices, schemes and stock'}
            </p>
          </div>
          {speech.ttsSupported && <VoiceToggle on={!speech.muted} onToggle={speech.toggleMute} />}
        </header>
        <ChatWindow messages={convo.messages} thinking={sending} />
        {ending && <p className="muted small chat__note">Saving the conversation and writing the summary...</p>}
        {convo.error && <p className="error chat__note">{convo.error}</p>}
        <footer className="chat__footer">
          <VoiceBar speech={speech} disabled={busy} onToggle={toggleListening} />
          <ChatInput onSend={handleSend} disabled={busy} />
        </footer>
      </section>
    )
  }

  return (
    <div className="conversation">
      <div className="conversation__centre">{centre}</div>
      <aside className="conversation__side">
        {convo.conversation && <CurrentRetailer retailer={convo.conversation.retailer} />}
        {/* One compact card until something is captured; then a card each for items and follow-ups that have content. */}
        {convo.capturedItems.length === 0 && convo.followUps.length === 0 && (
          <section className="card side-card">
            <h3>Enquiry</h3>
            <p className="muted small">Products, quantities and follow-ups you mention will appear here as you talk.</p>
          </section>
        )}
        {convo.capturedItems.length > 0 && (
          <section className="card side-card">
            <h3>Captured Items</h3>
            <CapturedItems items={convo.capturedItems} enquiryTotal={convo.enquiryTotal} products={products} />
          </section>
        )}
        {convo.followUps.length > 0 && (
          <section className="card side-card">
            <h3>Follow-ups</h3>
            <FollowUpList followUps={convo.followUps} />
          </section>
        )}
        {convo.conversation && !ended && (
          <button type="button" className="btn btn--end" onClick={handleEnd} disabled={convo.status !== 'active'}>
            {ending ? 'Saving...' : 'End Conversation'}
          </button>
        )}
        <ProductQuickReference products={products} />
      </aside>
    </div>
  )
}
