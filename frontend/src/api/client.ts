const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function getToken(): string | null {
  return localStorage.getItem('accessToken');
}

export async function apiRequest(path: string, options: RequestInit & { json?: unknown } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const body = options.json !== undefined ? JSON.stringify(options.json) : options.body;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, body });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.detail || 'Request failed');
  }
  return data;
}

export { API_BASE };
