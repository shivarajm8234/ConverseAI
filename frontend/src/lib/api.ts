/**
 * Browser-visible API URLs for the Express backend.
 *
 * - Dev: leave VITE_API_BASE_URL unset → use same-origin `/api` + Vite proxy → localhost:3001.
 * - Production (Firebase Hosting, etc.): you MUST set VITE_API_BASE_URL to your public API
 *   (e.g. https://api.example.com/api). Otherwise `/api/*` is rewritten to index.html and JSON parse fails.
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();
  if (raw) {
    const u = raw.replace(/\/$/, '');
    return u.endsWith('/api') ? u : `${u}/api`;
  }
  
  // If we are on localhost, and not using a proxy, try to point directly to 3001
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001/api';
  }
  
  return '/api';
}

/** Path must start with /, e.g. `/graph`, `/stats`. */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${p}`;
}

/** Backend serves GET /health outside the /api prefix. */
export function healthUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();
  if (raw) {
    let u = raw.replace(/\/$/, '');
    if (u.endsWith('/api')) u = u.slice(0, -4);
    return `${u}/health`;
  }
  return '/health';
}
