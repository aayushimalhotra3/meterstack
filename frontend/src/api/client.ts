const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function getToken(): string | null {
  return localStorage.getItem('accessToken');
}

export async function apiRequest<T = unknown>(path: string, options: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.json !== undefined) headers['Content-Type'] = 'application/json';
  const requestHeaders = {
    ...headers,
    ...(options.headers as Record<string, string> | undefined),
  };
  const body = options.json !== undefined ? JSON.stringify(options.json) : options.body;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: requestHeaders, body });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const detail =
      typeof data === 'object' && data !== null && 'detail' in data
        ? (data as { detail?: unknown }).detail
        : data;
    const message =
      typeof detail === 'string' ? detail :
      detail ? JSON.stringify(detail) :
      'Request failed';
    throw new Error(message);
  }
  return data as T;
}

export { API_BASE };
