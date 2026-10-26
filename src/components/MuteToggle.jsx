// Speaker icon: with sound waves when voice is on, crossed out when muted.
export default function MuteToggle({ muted, onToggle }) {
  const label = muted ? 'Unmute voice' : 'Mute voice'
  return (
    <button
      type="button"
      className="btn btn--ghost btn--small btn--icon"
      onClick={onToggle}
      aria-pressed={muted}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3Z" />
        {muted ? (
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            d="M16 9l6 6M22 9l-6 6"
          />
        ) : (
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            d="M16 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13"
          />
        )}
      </svg>
      <span>{label}</span>
    </button>
  )
}
