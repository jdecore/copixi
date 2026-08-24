import { useEffect, useMemo, useRef, useState } from 'react'
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

type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string }

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

export function ExcelChat({ onOpenFilePicker }: { onOpenFilePicker?: () => void }) {
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

  // Chat state (self-contained, no external chat SDK)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [status, setStatus] = useState<'idle' | 'submitted' | 'streaming' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastQueryRef = useRef('')

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

  const loading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    if (loading) setMascotaMood('pensando')
  }, [loading])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  // Token-efficient compressed context
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

  async function runQuery(text: string) {
    if (loading) return
    const trimmed = text.trim()
    if (!trimmed) return
    lastQueryRef.current = trimmed
    setError(null)

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', content: trimmed }
    const assistantMsg: ChatMsg = { id: `a-${Date.now()}`, role: 'assistant', content: '' }
    const history = [...messages, userMsg].slice(-4).map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setMascotaMood('escuchando')
    setStatus('submitted')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history, context: contextRef.current }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        let detail = `HTTP ${res.status}`
        try {
          const j = (await res.json()) as { error?: string; detail?: string }
          if (j?.error) detail = j.detail ? `${j.error}: ${j.detail}` : j.error
        } catch { /* ignore */ }
        throw new Error(detail)
      }

      setStatus('streaming')
      setMascotaMood('pensando')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let acc = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let sep: number
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          const line = raw.trim()
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (!payload) continue
          try {
            const evt = JSON.parse(payload) as { type: string; delta?: string; message?: string }
            if (evt.type === 'text-delta' && typeof evt.delta === 'string') {
              acc += evt.delta
              setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: acc } : m)))
            } else if (evt.type === 'error') {
              throw new Error(evt.message || 'Error del servidor')
            }
          } catch (e) {
            if (e instanceof Error && (e as any).type === 'error') throw e
            /* ignore non-delta / parse noise */
          }
        }
      }

      setStatus('done')
      setMascotaMood('exito')
      const action = parseAction(acc)
      if (action) dispatchAction(action)
      if (!getMuted() && acc) speak(acc.slice(0, 300))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setError(msg)
      setMascotaMood('enojado')
      setStatus('error')
      // Drop the empty assistant placeholder so the UI stays clean
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id))
    } finally {
      abortRef.current = null
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    const t = input.trim()
    setInput('')
    void runQuery(t)
  }

  const ask = (q: string) => {
    if (!q || loading) return
    void runQuery(q)
  }

  const stop = () => abortRef.current?.abort()

  const regenerate = () => {
    if (loading) return
    setMessages((prev) => {
      const copy = [...prev]
      if (copy.length && copy[copy.length - 1].role === 'assistant') copy.pop()
      return copy
    })
    if (lastQueryRef.current) void runQuery(lastQueryRef.current)
  }

  const clearChat = () => {
    setMessages([])
    setError(null)
    setStatus('idle')
    setMascotaMood('neutro')
  }

  const toggleMute = () => {
    const v = !muted
    setTtsMuted(v)
    setMutedState(v)
  }

  const lastAiMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].content) return messages[i].content
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
    <div className="excel-chat-container" aria-label="compexi Chat">
      <div className="speech-bubble-wrapper">
        <div className={`speech-bubble ${loading ? 'thinking' : ''}`} role="region" aria-live="polite">
          <div className="speech-bubble-tail" aria-hidden />
          <div className="speech-bubble-header">
            <div className="speech-bubble-avatar-title">
              <span className="dot-pulse" aria-hidden />
              <strong>compe</strong>
              <span className="badge-expert">Data &amp; Excel AI</span>
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
                <span>Analizando tus datos…</span>
              </div>
            ) : error ? (
              <div className="speech-bubble-error-box" role="alert">
                <div className="error-badge-row">
                  <i className="pixelart-icons-font-alert" aria-hidden />
                  <strong>Error al procesar la respuesta:</strong>
                </div>
                <div className="error-message-text">
                  {error || 'No se pudo conectar con el servicio de IA.'}
                </div>
                <div className="error-help-hint">
                  {error.includes('404') ? (
                    <span>El endpoint <code>/api/chat</code> no está respondiendo en este entorno (si estás en <code>vite dev</code>, asegúrate de correr con Vercel CLI o configurar la API).</span>
                  ) : error.includes('500') || error.includes('GEMINI_API_KEY') ? (
                    <span>Falta configurar la variable de entorno <code>GEMINI_API_KEY</code> en tu servidor o Vercel.</span>
                  ) : (
                    <span>Verifica tu conexión y tu clave de Gemini API.</span>
                  )}
                </div>
                <button type="button" className="btn btn-secondary small" onClick={regenerate} style={{ marginTop: 8 }}>
                  <i className="pixelart-icons-font-reload" aria-hidden /> Reintentar consulta
                </button>
              </div>
            ) : speechBubbleCleanText ? (
              <div className="speech-bubble-text">
                {speechBubbleCleanText.split('\n').map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            ) : (
              <div className="speech-bubble-welcome">
                <div className="welcome-header-line">
                  <p>¡Hola! Soy <strong>compe</strong>, tu analista de datos y experto en Excel.</p>
                  {isTtsSupported() && (
                    <button
                      type="button"
                      className="btn-hear-welcome"
                      onClick={() => speak('¡Hola! Soy compe, tu analista de datos y experto en Excel. Arrastra tu archivo Excel o CSV para comenzar.')}
                      title="Escuchar saludo"
                      aria-label="Escuchar saludo"
                    >
                      <i className="pixelart-icons-font-volume" aria-hidden /> Escuchar
                    </button>
                  )}
                </div>
                {hasData ? (
                  <p className="subtext">
                    He cargado <strong>{fileInfo?.name}</strong> con {rawRows?.length ?? 0} filas. Pregúntame lo que quieras o pide fórmulas y gráficos.
                  </p>
                ) : (
                  <div className="welcome-dropzone" onClick={onOpenFilePicker} role="button" tabIndex={0}>
                    <div className="dropzone-icon-ring">
                      <i className="pixelart-icons-font-folder" aria-hidden />
                    </div>
                    <div className="dropzone-text">
                      <strong className="dropzone-title">Arrastra y suelta tu archivo aquí</strong>
                      <span className="dropzone-hint">Soporta Excel (<strong>.xlsx, .xls</strong>) o <strong>CSV / TSV</strong> · o haz clic para explorar</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Embedded contextual mini chart */}
            {hasData && activeMiniChart && speechBubbleCleanText && !error && (
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
            onClick={clearChat}
            title="Limpiar conversación"
          >
            <i className="pixelart-icons-font-trash" aria-hidden /> Limpiar
          </button>
          {onOpenFilePicker && (
            <button
              type="button"
              className="btn btn-secondary small"
              onClick={onOpenFilePicker}
              title="Cargar otro archivo Excel o CSV"
            >
              <i className="pixelart-icons-font-upload" aria-hidden /> Cambiar archivo
            </button>
          )}
        </div>
      )}

      {chatLogOpen && (
        <div className="chat-expanded-log card" ref={scrollRef} role="log" aria-live="polite">
          {messages.map((m, i) => {
            if (!m.content) return null
            return (
              <div key={i} className={`excel-msg excel-msg-${m.role === 'user' ? 'user' : 'ai'}`}>
                <div className="excel-msg-body">
                  {m.content.split('\n').map((line, li) => (<span key={li}>{line}<br /></span>))}
                </div>
              </div>
            )
          })}
          {error && (
            <div className="excel-chat-error" role="alert">
              <div>
                <strong>Error en la petición:</strong>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>{error || 'Error de conexión con el servidor.'}</p>
              </div>
              <button type="button" className="btn btn-secondary small" onClick={regenerate}>Reintentar</button>
            </div>
          )}
        </div>
      )}

      <div className="excel-dock">
        {suggestions.length > 0 && (
          <div className="smart-suggestions" aria-label="Sugerencias rápidas">
            {suggestions.map((q, i) => (
              <button key={i} type="button" className="suggestion-chip" onClick={() => ask(q)} disabled={loading}>
                <span className="chip-sparkle" aria-hidden>✦</span> {q}
              </button>
            ))}
          </div>
        )}

        <form className="excel-dock-input" onSubmit={submit}>
          {onOpenFilePicker && (
            <button
              type="button"
              className="dock-attach-btn"
              onClick={onOpenFilePicker}
              title="Adjuntar archivo Excel o CSV (.xlsx, .xls, .csv, .tsv)"
              aria-label="Subir archivo"
            >
              <i className="pixelart-icons-font-upload" aria-hidden />
            </button>
          )}
          <input
            className="excel-text-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasData ? 'Pregunta sobre tus datos o pide fórmulas de Excel…' : 'Pregúntame cualquier fórmula o truco de Excel…'}
            aria-label="Escribe tu consulta"
            disabled={loading}
          />
          {loading ? (
            <button type="button" className="btn btn-primary btn-dock" onClick={stop} aria-label="Detener">
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
