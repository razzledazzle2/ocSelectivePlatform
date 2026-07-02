import './globals.css'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'OC Selective Platform',
  description: 'Phase 0 foundation for the OC and Selective exam preparation platform.',
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="theme">{children}</body>
    </html>
  )
}
