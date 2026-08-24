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
      const cy = rect.top + rect.height * 0.35
      const dx = (e.clientX - cx) / (rect.width || 1)
      const dy = (e.clientY - cy) / (rect.height || 1)
      el.style.setProperty('--mouse-x', `${Math.max(-12, Math.min(12, dx * 14))}px`)
      el.style.setProperty('--mouse-y', `${Math.max(-8, Math.min(8, dy * 10))}px`)
      el.style.setProperty('--head-rot', `${Math.max(-8, Math.min(8, dx * 7))}deg`)
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
      className={`robot-eve ${moodClass}`}
      onClick={onClick}
      style={size ? ({ ['--robot-size' as string]: `${size}px` } as React.CSSProperties) : undefined}
      aria-label={`Robot analista compe, estado: ${effectiveMood}`}
      role="img"
    >
      <div className="robot-container">
        {/* Floating Head */}
        <div className="robot-head">
          <div className="robot-head-shell">
            <div className="head-gloss" aria-hidden />
            {/* Glossy Black Visor */}
            <div className="robot-visor">
              <div className="visor-glare" aria-hidden />
              {/* Neon Eyes */}
              <div className="neon-eye left">
                <div className="neon-pupil" />
              </div>
              <div className="neon-eye right">
                <div className="neon-pupil" />
              </div>
              {/* Audio visualizer wave line in visor when speaking */}
              <div className="visor-audio-wave" aria-hidden>
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
              </div>
            </div>
          </div>
        </div>

        {/* Floating Smooth Body */}
        <div className="robot-body">
          <div className="robot-body-shell">
            <div className="body-gloss" aria-hidden />
            <div className="chest-core">
              <div className="core-light" />
            </div>
          </div>
          {/* Floating arms */}
          <div className="robot-arm left" aria-hidden />
          <div className="robot-arm right" aria-hidden />
        </div>

        {/* Electromagnetic levitation base shadow */}
        <div className="robot-thruster-glow" aria-hidden />
        <div className="robot-shadow" aria-hidden />
      </div>

      {subtitulo && <div id="subtitulos">{subtitulo}</div>}
    </div>
  )
}
