import { useState } from 'react'
import './BootSplash.css'

export type SplashAgent = 'gryph' | 'robot' | 'buho' | 'fenix' | 'kitsune1'

interface BootSplashProps {
  initial: SplashAgent
  onSelect: (a: SplashAgent) => void
  onClose: () => void
}

const AGENTS: { id: SplashAgent; icon: string; title: string; role: string; desc: string }[] = [
  { id: 'gryph', icon: '🦅', title: 'Grifo cobre', role: 'Guardián', desc: 'Te avisa si una venta es rara antes de mandarla a jefatura.' },
  { id: 'buho', icon: '🦉', title: 'Búho Atenea', role: 'Auditor Excel', desc: 'Encuentra columnas vacías, tipos mezclados y errores ocultos.' },
  { id: 'fenix', icon: '🔥', title: 'Fénix Bennu', role: 'Power Query Booster', desc: 'Ordena tu Excel feo en tabla limpia lista para Power BI.' },
  { id: 'kitsune1', icon: '🦊', title: 'Kitsune 1-cola', role: 'Copiloto chat', desc: 'Pregúntale normal: “¿qué ciudad vendió más en marzo?”' },
  { id: 'robot', icon: '🤖', title: 'Robot', role: 'Reporter', desc: 'Genera el informe trazable para Word/PowerPoint.' },
]

export function BootSplash({ initial, onSelect, onClose }: BootSplashProps) {
  const [picked, setPicked] = useState<SplashAgent>(initial)

  return (
    <div className="boot-splash" role="dialog" aria-modal="true" aria-label="Elige tu potenciador">
      <div className="boot-splash-card">
        <button className="boot-close" type="button" onClick={onClose} aria-label="Cerrar">✕</button>
        <div className="boot-splash-head">
          <div className="boot-splash-badge">Excel + Power BI Booster</div>
          <h1>From data to <span>useful intelligence</span></h1>
          <p className="boot-splash-sub">
            Potencia tu Microsoft 365 sin subir tus datos. Tus archivos se quedan en tu navegador. Copixi limpia, verifica y explica lo que Copilot no debe calcular.
          </p>
          <div className="boot-diagram" aria-hidden>
            <span>Excel sucio<small>csv/xlsx sucio</small></span>
            <i>→</i>
            <span style={{ borderColor: '#b87333' }}>Copixi<small>verifica + ordena</small></span>
            <i>→</i>
            <span>Power BI<small>tabla limpia</small></span>
            <i>→</i>
            <span>Decisión<small>reporte trazable</small></span>
          </div>
        </div>

        <div className="boot-agents" role="radiogroup" aria-label="Elige tu ayudante">
          {AGENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={picked === a.id}
              className={`boot-agent ${picked === a.id ? 'active' : ''}`}
              onClick={() => setPicked(a.id)}
            >
              <div className="boot-agent-icon" aria-hidden>{a.icon}</div>
              <div>
                <div className="boot-agent-title">{a.title}</div>
                <div className="boot-agent-role">{a.role}</div>
                <div className="boot-agent-desc">{a.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="boot-splash-actions">
          <button
            type="button"
            className="btn"
            style={{ background: 'linear-gradient(135deg, #b87333 0%, #d4926b 100%)', color: 'white', border: '1px solid #9c5a2e' }}
            onClick={() => { onSelect(picked); onClose() }}
          >
            Continuar con {AGENTS.find((x) => x.id === picked)?.title} →
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Saltar</button>
        </div>

        <div className="boot-splash-foot" aria-hidden>
          <span>✓ Cálculo real</span>
          <span>✓ Sin subir filas</span>
          <span>✓ Reporte reproducible</span>
          <span>✓ 100% local</span>
        </div>
      </div>
    </div>
  )
}
