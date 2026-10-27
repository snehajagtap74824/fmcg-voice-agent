import { Mic, Square } from 'lucide-react'

// Voice input row: the mic button, or while listening a waveform, "Listening…" and a red stop button.
// Falls back to a short notice when voice input is unavailable; the text box below always works.
export default function VoiceBar({ speech, disabled, onToggle }) {
  if (!speech.sttSupported) {
    return <p className="voice-note">Voice input not supported in this browser – please use Chrome or Edge, or type</p>
  }
  if (speech.micBlocked) {
    return <p className="voice-note">Microphone blocked – please allow mic access or type</p>
  }

  if (speech.listening) {
    return (
      <div className="voice-bar voice-bar--listening" role="status">
        <span className="waveform" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </span>
        <div className="voice-bar__text">
          <strong>Listening…</strong>
          {speech.interimText && <span>{speech.interimText}</span>}
        </div>
        <button type="button" className="btn-round btn-round--stop" onClick={onToggle} aria-label="Stop listening">
          <Square size={16} fill="currentColor" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div className="voice-bar">
      <button
        type="button"
        className="btn-round btn-round--mic"
        onClick={onToggle}
        disabled={disabled}
        aria-label="Speak your message"
        title="Speak your message"
      >
        <Mic size={22} aria-hidden="true" />
      </button>
      <span className={speech.error ? 'voice-note voice-note--error' : 'voice-note'}>
        {speech.error ?? 'Tap the mic and speak, or type below'}
      </span>
    </div>
  )
}
