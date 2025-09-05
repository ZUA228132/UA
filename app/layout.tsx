import Script from 'next/script'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Telegram SDK через прокси */}
        <Script src="/api/telegram-sdk" strategy="beforeInteractive" />
        {/* Human UMD (зафиксированная версия) */}
        <Script
          src="https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.5/dist/human.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
