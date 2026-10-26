// One short line under the input: listening state, a voice notice, or a recognition error.
export default function VoiceStatus({ sttSupported, micBlocked, listening, interimText, error }) {
  if (!sttSupported) return <p className="voice-status muted small">Voice input not supported in this browser – please use Chrome or Edge, or type</p>
  if (micBlocked) return <p className="voice-status muted small">Microphone blocked – please allow mic access or type</p>

  if (listening) {
    return (
      <p className="voice-status voice-status--listening small" role="status">
        <span className="pulse-dot" aria-hidden="true" />
        Listening…
        {interimText && <span className="voice-status__interim">{interimText}</span>}
      </p>
    )
  }

  if (error) return <p className="voice-status voice-status--error small">{error}</p>
  return null
}
