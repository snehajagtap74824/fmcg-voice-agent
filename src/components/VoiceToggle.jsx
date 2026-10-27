import { Volume2, VolumeX } from 'lucide-react'

// "Voice Mode" switch: on means replies are spoken (it drives the existing mute state).
export default function VoiceToggle({ on, onToggle }) {
  const Icon = on ? Volume2 : VolumeX
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`voice-toggle${on ? ' voice-toggle--on' : ''}`}
      onClick={onToggle}
      title={on ? 'Replies are spoken – click to mute' : 'Replies are muted – click to hear them'}
    >
      <Icon size={16} aria-hidden="true" />
      <span>Voice Mode</span>
      <span className="switch" aria-hidden="true">
        <span className="switch__knob" />
      </span>
    </button>
  )
}
