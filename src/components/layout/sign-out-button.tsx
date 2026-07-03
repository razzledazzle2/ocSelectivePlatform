import { LogOutIcon } from 'lucide-react'

import { signOutAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import type { ButtonVariant } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SignOutButtonProps {
  className?: string
  /** Extra classes for the inner button (e.g. to restyle it on the navy sidebar). */
  buttonClassName?: string
  variant?: ButtonVariant
}

export function SignOutButton({ className, buttonClassName, variant = 'outline' }: SignOutButtonProps) {
  return (
    <form action={signOutAction} className={className}>
      <Button type="submit" variant={variant} className={cn('w-full justify-start', buttonClassName)}>
        <LogOutIcon className="size-4" />
        Sign out
      </Button>
    </form>
  )
}
