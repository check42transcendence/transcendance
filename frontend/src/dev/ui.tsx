import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '../index.css'
import { UiPreview } from './UiPreview'

// Starts the standalone UI preview.
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <UiPreview />
    </StrictMode>,
)
