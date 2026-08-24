# Plan — Copilot Excel: Redesign Blanco/Negro/Naranja + Mascota Centrada + Chat + TTS + Sin CopilotKit

## Resumen
Reemplazar CopilotKit por un chat propio ligero, centrar la mascota slime arriba, cambiar paleta a blanco/negro/naranja, usar TTS nativo del browser, y mantener la capa de datos colapsable debajo. Backend mínimo: 1 Vercel Function (`api/chat.ts`) como proxy a Gemini con fallback OpenRouter. Sin backend tradicional, sin nuevas dependencias pesadas.

---

## Decisiones tomadas (confirmadas por usuario)
1. **Colores:** fondo `#ffffff`, texto `#0a0a0a`, primary `#ff6b00` (naranja). Tokens CSS nativos se remapean; slime cambia a naranja.
2. **Layout:** Mascota top-center + chat debajo (max-width 720px). Data-layer (gráficas/filtros/tabla) colapsable debajo del chat cuando hay dataset.
3. **IA — Librería chat:** Se usará **Vercel AI SDK** (`ai` + `@ai-sdk/react` + `@ai-sdk/google` + `@ai-sdk/openai`) en lugar de CopilotKit o fetch manual nativo.
   - Frontend: `useChat` de `@ai-sdk/react` maneja messages, input, loading, streaming, abort, errores y retry automáticamente.
   - Backend: `streamText` de `ai` con Google provider para Gemini. Si Gemini falla y existe `OPENROUTER_API_KEY`, fallback con `createOpenAICompatible` apuntando a OpenRouter.
   - Ventaja: menos código custom, streaming robusto, manejo de history nativo, cancelación limpia.
   - Elimina necesidad de `src/lib/chatClient.ts` custom y parseo manual de SSE.
4. **TTS:** Web Speech API nativo como primario. Kokoro-82M **NO se puede ejecutar en el browser** (requiere PyTorch + espeak-ng en servidor). Se descarta para P0. Queda como P2 si luego se añade un backend Python/Vercel Function.
5. **Gráficas:** Se mantiene Recharts para la data-layer colapsable. No se elimina.
6. **Fallback IA:** `api/chat.ts` con `streamText` intenta Google primero; si 4xx/5xx, reintenta con OpenRouter vía `createOpenAICompatible` (si hay key). Si todo falla, `useChat` captura el error y muestra UI amigable.
7. **Privacidad:** Solo contexto agregado al LLM (nunca filas crudas). Igual que antes.
8. **Modelo Gemini confirmado:** `gemini-3.5-flash-lite` (Google) via Vercel AI SDK `@ai-sdk/google`. OpenRouter fallback: `openrouter/auto-beta` vía `@ai-sdk/openai` + `createOpenAICompatible`.
   - ⚠️ **Riesgo conocido:** la key actual falla contra la familia `gemini-3.x` (404/403 documentado en AGENTS.md §43). Si `gemini-3.5-flash-lite` no está habilitado en el proyecto de Google, el backend hará fallback a OpenRouter automáticamente. Si ninguna funciona, se muestra error amigable.

---

## Estructura nueva del layout

```
<header> brand Copixi + badge "Excel Expert" </header>
<main>
  <section class="hero-excel">
    <Mascota moods={escuchando|pensando|hablando|feliz|enojado|neutro} size={220px desktop / 140px mobile} />
    <div id="subtitulos">Estado actual</div>
    <ExcelChat />           // full-width max 720px, input sticky bottom
  </section>

  <section class="data-layer collapsed"> // oculta por defecto, toggle "Ver análisis"
    {hasData && (
      <>
        <FilterBar />
        <div class="charts-full">{autoCharts.map(...)}</div>
        <DataTable />
        <DataProfiler />
        <ExportBar />
      </>
    )}
  </section>
</main>
```

---

## Cambios por archivo

