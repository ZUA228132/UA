'use client'
import { useEffect, useState } from 'react'

declare global {
  interface Window {
    Human: any
  }
}

export default function Page() {
  const [status, setStatus] = useState('Loading...')

  useEffect(() => {
    (async () => {
      try {
        const human = window.Human
        if (!human) throw new Error('Human not loaded')

        await human.load({
          modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
          face: {
            enabled: true,
            detector: { rotation: true, rotate: true, maxDetected: 1 },
            mesh: { enabled: true },
            description: { enabled: true },
          },
        })

        setStatus('✅ Human loaded OK (UMD)')
      } catch (e: any) {
        setStatus('Human load error: ' + e.message)
      }
    })()
  }, [])

  return (
    <main style={{ padding: 20 }}>
      <h1>Human via CDN (UMD)</h1>
      <p>{status}</p>
    </main>
  )
}
