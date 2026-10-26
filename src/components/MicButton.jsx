export default function MicButton({ listening, disabled, onToggle }) {
  const label = listening ? 'Stop listening' : 'Speak your message'
  return (
    <button
      type="button"
      className={`btn btn--mic${listening ? ' btn--mic-on' : ''}`}
      onClick={onToggle}
      disabled={disabled}
      aria-label={label}
      aria-pressed={listening}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
        />
      </svg>
      <span>{listening ? 'Stop' : 'Speak'}</span>
    </button>
  )
}
