import { LogOutIcon } from 'lucide-react'

import { signOutAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'

export function SignOutButton({ className, variant = 'outline' }) {
  return (
    <form action={signOutAction} className={className}>
      <Button type="submit" variant={variant} className="w-full justify-start">
        <LogOutIcon className="size-4" />
        Sign out
      </Button>
    </form>
  )
}
