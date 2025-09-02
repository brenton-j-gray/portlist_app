import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const API_URL = (process.env.EXPO_PUBLIC_API_URL as string)
  || ((Constants as any)?.expoConfig?.extra?.EXPO_PUBLIC_API_URL as string)
  || (global as any).__API_URL__
  || 'http://localhost:4000';
const TOKEN_KEY = 'cjp_token_v1';

/**
 * Function saveToken: TODO describe purpose and usage.
 * @param {any} token - TODO: describe
 * @returns {any} TODO: describe
 */
export async function saveToken(token: string) {
  try { await SecureStore.setItemAsync(TOKEN_KEY, token); } catch { /* noop */ }
}
/**
 * Function getToken: TODO describe purpose and usage.
 * @returns {any} TODO: describe
 */
export async function getToken(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
}
/**
 * Function clearToken: TODO describe purpose and usage.
 * @returns {any} TODO: describe
 */
export async function clearToken() {
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch { /* noop */ }
}

type AuthResponse = { token: string } | { mfaRequired: true } | { error: string };

/**
 * Function withTimeout: TODO describe purpose and usage.
 * @param {any} ms - TODO: describe
 * @param {any} fn - TODO: describe
 * @returns {any} TODO: describe
 */
function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fn(ctrl.signal)
    .finally(() => clearTimeout(id))
    .catch(e => {
      if (e?.name === 'AbortError') throw new Error('Request timed out');
      throw e;
    });
}

/**
 * Function post: TODO describe purpose and usage.
 * @param {any} path - TODO: describe
 * @param {any} body - TODO: describe
 * @param {any} timeoutMs - TODO: describe
 * @returns {any} TODO: describe
 */
async function post<T>(path: string, body: any, timeoutMs = 12000): Promise<T> {
  return withTimeout(timeoutMs, async (signal) => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    let json: any = null;
    try { json = await res.json(); } catch {}
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    return json as T;
  });
}

/**
 * Function apiLogin: TODO describe purpose and usage.
 * @param {any} email - TODO: describe
 * @param {any} password - TODO: describe
 * @param {any} totp - TODO: describe
 * @returns {any} TODO: describe
 */
export async function apiLogin(email: string, password: string, totp?: string) {
  try {
    console.log('[apiLogin] start', { email, hasTotp: !!totp });
    // Optional quick ping to verify connectivity & avoid waiting full timeout if route unreachable
  try { await post('/auth/ping', {}, 4000); } catch (e: any) { console.log('[apiLogin] ping failed (continuing)', e?.message); }
    const res = await post<AuthResponse>('/auth/login', { email, password, ...(totp ? { totp } : {}) });
    console.log('[apiLogin] response', res && ('token' in res ? 'token' : res));
    return res;
  } catch (e) {
    console.log('[apiLogin] error', e);
    throw e;
  }
}

/**
 * Function apiRegister: TODO describe purpose and usage.
 * @param {any} email - TODO: describe
 * @param {any} password - TODO: describe
 * @param {any} username - TODO: describe
 * @returns {any} TODO: describe
 */
export async function apiRegister(email: string, password: string, username?: string) {
  return post<AuthResponse>('/auth/register', { email, password, username });
}

// Health
/**
 * Function apiHealth: TODO describe purpose and usage.
 * @returns {any} TODO: describe
 */
export async function apiHealth(): Promise<{ ok: boolean; [k: string]: any }> {
  const res = await fetch(`${API_URL}/health`);
  let json: any = null;
  try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json || { ok: false };
}

// Profile
export type Profile = { userId?: string; fullName?: string; username?: string; bio?: string; createdAt?: string; updatedAt?: string } | null;

/**
 * Function authGet: TODO describe purpose and usage.
 * @param {any} path - TODO: describe
 * @param {any} timeoutMs - TODO: describe
 * @returns {any} TODO: describe
 */
async function authGet<T>(path: string, timeoutMs = 12000): Promise<T> {
  const token = await getToken();
  return withTimeout(timeoutMs, async (signal) => {
    const res = await fetch(`${API_URL}${path}`, { headers: { 'Authorization': token ? `Bearer ${token}` : '' }, signal });
    let json: any = null;
    try { json = await res.json(); } catch {}
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    return json as T;
  });
}

/**
 * Function authPut: TODO describe purpose and usage.
 * @param {any} path - TODO: describe
 * @param {any} body - TODO: describe
 * @param {any} opts - TODO: describe
 * @returns {any} TODO: describe
 */
