'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutButton } from '@/components/layout/sign-out-button'
import type { AppProfile } from '@/lib/types'

function getInitials(name = ''): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

interface UserNavProps {
  profile: AppProfile
}

export function UserNav({ profile }: UserNavProps) {
  const initials = getInitials(profile.full_name || profile.email || 'User')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-11 gap-3 rounded-xl px-2 hover:bg-muted"
          />
        }
      >
        <Avatar size="lg">
          <AvatarFallback className="bg-primary text-primary-foreground">{initials || 'U'}</AvatarFallback>
        </Avatar>
        <div className="hidden min-w-0 text-left md:block">
          <p className="max-w-[11rem] truncate text-sm font-semibold text-foreground">
            {profile.full_name || 'Platform user'}
          </p>
          <p className="max-w-[11rem] truncate text-xs text-muted-foreground">{profile.email}</p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl p-0 shadow-xl">
        <div className="space-y-3 p-4">
          <DropdownMenuLabel className="px-0 py-0">Account</DropdownMenuLabel>
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {profile.full_name || 'Platform user'}
                </p>
                <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 capitalize">
                {profile.role.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <SignOutButton variant="outline" />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
