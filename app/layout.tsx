import Script from 'next/script'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://cdn.jsdelivr.net/npm/@vladmandic/human/dist/human.js"
          strategy="beforeInteractive"
        />
        <Script
          src="/api/telegram-sdk" // через прокси, чтобы не было CORP-блокировки
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
