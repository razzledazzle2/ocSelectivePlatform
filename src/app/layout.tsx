import './globals.css'
import type { ReactNode } from 'react'

import { NavigationProgress } from '@/components/layout/navigation-progress'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'OC Selective Platform',
  description: 'Phase 0 foundation for the OC and Selective exam preparation platform.',
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <NavigationProgress />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
