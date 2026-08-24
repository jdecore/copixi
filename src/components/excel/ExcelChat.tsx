import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useDashboard } from '../../state/DashboardContext'
import { speak, getMuted, setMuted as setTtsMuted, isTtsSupported, cancel as cancelTts, isSpeaking } from '../../lib/tts'
import type { MascotaMood } from '../../types/mascota'
import type { FilterOperator, ChartConfig } from '../../data/types'

function setMascotaMood(m: MascotaMood) {
  window.dispatchEvent(new CustomEvent('copixi:mascota-mood', { detail: m }))
}

const VALID_OPS: FilterOperator[] = ['equals', 'contains', 'gt', 'lt', 'between']
const CHART_TYPES: ChartConfig['chartType'][] = ['line', 'bar', 'area', 'pie']
const CHART_COLORS = ['#ff6b00', '#166534', '#0a0a0a', '#c27803', '#64748b', '#0e9f6e', '#ff8c2f', '#1f2937']

const EXCEL_SUGGESTIONS = [
  '¿Cómo hago un BUSCARV / XLOOKUP?',
  'Fórmula para sumar con condiciones (SUMAR.SI)',
  'Crear tabla dinámica paso a paso',
  'Eliminar duplicados en Excel',
  '¿Cómo calcular el promedio ponderado?',
]

type ParsedAction = Record<string, unknown> & { action: string }

function parseAction(text: string): ParsedAction | null {
  const idx = text.lastIndexOf('{')
  if (idx === -1) return null
  const candidate = text.slice(idx)
  try {
    const obj = JSON.parse(candidate) as ParsedAction
    if (obj && typeof obj.action === 'string') return obj
  } catch {
    /* not JSON */
  }
  return null
}

