// app/layout.tsx
import './globals.css'
import { ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* подключаем Human.js глобально */}
        <script
          src="https://cdn.jsdelivr.net/npm/@vladmandic/human/dist/human.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
