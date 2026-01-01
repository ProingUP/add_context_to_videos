import { supabaseClient } from '$src/lib/supabaseClient'

export async function signInWithEmail(email: string, password: string) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return {
        success: false,
        error: error.code
      }
    }

    return {
      success: true,
      data: {
        user: data.user
      }
    }
}