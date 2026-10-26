import ConversationScreen from './components/ConversationScreen.jsx'
import './App.css'

// The prototype runs as a single retailer profile: Shree Ganesh Kirana Store, Pune (server/data/retailers.json).
const RETAILER_ID = 'R001'

// TODO(step 7): add a 'history' view
export default function App() {
  return (
    <div className="app">
      <header className="app-bar">
        <h1>Retailer Voice Agent</h1>
        <span className="app-bar__sub">Enquiry assistant prototype</span>
      </header>
      <main className="app-main">
        <ConversationScreen retailerId={RETAILER_ID} />
      </main>
    </div>
  )
}
