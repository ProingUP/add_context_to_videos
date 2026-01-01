// src/lib/server/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'

export const supabaseAdmin = createClient(
    PUBLIC_SUPABASE_URL,
    PRIVATE_SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
)