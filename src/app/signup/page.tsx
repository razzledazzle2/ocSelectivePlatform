import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SparklesIcon } from 'lucide-react'

import { signUpAction } from '@/app/actions/auth'
import { getCurrentUserProfile } from '@/lib/auth/get-current-profile'
import { getRoleRedirectPath } from '@/lib/auth/role-redirect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuthPageSearchParams } from '@/lib/types'

interface SignupPageProps {
  searchParams?: Promise<AuthPageSearchParams>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const profile = await getCurrentUserProfile()

  if (profile) {
    redirect(getRoleRedirectPath(profile.role))
  }

  const params = (await searchParams) ?? {}
  const error = typeof params.error === 'string' ? params.error : undefined

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-white/80 bg-white/85 shadow-2xl shadow-slate-200/60 backdrop-blur">
          <CardContent className="flex h-full flex-col justify-between p-8 sm:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-700">
                <SparklesIcon className="size-3.5" />
                Student onboarding
              </div>
              <h1 className="mt-6 text-3xl font-semibold text-slate-950">Create a student account</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                New signups land as students by default. Their profile row is created automatically from
                Supabase Auth metadata so the platform can route them into the correct experience.
              </p>
            </div>
            <div className="rounded-3xl border border-border/80 bg-slate-950 p-5 text-slate-100">
              <p className="text-sm font-medium">What is included in Phase 0?</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>Secure email/password authentication</li>
                <li>Role-aware redirects and protected dashboards</li>
                <li>Profile scaffolding for later learning features</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/92 shadow-2xl shadow-slate-200/60 backdrop-blur">
          <CardHeader className="space-y-3">
            <div>
              <CardTitle className="text-3xl">Sign up</CardTitle>
              <CardDescription className="mt-2 text-sm">
                This form uses Supabase Auth and stores the initial profile metadata for the profile trigger.
              </CardDescription>
            </div>
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}
          </CardHeader>
          <CardContent>
            <form action={signUpAction} className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" name="full_name" placeholder="Ava Nguyen" required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="student@minerva.edu" required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" placeholder="Create a password" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_exam">Target exam</Label>
                <Input id="target_exam" name="target_exam" placeholder="Selective" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year_level">Year level</Label>
                <Input id="year_level" name="year_level" type="number" min="3" max="12" placeholder="5" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" size="lg" className="h-11 w-full rounded-2xl">
                  Create account
                </Button>
              </div>
            </form>
            <p className="mt-6 text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-slate-950 underline-offset-4 hover:underline">
                Back to login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