### Tokens y estilos
- **`src/index.css`**
  - Cambiar `--color-primary: #0f62fe` → `#ff6b00`
  - Cambiar `--color-primary-hover: #0353e9` → `#e65f00`
  - Cambiar slime tokens a naranja:
    - `--slime-bg: #fff7ed`
    - `--slime-accent: #ff6b00`
    - `--slime-skin: #ff8c2f`
    - `--slime-skin-light: #ffb86a`
    - `--slime-skin-dark: #c2410c`
    - `--slime-glow: rgba(255,107,0,.25)`
  - Cambiar `*::selection` a `rgba(255,107,0,.14)`
  - Asegurar contraste AA: texto sobre blanco es 21:1; primary sobre blanco en botones grandes > 3:1.

- **`src/App.css`**
  - Eliminar `.dashboard-grid` (2 columnas) y `.mascota-sticky` (fixed/sticky lateral).
  - Crear `.hero-excel { display:flex; flex-direction:column; align-items:center; gap:24px; padding:32px 0; }`
  - Chat container: `max-width:720px; width:100%; margin:0 auto;`
  - Data-layer: `.data-layer { max-width:1200px; margin:0 auto; }` + toggle button.
  - Ajustar `.landing-grid` para que la mascota quede centrada arriba (ya lo está en desktop, mantener order).
  - Actualizar `.btn-primary` para usar `var(--color-text)` (negro) con borde naranja, o naranja sólido con texto blanco. Recomendado: naranja sólido + texto blanco para CTA principal.

### Componentes nuevos
- **`src/lib/tts.ts`** (nuevo)
  - `speak(text, opts?)` → Web Speech API con `SpeechSynthesisUtterance`, rate 0.95, pitch 1.05.
  - `cancel()` → `speechSynthesis.cancel()`.
  - `isSupported()` → boolean.
  - `setMuted(bool)` → persistido en `localStorage copixi:tts-muted`.
  - Exponer `window.mascotaSpeak` (compatibilidad con código existente).

- **`src/components/excel/ExcelChat.tsx`** (nuevo)
  - Usa `useChat` de `@ai-sdk/react` con `api: '/api/chat'`.
  - `useChat` provee: `messages`, `input`, `handleInputChange`, `handleSubmit`, `isLoading`, `error`, `stop`, `reload`.
  - Render custom: lista de mensajes con estilos propio, indicador "CERI está pensando…" cuando `isLoading`.
  - Sugerencias de preguntas Excel: "¿Cómo creo una tabla dinámica?", "Fórmula para eliminar duplicados", etc.
  - Toggle mute TTS.
  - Al completar respuesta (`onFinish` de `useChat`), si no está muteado → `mascotaSpeak(text.slice(0, 300))`.
  - Si la respuesta trae bloque JSON `{action: ...}` al final, parsearlo y validar contra `allowedColumns` / `isValidFilter`, luego dispatch a DashboardContext.
  - Accesible a11y: `aria-label`, `role="log"` en mensajes, focus management.

### Modificaciones a componentes existentes
- **`src/components/ui/Mascota.tsx`**
  - Extender `Mood` type: `'neutro' | 'feliz' | 'enojado' | 'duda' | 'dormido' | 'guino' | 'hablando' | 'escuchando' | 'pensando' | 'exito'`
  - Añadir métodos públicos: `setMood(m)`, `speak(text)` (ya existe), `setListening()`, `setThinking()`, `setSpeaking()`.
  - Exponer vía `window` para que `ExcelChat` pueda controlarla.

- **`src/components/ui/Mascota.css`**
  - Añadir moods:
    - `.mood-escuchando`: ojos abiertos + bounce leve 2px (`animation: escuchar 0.6s steps(2,end) infinite`), sin parpadeo automático.
    - `.mood-pensando`: ojo izquierdo duda + `::after` puntos suspensivos animados + glow naranja pulsante.
    - `.mood-hablando`: reuse `.mood-hablando` existente + mejora de cheeks.
  - Ajustar colores a tokens naranja.

