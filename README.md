# Copixi — Your AI Data Analyst
### Convierte CSVs en decisiones en 30 segundos. Sin backend. Sin riesgo. Solo resultados.

> **AI-native analytics product, listo para producción.** Sube un CSV o prueba el demo → obtén KPIs, tendencias, anomalías y pregunta en lenguaje natural: *“Show me sales from Bogotá”* → el dashboard se actualiza solo.
>
> **Busco equipo donde construir productos que importen.** Si necesitas un frontend que piense en producto, performance y negocio — hablemos.

**Live Demo:** `pnpm dev` → http://localhost:5173 → **Try demo data** (valor en <30s, sin registro)
**Stack de alto nivel:** React 19 · TypeScript · Vite · Radix UI · Recharts · Papa Parse · CopilotKit · Gemini (Vercel Function)
**Filosofía:** `DATA → ANALYSIS → AI → ACTION → DECISION` — la IA no chatea, **acciona**.

---

## ¿Por qué contratarme a través de Copixi?

Copixi no es un tutorial. Es una **decisión de arquitectura vendible**:

| Lo que demuestra | Por qué le importa a tu negocio |
|---|---|
| **Frontend-first** — 100% del cálculo en el navegador (Papa Parse + engine puro) | **0$ de infra.** Escala a miles de usuarios sin servidores, sin Docker, sin DB. Tu margen sube. |
| **IA token-eficiente** — solo contexto agregado al LLM, nunca filas crudas | **90% menos costo de Gemini.** Free tier viable. Privacidad real, no marketing. |
| **AI Actions validadas** — whitelist de columnas/operadores, nunca `eval` | **Seguridad y confianza.** La IA no puede romper tu dashboard ni filtrar datos. |
| **Producto antes que código** — landing con 2 CTAs, demo sin login, <30s al “wow” | **Conversión.** Flujo `Anonymous → Value → Optional Save` (§31). No pierdes usuarios en un signup. |
| **Craft de portfolio-grade** — design tokens CSS nativo, Radix a11y AA, Responsive, skeletons, ErrorBoundary, manualChunks (90KB index) | **Velocidad y calidad percibida.** Se siente Linear/Notion, no un dashboard de bootcamp. |

**Si tu equipo necesita alguien que entregue P0 en días, no semanas, y que tome decisiones de trade-off con criterio de negocio — soy esa persona.**

> **Disponible para roles Frontend / Product Engineer / AI Product.** Stack: React/TypeScript/Vite/pnpm. Inglés/español. Remoto/híbrido.

