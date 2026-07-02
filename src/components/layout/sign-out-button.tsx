import { LogOutIcon } from 'lucide-react'

import { signOutAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import type { ButtonVariant } from '@/components/ui/button'

interface SignOutButtonProps {
  className?: string
  variant?: ButtonVariant
}

export function SignOutButton({ className, variant = 'outline' }: SignOutButtonProps) {
  return (
    <form action={signOutAction} className={className}>
      <Button type="submit" variant={variant} className="w-full justify-start">
        <LogOutIcon className="size-4" />
        Sign out
      </Button>
    </form>
  )
}
