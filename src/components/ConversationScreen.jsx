import { useEffect, useRef } from 'react'
import { useConversation } from '../hooks/useConversation.js'
import CapturePanel from './CapturePanel.jsx'
import ChatInput from './ChatInput.jsx'
import ChatWindow from './ChatWindow.jsx'
import RetailerHeader from './RetailerHeader.jsx'

// TODO(step 5): add useSpeech and speak the text returned by start()/send().
export default function ConversationScreen({ retailerId }) {
  const convo = useConversation()
  const { start } = convo
  const startedRef = useRef(false)

  useEffect(() => {
    // Guard so StrictMode's double effect run does not start two conversations.
    if (startedRef.current) return
    startedRef.current = true
    start(retailerId)
  }, [retailerId, start])

  if (!convo.conversation) {
    return (
      <section className="card">
        {convo.error ? <p className="error">Could not start conversation: {convo.error}</p> : <p>Connecting...</p>}
      </section>
    )
  }

  return (
    <div className="conversation">
      <RetailerHeader retailer={convo.conversation.retailer} />
      <div className="conversation__body">
        <section className="card chat">
          <ChatWindow messages={convo.messages} thinking={convo.status === 'sending'} />
          {convo.error && <p className="error chat__error">{convo.error}</p>}
          <ChatInput onSend={convo.send} disabled={convo.status === 'sending'} />
        </section>
        <CapturePanel items={convo.capturedItems} enquiryTotal={convo.enquiryTotal} followUps={convo.followUps} />
      </div>
    </div>
  )
}
