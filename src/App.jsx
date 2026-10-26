import { useState } from 'react'
import ConversationScreen from './components/ConversationScreen.jsx'
import HistoryList from './components/HistoryList.jsx'
import './App.css'

// The prototype runs as a single retailer profile: Shree Ganesh Kirana Store, Pune (server/data/retailers.json).
const RETAILER_ID = 'R001'

const TABS = [
  { id: 'conversation', label: 'Conversation' },
  { id: 'history', label: 'History' },
]

export default function App() {
  const [tab, setTab] = useState('conversation')

  return (
    <div className="app">
      <header className="app-bar">
        <h1>Retailer Voice Agent</h1>
        <span className="app-bar__sub">Enquiry assistant prototype</span>
        <nav className="app-tabs" aria-label="Main">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`app-tab${tab === t.id ? ' app-tab--active' : ''}`}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {/* Kept mounted while hidden so switching tabs never loses a conversation in progress. */}
        <div hidden={tab !== 'conversation'}>
          <ConversationScreen retailerId={RETAILER_ID} />
        </div>
        {/* Mounted on each visit so the list is re-fetched and shows the latest saved call. */}
        {tab === 'history' && <HistoryList />}
      </main>
    </div>
  )
}
