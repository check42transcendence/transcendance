import { useState } from 'react'

function App() {
  const [status, setStatus] = useState('Not checked')
  const [loading, setLoading] = useState(false)

  async function checkBackend() {
    setLoading(true)
    setStatus('Checking...')

    try {
      const response = await fetch('/api/health')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.status !== 'ok') {
        throw new Error('Unexpected response')
      }

      setStatus('Backend is running')
    } catch {
      setStatus('Unable to verify backend status')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <h1>Travel Planner</h1>
      <p>Plan your next trip together.</p>

      <button onClick={checkBackend} disabled={loading}>
        Check backend
      </button>

      <p role="status">{status}</p>
    </main>
  )
}

export default App
