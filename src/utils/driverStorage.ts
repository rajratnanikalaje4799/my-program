import { Driver } from '../types';

const API_BASE_URL = 'http://10.57.254.99:4000';
const DRIVERS_API = `${API_BASE_URL}/api/drivers`;

let driversCache: Driver[] = [];

async function fetchDriversFromAPI(): Promise<Driver[]> {
  const res = await fetch(DRIVERS_API);
  if (!res.ok) throw new Error('Failed to fetch drivers');
  const data = (await res.json()) as Driver[];
  driversCache = Array.isArray(data) ? data : [];
  return driversCache;
}

async function overwriteDriversOnAPI(drivers: Driver[]): Promise<void> {
  const saveRes = await fetch(`${API_BASE_URL}/api/saveAll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'drivers', value: drivers }),
  });
  if (!saveRes.ok) throw new Error('Failed to save drivers');
}

export const driverStorage = {
  getDrivers: (): Driver[] => {
    return driversCache;
  },

  getDriversAsync: async (): Promise<Driver[]> => {
    return fetchDriversFromAPI();
  },

  saveDrivers: (drivers: Driver[]): void => {
    driversCache = drivers;
    void driverStorage.saveDriversAsync(drivers);
  },

  saveDriversAsync: async (drivers: Driver[]): Promise<void> => {
    driversCache = drivers;
    await overwriteDriversOnAPI(drivers);
  },

  saveDriver: (driver: Driver): void => {
    const drivers = driverStorage.getDrivers();
    const index = drivers.findIndex(d => d.driverId === driver.driverId);
    if (index !== -1) {
      drivers[index] = driver;
    } else {
      drivers.push(driver);
    }
    driverStorage.saveDrivers(drivers);
  },

  addDriver: (driver: Driver): void => {
    const drivers = driverStorage.getDrivers();
    drivers.push(driver);
    driverStorage.saveDrivers(drivers);
  },

  addDriverAsync: async (driver: Driver): Promise<void> => {
    const drivers = await driverStorage.getDriversAsync();
    drivers.push(driver);
    await driverStorage.saveDriversAsync(drivers);
  },

  updateDriver: (updatedDriver: Driver): void => {
    const drivers = driverStorage.getDrivers();
    const index = drivers.findIndex(d => d.driverId === updatedDriver.driverId);
    if (index !== -1) {
      drivers[index] = updatedDriver;
      driverStorage.saveDrivers(drivers);
    }
  },

  updateDriverAsync: async (updatedDriver: Driver): Promise<void> => {
    const drivers = await driverStorage.getDriversAsync();
    const index = drivers.findIndex(d => d.driverId === updatedDriver.driverId);
    if (index !== -1) {
      drivers[index] = updatedDriver;
      await driverStorage.saveDriversAsync(drivers);
    }
  },

  deleteDriver: (driverId: string): void => {
    const drivers = driverStorage.getDrivers().filter(d => d.driverId !== driverId);
    driverStorage.saveDrivers(drivers);
  },

  deleteDriverAsync: async (driverId: string): Promise<void> => {
    const drivers = await driverStorage.getDriversAsync();
    const filtered = drivers.filter(d => d.driverId !== driverId);
    await driverStorage.saveDriversAsync(filtered);
  },

  getDriverById: (driverId: string): Driver | undefined => {
    return driverStorage.getDrivers().find(d => d.driverId === driverId);
  },

  getActiveDrivers: (): Driver[] => {
    return driversCache.filter(d => d.status === 'Active');
  },

  getActiveDriversAsync: async (): Promise<Driver[]> => {
    const drivers = await driverStorage.getDriversAsync();
    return drivers.filter(d => d.status === 'Active');
  },

  // Force refresh from server
  refreshFromServer: async (): Promise<Driver[]> => {
    return fetchDriversFromAPI();
  }
};

export default driverStorage;
