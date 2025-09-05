export const metadata = { title: "TG Face WebApp Enterprise", description: "FaceID-like WebApp" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* Load from our own domain to bypass CORP quirks */}
        <script src="/api/telegram-sdk"></script>
        <script src="/api/human"></script>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body style={{ background: 'var(--tg-theme-bg-color)', color: 'var(--tg-theme-text-color)' }}>
        {children}
      </body>
    </html>
  )
}
