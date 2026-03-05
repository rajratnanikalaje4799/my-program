import { BreakdownRecord } from '../types';

const API_BASE_URL = 'http://10.57.254.99:4000';
const BREAKDOWNS_API = `${API_BASE_URL}/api/breakdowns`;

let breakdownsCache: BreakdownRecord[] = [];

async function fetchBreakdownsFromAPI(): Promise<BreakdownRecord[]> {
  const res = await fetch(BREAKDOWNS_API);
  if (!res.ok) throw new Error('Failed to fetch breakdowns');
  const data = (await res.json()) as BreakdownRecord[];
  breakdownsCache = Array.isArray(data) ? data : [];
  return breakdownsCache;
}

async function overwriteBreakdownsOnAPI(breakdowns: BreakdownRecord[]): Promise<void> {
  const saveRes = await fetch(`${API_BASE_URL}/api/saveAll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'breakdowns', value: breakdowns }),
  });
  if (!saveRes.ok) throw new Error('Failed to save breakdowns');
}

export const breakdownStorage = {
  getBreakdowns: (): BreakdownRecord[] => {
    return breakdownsCache;
  },

  getBreakdownsAsync: async (): Promise<BreakdownRecord[]> => {
    return fetchBreakdownsFromAPI();
  },

  saveBreakdowns: (breakdowns: BreakdownRecord[]): void => {
    breakdownsCache = breakdowns;
    void breakdownStorage.saveBreakdownsAsync(breakdowns);
  },

  saveBreakdownsAsync: async (breakdowns: BreakdownRecord[]): Promise<void> => {
    breakdownsCache = breakdowns;
    await overwriteBreakdownsOnAPI(breakdowns);
  },

  saveBreakdown: (breakdown: BreakdownRecord): void => {
    const breakdowns = breakdownStorage.getBreakdowns();
    breakdowns.push(breakdown);
    breakdownStorage.saveBreakdowns(breakdowns);
  },

  saveBreakdownAsync: async (breakdown: BreakdownRecord): Promise<void> => {
    const breakdowns = await breakdownStorage.getBreakdownsAsync();
    breakdowns.push(breakdown);
    await breakdownStorage.saveBreakdownsAsync(breakdowns);
  },

  deleteBreakdown: (id: string): void => {
    const breakdowns = breakdownStorage.getBreakdowns().filter(b => b.id !== id);
    breakdownStorage.saveBreakdowns(breakdowns);
  },

  deleteBreakdownAsync: async (id: string): Promise<void> => {
    const breakdowns = await breakdownStorage.getBreakdownsAsync();
    const filtered = breakdowns.filter(b => b.id !== id);
    await breakdownStorage.saveBreakdownsAsync(filtered);
  },

  getBreakdownById: (id: string): BreakdownRecord | undefined => {
    return breakdownStorage.getBreakdowns().find(b => b.id === id);
  },

  getBreakdownsByDate: (date: string): BreakdownRecord[] => {
    return breakdownStorage.getBreakdowns().filter(b => b.date === date);
  },

  refreshFromServer: async (): Promise<BreakdownRecord[]> => {
    return fetchBreakdownsFromAPI();
  },

  // Compatibility aliases
  getAll: (): BreakdownRecord[] => {
    return breakdownStorage.getBreakdowns();
  },

  save: (breakdown: BreakdownRecord): void => {
    breakdownStorage.saveBreakdown(breakdown);
  },

  delete: (id: string): void => {
    breakdownStorage.deleteBreakdown(id);
  }
};

// Re-export BreakdownRecord type for convenience
export type { BreakdownRecord } from '../types';

export default breakdownStorage;
