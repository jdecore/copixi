import { useEffect, useRef, useState } from 'react'
import './Mascota.css'

type Mood = 'neutro' | 'feliz' | 'enojado' | 'duda' | 'dormido' | 'guino'

interface MascotaProps {
  mood?: Mood
  subtitulo?: string
}

export function Mascota({ mood = 'neutro', subtitulo = '' }: MascotaProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [localMood, setLocalMood] = useState<Mood>(mood)

  useEffect(() => { setLocalMood(mood) }, [mood])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height * 0.38
      const dx = (e.clientX - cx) / (rect.width || 1)
      const dy = (e.clientY - cy) / (rect.height || 1)
      el.style.setProperty('--mouse-x', `${Math.max(-8, Math.min(8, dx * 10))}px`)
      el.style.setProperty('--mouse-y', `${Math.max(-6, Math.min(6, dy * 8))}px`)
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  useEffect(() => {
    const api = { setMood: (m: Mood) => setLocalMood(m) }
    ;(window as any).setMood = (m: string) => api.setMood(m as Mood)
    return () => { delete (window as any).setMood }
  }, [])

  const moodClass = `mood-${localMood}`

  return (
    <div id="mascota" ref={rootRef} className={moodClass} aria-label={`Mascota estado: ${localMood}`}>
      <div className="head">
        <div className="ceja izq" aria-hidden />
        <div className="ceja der" aria-hidden />
        <div className="ojo izq"><div className="pupila" /></div>
        <div className="ojo der"><div className="pupila" /></div>
        <div className="mejilla izq" aria-hidden />
        <div className="mejilla der" aria-hidden />
        <div className="brillo" aria-hidden />
      </div>
      <div className="cuerpo" aria-hidden />
      <div id="subtitulos">{subtitulo}</div>
    </div>
  )
}