**Contacta:** [LinkedIn](#) · [Portfolio](#) · `tu-email@dominio.com` — Respondo en 24h. **¿Quieres ver Copixi en vivo? Agenda 15 min y lo deployamos en tu Vercel.**

---

## Qué es Copixi

**Copixi es un AI Data Analyst para negocio.** Diseñado como **app de análisis con IA en el centro**, no como chatbot pegado a un dashboard.

1. Carga un CSV (drag & drop, 15 MB)
2. Perfilado automático (tipos, nulos, distinct, min/max)
3. KPIs + 4 gráficos con propósito (Area mensual, Bar ciudad/categoría, Line producto)
4. Filtra, busca, ordena, compara
5. Detecta anomalías (z-score + IQR)
6. Pregunta: *“Compare Bogotá vs Medellín”* o *“Set chart pie city vs sales”*
7. La IA ejecuta acciones estructuradas → el dashboard muta → obtienes insight y recomendación
8. Exporta CSV/JSON/PNG y reporte `.md` — todo local — guarda análisis para volver después

**Demo incluida:** `public/demo.csv` — 180 filas con `date,product,category,city,sales,units,customers` (tendencias, rankings, picos/caídas).

---

## Problema → Solución (pensado para vender)

**Problema real:** PYMES y equipos tienen CSVs valiosos pero sin analista. BI tradicional es caro y lento. Los chatbots genéricos alucinan cifras y te obligan a subir datos sensibles.

**Solución Copixi:**
- **Frontend-first** = sin backend tradicional (§5.4/§6/§11 solo Vercel Function mínima para proteger `GEMINI_API_KEY`). Despliegas en Vercel en 2 minutos.
- **Privacidad por diseño** (§8): *Your data stays in your browser.* El LLM solo ve `{ rowCount, columns, metrics, topProducts, salesByCity, trends, currentFilters }`. Nunca 10k filas.
- **UX que convierte:** Landing `Your AI Data Analyst` + `Turn raw business data into clear decisions.` → CTA `Analyze your data` + `Try demo data`. Sin fricción.

**Resultado:** Usuario a valor en <30s, costo IA mínimo, cero infra, experiencia premium.

---

## Features que cierran clientes

**P0 — Core (ya genera valor)**
- Upload impecable: drag & drop + picker, estados idle/loading/success/error, validación `text/csv` + `.csv` + 15 MB, mensaje accionable, meta `name/size/rows/cols`, retry / try demo (nunca pantalla vacía §27)
- Profiling + KPIs (total/avg sales, units, customers) + 4 charts Recharts con `ResponsiveContainer` + tooltips + empty states
- FilterBar validado (whitelist columnas + operadores `equals|contains|gt|lt|between`, datalist ≤50 distinct, chips, clear all, `isValidFilter`)
- DataTable: búsqueda global, sort con `aria-sort`, paginación 10/page
- Insights determinísticos (6): top city/category/product, highest sale, anomaly — sin LLM (§7)
- AI Analyst: CopilotKit `useCopilotReadable` (solo agregado) + 6 `useCopilotAction` validadas

**P1 — Retención sin fricción**
- Sin login para probar. Guardado opcional localStorage (`src/lib/storage.ts` — abstracción swap-ready a InsForge): 20 análisis / 50 history, nunca filas crudas
- Restaura filtros/charts en 1 click (`copixi:restore-analysis`)

**P2 — Valor avanzado**
- Export CSV/JSON/PNG (SVG→canvas 2×) + reporte `.md` — 100% Blob local, sin servidor
- Anomalías avanzadas: z-score 1.5–4 slider + IQR 1.5×, preferencia persistida
- Comparación lado a lado: elige 2–5 valores (city/product/category) → tabla Rows/Sales/Units/Customers (sum local, no LLM)

---

## Cómo funciona (para CTOs y para negocio)

### Arquitectura Frontend-First

```
User → React → Browser Data Engine (Papa Parse + engine puro)
→ Analytics → Dashboard → Copilot (CopilotKit + Gemini) → AI Actions validadas → Dashboard State
```

Todo lo determinista es local y testeable. El LLM solo traduce lenguaje → JSON.

### Browser Data Engine (`src/data/` — funciones puras)

```
parser.ts              Papa Parse + validateFile
profiler.ts            type inference, distinct, nulls, min/max
statistics.ts          sum/avg/median/std/percentiles, computeMetrics
transformations.ts     filter/sort/groupBy
anomalyDetection.ts    z-score / IQR
chartAdapter.ts        toTimeSeries (YYYY-MM) + toBarData
types.ts               Row, ColumnMeta, Filter, Metrics, ChartConfig
```

### IA que acciona (no solo responde)

```
React (useCopilotReadable agregado + 6 useCopilotAction)
  → /api/copilotkit (Vercel Function minimal)
  → Gemini gemini-2.0-flash → JSON validado → DashboardContext
```

**Proxy mínimo** `api/copilotkit.ts`: `CopilotRuntime` + `GoogleGenerativeAIAdapter`, `GEMINI_API_KEY` solo en server (nunca `VITE_`), valida payload, rate-limit 20/min, CORS. Fallback `api/gemini.ts`.

**6 AI Actions validadas** (§13):

```ts
setFilter      // { column whitelist, operator, value, value2 }
clearFilters
setChart       // { chartType line|bar|area|pie, x, y whitelisted }
setDateRange   // { from, to } → Date.parse + filters date gt/lt
compareValues  // { column, values[2..5] } → sum sales local
showInsight    // { insight ≤600 chars } → insightLog
```

Rechazos logueados en dev + `setError` visible.

### Estado y UI

`src/state/DashboardContext.tsx` — single source `rawRows/filters/activeChart` → `useMemo` derivados, handlers validados, `CustomEvent` para restore. Componentes ≤300 líneas, `ui/data/dashboard/copilot/history`, Radix a11y, Pixelarticons 48+ usos, CSS nativo con tokens `:root`, manualChunks (react 180KB / recharts 401KB / copilot 3.4MB lazy), `Suspense` lazy CopilotPanel.

---

## Seguridad y Privacidad (argumento de venta)

> **Your data stays in your browser whenever possible. (§8)**

- Sin subida automática de dataset a servidor.
- Sin envío de filas a LLM — solo agregado token-eficiente (§9 free tier).
- Exports y guardado 100% `Blob`/`localStorage` local. InsForge futuro sería opt-in con consentimiento.
- `GEMINI_API_KEY` nunca en frontend, nunca en logs. Solo Vercel env var.

**Para tu empresa:** cumples con clientes sensibles a datos sin sobre-ingeniería.

---

## Stack — elegido para ganar

| Categoría | Tecnología | Por qué |
|---|---|---|
| Framework | React 19 + TypeScript | Tipado, ecosistema, hiring pool |
| Build | Vite 8, pnpm only | Rápido, reproducible, sin `npm` |
| Estilos | Native CSS + CSS Modules, tokens `:root` | Sin Tailwind — control total, bundle pequeño |
| UI | Radix UI | a11y AA sin reinventar |
| Iconos | Pixelarticons only | Consistencia, sin lucide/FA |
| Charts | Recharts | Propósito analítico, no decoración |
| CSV | Papa Parse | Estándar probado |
| AI | CopilotKit + Gemini `2.0-flash` | AI-native UI, free tier |
| Deploy | Vercel + Functions mínimas | Proxy seguro sin backend |

**Disciplina de deps (§34):** antes de añadir una lib, ¿lo resuelve React / Radix / browser / dep existente? No.

---

## Corre en 3 comandos

```bash
pnpm install
pnpm dev      # http://localhost:5173 — Try demo data
pnpm build    # tsc -b + vite build
pnpm preview  # http://localhost:4173
```

Requisitos: Node 20+, pnpm 11.22.0 (`packageManager`). `.env.example` trae `GEMINI_API_KEY=` server-only (copia a `.env.local`, nunca `VITE_`). Sin `.env` el dashboard funciona; la IA responde “configura key en Vercel”.

**Deploy Vercel (2 min):**

1. Importa repo → Framework Vite, `pnpm build`, `dist`
2. Env var `GEMINI_API_KEY` (server only)
3. Functions `api/copilotkit.ts` + `api/gemini.ts` auto-detectadas vía `vercel.json`

---

## Quality Gate — todo verificado (§38)

```
pnpm install/dev/build OK, tsc sin errores, 90KB index (lazy copilot 3.4MB)
Sin Tailwind/shadcn/lucide, solo Pixelarticons
Sin VITE_ secrets, GEMINI_API_KEY solo api/*.ts
Sin backend tradicional, solo proxy mínimo rate-limited
CSV Papa Parse local + demo <30s
KPIs + 4 charts + filtros validados
AI actions validadas + log
Responsive desktop>tablet>mobile + a11y AA (skip-link, focus-visible, Radix, semantic)
ErrorBoundary + retry/demo + empty states (nunca pantalla vacía)
```

Fases 0–6 completadas. Ver `AGENTS.md` §42/§43.

---

## Roadmap y por qué sigo

- **Hecho:** Fundación → Dashboard → AI-Native → Polish → P1/P2 → Release comercial
- **Siguiente con ROI:** multi-dataset tabs + PDF jsPDF (si justificado §34/§41), InsForge SDK real (swap de `storage.ts`), auth opcional pulida
- **Cómo trabajo:** Conventional Commits, PRs pequeños, `AGENTS.md` como contrato vivo (§39/§41), Quality Gate antes de “done”

**¿Te sirve alguien que entrega producto vendible, no solo código?** Copixi es la prueba.

---

### ¿Hablamos?

**Busco rol donde el frontend genere negocio.** Si te gustó cómo pienso producto + IA + performance + seguridad — escríbeme y lo llevamos a tu caso de uso en una semana.

- **Email:** tu-email@dominio.com
- **LinkedIn:** linkedin.com/in/tu-perfil
- **Portfolio:** tu-portfolio.com (aquí Copixi en vivo)
- **Disponibilidad:** inmediata · Remoto / Híbrido · Inglés C1

> *“No me contrates por las líneas de código. Contrátame por las decisiones que te ahorran infra, tokens y usuarios perdidos.”*

---
*Construido con pnpm, CSS nativo, Radix, Recharts y CopilotKit. Sin atajos. Sin humo. Solo producto.*
