import './globals.css'
import Script from 'next/script'

export const metadata = {
  title: 'TG Face WebApp Enterprise',
  description: 'FaceID-like WebApp',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <head>
        {/* Telegram SDK */}
        <Script src="/api/telegram-sdk" strategy="beforeInteractive" />
        {/* Human UMD локально из public/ */}
        <Script src="/human.js" strategy="beforeInteractive" />
      </head>
      <body>{children}</body>
    </html>
  )
}