async function authPut<T>(path: string, body: any, opts?: { timeoutMs?: number }): Promise<T> {
  const token = await getToken();
  const timeoutMs = opts?.timeoutMs ?? 12000;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e: any) {
    clearTimeout(to);
    if (e?.name === 'AbortError') throw new Error('Request timed out');
    throw e;
  }
  clearTimeout(to);
  let json: any = null;
  try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json as T;
}

/**
 * Function apiGetProfile: TODO describe purpose and usage.
 * @returns {any} TODO: describe
 */
export async function apiGetProfile() {
  return authGet<{ profile: Profile }>('/profile');
}

/**
 * Function apiSaveProfile: TODO describe purpose and usage.
 * @param {any} p - TODO: describe
 * @returns {any} TODO: describe
 */
export async function apiSaveProfile(p: { fullName?: string; username?: string; bio?: string }) {
  // Use a timeout so UI doesn't hang forever on network issues
  return authPut<{ profile: Profile }>('/profile', p, { timeoutMs: 12000 });
}

// Account management
/**
 * Function apiChangeEmail: TODO describe purpose and usage.
 * @param {any} newEmail - TODO: describe
 * @param {any} password - TODO: describe
 * @returns {any} TODO: describe
 */
export async function apiChangeEmail(newEmail: string, password: string) {
  const res = await authPut<{ token: string }>('/auth/email', { newEmail, password });
  // Persist the new token (email is embedded)
  if (res && (res as any).token) {
    await saveToken((res as any).token);
  }
  return res;
}

/**
 * Function apiChangePassword: TODO describe purpose and usage.
 * @param {any} currentPassword - TODO: describe
 * @param {any} newPassword - TODO: describe
 * @returns {any} TODO: describe
 */
export async function apiChangePassword(currentPassword: string, newPassword: string) {
  return authPut<{ ok: boolean }>('/auth/password', { currentPassword, newPassword });
}

// 2FA
/**
 * Function api2faStatus: TODO describe purpose and usage.
 * @returns {any} TODO: describe
 */
export async function api2faStatus() {
  return authGet<{ enabled: boolean }>('/auth/2fa/status');
}
/**
 * Function api2faSetup: TODO describe purpose and usage.
 * @returns {any} TODO: describe
 */
export async function api2faSetup() {
  return authGet<{ secret: string; otpauthUri: string }>('/auth/2fa/setup');
}
/**
 * Function api2faVerifySetup: TODO describe purpose and usage.
 * @param {any} code - TODO: describe
 * @returns {any} TODO: describe
 */
export async function api2faVerifySetup(code: string) {
  return authPost<{ enabled: boolean; backupCodes: string[] }>('/auth/2fa/verify-setup', { code });
}
/**
 * Function api2faDisable: TODO describe purpose and usage.
 * @param {any} password - TODO: describe
 * @returns {any} TODO: describe
 */
export async function api2faDisable(password: string) {
  return authPost<{ enabled: false }>('/auth/2fa/disable', { password });
}

// Minimal POST with auth (reusing token helpers)
/**
 * Function authPost: TODO describe purpose and usage.
 * @param {any} path - TODO: describe
 * @param {any} body - TODO: describe
 * @param {any} timeoutMs - TODO: describe
 * @returns {any} TODO: describe
 */
async function authPost<T>(path: string, body: any, timeoutMs = 12000): Promise<T> {
  const token = await getToken();
  return withTimeout(timeoutMs, async (signal) => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
      body: JSON.stringify(body),
      signal,
    });
    let json: any = null;
    try { json = await res.json(); } catch {}
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    return json as T;
  });
}

// Routing: compute a polyline between waypoints (server may provide maritime-aware paths later)
export type LatLng = { latitude: number; longitude: number };
/**
 * Function apiComputeRoute: TODO describe purpose and usage.
 * @param {any} points - TODO: describe
 * @returns {any} TODO: describe
 */
export async function apiComputeRoute(points: LatLng[]): Promise<{ polyline: LatLng[]; cached?: boolean }> {
  // Try specific marine endpoint first if available, then fallback to generic /route
  const body = { points };
  try {
    const res = await fetch(`${API_URL}/route/marine`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      const json = await res.json();
      return json as { polyline: LatLng[]; cached?: boolean };
    }
  } catch { /* ignore */ }
  // Fallback
  const res2 = await fetch(`${API_URL}/route`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json2 = await res2.json();
  if (!res2.ok) throw new Error(json2?.error || `HTTP ${res2.status}`);
  return json2 as { polyline: LatLng[]; cached?: boolean };
}
