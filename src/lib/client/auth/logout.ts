import { supabaseClient } from '$src/lib/supabaseClient'


export async function logout() {
    const { error } = await supabaseClient.auth.signOut()
    if (error) throw new Error(error.message)
}