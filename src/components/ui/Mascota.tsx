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
  /** 'gryph' = El Grifo (default en main), 'robot' = backup Cyber-EVE (rama robot) */
  variant?: 'gryph' | 'robot'
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
  const variantClass = variant === 'robot' ? 'robot-eve' : 'gryph'

  if (variant === 'robot') {
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

  // ============ EL GRIFO (Gryphon) — CSS puro, sin imágenes ============
  return (
    <div
      id="mascota"
      ref={rootRef}
      className={`${variantClass} ${moodClass}`}
      onClick={onClick}
      style={size ? ({ ['--robot-size' as string]: `${size}px`, ['--gryph-size' as string]: `${size}px` } as React.CSSProperties) : undefined}
      aria-label={`Grifo analista compe, estado: ${effectiveMood}`}
      role="img"
    >
      <div className="gryph-container">
        {/* Alas — águila, desplegadas a los lados (rasgo clave grifo) */}
        <div className="gryph-wing left" aria-hidden>
          <span className="wing-feather f1" /><span className="wing-feather f2" /><span className="wing-feather f3" /><span className="wing-feather f4" />
        </div>
        <div className="gryph-wing right" aria-hidden>
          <span className="wing-feather f1" /><span className="wing-feather f2" /><span className="wing-feather f3" /><span className="wing-feather f4" />
        </div>

        {/* Cuerpo león */}
        <div className="gryph-body">
          <div className="gryph-body-shell" aria-hidden>
            <div className="gryph-chest-fluff" />
            <div className="gryph-belly-gloss" />
          </div>
          {/* Patas delanteras — garras de águila */}
          <div className="gryph-leg front left" aria-hidden><span className="claw" /><span className="claw" /><span className="claw" /></div>
          <div className="gryph-leg front right" aria-hidden><span className="claw" /><span className="claw" /><span className="claw" /></div>
          {/* Patas traseras — león */}
          <div className="gryph-leg hind left" aria-hidden />
          <div className="gryph-leg hind right" aria-hidden />
          {/* Cola de león con borla */}
          <div className="gryph-tail" aria-hidden><span className="tail-tuft" /></div>
        </div>

        {/* Cabeza águila */}
        <div className="gryph-head">
          {/* Orejas / penacho león */}
          <div className="gryph-ear left" aria-hidden />
          <div className="gryph-ear right" aria-hidden />
          <div className="gryph-crest" aria-hidden />

          <div className="gryph-head-shell">
            <div className="gryph-head-gloss" aria-hidden />

            {/* Cejas águila — ceño que hace que se lea como rapaz */}
            <div className="gryph-brow left" aria-hidden />
            <div className="gryph-brow right" aria-hidden />

            {/* Ojos ámbar con pupila — grandes chibi pero con brillo rapaz */}
            <div className="gryph-eye left" aria-hidden>
              <div className="gryph-pupil" />
              <div className="gryph-eye-highlight" />
            </div>
            <div className="gryph-eye right" aria-hidden>
              <div className="gryph-pupil" />
              <div className="gryph-eye-highlight" />
            </div>

            {/* Pico gancho cobre — rasgo #1 de águila */}
            <div className="gryph-beak" aria-hidden>
              <div className="beak-cere" />
              <div className="beak-upper" />
              <div className="beak-lower" />
              <div className="beak-nostril" />
              <div className="beak-shine" />
              <div className="beak-hook" />
              {/* onda de audio cuando habla */}
              <div className="beak-audio-wave" aria-hidden>
                <span className="wave-bar" /><span className="wave-bar" /><span className="wave-bar" />
              </div>
            </div>

            {/* Melena león — rasgo #1 de león, collar esponjoso cobre */}
            <div className="gryph-mane" aria-hidden>
              <span className="mane-lock l1" /><span className="mane-lock l2" /><span className="mane-lock l3" /><span className="mane-lock l4" /><span className="mane-lock l5" /><span className="mane-lock l6" />
            </div>
          </div>
        </div>

        {/* Sombra / brillo levitación */}
        <div className="gryph-glow" aria-hidden />
        <div className="gryph-shadow" aria-hidden />
      </div>

      {subtitulo && <div id="subtitulos">{subtitulo}</div>}
    </div>
  )
}
