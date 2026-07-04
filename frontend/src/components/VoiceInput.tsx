import { useState, useRef, useEffect, useCallback } from 'react'

interface Props {
  onTranscript: (text: string) => void
  onListeningChange?: (listening: boolean) => void
  disabled?: boolean
}

type MicState = 'idle' | 'listening' | 'denied' | 'unsupported'

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed':
    'Microphone blocked. Click the lock icon in your address bar → Site settings → set Microphone to Allow, then refresh.',
  'service-not-allowed':
    'Microphone blocked by browser. Allow microphone access for localhost in your browser settings.',
  'audio-capture': 'No microphone found. Please connect a microphone and try again.',
  'network': 'Voice recognition needs an internet connection (Chrome sends audio to Google).',
  'no-speech': 'No speech detected. Please try again and speak clearly.',
  'aborted': 'Recording was cancelled.',
}

function RecordingBars() {
  return (
    <span className="flex items-end gap-0.5 h-3" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-0.5 bg-red-500 rounded-full recording-bar"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}

export default function VoiceInput({ onTranscript, onListeningChange, disabled }: Props) {
  const [micState, setMicState] = useState<MicState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    onListeningChange?.(micState === 'listening')
  }, [micState, onListeningChange])

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMicState('unsupported')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      onTranscript(transcript)
      setMicState('idle')
      setErrorMsg('')
    }

    recognition.onerror = (event) => {
      const msg = ERROR_MESSAGES[event.error] || `Voice error: ${event.error}`
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicState('denied')
      } else {
        setMicState('idle')
      }
      setErrorMsg(msg)
    }

    recognition.onend = () => {
      setMicState((s) => (s === 'listening' ? 'idle' : s))
    }

    recognitionRef.current = recognition
    return () => {
      recognition.abort()
      stopStream()
    }
  }, [onTranscript, stopStream])

  const requestMicPermission = async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) return true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      stopStream()
      setMicState('idle')
      setErrorMsg('')
      return true
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setMicState('denied')
        setErrorMsg(ERROR_MESSAGES['not-allowed'])
      } else if (name === 'NotFoundError') {
        setErrorMsg(ERROR_MESSAGES['audio-capture'])
      } else {
        setErrorMsg('Could not access microphone. Check browser permissions.')
      }
      return false
    }
  }

  const toggle = async () => {
    if (!recognitionRef.current || disabled || micState === 'unsupported') return

    if (micState === 'listening') {
      recognitionRef.current.stop()
      setMicState('idle')
      return
    }

    const allowed = await requestMicPermission()
    if (!allowed) {
      setShowHelp(true)
      return
    }

    try {
      recognitionRef.current.start()
      setMicState('listening')
      setErrorMsg('')
      setShowHelp(false)
    } catch {
      setErrorMsg('Could not start voice recognition. Try refreshing the page.')
    }
  }

  if (micState === 'unsupported') {
    return (
      <span className="text-xs text-gray-400 px-2" title="Use Chrome or Edge for voice input">
        Voice N/A
      </span>
    )
  }

  const listening = micState === 'listening'
  const blocked = micState === 'denied'

  return (
    <div className="relative flex items-center gap-2">
      {listening && (
        <div
          className="absolute bottom-full left-0 mb-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 shadow-sm whitespace-nowrap z-10"
          role="status"
          aria-live="polite"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <RecordingBars />
          <span className="text-xs font-medium text-red-600">Recording…</span>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? 'Stop recording' : 'Start voice input'}
        title={
          blocked
            ? 'Microphone blocked — click for help'
            : listening
              ? 'Stop recording'
              : 'Start voice input'
        }
        className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 shrink-0 ${
          blocked
            ? 'bg-red-100 text-red-500 ring-2 ring-red-300'
            : listening
              ? 'bg-red-500 text-white mic-active ring-2 ring-red-300 ring-offset-2'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {blocked ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M12 9a3 3 0 00-3 3v.5a.75.75 0 01-1.5 0V12a4.5 4.5 0 019 0v.75a.75.75 0 01-1.5 0V12a3 3 0 00-3-3z" />
            <path d="M9.53 3.47a.75.75 0 00-1.06 1.06l12 12a.75.75 0 101.06-1.06l-12-12z" />
            <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
          </svg>
        ) : listening ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
            <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
          </svg>
        )}
      </button>

      {(showHelp || (errorMsg && !listening)) && (
        <div className="absolute bottom-full left-0 mb-2 w-72 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs text-gray-700">
          <p className="font-semibold text-gray-900 mb-1.5">
            {blocked ? '🎤 Microphone blocked' : 'Voice input'}
          </p>
          <p className="leading-relaxed mb-2">{errorMsg || 'Allow microphone access to use voice.'}</p>
          {blocked && (
            <ol className="list-decimal list-inside space-y-1 text-gray-600 mb-2">
              <li>Click the <strong>lock/tune icon</strong> left of the address bar</li>
              <li>Open <strong>Site settings</strong></li>
              <li>Set <strong>Microphone → Allow</strong></li>
              <li><strong>Refresh</strong> this page</li>
            </ol>
          )}
          <p className="text-gray-400">Use Chrome or Edge. Voice requires internet.</p>
          <button
            type="button"
            onClick={() => { setShowHelp(false); setErrorMsg('') }}
            className="mt-2 text-brand-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
