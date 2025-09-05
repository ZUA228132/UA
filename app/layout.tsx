
export const metadata = { title: "TG Face WebApp Enterprise", description: "FaceID-like: review queue, export/import, logs, charts, deep links" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body style={{ background: 'var(--tg-theme-bg-color)', color: 'var(--tg-theme-text-color)' }}>
        {children}
      </body>
    </html>
  )
}