### Backend
- **`api/chat.ts`** (nuevo, reemplaza `api/copilotkit.ts` y `api/gemini.ts`)
  - Rate-limit 20/min (misma lógica que `gemini.ts`).
  - Valida `GEMINI_API_KEY` (server-side).
  - Body: `{ messages: [{role,content}], context?: object }` (formato compatible con `useChat` de AI SDK).
  - Usa `streamText` de `ai` con `google('gemini-3.5-flash-lite')` y `apiKey: process.env.GEMINI_API_KEY`.
  - `system` prompt: experto en Excel (fórmulas, tablas dinámicas, Power Query, validación, gráficos). Responde en español conciso. Si hay `context`, cita columnas reales. Al final puede incluir bloque JSON `{action: ...}`.
  - Si `streamText` falla (4xx/5xx) y existe `OPENROUTER_API_KEY`, reintenta con `createOpenAICompatible` apuntando a `https://openrouter.ai/api/v1` y modelo `openrouter/auto-beta`.
  - Retorna `result.toDataStreamResponse()` (SSE estándar AI SDK).
  - Nunca expone keys.
  - **Nota:** `ai` maneja el `Request` de Vercel automáticamente; no requiere adaptadores `toWebRequest`/`writeWebResponse` custom.

- **Eliminar `api/copilotkit.ts`**
- **Eliminar `src/components/copilot/CopilotPanel.tsx`**
- **Eliminar `src/copilot/a2uiCatalog.tsx`** (si existe)

### Provider y entrypoint
- **`src/main.tsx`**
  - Eliminar imports de `@copilotkit/react-core/v2`, `a2uiCatalog`, `reflect-metadata`, `@copilotkit/react-core/v2/styles.css`.
  - Quitar `<CopilotKit>` wrapper.
  - Mantener `ErrorBoundary` + `DashboardProvider`.

- **`src/App.tsx`**
  - Eliminar import `CopilotPanel` y `Suspense` del copilot.
  - En `hasData` false: landing con mascota centrada + upload.
  - En `hasData` true: sección `hero-excel` (mascota + subtítulo + `ExcelChat`) + sección `data-layer` colapsable debajo.
  - Eliminar `<aside className="mascota-sticky">` y todo el layout 2 columnas.
  - En `DashboardContent`, exponer `window.copixiDashboard = { addFilter, clearFilters, setActiveChart, allowedColumns }` para que `ExcelChat` pueda aplicar acciones validadas.

- **`src/state/DashboardContext.tsx`**
  - No requiere cambios estructurales. Solo asegurar que `isValidFilter` y `allowedColumns` estén accesibles desde `App.tsx` (ya lo están via `useDashboard`).

### Package y config
- **`package.json`**
  - Eliminar: `@copilotkit/a2ui-renderer`, `@copilotkit/react-core`, `@copilotkit/runtime`, `reflect-metadata`.
  - Añadir: `ai` (core Vercel AI SDK), `@ai-sdk/react` (useChat), `@ai-sdk/google` (provider Gemini `gemini-3.5-flash-lite`), `@ai-sdk/openai` (provider OpenRouter fallback `openrouter/auto-beta`).
  - Mantener: `react`, `react-dom`, `recharts`, `papaparse`, `pixelarticons`, `@radix-ui/*`, `zod`, `xlsx`, `pdfjs-dist`, `@xenova/transformers`.
  - Nota: Se añaden 4 deps pero se eliminan 4 deps de CopilotKit (net ~0 deps). Bundle baja ~3.4MB porque CopilotKit es muy pesado.

- **`vercel.json`**
  - Actualizar `functions`:
    - `"api/chat.ts"` con `maxDuration: 30`.
  - Eliminar referencias a `api/copilotkit.ts`.

- **`.env.example`**
  - Añadir `OPENROUTER_API_KEY=` (opcional).
  - Mantener `GEMINI_API_KEY=` (server-only).

- **`src/types/mascota.ts`** (si no existe)
  - Asegurar export de `MascotaMood` con nuevos estados.

---

## Flujo de datos del chat (reemplazo CopilotKit)

