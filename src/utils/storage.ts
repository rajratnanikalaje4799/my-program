import { Logsheet } from '../types';

const API_BASE_URL = 'http://10.57.254.99:4000';
const LOGSHEETS_API = `${API_BASE_URL}/api/logsheets`;

let logsheetsCache: Logsheet[] = [];

async function fetchLogsheetsFromAPI(): Promise<Logsheet[]> {
  const res = await fetch(LOGSHEETS_API);
  if (!res.ok) throw new Error('Failed to fetch logsheets');
  const data = (await res.json()) as Logsheet[];
  logsheetsCache = Array.isArray(data) ? data : [];
  return logsheetsCache;
}

async function overwriteLogsheetsOnAPI(logsheets: Logsheet[]): Promise<void> {
  const saveRes = await fetch(`${API_BASE_URL}/api/saveAll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'logsheets', value: logsheets }),
  });
  if (!saveRes.ok) throw new Error('Failed to save logsheets');
}

export const storage = {
  getLogsheets: (): Logsheet[] => {
    return logsheetsCache;
  },

  getLogsheetsAsync: async (): Promise<Logsheet[]> => {
    return fetchLogsheetsFromAPI();
  },

  saveLogsheet: (logsheet: Logsheet): void => {
    const logsheets = [...logsheetsCache];
    logsheets.push(logsheet);
    logsheetsCache = logsheets;
    void storage.saveLogsheetAsync(logsheet);
  },

  saveLogsheetAsync: async (logsheet: Logsheet): Promise<void> => {
    const logsheets = [...logsheetsCache];
    logsheets.push(logsheet);
    logsheetsCache = logsheets;
    await overwriteLogsheetsOnAPI(logsheets);
  },

  deleteLogsheet: (id: string): void => {
    const logsheets = logsheetsCache.filter((l) => l.id !== id);
    logsheetsCache = logsheets;
    void storage.deleteLogsheetAsync(id);
  },

  deleteLogsheetAsync: async (id: string): Promise<void> => {
    const logsheets = logsheetsCache.filter((l) => l.id !== id);
    logsheetsCache = logsheets;
    await overwriteLogsheetsOnAPI(logsheets);
  },

  updateLogsheet: (updatedLogsheet: Logsheet): void => {
    const logsheets = storage.getLogsheets();
    const index = logsheets.findIndex(l => l.id === updatedLogsheet.id);
    if (index !== -1) {
      logsheets[index] = updatedLogsheet;
      logsheetsCache = logsheets;
      void overwriteLogsheetsOnAPI(logsheets);
    }
  },

  getLogsheetById: (id: string): Logsheet | undefined => {
    return storage.getLogsheets().find(l => l.id === id);
  },

  getLogsheetsByDate: (date: string): Logsheet[] => {
    return storage.getLogsheets().filter(l => l.date === date);
  },

  getLogsheetsByDateAsync: async (date: string): Promise<Logsheet[]> => {
    const logsheets = await storage.getLogsheetsAsync();
    return logsheets.filter(l => l.date === date);
  },

  refreshFromServer: async (): Promise<Logsheet[]> => {
    return fetchLogsheetsFromAPI();
  }
};

export default storage;
