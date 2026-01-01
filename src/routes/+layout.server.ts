// import type { LayoutServerLoad } from './$types'

// export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, cookies }) => {
//   const { session, user } = await safeGetSession()
//   return {
//     session, // as long as we do not use the data for the session in the backend routes, we should be good to pass this to the front end // null, // Do not trust session becuase it can be tampered with by the client
//     user,
//     cookies: cookies.getAll(),
//   }
// }

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types'
export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, cookies, url }) => {
  const { session } = await safeGetSession()

  const currentPath = url.pathname;

  if (session && currentPath === '/') {
    throw redirect(302, '/explore');
  }

  return {
    session,
    cookies: cookies.getAll(),
  }
}