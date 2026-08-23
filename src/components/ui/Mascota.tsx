import { useEffect, useRef, useState } from 'react'
import './Mascota.css'

type Mood = 'neutro' | 'feliz' | 'enojado' | 'duda' | 'dormido' | 'guino' | 'hablando'

interface MascotaProps {
  mood?: Mood
  subtitulo?: string
}

export function Mascota({ mood = 'neutro', subtitulo = '' }: MascotaProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [localMood, setLocalMood] = useState<Mood>(mood)
  const speakQueueRef = useRef<string[]>([])
  const speakingRef = useRef(false)

  useEffect(() => { setLocalMood(mood) }, [mood])

  const getSpanishVoice = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null
    const voices = window.speechSynthesis.getVoices()
    return voices.find((v) => v.lang.startsWith('es')) ?? voices.find((v) => v.lang.startsWith('en')) ?? null
  }

  const processQueue = () => {
    if (speakingRef.current || speakQueueRef.current.length === 0) return
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    speakingRef.current = true
    const text = speakQueueRef.current.shift()!
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = getSpanishVoice()
    if (voice) utterance.voice = voice
    utterance.rate = 1
    utterance.pitch = 1.1
    utterance.onend = () => {
      speakingRef.current = false
      processQueue()
    }
    utterance.onerror = () => {
      speakingRef.current = false
      processQueue()
    }
    window.speechSynthesis.speak(utterance)
  }

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    speakQueueRef.current.push(text)
    processQueue()
  }

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height * 0.38
      const dx = (e.clientX - cx) / (rect.width || 1)
      const dy = (e.clientY - cy) / (rect.height || 1)
      el.style.setProperty('--mouse-x', `${Math.max(-10, Math.min(10, dx * 12))}px`)
      el.style.setProperty('--mouse-y', `${Math.max(-8, Math.min(8, dy * 10))}px`)
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  useEffect(() => {
    const api = { setMood: (m: Mood) => setLocalMood(m), speak: (t: string) => speak(t) }
    ;(window as any).setMood = (m: string) => api.setMood(m as Mood)
    ;(window as any).mascotaSpeak = (t: string) => api.speak(t)
    return () => { delete (window as any).setMood; delete (window as any).mascotaSpeak }
  }, [])

  const moodClass = `mood-${localMood}`

  return (
    <div id="mascota" ref={rootRef} className={moodClass} aria-label={`Mascota estado: ${localMood}`}>
      <div className="slime">
        <div className="slime-body">
          <div className="slime-glow" aria-hidden />
          <div className="eye left"><div className="pupil" /></div>
          <div className="eye right"><div className="pupil" /></div>
          <div className="mouth" aria-hidden />
          <div className="cheek left" aria-hidden />
          <div className="cheek right" aria-hidden />
        </div>
        <div className="slime-base" aria-hidden />
      </div>
      <div id="subtitulos">{subtitulo}</div>
    </div>
  )
}
