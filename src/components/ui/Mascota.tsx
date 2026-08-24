import { useEffect, useRef, useState } from 'react'
import './Mascota.css'
import { speak, isSpeaking } from '../../lib/tts'
import type { MascotaMood } from '../../types/mascota'

type Mood = MascotaMood

interface MascotaProps {
  mood?: Mood
  subtitulo?: string
  size?: number
  onClick?: () => void
}

export function Mascota({ mood = 'neutro', subtitulo = '', size, onClick }: MascotaProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [localMood, setLocalMood] = useState<Mood>(mood)
  const [speakingState, setSpeakingState] = useState<boolean>(isSpeaking())

  useEffect(() => { setLocalMood(mood) }, [mood])

  useEffect(() => {
    const handleTts = (e: Event) => {
      const detail = (e as CustomEvent<{ speaking: boolean }>).detail
      if (detail) {
        setSpeakingState(detail.speaking)
        if (detail.speaking) {
          setLocalMood('hablando')
        }
      }
    }
    window.addEventListener('copixi:tts-speaking', handleTts as EventListener)
    return () => window.removeEventListener('copixi:tts-speaking', handleTts as EventListener)
  }, [])

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
    const api = {
      setMood: (m: Mood) => setLocalMood(m),
      speak: (t: string) => speak(t),
    }
    ;(window as unknown as Record<string, unknown>).setMood = (m: string) => api.setMood(m as Mood)
    ;(window as unknown as Record<string, unknown>).mascotaSpeak = (t: string) => api.speak(t)
    return () => {
      delete (window as unknown as Record<string, unknown>).setMood
      delete (window as unknown as Record<string, unknown>).mascotaSpeak
    }
  }, [])

  const effectiveMood = speakingState ? 'hablando' : localMood
  const moodClass = `mood-${effectiveMood}`

  return (
    <div
      id="mascota"
      ref={rootRef}
      className={moodClass}
      onClick={onClick}
      style={size ? ({ ['--slime-size' as string]: `${size}px` } as React.CSSProperties) : undefined}
      aria-label={`Mascota estado: ${effectiveMood}`}
      role="img"
    >
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
      {subtitulo && <div id="subtitulos">{subtitulo}</div>}
    </div>
  )
}
