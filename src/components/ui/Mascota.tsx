import { useEffect, useRef, useState } from 'react'
import './Mascota.css'
import { speak, isSpeaking } from '../../lib/tts'
import type { MascotaMood, MascotVariant, RobotUnitId } from '../../types/mascota'
import { ROBOT_UNITS } from '../../types/mascota'

interface MascotaProps {
  mood?: MascotaMood
  subtitulo?: string
  size?: number
  onClick?: () => void
  variant?: MascotVariant
}

export function Mascota({ mood = 'neutro', subtitulo = '', size, onClick, variant = 'helix' }: MascotaProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [localMood, setLocalMood] = useState<MascotaMood>(mood)
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
      el.style.setProperty('--mouse-x', `${Math.max(-4, Math.min(4, dx * 5))}px`)
      el.style.setProperty('--mouse-y', `${Math.max(-3, Math.min(3, dy * 4))}px`)
      el.style.setProperty('--head-rot', `${Math.max(-8, Math.min(8, dx * 7))}deg`)
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  useEffect(() => {
    const api = {
      setMood: (m: MascotaMood) => setLocalMood(m),
      speak: (t: string) => speak(t),
    }
    ;(window as unknown as Record<string, unknown>).setMood = (m: string) => api.setMood(m as MascotaMood)
    ;(window as unknown as Record<string, unknown>).mascotaSpeak = (t: string) => api.speak(t)
    return () => {
      delete (window as unknown as Record<string, unknown>).setMood
      delete (window as unknown as Record<string, unknown>).mascotaSpeak
    }
  }, [])

  const effectiveMood = speakingState ? 'hablando' : localMood
  const moodClass = `mood-${effectiveMood}`

  // Mapeo a unidad de robot
  const isRobotUnit = variant in ROBOT_UNITS
  const activeUnitId: RobotUnitId = isRobotUnit ? (variant as RobotUnitId) : 'helix'
  const robotMeta = ROBOT_UNITS[activeUnitId] || ROBOT_UNITS.helix

  const unitClass = `unit-${activeUnitId}`

  return (
    <div
      id="mascota"
      ref={rootRef}
      className={`robot-eve ${unitClass} ${moodClass}`}
      onClick={onClick}
      style={{
        ...(size ? { ['--robot-size' as string]: `${size}px` } : {}),
        ['--unit-primary' as string]: robotMeta.primaryColor,
        ['--unit-accent' as string]: robotMeta.accentColor,
      } as React.CSSProperties}
      aria-label={`${robotMeta.name} (${robotMeta.domain}), estado: ${effectiveMood}`}
      role="img"
    >
      <div className="robot-container">
        {/* Halo / Ambiente del Hábitat */}
        <div className="robot-habitat-aura" aria-hidden />

        <div className={`robot-head chasis-${activeUnitId}`}>
          <div className="robot-head-shell">
            <div className="head-gloss" aria-hidden />
            
            {/* Chasis específico por Robot */}
            {activeUnitId === 'curio' && <div className="curio-lens-rim" aria-hidden />}
            {activeUnitId === 'helix' && <div className="helix-nanotubes" aria-hidden><span /><span /></div>}
            {activeUnitId === 'datum' && <div className="datum-server-ridges" aria-hidden><span /><span /><span /></div>}
            {activeUnitId === 'synapse' && <div className="synapse-neural-filaments" aria-hidden><span /><span /></div>}
            {activeUnitId === 'nexus' && <div className="nexus-wings" aria-hidden><span /><span /></div>}
            {activeUnitId === 'vektor' && <div className="vektor-bevel" aria-hidden />}
            {activeUnitId === 'gaia' && <div className="gaia-orbital-ring" aria-hidden />}

            <div className={`robot-visor visor-shape-${robotMeta.visorType}`}>
              <div className="visor-glare" aria-hidden />

              {/* 1. CURIO: Visor Monocular Circular */}
              {robotMeta.visorType === 'circle' && (
                <div className="visor-eye-circle">
                  <div className="reticle-ring" />
                  <div className="lens-center-dot" />
                </div>
              )}

              {/* 2. HELIX: Visor Cromosoma en X / Pares de bases */}
              {robotMeta.visorType === 'chromosome' && (
                <div className="visor-eye-chromosome">
                  <span className="base-pair bp-left" />
                  <span className="base-node node-center" />
                  <span className="base-pair bp-right" />
                </div>
              )}

              {/* 3. DATUM: Visor Matriz de Puntos 4x4 */}
              {robotMeta.visorType === 'matrix4x4' && (
                <div className="visor-eye-matrix">
                  <span className="matrix-bar b1" />
                  <span className="matrix-bar b2" />
                  <span className="matrix-bar b3" />
                  <span className="matrix-bar b4" />
                </div>
              )}

              {/* 4. SYNAPSE: Visor Triángulo Neural */}
              {robotMeta.visorType === 'triangle' && (
                <div className="visor-eye-triangle">
                  <div className="neural-triangle-pulse" />
                  <div className="synapse-node" />
                </div>
              )}

              {/* 5. NEXUS: Visor Chevron / Rayo */}
              {robotMeta.visorType === 'chevron' && (
                <div className="visor-eye-chevron">
                  <span className="chev c1" />
                  <span className="chev c2" />
                  <span className="chev c3" />
                </div>
              )}

              {/* 6. VEKTOR: Visor Retícula / Diamante */}
              {robotMeta.visorType === 'reticle' && (
                <div className="visor-eye-reticle">
                  <div className="diamond-target" />
                  <div className="target-crosshair" />
                </div>
              )}

              {/* 7. GAIA: Visor Fractal / Anillo Orbital */}
              {robotMeta.visorType === 'fractal' && (
                <div className="visor-eye-fractal">
                  <div className="fractal-ring r1" />
                  <div className="fractal-ring r2" />
                  <div className="fractal-core" />
                </div>
              )}

              {/* Audio wave común interactiva al hablar */}
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

        {/* Cuerpo del Robot */}
        <div className={`robot-body body-shape-${activeUnitId}`}>
          <div className="robot-body-shell">
            <div className="body-gloss" aria-hidden />
            <div className="chest-core">
              <div className="core-light" />
              <span className="unit-badge-text">{robotMeta.code}</span>
            </div>
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
