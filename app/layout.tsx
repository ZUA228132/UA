// app/layout.tsx
export const metadata = {
  title: 'TG Face WebApp',
  description: 'FaceID-like WebApp',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk"> {/* язык UI — украинский */}
      <head>
        {/* Телеграм SDK через ваш прокси */}
        <script src="/api/telegram-sdk" />
        {/* Human UMD с CDN */}
        <script src="https://cdn.jsdelivr.net/npm/@vladmandic/human/dist/human.js" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body style={{ background: '#000', color: '#fff', margin: 0 }}>{children}</body>
    </html>
  )
}
