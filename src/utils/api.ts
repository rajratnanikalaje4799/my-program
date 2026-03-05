const API_BASE_URL = 'http://10.57.254.99:4000';
const API_PREFIX = '/api';

let serverConnected = false;
let connectionChecked = false;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API ${method} ${path} failed with ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return undefined as T;
}

export function getSessionUser(): string | null {
  return sessionStorage.getItem('depot_loggedInUser');
}

export function setSessionUser(username: string): void {
  sessionStorage.setItem('depot_loggedInUser', username);
}

export function clearSession(): void {
  sessionStorage.removeItem('depot_loggedInUser');
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const loggedInUser = getSessionUser();
    if (!loggedInUser) return;

    navigator.sendBeacon(
      `${API_BASE_URL}/logout`,
      JSON.stringify({ username: loggedInUser }),
    );
  });
}

export async function getData(): Promise<unknown> {
  return request<unknown>('/data');
}

export async function login(
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string; user?: unknown }> {
  try {
    const result = await request<{ ok: boolean; error?: string; user?: unknown }>(
      '/login',
      'POST',
      { username, password },
    );
    if (result.ok) {
      setSessionUser(username);
    }
    return result;
  } catch {
    return { ok: false, error: 'Server connection failed' };
  }
}

export async function logout(): Promise<void> {
  try {
    await request('/logout', 'POST');
  } finally {
    clearSession();
  }
}

export async function updatePassword(newPassword: string): Promise<{ ok: boolean }> {
  try {
    return await request<{ ok: boolean }>('/updatePassword', 'POST', { password: newPassword });
  } catch {
    return { ok: false };
  }
}

export async function checkServerConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${API_BASE_URL}/ping`, { signal: controller.signal });
    clearTimeout(timeoutId);
    serverConnected = response.ok;
    connectionChecked = true;
    return response.ok;
  } catch {
    serverConnected = false;
    connectionChecked = true;
    return false;
  }
}

export function getServerStatus(): { connected: boolean; checked: boolean; url: string } {
  return {
    connected: serverConnected,
    checked: connectionChecked,
    url: API_BASE_URL,
  };
}

function createCrudAPI<T>(entity: string) {
  const base = `${API_PREFIX}/${entity}`;
  return {
    getAll: async (): Promise<T[]> => request<T[]>(base),
    create: async (item: T): Promise<{ ok: boolean }> => request<{ ok: boolean }>(base, 'POST', item),
    update: async (id: string, item: T): Promise<{ ok: boolean }> =>
      request<{ ok: boolean }>(`${base}/${id}`, 'PUT', item),
    delete: async (id: string): Promise<{ ok: boolean }> => request<{ ok: boolean }>(`${base}/${id}`, 'DELETE'),
  };
}

export const logsheetsAPI = createCrudAPI<unknown>('logsheets');
export const routesAPI = createCrudAPI<unknown>('routes');
export const driversAPI = createCrudAPI<unknown>('drivers');
export const vehiclesAPI = createCrudAPI<unknown>('vehicles');
export const breakdownsAPI = createCrudAPI<unknown>('breakdowns');

export const usersAPI = createCrudAPI<unknown>('users');

export const backupAPI = {
  export: () => request<unknown>(`${API_PREFIX}/backup/export`),
  import: (data: unknown, options: { replaceExisting: boolean; importItems: Record<string, boolean> }) =>
    request<{ ok: boolean }>(`${API_PREFIX}/backup/import`, 'POST', { data, options }),
  clear: () => request<{ ok: boolean }>(`${API_PREFIX}/backup/clear`, 'POST'),
};
