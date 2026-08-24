import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CopilotKit } from '@copilotkit/react-core/v2'
import { a2uiCatalog, a2uiTheme } from './copilot/a2uiCatalog'
import './index.css'
import 'pixelarticons/fonts/pixelart-icons-font.css'
import '@copilotkit/react-core/v2/styles.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CopilotKit runtimeUrl="/api/copilotkit" a2ui={{ theme: a2uiTheme, catalog: a2uiCatalog }}>
      <App />
    </CopilotKit>
  </StrictMode>,
)
