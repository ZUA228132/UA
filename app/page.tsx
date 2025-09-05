'use client'
import { useEffect, useState } from 'react'

declare global {
  interface Window {
    human: any
    Telegram: { WebApp: any }
  }
}

export default function Page(){
  const [status, setStatus] = useState('Loading...')

  useEffect(()=>{
    (async()=>{
      try {
        const human = (window as any).human
        if (!human) throw new Error('Human UMD not loaded')
        await human.load()
        await human.warmup()
        const oc = new OffscreenCanvas(64, 64) // sanity-check frame
        const res = await human.detect(oc)
        setStatus(`Human ready. Faces detected: ${res.face?.length ?? 0}`)
      } catch (e:any) {
        setStatus('Human load error: ' + e.message)
      }
    })()
  }, [])

  return (
    <main style={{padding:20}}>
      <h1>Human via CDN</h1>
      <p>{status}</p>
    </main>
  )
}
