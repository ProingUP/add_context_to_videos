import { createServerClient } from '@supabase/ssr'
import { type Handle, redirect } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'

import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY,  } from '$env/static/public'

// --- CORS + Origin + CSRF guard ---------------------------------------------
import { randomBytes } from 'crypto';


const PROD = (process.env.NODE_ENV === 'production') || (process.env.VITE_ENV === 'production');

const PROD_ORIGINS = ['https://proingup.com', 'https://www.proingup.com'];
const DEV_ORIGINS  = ['http://localhost:5173', 'http://localhost:4173'];

const ALLOWED_ORIGINS = new Set<string>([...PROD_ORIGINS, ...(PROD ? [] : DEV_ORIGINS)]);
const TRUSTED_HOSTS   = new Set<string>([
  'proingup.com',
  'www.proingup.com',
  ...(PROD ? [] : ['localhost:5173', 'localhost:4173'])
]);
const NO_CSRF_PATHS = new Set([
  // '/auth/callback',          // Supabase OAuth callback
  // '/auth/reset-password',    // if you use it
  // '/api/analytics/log-event',
  // '/api/analytics/log-error'
  // '/api/webhooks/...',    // any public webhook targets you expose
]);

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true'
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

// helpful when some same-site browsers omit Origin: fall back to Referer
function isTrustedOriginOrReferer(event: Parameters<Handle>[0]['event']) {
  const origin = event.request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) return true;

  const referer = event.request.headers.get('referer');
  try {
    if (referer) {
      const { origin: refererOrigin } = new URL(referer);
      if (ALLOWED_ORIGINS.has(refererOrigin)) return true;
    }
  } catch {}
  return false;
}

function ensureCsrfCookie(event: Parameters<Handle>[0]['event']) {
  let token = event.cookies.get('csrf');
  if (!token) {
    token = randomBytes(16).toString('hex');
    event.cookies.set('csrf', token, {
      httpOnly: false,     // client must read it to mirror into X-CSRF-Token
      secure: PROD, // <— important for local dev
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });
  }
  return token;
}

const corsAndCsrf: Handle = async ({ event, resolve }) => {
  const { request, url } = event;
  const method = request.method;
  const origin = request.headers.get('origin');

  // Always have a CSRF cookie available (no-op if present)
  ensureCsrfCookie(event);

  // Answer preflight early
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  // For state-changing requests, enforce host + origin/referer + CSRF
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    // Host check defends against odd proxying
     if (!TRUSTED_HOSTS.has(url.host)) {
      return new Response('Forbidden: bad host', { status: 403 });
    }

    // Require trusted Origin or Referer
    if (!isTrustedOriginOrReferer(event)) {
      return new Response('Forbidden: bad origin', { status: 403 });
    }

    // CSRF (skip on whitelisted paths)
    if (!NO_CSRF_PATHS.has(event.url.pathname)) {
      const csrfHeader = request.headers.get('x-csrf-token');
      const csrfCookie = event.cookies.get('csrf');
      if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
        return new Response('Forbidden: CSRF', { status: 403 });
      }
    }
  }

  // Let downstream handles (Supabase, auth) run
  const response = await resolve(event);

  // Add CORS headers on API responses so your frontend can read them
  if (event.url.pathname.startsWith('/api')) {
    const headers = corsHeaders(origin);
    for (const [k, v] of Object.entries(headers)) {
      if (v) response.headers.set(k, v);
    }
  }

  return response;
};


// // During recovery, ONLY these paths are allowed
// const routesAllowDuringRecovery = new Set<string>([
//   '/auth/reset-password',
//   '/auth/callback',       // retry landing from email links
//   '/auth/signout',         // optional: let them sign out
//   '/api/private/auth/finish-password-reset',
// ])

// function matchesPrefix(path: string, prefixes: Set<string>) {
//   for (const p of prefixes) if (path === p || path.startsWith(p)) return true;
//   return false;
// }

// function isHtmlNav(event: Parameters<Handle>[0]['event']) {
//   const h = event.request.headers;
//   return event.request.method === 'GET' && (h.get('accept') ?? '').includes('text/html');
// }

// function isStaticAsset(path: string) {
//   return (
//     path.startsWith('/_app/') ||
//     path.startsWith('/build/') ||
//     path.startsWith('/assets/') ||
//     path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.map') ||
//     path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.svg') ||
//     path === '/favicon.ico' || path === '/robots.txt'
//   );
// }

