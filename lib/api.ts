import * as SecureStore from 'expo-secure-store';

const API_URL = (process.env.EXPO_PUBLIC_API_URL as string) || (global as any).__API_URL__ || 'http://localhost:4000';
const TOKEN_KEY = 'cjp_token_v1';

export async function saveToken(token: string) {
  try { await SecureStore.setItemAsync(TOKEN_KEY, token); } catch { /* noop */ }
}
export async function getToken(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
}
export async function clearToken() {
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch { /* noop */ }
}

type AuthResponse = { token: string } | { error: string };

async function post<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json as T;
}

export async function apiLogin(email: string, password: string) {
  return post<AuthResponse>('/auth/login', { email, password });
}

export async function apiRegister(email: string, password: string) {
  return post<AuthResponse>('/auth/register', { email, password });
}
