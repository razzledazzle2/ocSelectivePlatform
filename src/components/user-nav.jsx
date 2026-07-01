'use client'

import { BookOpenCheckIcon } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function UserNav({ profile }) {
  const initials = getInitials(profile.full_name || profile.email || 'User')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="h-11 min-w-[14rem] justify-between rounded-2xl border-white/80 bg-white/90 px-3 shadow-sm shadow-slate-200/50"
          />
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="lg">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? 'User avatar'} />
            <AvatarFallback>{initials || 'U'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-semibold text-foreground">
              {profile.full_name || 'Platform user'}
            </p>
            <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl border bg-white/95 p-0 shadow-xl">
        <div className="space-y-3 p-4">
          <DropdownMenuLabel className="px-0 py-0 text-slate-900">Account</DropdownMenuLabel>
          <div className="rounded-2xl border border-border/80 bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{profile.full_name || 'Platform user'}</p>
                <p className="text-xs text-muted-foreground">{profile.email}</p>
              </div>
              <Badge variant="secondary" className="capitalize">
                {profile.role.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-slate-950 px-3 py-3 text-slate-100">
            <BookOpenCheckIcon className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-sm font-medium">Phase 0 foundation</p>
              <p className="text-xs text-slate-300">
                Auth, roles, routing, and dashboard scaffolding are ready for the next phase.
              </p>
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
