const TOKEN_KEY = 'smartattend.token';

export const API_URL: string = (() => {
  const fromEnv = (import.meta as any).env?.VITE_API_URL as string | undefined;
  return (fromEnv && fromEnv.trim()) || 'http://localhost:8000';
})();

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function buildPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_URL.replace(/\/$/, '')}${path}`;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  formData?: FormData;
  signal?: AbortSignal;
};

export class ApiRequestError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.name = 'ApiRequestError';
  }
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_URL.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, {
    method: opts.method ?? (body ? 'POST' : 'GET'),
    headers,
    body,
    signal: opts.signal,
  });

  if (res.status === 401) {
    setToken(null);
    onUnauthorized?.();
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) {
        detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // ignore parse errors
    }
    // Surface the failing call in the browser console so debugging is easy.
    // eslint-disable-next-line no-console
    console.error(
      `[SmartAttend API] ${opts.method ?? (body ? 'POST' : 'GET')} ${url} → ${res.status}`,
      detail,
    );
    throw new ApiRequestError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export function extractErrorMessage(err: unknown, fallback = 'Bir hata oluştu.'): string {
  if (err instanceof ApiRequestError) return err.detail || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
