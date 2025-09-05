'use client'
import { useEffect, useState } from 'react'

declare global {
  interface Window {
    Human: any
    Telegram: { WebApp: any }
  }
}

export default function Page() {
  const [status, setStatus] = useState('Loading...')

  useEffect(() => {
    (async () => {
      try {
        // Human берём из UMD, который подключен в layout.tsx
        const Human = window.Human
        if (!Human) throw new Error('Human UMD not loaded')

        const h = new Human({
          modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
          face: {
            enabled: true,
            detector: { rotation: true, rotate: true, maxDetected: 1 },
            mesh: { enabled: true },
            description: { enabled: true },
          },
        })

        await h.load()
        setStatus('Human loaded OK (CDN)')
      } catch (e: any) {
        setStatus('Human load error: ' + e.message)
      }
    })()
  }, [])

  return (
    <main style={{ padding: 20 }}>
      <h1>Human via CDN</h1>
      <p>{status}</p>
    </main>
  )
}
