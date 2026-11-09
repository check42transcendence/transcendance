import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './index.css'
import App from './App.tsx'

// Start Activity mocks only when explicitly enabled in development.
async function startApp(): Promise<void> {
    if (
        import.meta.env.DEV &&
        import.meta.env.VITE_ACTIVITY_MOCKS === 'true'
    ) {
        const { worker } = await import('./mocks/browser')

        // Wait for interception; let unmatched requests reach the real backend.
        await worker.start({
            onUnhandledFrame: 'bypass',
        })
    }

    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </StrictMode>,
    )
}

startApp().catch((error: unknown) => {
    console.error('Unable to start the application:', error)
})
