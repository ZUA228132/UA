'use client'
import { useEffect, useRef, useState } from 'react'
// use browser ESM build of Human to avoid tfjs-node
const loadHuman = async () => (await import('@vladmandic/human/dist/human.esm.js')).default

declare global { interface Window { Telegram: { WebApp: any } } }

export default function Page(){
  const [status, setStatus] = useState('Ready')
  useEffect(()=>{
    (async()=>{
      const Human = await loadHuman()
      const h = new Human({ modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
        face: { enabled:true, detector:{ rotation:true, rotate:true, maxDetected:1 }, mesh:{ enabled:true }, description:{ enabled:true } } })
      await h.load(); setStatus('Human loaded')
    })()
  }, [])
  return (
    <main style={{padding:20}}>
      <h1>Test Page</h1>
      <p>{status}</p>
    </main>
  )
}
