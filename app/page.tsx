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
    // ждём загрузку human.js
    function initHuman() {
      if (window.human) {
        (async()=>{
          try {
            await window.human.load()
            await window.human.warmup()
            const res = await window.human.detect(new OffscreenCanvas(64,64))
            setStatus(`Human ready. Faces detected: ${res.face?.length ?? 0}`)
          } catch (e:any) {
            setStatus('Human load error: ' + e.message)
          }
        })()
      } else {
        setTimeout(initHuman, 200) // повторяем, пока не появится
      }
    }
    initHuman()
  }, [])

  return (
    <main style={{padding:20}}>
      <h1>Human via CDN</h1>
      <p>{status}</p>
    </main>
  )
}
