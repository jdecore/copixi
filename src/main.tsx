import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CopilotKit } from '@copilotkit/react-core'
import './index.css'
import 'pixelarticons/fonts/pixelart-icons-font.css'
import '@copilotkit/react-ui/styles.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CopilotKit runtimeUrl="/api/copilotkit" agent="default">
      <App />
    </CopilotKit>
  </StrictMode>,
)
