# Copixi — Tu Analista de Datos con IA

**Sube un CSV/Excel/PDF → obtén KPIs, gráficos y tendencias en 30 segundos → pregúntale en lenguaje natural y el dashboard se actualiza solo.**

> AI-native analytics product, frontend-first. Sin servidores propios, sin subir datos sensibles, costo de IA mínimo.

---

## Por qué Copixi ayuda a tu empresa

Copixi convierte datos que tu equipo ya tiene (CSV de ventas, reportes en Excel/PDF) en decisiones, **sin contratar un analista ni montar infraestructura**.

| Lo que entrega | Valor de negocio |
|---|---|
| **Frontend-first** — todo el cálculo corre en el navegador | **0$ de infraestructura.** Despliegas en Vercel en 2 minutos, escala sin servidores ni DB. |
| **Privacidad por diseño** — el dato nunca sale del navegador; la IA solo recibe contexto agregado | Cumple con clientes sensibles a datos. Sin riesgo de fuga ni compliance caro. |
| **IA token-eficiente** — Gemini/OpenRouter solo con resumen agregado, nunca 10k filas | Costo de IA marginal. Free tier viable en producción. |
| **Conversión inmediata** — demo sin registro, valor en <30s | Tus usuarios/no-analistas llegan al "wow" sin fricción ni onboarding. |
| **Decisiones accionables** — la IA no solo responde, *ejecuta* (filtra, grafica, compara) | De la pregunta al insight en un paso. No alucina cifras: valida contra tus columnas reales. |
| **Multiformato** — CSV, Excel, PDF y Word con un solo upload | Tu equipo usa sus archivos reales, no pierde tiempo re-formateando. |

**Resultado:** análisis que antes tomaba días de un analista queda listo en minutos, en cualquier navegador, con costo casi nulo.

---

## Qué es

Un **AI Data Analyst** diseñado como app de análisis con IA en el centro, no un chatbot pegado a un dashboard.

1. Carga CSV/Excel/PDF/Word (drag & drop, 15 MB) o prueba el demo
2. Perfilado automático (tipos, nulos, valores distintos, min/max)
3. KPIs + gráficos con propósito (tendencia, ranking por ciudad/categoría, producto)
4. Filtra, busca, ordena, compara, detecta anomalías (z-score + IQR)
5. Pregunta en lenguaje natural → la IA emite una acción validada → el dashboard muta
6. Exporta CSV/JSON/PNG, reporte `.md`, comparte por URL, guarda análisis

Demo: `public/demo.csv` (180 filas: `date,product,category,city,sales,units,customers`).

---

## Arquitectura (técnica)

```
User → React → Browser Data Engine (parser + engine puro)
     → Dashboard (KPIs/charts/filters) → AI Chat (useChat / Vercel AI SDK)
     → /api/chat (Vercel Function mínima) → Gemini / OpenRouter → JSON validado
     → DashboardContext (estado único, acciones validadas)
```

Todo lo determinista (parseo, filtrado, agregación, estadística, anomalías) es local y puro.

### Browser Data Engine — `src/data/` (funciones heredadas)
```
parser.ts / universalParser.ts   Papa Parse + extractores Excel/PDF/Word
profiler.ts            type inference, distinct, nulls, min/max
statistics.ts          sum/avg/median/std/percentiles, computeMetrics
transformations.ts     filter/sort/groupBy
anomalyDetection.ts    z-score / IQR
chartAdapter.ts        toTimeSeries + toBarData (auto-detección de columnas)
```

### Capa de IA — Vercel AI SDK v7
- **Frontend:** `ExcelChat.tsx` usa `useChat` (`@ai-sdk/react`) con `DefaultChatTransport` a `/api/chat`. Inyecta contexto agregado y parsea un bloque JSON de acción al final de la respuesta.
- **Acciones validadas** (whitelist de columnas + `isValidFilter`, nunca `eval`): `setFilter`, `clearFilters`, `setChart`, `setDateRange`.
- **Backend único:** `api/chat.ts` — `streamText`/`generateText` con Gemini primario y fallback OpenRouter, 3 modos (chat SSE, `summary`, `extract`), rate-limit 20/min, `GEMINI_API_KEY` solo en server. Nunca envía filas crudas.
- **RAG local (opcional):** `@xenova/transformers` genera embeddings en el navegador para búsqueda semántica; solo snippets al LLM.

### Estado y UI
`src/state/DashboardContext.tsx` (fuente única `rawRows/filters/activeChart` → `useMemo` derivados). Componentes pequeños (≤300 líneas), Radix UI (a11y AA), Pixelarticons, CSS nativo con tokens `:root` (paleta naranja/negro/blanco estilo Excel), `manualChunks` (index ~90KB + recharts lazy).

---

## Stack

| Categoría | Tecnología |
|---|---|
| Framework / Lenguaje | React 19 · TypeScript · Vite · pnpm |
| Estilos / UI | Native CSS + tokens · Radix UI · Pixelarticons |
| Charts / CSV | Recharts · Papa Parse · xlsx · pdfjs · mammoth |
| IA | Vercel AI SDK v7 · Gemini / OpenRouter · @xenova/transformers (RAG) |
| Backend | Vercel Function única (`api/chat.ts`) |

---

## Corre en 3 comandos

```bash
pnpm install
pnpm dev      # http://localhost:5173 — Try demo data
pnpm build    # tsc -b + vite build
```

Requisitos: Node 20+, pnpm 11.22.0. `.env.example` trae `GEMINI_API_KEY=` (server-only, nunca `VITE_`). Sin key el dashboard funciona; la IA hace fallback a OpenRouter si existe `OPENROUTER_API_KEY`.

**Deploy Vercel (2 min):** importa repo → Framework Vite → env `GEMINI_API_KEY` → `api/chat.ts` auto-detectada vía `vercel.json`.

---

## Seguridad y Privacidad

- *Your data stays in your browser.* Sin subida automática del dataset; la IA solo recibe contexto agregado (§8).
- Keys nunca en frontend ni logs. Rate-limit y validación de payload en la Function.
- Acciones de IA validadas contra esquema + whitelist; rechazos logueados.

---

## Quality Gate (verificado)
`pnpm build` ok · sin Tailwind/shadcn/lucide · solo Pixelarticons · sin `VITE_` secrets · sin backend tradicional (solo proxy mínimo) · CSV/Excel/PDF local · KPIs + charts + filtros validados · responsive + a11y AA · ErrorBoundary + empty states.

Fases 0–13 completadas (ver `AGENTS.md` §42/§43).

---
*Construido con pnpm, CSS nativo, Radix, Recharts y Vercel AI SDK. Sin atajos. Sin humo. Solo producto.*
