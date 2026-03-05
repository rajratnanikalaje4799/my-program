import { Vehicle } from '../types';

const API_BASE_URL = 'http://10.57.254.99:4000';
const VEHICLES_API = `${API_BASE_URL}/api/vehicles`;

let vehiclesCache: Vehicle[] = [];

async function fetchVehiclesFromAPI(): Promise<Vehicle[]> {
  const res = await fetch(VEHICLES_API);
  if (!res.ok) throw new Error('Failed to fetch vehicles');
  const data = (await res.json()) as Vehicle[];
  vehiclesCache = Array.isArray(data) ? data : [];
  return vehiclesCache;
}

async function overwriteVehiclesOnAPI(vehicles: Vehicle[]): Promise<void> {
  const saveRes = await fetch(`${API_BASE_URL}/api/saveAll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'vehicles', value: vehicles }),
  });
  if (!saveRes.ok) throw new Error('Failed to save vehicles');
}

export const vehicleStorage = {
  getVehicles: (): Vehicle[] => {
    return vehiclesCache;
  },

  getVehiclesAsync: async (): Promise<Vehicle[]> => {
    return fetchVehiclesFromAPI();
  },

  saveVehicles: (vehicles: Vehicle[]): void => {
    vehiclesCache = vehicles;
    void vehicleStorage.saveVehiclesAsync(vehicles);
  },

  saveVehiclesAsync: async (vehicles: Vehicle[]): Promise<void> => {
    vehiclesCache = vehicles;
    await overwriteVehiclesOnAPI(vehicles);
  },

  saveVehicle: (vehicle: Vehicle): void => {
    const vehicles = vehicleStorage.getVehicles();
    const index = vehicles.findIndex(v => v.vehicleNumber === vehicle.vehicleNumber);
    if (index !== -1) {
      vehicles[index] = vehicle;
    } else {
      vehicles.push(vehicle);
    }
    vehicleStorage.saveVehicles(vehicles);
  },

  addVehicle: (vehicle: Vehicle): void => {
    const vehicles = vehicleStorage.getVehicles();
    vehicles.push(vehicle);
    vehicleStorage.saveVehicles(vehicles);
  },

  addVehicleAsync: async (vehicle: Vehicle): Promise<void> => {
    const vehicles = await vehicleStorage.getVehiclesAsync();
    vehicles.push(vehicle);
    await vehicleStorage.saveVehiclesAsync(vehicles);
  },

  updateVehicle: (updatedVehicle: Vehicle): void => {
    const vehicles = vehicleStorage.getVehicles();
    const index = vehicles.findIndex(v => v.vehicleNumber === updatedVehicle.vehicleNumber);
    if (index !== -1) {
      vehicles[index] = updatedVehicle;
      vehicleStorage.saveVehicles(vehicles);
    }
  },

  updateVehicleAsync: async (updatedVehicle: Vehicle): Promise<void> => {
    const vehicles = await vehicleStorage.getVehiclesAsync();
    const index = vehicles.findIndex(v => v.vehicleNumber === updatedVehicle.vehicleNumber);
    if (index !== -1) {
      vehicles[index] = updatedVehicle;
      await vehicleStorage.saveVehiclesAsync(vehicles);
    }
  },

  deleteVehicle: (vehicleNumber: string): void => {
    const vehicles = vehicleStorage.getVehicles().filter(v => v.vehicleNumber !== vehicleNumber);
    vehicleStorage.saveVehicles(vehicles);
  },

  deleteVehicleAsync: async (vehicleNumber: string): Promise<void> => {
    const vehicles = await vehicleStorage.getVehiclesAsync();
    const filtered = vehicles.filter(v => v.vehicleNumber !== vehicleNumber);
    await vehicleStorage.saveVehiclesAsync(filtered);
  },

  getVehicleByNumber: (vehicleNumber: string): Vehicle | undefined => {
    return vehicleStorage.getVehicles().find(v => v.vehicleNumber === vehicleNumber);
  },

  getActiveVehicles: (): Vehicle[] => {
    return vehiclesCache.filter(v => v.status === 'Active');
  },

  getActiveVehiclesAsync: async (): Promise<Vehicle[]> => {
    const vehicles = await vehicleStorage.getVehiclesAsync();
    return vehicles.filter(v => v.status === 'Active');
  },

  refreshFromServer: async (): Promise<Vehicle[]> => {
    return fetchVehiclesFromAPI();
  }
};

export default vehicleStorage;
