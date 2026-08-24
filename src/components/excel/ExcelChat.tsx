import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useDashboard } from '../../state/DashboardContext'
import { speak, getMuted, setMuted as setTtsMuted, isTtsSupported } from '../../lib/tts'
import type { MascotaMood } from '../../types/mascota'
import type { FilterOperator, ChartConfig } from '../../data/types'

function setMascotaMood(m: MascotaMood) {
  window.dispatchEvent(new CustomEvent('copixi:mascota-mood', { detail: m }))
}

const VALID_OPS: FilterOperator[] = ['equals', 'contains', 'gt', 'lt', 'between']
const CHART_TYPES: ChartConfig['chartType'][] = ['line', 'bar', 'area', 'pie']

const EXCEL_SUGGESTIONS = [
  '¿Cómo creo una tabla dinámica?',
  'Fórmula para eliminar duplicados',
  'BUSCARV vs XLOOKUP, ¿cuál usar?',
  'Suma condicional con SUMAR.SI',
  'Gráfico de tendencia mensual',
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

export function ExcelChat() {
  const {
    rawRows, columns, addFilter, clearFilters, setActiveChart,
    byProduct, byCity, byCategory, timeSeries, metrics, filters, suggestedQuestions,
    anomalies, autoCharts,
  } = useDashboard()

  const hasData = !!rawRows
  const [input, setInput] = useState('')
  const [muted, setMutedState] = useState(getMuted())
  const scrollRef = useRef<HTMLDivElement>(null)

  const context = useMemo(() => {
    if (!hasData) return { hasData: false }
    return {
      hasData: true,
      rowCount: rawRows!.length,
      filteredCount: rawRows!.length,
      columns: columns.map((c) => ({ name: c.name, type: c.type, distinctCount: c.distinctCount })),
      metrics,
      topProducts: (byProduct ?? []).slice(0, 3),
      salesByCity: (byCity ?? []).slice(0, 3),
      salesByCategory: (byCategory ?? []).slice(0, 3),
      trends: (timeSeries ?? []).slice(-6),
      currentFilters: filters,
      autoCharts: (autoCharts ?? []).slice(0, 4).map((c) => ({ chartType: c.config.chartType, x: c.config.x, y: c.config.y })),
      suggestedQuestions: suggestedQuestions.slice(0, 5),
      anomalies: (anomalies ?? []).slice(0, 3).map((a) => ({ column: a.column, value: a.value, zScore: a.zScore })),
    }
  }, [hasData, rawRows, columns, metrics, byProduct, byCity, byCategory, timeSeries, filters, suggestedQuestions, anomalies, autoCharts])

  const contextRef = useRef(context)

  useEffect(() => {
    contextRef.current = context
  }, [context])

  const { messages, sendMessage, status, error, stop, regenerate, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages }) => ({ body: { messages, context: contextRef.current } }),
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
  }, [messages])

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

  const suggestions = hasData ? suggestedQuestions : EXCEL_SUGGESTIONS

  return (
    <div className="excel-chat card" aria-label="CERI Excel chat">
      <div className="excel-chat-head">
        <div className="excel-chat-title">
          <i className="pixelart-icons-font-robot" aria-hidden />
          <span>CERI · Experto en Excel</span>
        </div>
        <div className="excel-chat-actions">
          {isTtsSupported() && (
            <button type="button" className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Activar voz' : 'Silenciar voz'} title={muted ? 'Activar voz' : 'Silenciar voz'}>
              <i className={`pixelart-icons-font-${muted ? 'volume-x' : 'volume'}`} aria-hidden />
            </button>
          )}
          {messages.length > 0 && (
            <button type="button" className="icon-btn" onClick={() => { setMessages([]); setMascotaMood('neutro') }} aria-label="Limpiar chat" title="Limpiar chat">
              <i className="pixelart-icons-font-trash" aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="excel-chat-log" ref={scrollRef} role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="excel-chat-welcome">
            <p>Hola, soy <strong>CERI</strong>. Pregúntame lo que sea de Excel, fórmulas o análisis de datos.</p>
            {hasData && <p className="excel-chat-hint">Tu dataset está cargado — puedo filtrar, graficar y comparar por ti.</p>}
          </div>
        )}
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
        {loading && (
          <div className="excel-msg excel-msg-ai" role="status">
            <div className="excel-msg-body excel-msg-thinking">
              <span className="skeleton" style={{ width: 10, height: 10, borderRadius: 999, display: 'inline-block' }} aria-hidden />
              CERI está pensando…
            </div>
          </div>
        )}
        {error && (
          <div className="excel-chat-error" role="alert">
            <span>No pude responder: {error.message || 'error de conexión'}.</span>
            <button type="button" className="btn btn-secondary small" onClick={() => regenerate()}>Reintentar</button>
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="smart-suggestions" aria-label="Preguntas sugeridas">
          {suggestions.map((q, i) => (
            <button key={i} type="button" className="suggestion-chip" onClick={() => ask(q)}>{q}</button>
          ))}
        </div>
      )}

      <form className="excel-chat-input" onSubmit={submit}>
        <input
          className="filter-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={hasData ? 'Pregunta sobre tus datos o sobre Excel…' : 'Pregunta lo que sea de Excel…'}
          aria-label="Escribe tu mensaje"
          disabled={loading}
        />
        {loading ? (
          <button type="button" className="btn btn-primary" onClick={() => stop()} aria-label="Detener">Detener</button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={!input.trim()} aria-label="Enviar">
            <i className="pixelart-icons-font-send" aria-hidden /> Enviar
          </button>
        )}
      </form>
    </div>
  )
}
