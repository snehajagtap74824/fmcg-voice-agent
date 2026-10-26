import { useEffect, useRef } from 'react'
import { useConversation } from '../hooks/useConversation.js'
import { useSpeech } from '../hooks/useSpeech.js'
import CallEnded from './CallEnded.jsx'
import CapturePanel from './CapturePanel.jsx'
import ChatInput from './ChatInput.jsx'
import ChatWindow from './ChatWindow.jsx'
import MicButton from './MicButton.jsx'
import MuteToggle from './MuteToggle.jsx'
import RetailerHeader from './RetailerHeader.jsx'
import VoiceStatus from './VoiceStatus.jsx'

// Wires the two hooks together: useConversation returns the agent's text, useSpeech speaks it.
export default function ConversationScreen({ retailerId }) {
  const convo = useConversation()
  const speech = useSpeech({ lang: 'en-IN', onFinalText: handleSend })
  const startedRef = useRef(false)

  async function handleStart() {
    // Browsers may block speech before the first click, so the greeting can be text-only.
    speech.speak(await convo.start(retailerId))
  }

  // Start straight away when the page opens. The ref stops StrictMode's double effect from starting two calls.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    handleStart()
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

  if (!convo.conversation) {
    return (
      <section className="card">
        {convo.error ? (
          <>
            <p className="error">Could not start conversation: {convo.error}</p>
            <button type="button" className="btn btn--primary" onClick={handleStart}>
              Try again
            </button>
          </>
        ) : (
          <p className="muted">Connecting to Meera...</p>
        )}
      </section>
    )
  }

  const sending = convo.status === 'sending'
  const ending = convo.status === 'ending'
  const busy = sending || ending
  const micAvailable = speech.sttSupported && !speech.micBlocked

  return (
    <div className="conversation">
      <RetailerHeader retailer={convo.conversation.retailer}>
        {convo.status !== 'ended' && (
          <button type="button" className="btn btn--danger" onClick={handleEnd} disabled={convo.status !== 'active'}>
            {ending ? 'Saving...' : 'End conversation'}
          </button>
        )}
      </RetailerHeader>
      {convo.status === 'ended' ? (
        <CallEnded result={convo.result} onStartNew={handleStart} />
      ) : (
        <div className="conversation__body">
          <section className="card chat">
            <div className="chat__toolbar">
              <span className="muted small">
                Talking to Meera{speech.speaking && <span className="chat__speaking"> · speaking…</span>}
              </span>
              {speech.ttsSupported && <MuteToggle muted={speech.muted} onToggle={speech.toggleMute} />}
            </div>
            <ChatWindow messages={convo.messages} thinking={sending} />
            {ending && <p className="muted small chat__note">Saving the conversation and writing the summary...</p>}
            {convo.error && <p className="error chat__error">{convo.error}</p>}
            <ChatInput
              onSend={handleSend}
              disabled={busy}
              mic={
                micAvailable && (
                  <MicButton listening={speech.listening} disabled={busy} onToggle={toggleListening} />
                )
              }
            />
            <VoiceStatus
              sttSupported={speech.sttSupported}
              micBlocked={speech.micBlocked}
              listening={speech.listening}
              interimText={speech.interimText}
              error={speech.error}
            />
          </section>
          <CapturePanel items={convo.capturedItems} enquiryTotal={convo.enquiryTotal} followUps={convo.followUps} />
        </div>
      )}
    </div>
  )
}
