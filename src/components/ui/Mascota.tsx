import { useEffect, useRef, useState } from 'react'
import './Mascota.css'
import { speak, isSpeaking } from '../../lib/tts'
import type { MascotaMood } from '../../types/mascota'

type Mood = MascotaMood

type MascotVariant = 'gryph' | 'robot' | 'buho' | 'fenix' | 'kitsune1'

interface MascotaProps {
  mood?: Mood
  subtitulo?: string
  size?: number
  onClick?: () => void
  /** potenciador Excel/Power BI — todos molde robot redondo cobre */
  variant?: MascotVariant
}

export function Mascota({ mood = 'neutro', subtitulo = '', size, onClick, variant = 'gryph' }: MascotaProps) {
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
      el.style.setProperty('--mouse-x', `${Math.max(-3, Math.min(3, dx * 4))}px`)
      el.style.setProperty('--mouse-y', `${Math.max(-2, Math.min(2, dy * 3))}px`)
      el.style.setProperty('--head-rot', `${Math.max(-6, Math.min(6, dx * 6))}deg`)
      // Gryphon wing micro-tilt with mouse
      el.style.setProperty('--wing-tilt', `${Math.max(-4, Math.min(4, dx * 3))}deg`)
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
  const isRobot = variant === 'robot'
  const variantClass = isRobot ? 'robot-eve' : variant

  if (isRobot) {
    return (
      <div
        id="mascota"
        ref={rootRef}
        className={`${variantClass} ${moodClass}`}
        onClick={onClick}
        style={size ? ({ ['--robot-size' as string]: `${size}px` } as React.CSSProperties) : undefined}
        aria-label={`Robot analista compe, estado: ${effectiveMood}`}
        role="img"
      >
        <div className="robot-container">
          <div className="robot-head">
            <div className="robot-head-shell">
              <div className="head-gloss" aria-hidden />
              <div className="robot-visor">
                <div className="visor-glare" aria-hidden />
                <div className="neon-eye left"><div className="neon-pupil" /></div>
                <div className="neon-eye right"><div className="neon-pupil" /></div>
                <div className="visor-audio-wave" aria-hidden>
                  <span className="wave-bar" /><span className="wave-bar" /><span className="wave-bar" /><span className="wave-bar" /><span className="wave-bar" />
                </div>
              </div>
            </div>
          </div>
          <div className="robot-body">
            <div className="robot-body-shell">
              <div className="body-gloss" aria-hidden />
              <div className="chest-core"><div className="core-light" /></div>
            </div>
            <div className="robot-arm left" aria-hidden />
            <div className="robot-arm right" aria-hidden />
          </div>
          <div className="robot-thruster-glow" aria-hidden />
          <div className="robot-shadow" aria-hidden />
        </div>
        {subtitulo && <div id="subtitulos">{subtitulo}</div>}
      </div>
    )
  }

  // ============ CRIATURAS — MOLDE ROBOT (mismo DOM que robot, solo reskin) ============
  const labelMap: Record<string, string> = {
    gryph: 'Grifo',
    buho: 'Búho',
    fenix: 'Fénix',
    kitsune1: 'Kitsune',
  }
  // Usamos EXACTO mismo DOM que robot para garantizar que se vea bien.
  // Solo cambia el reskin vía CSS: #mascota.gryph .robot-head-shell etc.
  return (
    <div
      id="mascota"
      ref={rootRef}
      className={`${variantClass} robot-eve ${moodClass}`}
      onClick={onClick}
      style={size ? ({ ['--robot-size' as string]: `${size}px`, ['--gryph-size' as string]: `${size}px` } as React.CSSProperties) : undefined}
      aria-label={`${labelMap[variant] ?? 'Grifo'} analista compe, estado: ${effectiveMood}`}
      role="img"
    >
      <div className="robot-container">
        <div className="robot-head">
          <div className="robot-head-shell">
            <div className="head-gloss" aria-hidden />
            {/* Detalles criatura — ocultos en robot vía CSS, visibles por variante */}
            <div className="creature-ears" aria-hidden><span /><span /></div>
            <div className="creature-crest" aria-hidden />
            <div className="robot-visor">
              <div className="visor-glare" aria-hidden />
              <div className="neon-eye left"><div className="neon-pupil" /></div>
              <div className="neon-eye right"><div className="neon-pupil" /></div>
              <div className="creature-beak" aria-hidden><span className="beak-tip" /></div>
              <div className="visor-audio-wave" aria-hidden>
                <span className="wave-bar" /><span className="wave-bar" /><span className="wave-bar" /><span className="wave-bar" /><span className="wave-bar" />
              </div>
            </div>
          </div>
        </div>
        <div className="robot-body">
          <div className="robot-body-shell">
            <div className="body-gloss" aria-hidden />
            <div className="chest-core"><div className="core-light" /></div>
          </div>
          <div className="robot-arm left" aria-hidden />
          <div className="robot-arm right" aria-hidden />
        </div>
        <div className="robot-thruster-glow" aria-hidden />
        <div className="robot-shadow" aria-hidden />
      </div>
      {subtitulo && <div id="subtitulos">{subtitulo}</div>}
    </div>
  )
}