function MiniChart({ config, data }: { config: { chartType: string; x: string; y: string; title?: string }; data: { name: string; value: number }[] }) {
  if (!data || data.length === 0) return null
  return (
    <div className="mini-chart-card" aria-label={`Mini gráfica de ${config.title ?? config.y}`}>
      <div className="mini-chart-title">
        <i className="pixelart-icons-font-chart" aria-hidden />
        <span>{config.title ?? `${config.y} por ${config.x}`}</span>
      </div>
      <div className="mini-chart-body">
        <ResponsiveContainer width="100%" height={140}>
          {config.chartType === 'pie' ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} label>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : config.chartType === 'line' ? (
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#ff6b00" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#ff6b00" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function ExcelChat() {
  const {
    rawRows, columns, addFilter, clearFilters, setActiveChart,
    byProduct, byCity, byCategory, metrics, filters, suggestedQuestions,
    autoCharts, fileInfo,
  } = useDashboard()

  const hasData = !!rawRows
  const [input, setInput] = useState('')
  const [muted, setMutedState] = useState(getMuted())
  const [ttsSpeaking, setTtsSpeaking] = useState(isSpeaking())
  const [chatLogOpen, setChatLogOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleTts = (e: Event) => {
      const detail = (e as CustomEvent<{ speaking: boolean }>).detail
      if (detail) setTtsSpeaking(detail.speaking)
    }
    const handleMuteChange = (e: Event) => {
      const detail = (e as CustomEvent<{ muted: boolean }>).detail
      if (detail !== undefined) setMutedState(detail.muted)
    }
    window.addEventListener('copixi:tts-speaking', handleTts as EventListener)
    window.addEventListener('copixi:tts-muted-change', handleMuteChange as EventListener)
    return () => {
      window.removeEventListener('copixi:tts-speaking', handleTts as EventListener)
      window.removeEventListener('copixi:tts-muted-change', handleMuteChange as EventListener)
    }
  }, [])

  const context = useMemo(() => {
    if (!hasData) return { hasData: false }
    return {
      hasData: true,
      file: fileInfo?.name ?? 'excel_data.xlsx',
      rowCount: rawRows!.length,
      columns: columns.map((c) => ({ name: c.name, type: c.type, distinctCount: c.distinctCount })),
      metrics: {
        totalSales: metrics?.totalSales ?? 0,
        avgSales: metrics?.avgSales ?? 0,
        totalUnits: metrics?.totalUnits ?? 0,
        totalCustomers: metrics?.totalCustomers ?? 0,
      },
      topProducts: (byProduct ?? []).slice(0, 3),
      salesByCity: (byCity ?? []).slice(0, 3),
      salesByCategory: (byCategory ?? []).slice(0, 3),
      currentFilters: filters,
    }
  }, [hasData, rawRows, columns, metrics, byProduct, byCity, byCategory, filters, fileInfo])

  const contextRef = useRef(context)
  useEffect(() => { contextRef.current = context }, [context])

  const { messages, sendMessage, status, error, stop, regenerate, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages }) => {
        const windowed = messages.slice(-4)
        return { body: { messages: windowed, context: contextRef.current } }
      },
    }),
    onFinish: ({ message }) => {
      const text = message.parts
        .filter((p) => p.type === 'text')
        .map((p) => (p as { text?: string }).text ?? '')
        .join('')
      if (!getMuted() && text) speak(text.slice(0, 300))
      setMascotaMood('exito')
      const action = parseAction(text)
      if (action) dispatchAction(action)
    },
    onError: () => {
      setMascotaMood('enojado')
    },
  })

  const loading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    if (loading) setMascotaMood('pensando')
  }, [loading])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const allowedColumns = useMemo(() => columns.map((c) => c.name), [columns])

  function dispatchAction(a: ParsedAction) {
    if (a.action === 'setFilter') {
      const column = String(a.column ?? '')
      const operator = String(a.operator ?? '')
      const value = String(a.value ?? '')
      const value2 = a.value2 !== undefined ? String(a.value2) : undefined
      if (!allowedColumns.includes(column)) return
      if (!VALID_OPS.includes(operator as FilterOperator)) return
      if (!value) return
      addFilter({ column, operator: operator as FilterOperator, value, value2 })
    } else if (a.action === 'clearFilters') {
      clearFilters()
    } else if (a.action === 'setChart') {
      const chartType = String(a.chartType ?? '')
      const x = String(a.x ?? '')
      const y = String(a.y ?? '')
      if (!CHART_TYPES.includes(chartType as ChartConfig['chartType'])) return
      if (!allowedColumns.includes(x) || !allowedColumns.includes(y)) return
      setActiveChart({ chartType: chartType as ChartConfig['chartType'], x, y })
    } else if (a.action === 'setDateRange') {
      const from = String(a.from ?? '')
      const to = String(a.to ?? '')
      const dateCol = columns.find((c) => c.type === 'date')?.name ?? columns.find((c) => /date|time|fecha|day/i.test(c.name))?.name
      if (!dateCol) return
      if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) return
      clearFilters()
      addFilter({ column: dateCol, operator: 'gt', value: from })
      addFilter({ column: dateCol, operator: 'lt', value: to })
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    setMascotaMood('escuchando')
    sendMessage({ text: input.trim() })
    setInput('')
  }

  const ask = (q: string) => {
    if (!q || loading) return
    setMascotaMood('escuchando')
    sendMessage({ text: q })
  }

  const toggleMute = () => {
    const v = !muted
    setTtsMuted(v)
    setMutedState(v)
  }

  const lastAiMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        const t = messages[i].parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { text?: string }).text ?? '')
          .join('')
        if (t) return t
      }
    }
    return null
  }, [messages])

  const speechBubbleCleanText = useMemo(() => {
    if (!lastAiMessage) return null
    const idx = lastAiMessage.lastIndexOf('{')
    if (idx !== -1 && lastAiMessage.includes('"action"')) {
      return lastAiMessage.slice(0, idx).trim()
    }
    return lastAiMessage
  }, [lastAiMessage])

  const activeMiniChart = useMemo(() => {
    if (autoCharts && autoCharts.length > 0 && hasData) {
      return autoCharts[0]
    }
    return null
  }, [autoCharts, hasData])

  const suggestions = hasData ? (suggestedQuestions.length > 0 ? suggestedQuestions.slice(0, 4) : [
    '¿Cuál es el total y promedio?',
    'Top 3 productos más vendidos',
    'Ventas por ciudad',
    'Fórmula SUMAR.SI para este archivo',
  ]) : EXCEL_SUGGESTIONS

  return (
    <div className="copilot-container" aria-label="compexi Copilot Canvas">
      <div className="speech-bubble-wrapper">
        <div className={`speech-bubble ${loading ? 'thinking' : ''}`} role="region" aria-live="polite">
          <div className="speech-bubble-tail" aria-hidden />
          <div className="speech-bubble-header">
            <div className="speech-bubble-avatar-title">
              <span className="dot-pulse" aria-hidden />
              <strong>compe</strong>
              <span className="badge-expert">Excel AI</span>
            </div>
            <div className="speech-bubble-status">
              {ttsSpeaking && !muted && (
                <span className="audio-waves" title="Hablando por voz" aria-label="Hablando por voz">
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                </span>
              )}
              {isTtsSupported() && (
                <button
                  type="button"
                  className={`bubble-icon-btn ${muted ? 'muted' : ''}`}
                  onClick={toggleMute}
                  aria-label={muted ? 'Activar voz' : 'Silenciar voz'}
                  title={muted ? 'Activar voz' : 'Silenciar voz'}
                >
                  <i className={`pixelart-icons-font-${muted ? 'volume-x' : 'volume'}`} aria-hidden />
                </button>
              )}
              {ttsSpeaking && (
                <button type="button" className="bubble-icon-btn" onClick={cancelTts} aria-label="Parar audio" title="Parar audio">
                  <i className="pixelart-icons-font-pause" aria-hidden />
                </button>
              )}
            </div>
          </div>

          <div className="speech-bubble-content">
            {loading ? (
              <div className="speech-bubble-thinking">
                <span className="skeleton-dot" />
                <span className="skeleton-dot" />
                <span className="skeleton-dot" />
                <span>Analizando tus datos de Excel…</span>
              </div>
            ) : speechBubbleCleanText ? (
              <div className="speech-bubble-text">
                {speechBubbleCleanText.split('\n').map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            ) : (
              <div className="speech-bubble-welcome">
                <p>¡Hola! Soy <strong>compe</strong>, tu analista y experto en Excel.</p>
                <p className="subtext">
                  {hasData
                    ? `He cargado tu archivo con ${rawRows?.length ?? 0} filas. Pregúntame lo que quieras o pide fórmulas y gráficos.`
                    : 'Arrastra un archivo Excel (.xlsx / .xls) o pregúntame cualquier fórmula o truco de Excel.'}
                </p>
              </div>
            )}

            {hasData && activeMiniChart && speechBubbleCleanText && (
              <MiniChart config={activeMiniChart.config} data={activeMiniChart.data as any} />
            )}
          </div>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="chat-history-toggle-row">
          <button
            type="button"
            className="btn btn-secondary small"
            onClick={() => setChatLogOpen((o) => !o)}
            aria-expanded={chatLogOpen}
          >
            <i className={`pixelart-icons-font-${chatLogOpen ? 'chevron-up' : 'message'}`} aria-hidden />
            {chatLogOpen ? 'Ocultar historial de chat' : `Ver historial completo (${messages.length})`}
          </button>
          <button
            type="button"
            className="btn btn-secondary small"
            onClick={() => { setMessages([]); setMascotaMood('neutro') }}
            title="Limpiar conversación"
          >
            <i className="pixelart-icons-font-trash" aria-hidden /> Limpiar
          </button>
        </div>
      )}

      {chatLogOpen && (
        <div className="chat-expanded-log card" ref={scrollRef} role="log" aria-live="polite">
          {messages.map((m, i) => {
            const text = m.parts.filter((p) => p.type === 'text').map((p) => (p as { text?: string }).text ?? '').join('')
            if (!text) return null
            return (
              <div key={i} className={`excel-msg excel-msg-${m.role === 'user' ? 'user' : 'ai'}`}>
                <div className="excel-msg-body">
                  {text.split('\n').map((line, li) => (<span key={li}>{line}<br /></span>))}
                </div>
              </div>
            )
          })}
          {error && (
            <div className="excel-chat-error" role="alert">
              <span>No pude responder: {error.message || 'error de conexión'}.</span>
              <button type="button" className="btn btn-secondary small" onClick={() => regenerate()}>Reintentar</button>
            </div>
          )}
        </div>
      )}

      <div className="copilot-dock">
        {suggestions.length > 0 && (
          <div className="smart-suggestions" aria-label="Sugerencias rápidas">
            {suggestions.map((q, i) => (
              <button key={i} type="button" className="suggestion-chip" onClick={() => ask(q)} disabled={loading}>
                <span className="chip-sparkle" aria-hidden>✦</span> {q}
              </button>
            ))}
          </div>
        )}

        <form className="copilot-dock-input" onSubmit={submit}>
          <input
            className="copilot-text-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasData ? 'Pregunta sobre tus datos de Excel o pide fórmulas…' : 'Pregúntame cualquier fórmula o truco de Excel…'}
            aria-label="Escribe tu consulta"
            disabled={loading}
          />
          {loading ? (
            <button type="button" className="btn btn-primary btn-dock" onClick={() => stop()} aria-label="Detener">
              <i className="pixelart-icons-font-close" aria-hidden /> Detener
            </button>
          ) : (
            <button type="submit" className="btn btn-primary btn-dock" disabled={!input.trim()} aria-label="Enviar">
              <i className="pixelart-icons-font-send" aria-hidden /> Enviar
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
