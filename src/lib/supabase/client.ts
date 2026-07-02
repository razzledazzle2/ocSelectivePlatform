import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseEnv } from '@/lib/supabase/config'

export function createClient(): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
