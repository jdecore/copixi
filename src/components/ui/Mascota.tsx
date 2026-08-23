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
      el.style.setProperty('--mouse-x', `${Math.max(-10, Math.min(10, dx * 12))}px`)
      el.style.setProperty('--mouse-y', `${Math.max(-8, Math.min(8, dy * 10))}px`)
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
