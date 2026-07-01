import './globals.css'

export const metadata = {
  title: 'OC Selective Platform',
  description: 'Phase 0 foundation for the OC and Selective exam preparation platform.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="theme">{children}</body>
    </html>
  )
}
