import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpenCheckIcon } from 'lucide-react'

import { signInAction } from '@/app/actions/auth'
import { getCurrentUserProfile } from '@/lib/auth/get-current-profile'
import { getRoleRedirectPath } from '@/lib/auth/role-redirect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuthPageSearchParams } from '@/lib/types'

interface LoginPageProps {
  searchParams?: Promise<
    AuthPageSearchParams & {
      next?: string | string[]
    }
  >
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const profile = await getCurrentUserProfile()

  if (profile) {
    redirect(getRoleRedirectPath(profile.role))
  }

  const params = (await searchParams) ?? {}
  const error = typeof params.error === 'string' ? params.error : undefined
  const message = typeof params.message === 'string' ? params.message : undefined
  const next = typeof params.next === 'string' ? params.next : undefined

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="hidden border-white/80 bg-white/85 shadow-2xl shadow-slate-200/60 backdrop-blur lg:flex">
          <CardContent className="flex h-full flex-col justify-between p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-cyan-800">
                <BookOpenCheckIcon className="size-3.5" />
                Product foundation
              </div>
              <h1 className="mt-6 max-w-lg text-4xl font-semibold tracking-tight text-slate-950">
                A clean, secure base for OC and Selective exam preparation.
              </h1>
              <p className="mt-4 max-w-xl text-base text-slate-600">
                Phase 0 focuses on the essential layers: authentication, role-based access, profiles,
                protected routes, and the dashboard shell for students, tutors, and admins.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {['Student portal', 'Tutor visibility', 'Admin controls'].map((item) => (
                <div key={item} className="rounded-2xl border border-border/80 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/92 shadow-2xl shadow-slate-200/60 backdrop-blur">
          <CardHeader className="space-y-3">
            <div>
              <CardTitle className="text-3xl">Login</CardTitle>
              <CardDescription className="mt-2 text-sm">
                Sign in with your Supabase email and password to access the correct dashboard.
              </CardDescription>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Admins, tutors, and students all use this same login page. Staff accounts are routed from
              `profiles.role`, so once an account is promoted in Supabase it will land in the admin area
              automatically after sign-in.
            </div>
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}
            {message ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <form action={signInAction} className="space-y-5">
              <input type="hidden" name="next" value={next ?? ''} />
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="student@minerva.edu" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" placeholder="Enter your password" required />
              </div>
              <Button type="submit" size="lg" className="h-11 w-full rounded-2xl">
                Sign in
              </Button>
            </form>
            <p className="mt-6 text-sm text-muted-foreground">
              New here?{' '}
              <Link href="/signup" className="font-medium text-slate-950 underline-offset-4 hover:underline">
                Create a student account
              </Link>
            </p>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-950">Create an admin account</p>
              <p className="mt-2">
                1. Create the user in Supabase Auth.
                <br />
                2. Run this SQL in Supabase:
              </p>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
                <code>{`update public.profiles
set role = 'admin'
where email = 'admin@example.com';`}</code>
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
