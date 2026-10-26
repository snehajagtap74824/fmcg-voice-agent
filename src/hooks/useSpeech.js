import { useCallback, useEffect, useRef, useState } from 'react'

// Detected once: browser support does not change while the page is open.
// Brave and Opera expose the API but have no speech service behind it (every attempt fails with 'network'),
// so treat them as unsupported and show the "please type" notice instead.
const noSpeechService = Boolean(navigator.brave) || /\bOPR\//.test(navigator.userAgent)
const Recognition = noSpeechService ? null : window.SpeechRecognition || window.webkitSpeechRecognition
const synth = 'speechSynthesis' in window ? window.speechSynthesis : null

const ERROR_MESSAGES = {
  'not-allowed': 'Microphone blocked – please allow mic access or type',
  'service-not-allowed': 'Microphone blocked – please allow mic access or type',
  'no-speech': "Didn't catch that – try again",
  'audio-capture': 'No microphone found – please type',
  network: 'Voice service unavailable – check your connection or use Chrome/Edge, or type',
}
const BLOCKED_ERRORS = new Set(['not-allowed', 'service-not-allowed'])

// Prefer an Indian English voice, then any English voice, then the browser default (null).
function pickVoice(voices, lang) {
  const base = lang.split('-')[0]
  return (
    voices.find((v) => v.lang.replace('_', '-') === lang) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(`${base}-`)) ||
    null
  )
}

// Voice in (SpeechRecognition) and voice out (speechSynthesis). Knows nothing about the conversation:
// final transcripts go to onFinalText, and the screen decides what to speak.
export function useSpeech({ lang = 'en-IN', onFinalText } = {}) {
  const [micBlocked, setMicBlocked] = useState(false)
  const [listening, setListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [muted, setMuted] = useState(true)
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)
  const voiceRef = useRef(null)
  const utteranceRef = useRef(null)
  const onFinalTextRef = useRef(onFinalText)
  // speak() is often called after an await, so it reads mute from a ref rather than a stale closure.
  const mutedRef = useRef(true)

  // Keep the latest callback without re-creating the recognition handlers.
  useEffect(() => {
    onFinalTextRef.current = onFinalText
  }, [onFinalText])

  // Chrome loads voices asynchronously, so pick again when the list changes.
  useEffect(() => {
    if (!synth) return
    const loadVoice = () => {
      voiceRef.current = pickVoice(synth.getVoices(), lang)
    }
    loadVoice()
    synth.addEventListener('voiceschanged', loadVoice)
    return () => synth.removeEventListener('voiceschanged', loadVoice)
  }, [lang])

  // Stop everything when the screen goes away.
  useEffect(
    () => () => {
      recognitionRef.current?.abort()
      synth?.cancel()
    },
    [],
  )

  const stopSpeaking = useCallback(() => {
    if (!synth) return
    utteranceRef.current = null
    synth.cancel()
    setSpeaking(false)
  }, [])

  const speak = useCallback(
    (text) => {
      if (!synth || mutedRef.current || !text) return
      synth.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = voiceRef.current?.lang ?? lang
      if (voiceRef.current) utterance.voice = voiceRef.current
      // cancel() fires end/error on the previous utterance, so only the current one updates state.
      const finish = () => {
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null
          setSpeaking(false)
        }
      }
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = finish
      utterance.onerror = finish
      utteranceRef.current = utterance
      synth.speak(utterance)
    },
    [lang],
  )

  const toggleMute = useCallback(() => {
    const nextMuted = !mutedRef.current
    mutedRef.current = nextMuted
    setMuted(nextMuted)
    if (nextMuted) stopSpeaking()
  }, [stopSpeaking])

  const getRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current
    const recognition = new Recognition()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) final += transcript
        else interim += transcript
      }
      setInterimText(interim)
      if (final.trim()) onFinalTextRef.current?.(final.trim())
    }
    recognition.onerror = (event) => {
      if (event.error === 'aborted') return
      if (BLOCKED_ERRORS.has(event.error)) setMicBlocked(true)
      setError(ERROR_MESSAGES[event.error] ?? 'Voice input failed – please try again or type')
    }
    recognition.onend = () => {
      setListening(false)
      setInterimText('')
    }

    recognitionRef.current = recognition
    return recognition
  }, [lang])

  const startListening = useCallback(() => {
    if (!Recognition || micBlocked || listening) return
    stopSpeaking() // a new mic input interrupts the agent
    setError(null)
    setInterimText('')
    try {
      getRecognition().start()
      setListening(true)
    } catch {
      // start() throws if recognition is already running; nothing to do.
      setError('Voice input is busy – please try again')
    }
  }, [micBlocked, listening, stopSpeaking, getRecognition])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop() // stop() still delivers the final result
  }, [])

  return {
    sttSupported: Boolean(Recognition),
    ttsSupported: Boolean(synth),
    micBlocked,
    listening,
    interimText,
    speaking,
    muted,
    error,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    toggleMute,
  }
}
