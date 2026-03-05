import * as XLSX from 'xlsx';
import { Driver, RouteDefinition, RouteTrip, Vehicle } from '../types';

type SheetRow = Record<string, unknown>;

const normalizeHeader = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const toText = (value: unknown): string => String(value ?? '').trim();

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pick = (row: SheetRow, keys: string[]): unknown => {
  const index = new Map<string, unknown>();
  Object.entries(row).forEach(([k, v]) => index.set(normalizeHeader(k), v));
  for (const key of keys) {
    const found = index.get(normalizeHeader(key));
    if (found !== undefined && toText(found) !== '') return found;
  }
  return '';
};

export const parseExcelRows = async (file: File): Promise<SheetRow[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[firstSheet], {
    defval: '',
    raw: false,
  });
};

export const mapRowsToDrivers = (rows: SheetRow[]): Driver[] => {
  return rows
    .map((row) => {
      const driverId = toText(pick(row, ['driverid', 'driver_id', 'id']));
      const name = toText(pick(row, ['name', 'drivername', 'driver_name']));
      const statusRaw = toText(pick(row, ['status'])).toLowerCase();
      const status: Driver['status'] = statusRaw === 'inactive' ? 'Inactive' : 'Active';
      return {
        driverId,
        name,
        licenseNumber: toText(pick(row, ['licensenumber', 'license', 'license_no'])),
        contactNumber: toText(pick(row, ['contactnumber', 'mobile', 'phone', 'contact'])),
        status,
      };
    })
    .filter((driver) => driver.driverId && driver.name);
};

export const mapRowsToVehicles = (rows: SheetRow[]): Vehicle[] => {
  return rows
    .map((row) => {
      const statusRaw = toText(pick(row, ['status'])).toLowerCase();
      const status: Vehicle['status'] =
        statusRaw === 'maintenance' ? 'Maintenance' : statusRaw === 'inactive' ? 'Inactive' : 'Active';
      return {
        vehicleNumber: toText(pick(row, ['vehiclenumber', 'vehicle_no', 'vehicleno', 'number'])).toUpperCase(),
        type: toText(pick(row, ['type', 'vehicletype'])),
        status,
      };
    })
    .filter((vehicle) => vehicle.vehicleNumber);
};

export const mapRowsToRoutes = (rows: SheetRow[]): RouteDefinition[] => {
  const grouped = new Map<string, RouteDefinition>();

  rows.forEach((row, index) => {
    const routeNumber = toText(pick(row, ['routenumber', 'route_no', 'route']));
    if (!routeNumber) return;

    const shiftRaw = toText(pick(row, ['shift'])).toLowerCase();
    const shift: RouteDefinition['shift'] =
      shiftRaw === 'morning' ? 'Morning' : shiftRaw === 'evening' ? 'Evening' : 'General';
    const key = `${routeNumber}__${shift}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        routeNumber,
        shift,
        scheduleKms: 0,
        trips: [],
      });
    }

    const route = grouped.get(key)!;
    const tripName = toText(pick(row, ['tripname', 'routename', 'fromto', 'trip']));
    const planKm = toNumber(pick(row, ['plankm', 'plan_km', 'km']));
    const scheduleOutTime = toText(pick(row, ['scheduleouttime', 'schout', 'outtime']));
    const scheduleInTime = toText(pick(row, ['scheduleintime', 'schin', 'intime']));

    if (tripName || planKm > 0 || scheduleOutTime || scheduleInTime) {
      const trip: RouteTrip = {
        id: `IMP-${Date.now()}-${index}-${route.trips.length + 1}`,
        name: tripName || `Trip ${route.trips.length + 1}`,
        planKm,
        scheduleOutTime,
        scheduleInTime,
      };
      route.trips.push(trip);
    }
  });

  return Array.from(grouped.values()).map((route) => ({
    ...route,
    scheduleKms: route.trips.reduce((sum, trip) => sum + (Number(trip.planKm) || 0), 0),
  }));
};