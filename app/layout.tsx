// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'Верифікація',
  description: 'FaceID-верифікація користувачів',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <head>
        {/* Human.js подключаем как UMD до рендера */}
        <Script
          src="https://cdn.jsdelivr.net/npm/@vladmandic/human/dist/human.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="bg-black text-white">
        {children}
      </body>
    </html>
  )
}
