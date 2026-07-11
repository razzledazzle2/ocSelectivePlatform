'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpenIcon,
  ChartNoAxesColumnIcon,
  ClipboardListIcon,
  FlagIcon,
  GaugeIcon,
  GraduationCapIcon,
  LayersIcon,
  MenuIcon,
  RotateCcwIcon,
  TimerIcon,
  UploadCloudIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { SignOutButton } from '@/components/layout/sign-out-button'
import { UserNav } from '@/components/layout/user-nav'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { AppProfile, NavigationIconName, NavigationItem } from '@/lib/types'

const navigationIcons: Record<NavigationIconName, LucideIcon> = {
  gauge: GaugeIcon,
  'book-open': BookOpenIcon,
  revision: RotateCcwIcon,
  'clipboard-list': ClipboardListIcon,
  timer: TimerIcon,
  users: UsersIcon,
  flag: FlagIcon,
  layers: LayersIcon,
  chart: ChartNoAxesColumnIcon,
  upload: UploadCloudIcon,
}

interface ShellNavProps {
  navigation: NavigationItem[]
  pathname: string
  profile: AppProfile
  portalLabel: string
  accessory?: ReactNode
}

function ShellNav({ navigation, pathname, profile, portalLabel, accessory }: ShellNavProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          <GraduationCapIcon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-wide text-white">MINERVA</p>
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.22em] text-sidebar-foreground/60">
            Education
          </p>
        </div>
      </div>

      <p className="px-5 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/50">
        {portalLabel}
      </p>

      {accessory ? <div className="px-4 pb-4">{accessory}</div> : null}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = navigationIcons[item.icon]

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
              )}
            >
              {isActive ? (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
              ) : null}
              <Icon className={cn('size-4 shrink-0', isActive && 'text-sidebar-primary')} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Signed-in user */}
      <div className="space-y-3 border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/50 px-3 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            {(profile.full_name || profile.email || 'U')
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase())
              .join('')}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {profile.full_name || 'Signed-in user'}
            </p>
            <p className="truncate text-xs capitalize text-sidebar-foreground/60">
              {profile.role.replace('_', ' ')}
            </p>
          </div>
        </div>
        <SignOutButton
          variant="ghost"
          buttonClassName="text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
        />
      </div>
    </div>
  )
}

interface AppShellProps {
  title: string
  description: string
  navigation: NavigationItem[]
  profile: AppProfile
  children: ReactNode
  /** Rendered under the portal label in the sidebar (e.g. program switcher). */
  sidebarAccessory?: ReactNode
  /** Rendered in the top bar where the desktop sidebar is hidden (mobile/tablet). */
  headerAccessory?: ReactNode
}

export function AppShell({
  title,
  description,
  navigation,
  profile,
  children,
  sidebarAccessory,
  headerAccessory,
}: AppShellProps) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
        <ShellNav
          navigation={navigation}
          pathname={pathname}
          profile={profile}
          portalLabel={title}
          accessory={sidebarAccessory}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet>
                <SheetTrigger render={<Button variant="outline" size="icon-lg" className="lg:hidden" />}>
                  <MenuIcon className="size-4" />
                  <span className="sr-only">Open navigation</span>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Portal navigation</SheetTitle>
                  </SheetHeader>
                  <ShellNav
                    navigation={navigation}
                    pathname={pathname}
                    profile={profile}
                    portalLabel={title}
                    accessory={sidebarAccessory}
                  />
                </SheetContent>
              </Sheet>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                <p className="hidden truncate text-xs text-muted-foreground sm:block">{description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {headerAccessory ? <div className="lg:hidden">{headerAccessory}</div> : null}
              <div className="hidden sm:block">
                <UserNav profile={profile} />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