const supabase: Handle = async ({ event, resolve }) => {
  /**
   * Creates a Supabase client specific to this server request.
   *
   * The Supabase client gets the Auth token from the request cookies.
   */

  // Not needed for MVP - when a user clicks on the password reset link, they will be signed in automatically and taken to the reset password page
  // They can navigate off the page if they don't want to change their password at the moment
  // Clicking on the reset password link acts as a full sign in
  // (if the user has access to their email, for this MVP, they will have access to resetting their email
  // -- if the user's email account with their email provider has been compromised, all bets are off, and I cannot stop a malicious user from resetting the password
  // -- 2FA with a phone would help with this in the future)
  // // --- Recovery gate (before creating Supabase client) ---
  // const inRecovery = event.cookies.get('recovery_session') === '1';
  // if (inRecovery) {
  //   const path = event.url.pathname;
  //   const allowed = routesAllowDuringRecovery.has(path);

  //   // const isApiRoute = path.startsWith('/api/');
  //   const html = isHtmlNav(event);
  //   if (!allowed && !isStaticAsset(path)) {
  //     if (html) {
  //       return new Response(null, { status: 303, headers: { location: '/auth/reset-password' } });
  //     }
  //     return new Response(JSON.stringify({ error: 'password_recovery_required' }), {
  //       status: 401,
  //       headers: { 'content-type': 'application/json' }
  //     });
  //   }
  // }

  // --- Supabase SSR client ---
  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      /**
       * SvelteKit's cookies API requires `path` to be explicitly set in
       * the cookie options. Setting `path` to `/` replicates previous/
       * standard behavior.
       */
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          event.cookies.set(name, value, { ...options, path: '/' })
        })
      },
    },
  })

  /**
   * Unlike `supabase.auth.getSession()`, which returns the session _without_
   * validating the JWT, this function also calls `getUser()` to validate the
   * JWT before returning the session.
   */

  event.locals.safeGetSession = async () => {
    const {
      data: { session },
    } = await event.locals.supabase.auth.getSession()
    if (!session) {
      return { session: null, user: null }
    }

    const {
      data: { user },
      error,
    } = await event.locals.supabase.auth.getUser()
    if (error) {
      // JWT validation has failed
      return { session: null, user: null }
    }

    return { session, user }
  }

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      /**
       * Supabase libraries use the `content-range` and `x-supabase-api-version`
       * headers, so we need to tell SvelteKit to pass it through.
       */
      return name === 'content-range' || name === 'x-supabase-api-version'
    },
  })
}

const authGuard: Handle = async ({ event, resolve }) => {
    const { session, user } = await event.locals.safeGetSession();
    event.locals.session = session;
    event.locals.user = user;
  
    const path = event.url.pathname;
    const isApiRoute = path.startsWith('/api/');
    const privatePaths = new Set(['/explore', '/account', '/connections', '/collaborations', '/chat', '/opportunities' ])
    const isPrivatePage = path.startsWith('/private') || privatePaths.has(path);
    const signedInUsersAuthPathToRedirectFrom = ['/auth/join', '/auth/login'];

    const publicApiRoutes = [
      '/api/join',
      // '/api/projects/get-more-post-thumbnails',
      // '/api/posts/get-pinned-posts',
      // '/api/views/view-opportunity',
      // '/api/views/view-project-post',
      // '/api/handle/get-handle-from-id',
      // '/api/opportunities/get-active-opportunities',
      // '/api/posts/get-all-media-for-post',
      // '/api/analytics/log-event',
      // '/api/analytics/log-error',
      // '/api/follows/get-followers-count',
      // '/api/follows/get-followees-count',
    ]; // Add others if needed

    // If the user has not signed in
    if (!session) {
      // If the user is trying to access an API route meant only for authenticated useres
      if (isApiRoute && !publicApiRoutes.includes(path)) {
        return new Response('Unauthorized', { status: 401 });
      }
  
      // If the user is trying to access a private route
      if (isPrivatePage) {
        throw redirect(303, '/auth/login');
      }
    }
  
    // If the user is signed in and tries to access the auth route
    // if (session && path.includes('/auth')) {
    if (session && signedInUsersAuthPathToRedirectFrom.includes(path)) {
      throw redirect(303, '/explore');
    }
  
    return resolve(event);
  };
  
  export const handle: Handle = sequence(corsAndCsrf, supabase, authGuard);
  