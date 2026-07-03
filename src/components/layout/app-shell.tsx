'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpenIcon,
  ClipboardListIcon,
  FlagIcon,
  GaugeIcon,
  GraduationCapIcon,
  MenuIcon,
  RotateCcwIcon,
  SparklesIcon,
  TimerIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { SignOutButton } from '@/components/layout/sign-out-button'
import { UserNav } from '@/components/layout/user-nav'
import { Button, buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
}

interface ShellNavProps {
  navigation: NavigationItem[]
  pathname: string
  profile: AppProfile
  mobile?: boolean
}

function ShellNav({ navigation, pathname, profile, mobile = false }: ShellNavProps) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn('space-y-4', mobile ? 'px-4 pb-4' : 'px-5 pb-5 pt-5')}>
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300/60">
            <GraduationCapIcon className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">OC Selective Platform</p>
            <p className="text-xs text-muted-foreground">Phase 0 foundation</p>
          </div>
        </div>
        <div className="rounded-3xl border border-border/80 bg-slate-950 px-4 py-4 text-slate-100">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-300">
            <SparklesIcon className="size-3.5" />
            Active role
          </div>
          <p className="mt-3 text-lg font-semibold capitalize">{profile.role.replace('_', ' ')}</p>
          <p className="mt-1 text-sm text-slate-300">
            {profile.full_name || profile.email || 'Signed-in user'}
          </p>
        </div>
      </div>

      <Separator />

      <nav className="flex-1 space-y-2 px-4 py-5">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = navigationIcons[item.icon]

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                buttonVariants({
                  variant: isActive ? 'secondary' : 'ghost',
                  size: 'lg',
                }),
                'h-11 w-full justify-start rounded-2xl px-4 text-sm',
                isActive && 'bg-white text-slate-950 shadow-sm'
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 pb-4">
        <SignOutButton variant="outline" />
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
}

export function AppShell({ title, description, navigation, profile, children }: AppShellProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen px-4 py-4 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl gap-6">
        <aside className="hidden w-80 shrink-0 overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-xl shadow-slate-200/60 backdrop-blur lg:block">
          <ShellNav navigation={navigation} pathname={pathname} profile={profile} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="sticky top-4 z-20 rounded-[2rem] border border-white/70 bg-white/80 px-4 py-4 shadow-lg shadow-slate-200/50 backdrop-blur sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Sheet>
                  <SheetTrigger render={<Button variant="outline" size="icon-lg" className="lg:hidden" />}>
                    <MenuIcon className="size-4" />
                    <span className="sr-only">Open navigation</span>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[20rem] bg-white/95 p-0">
                    <SheetHeader className="sr-only">
                      <SheetTitle>Portal navigation</SheetTitle>
                    </SheetHeader>
                    <ShellNav navigation={navigation} pathname={pathname} profile={profile} mobile />
                  </SheetContent>
                </Sheet>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-700">Minerva internal</p>
                  <h1 className="truncate text-2xl font-semibold text-slate-950">{title}</h1>
                  <p className="hidden text-sm text-muted-foreground sm:block">{description}</p>
                </div>
              </div>
              <div className="hidden sm:block">
                <UserNav profile={profile} />
              </div>
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
