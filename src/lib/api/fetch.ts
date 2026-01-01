export async function apiFetch(
    input: RequestInfo,
    init: RequestInit = {},
    fetchImpl: typeof fetch = fetch
) {
    const headers = new Headers(init.headers || {});
    const method = (init.method || 'GET').toUpperCase();
  
    // Only in the browser: add CSRF header for writes
    if (typeof document !== 'undefined' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const csrf = document.cookie.split('; ').find(c => c.startsWith('csrf='))?.split('=')[1];
        if (csrf) headers.set('X-CSRF-Token', csrf);
        // Don’t force Content-Type if the caller is sending FormData/Blob/etc.
        if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
            headers.set('Content-Type', 'application/json');
        }
    }

    return fetchImpl(input, { ...init, headers, credentials: 'include' });
  }