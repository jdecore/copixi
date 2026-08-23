# Plan: Mascota sticky + voz + RAG local + CopilotKit mejorado

## Decisión clave confirmada
- **RAG por fila completa**: cada fila del CSV se convierte en texto enriquecido y se genera 1 embedding.
- **Doble uso**: (1) mejora CopilotKit inyectando top-K resultados en `useCopilotReadable`; (2) la mascota usa el mismo RAG para hablar con voz nativa.
- **Recursos**: factible. Transformers.js se importa dinámicamente, modelo cacheado en cliente, ~750KB memoria para 500 filas, generación en background.

---

## Fase A — Mascota sticky + voz nativa
**Archivos:** `App.tsx`, `App.css`, `components/ui/Mascota.tsx`

1. **Layout sticky**
   - Dashboard: panel derecho sticky `top: 80px; height: calc(100vh - 100px); overflow-y: auto; width: 320px`.
   - Mobile: mascota fixed bottom-right pequeña (`width: 120px`) con opción de expandir.
   - Landing: mantener columna derecha.

2. **Voz nativa**
   - En `Mascota.tsx`: exponer `speak(text: string)` usando `window.speechSynthesis`.
   - Seleccionar voz en español si existe, fallback default.
   - En `CopilotPanel`: llamar `speak()` en respuestas exitosas e insights.
   - No bloquear UI; queue de frases cortas.

3. **Panel derecho unificado**
   - Si hay datos: pestañas a la izquierda, panel derecho con `Mascota` + mini chat/resumen + botón "Abrir chat completo".
   - Si no hay datos: landing con upload a la izquierda, mascota a la derecha.

---

## Fase B — Embeddings locales con Transformers.js
**Archivos nuevos:** `src/lib/embeddings.ts`, `src/lib/rag.ts`

1. **Instalar dependencia**
   - `pnpm add @xenova/transformers`
   - Import dinámico: `const { pipeline } = await import('@xenova/transformers')`

2. **Generar embeddings**
   - `generateEmbeddings(rows, columns)`:
     - Texto por fila: `"city=Bogotá, product=Widget A, sales=1200, date=2024-01-15"`
     - Pipeline `feature-extraction` con `Xenova/all-MiniLM-L6-v2`
     - Cachear en `Map<number, Float32Array>` por índice de fila
     - Limitar a 500 filas; mostrar progreso si hay más
     - Ejecutar en `requestIdleCallback` o `setTimeout` chunks para no bloquear UI

3. **Indexar y buscar**
   - `buildIndex(embeddings)` → matriz normalizada para similitud coseno
   - `search(query: string, topK: 3)`:
     - Embedding de query
     - Similitud coseno contra índice
     - Retornar top-K filas con score y snippet

---

## Fase C — RAG mejorado para CopilotKit
**Archivos:** `src/components/copilot/CopilotPanel.tsx`, `api/copilotkit.ts`

1. **Nueva acción `ragQuery`**
   - Parámetros: `query: string`, `topK?: number`
   - Handler:
     1. Llamar `search(query, topK ?? 3)` localmente
     2. Formatear resultados como snippets (no filas crudas): `"Row #3: Bogotá, Widget A, $1200"`
     3. Retornar contexto enriquecido al LLM

2. **Actualizar `useCopilotReadable`**
   - Añadir: `embeddingStatus`, `embeddingRowCount`, `topSimilarRows`
   - Permitir que el LLM sepa que puede usar `ragQuery`

3. **Prompt mejorado**
   - Instruir al LLM a usar `ragQuery` para preguntas ambiguas o búsquedas de texto libre
   - Mantener regla de no enviar filas crudas

---

## Fase D — Más gráficos adaptados al archivo
**Archivos:** `src/data/chartAdapter.ts`, `src/App.tsx`

1. **Aumentar densidad de charts**
   - Mostrar hasta 6 charts automáticos (ya los genera `suggestCharts`)
   - Agregar scatter si hay 2 columnas numéricas
   - Agregar barra horizontal para rankings

2. **Responsive grid**
   - Desktop: 2 columnas fijas
   - Tablet: 1 columna
   - Mobile: stack vertical con scroll

---

## Fase E — Integración y polish
**Archivos:** `App.tsx`, `App.css`

1. **Panel derecho unificado**
   - Mascota sticky + subtítulo contextual
   - Mini resumen de IA (versión compacta de CopilotPanel)
   - Botón para expandir chat completo

2. **Subtítulos contextuales**
   - "Cargué 180 filas, 7 columnas"
   - "Encontré 3 anomalías"
   - "Filtros activos: ciudad = Bogotá"

3. **Performance**
   - Lazy load de Transformers.js solo al cargar dataset
   - Progress bar durante generación de embeddings
   - Cache en memoria por sesión

---

## Validación
- `pnpm build` sin errores
- Dev server: demo carga en <30s, embeddings en background
- Mascota: eye-tracking, moods, voz funcionan
- RAG: búsqueda semántica retorna top-K relevantes
- CopilotKit: usa `ragQuery` cuando corresponde
- Mobile: mascota fixed bottom-right, expandible