```
User escribe pregunta
  ↓
ExcelChat (useChat de @ai-sdk/react) envía messages + context a /api/chat
  ↓
api/chat ejecuta streamText con Google Gemini
  ↓ (si falla)
api/chat reintenta con OpenRouter (si hay OPENROUTER_API_KEY)
  ↓
AI SDK devuelve stream SSE nativo al frontend
  ↓
useChat renderiza mensaje incremental + estado loading/error/stop
  ↓
Al finalizar, si hay bloque JSON {action:...} → validar whitelist → dispatch a DashboardContext
  ↓
Mascota cambia de mood (pensando → hablando → feliz)
  ↓
TTS lee respuesta (si no muteado)
```

---

## Privacidad (§8)
- No se envían filas crudas al LLM.
- `contextAgg` incluye: `rowCount`, `columns` (name/type/distinct), `metrics`, `topProducts`, `salesByCity`, `trends`, `currentFilters`, `suggestedQuestions` (max ~1500 tokens).
- TTS es local (Web Speech API), no sale del browser.

---

## Validación / Quality Gate
- `pnpm install` sin CopilotKit deps, con `ai` + `@ai-sdk/react` + `@ai-sdk/google` + `@ai-sdk/openai`.
- `pnpm dev` funciona.
- `pnpm build` pasa `tsc -b` + `vite build` sin errores.
- `grep` sin `tailwind`, `shadcn`, `lucide`, `VITE_*` secrets.
- Mascota carga en top-center con nueva paleta naranja.
- Chat envía pregunta, recibe respuesta streaming, aplica action JSON valida.
- Si Gemini falla y hay OpenRouter key, fallback funciona.
- TTS nativo habla respuestas; mute toggle persiste en localStorage.
- Data-layer se muestra/oculta con toggle.
- Responsive: mascota 220px desktop / 140px mobile, chat max-width 720px.
- `useChat` maneja estados loading/error/stream correctamente; stop/reload funcionan.

---

## Riesgos
- **Kokoro descartado en P0:** No se puede correr en browser sin backend Python. Si el usuario lo requiere, será P2 con Vercel Python Function (peso ~189MB+ dependencias), lo cual rompe "sin backend" y "frontend-first".
- **Modelo Gemini `gemini-3.5-flash-lite`:** La key actual falla contra la familia `gemini-3.x` (404/403 documentado en AGENTS.md §43). Si no está habilitado en el proyecto de Google, el backend hará fallback a OpenRouter `openrouter/auto-beta`. Si ninguna funciona, se muestra error amigable. **Mitigación:** el código debe intentar Gemini primero, capturar el error, y reintentar con OpenRouter si hay key.
- **Vercel AI SDK:** Añade 4 deps pero elimina 4 deps de CopilotKit (net 0). Bundle esperado: index ~100KB + react ~180KB + recharts ~400KB + ai SDK ~150KB. Total ~30-50KB extra en main chunk; `useChat` es tree-shakeable.
- **OpenRouter fallback:** Solo funciona si el usuario provee `OPENROUTER_API_KEY`. Si no, se muestra error amigable.
- **Action JSON:** El modelo debe incluir el bloque `{action: ...}` al final del mensaje. Si no lo hace, el chat funciona en modo texto plano. No crítico.

---

## Pregunta abierta (requiere respuesta antes de implementar)
1. **¿Modelo Gemini a usar?** La key actual falla contra `gemini-2.5-flash` y familia `gemini-3.x` (documentado en AGENTS.md §43). Opciones seguras: `gemini-1.5-flash` (rápido, free tier) o `gemini-1.5-pro` (mejor calidad). Recomiendo `gemini-1.5-flash` para P0. Si conseguís acceso a `gemini-2.0-flash` o superior, se cambia en una línea.
2. **¿Aprobás usar Vercel AI SDK** (`ai` + `@ai-sdk/react` + `@ai-sdk/google` + `@ai-sdk/openai`) para el chat? Sí => elimino `src/lib/chatClient.ts` custom y uso `useChat` + `streamText`. No => mantengo fetch nativo manual.

> Nota: El usuario ya confirmó "mantener data-layer colapsable debajo del chat como default", así que Recharts se mantiene.
