'use client'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    human?: any
    Telegram: { WebApp: any }
  }
}

export default function Page(){
  const [status, setStatus] = useState('Loading...')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(()=>{
    let cancelled = false
    const started = Date.now()

    async function tryInit(){
      // bail out after 10s
      if (Date.now() - started > 10000) {
        setStatus('Human load error: timeout (script not found)')
        return
      }
      const human = window.human
      if (!human) {
        setTimeout(tryInit, 200)
        return
      }
      try {
        await human.load()
        await human.warmup()
        const c = canvasRef.current!
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,c.width,c.height)
        const res = await human.detect(c)
        if (!cancelled) setStatus(`Human ready v${human.version}. Faces detected: ${res.face?.length ?? 0}`)
      } catch (e:any) {
        if (!cancelled) setStatus('Human load error: ' + (e?.message || String(e)))
      }
    }
    tryInit()
    return ()=>{ cancelled = true }
  }, [])

  return (
    <main style={{padding:20}}>
      <h1>Human via CDN</h1>
      <p>{status}</p>
      <canvas ref={canvasRef} width={64} height={64} style={{display:'none'}} />
    </main>
  )
}
