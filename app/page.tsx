'use client'
import { useEffect, useState } from 'react'

// Keep import to package root; alias in next.config.js forces ESM browser build
const loadHuman = async () => (await import('@vladmandic/human')).default

export default function Page(){
  const [status, setStatus] = useState('Loading...')
  useEffect(()=>{
    (async()=>{
      const Human = await loadHuman()
      const h = new Human({ modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
        face: { enabled:true, detector:{ rotation:true, rotate:true, maxDetected:1 }, mesh:{ enabled:true }, description:{ enabled:true } } })
      await h.load(); setStatus('Human loaded OK')
    })().catch(e=>setStatus('Human load error: '+e.message))
  }, [])
  return (
    <main style={{padding:20}}>
      <h1>Human ESM Test</h1>
      <p>{status}</p>
    </main>
  )
}
