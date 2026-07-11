'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const SHOW_DELAY_MS = 250
const HIDE_DELAY_MS = 200

function isInternalNavigationClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null

  const anchor = (event.target as HTMLElement | null)?.closest('a')
  if (!anchor) return null
  if (anchor.target && anchor.target !== '_self') return null
  if (anchor.hasAttribute('download')) return null

  const href = anchor.getAttribute('href')
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null

  try {
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return null
    if (url.pathname === window.location.pathname && url.search === window.location.search) return null
    return url
  } catch {
    return null
  }
}

function NavigationProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const [complete, setComplete] = useState(false)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!isInternalNavigationClick(event)) return
      if (showTimer.current) clearTimeout(showTimer.current)
      showTimer.current = setTimeout(() => {
        setComplete(false)
        setVisible(true)
      }, SHOW_DELAY_MS)
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  useEffect(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current)
      showTimer.current = null
    }

    if (!visible) return

    setComplete(true)
    hideTimer.current = setTimeout(() => {
      setVisible(false)
      setComplete(false)
    }, HIDE_DELAY_MS)

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-transparent">
      <div
        className="h-full bg-brand transition-[width] ease-out"
        style={{
          width: complete ? '100%' : '70%',
          transitionDuration: complete ? '200ms' : '600ms',
        }}
      />
    </div>
  )
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBar />
    </Suspense>
  )
}
