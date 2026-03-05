export interface Driver {
  driverId: string;
  name: string;
  licenseNumber?: string;
  contactNumber?: string;
  status: 'Active' | 'Inactive';
}

export interface Vehicle {
  vehicleNumber: string;
  type?: string;
  status: 'Active' | 'Maintenance' | 'Inactive';
}

export interface RouteTrip {
  id: string;
  name: string;
  planKm: number;
  scheduleOutTime: string;
  scheduleInTime: string;
}

export interface RouteDefinition {
  routeNumber: string;
  scheduleKms: number;
  shift: 'Morning' | 'Evening' | 'General';
  trips: RouteTrip[];
}

export interface Trip {
  id: string;
  name: string; // Route Name: Where to Where
  planKm: number;
  actualKm: number | string;
  scheduleOutTime: string;
  scheduleInTime: string;
  actualOutTime: string;
  actualInTime: string;
  isCompleted: boolean;
  reason?: string;
  isManual?: boolean;
}

export interface Logsheet {
  id: string;
  date: string;
  vehicleNumber: string;
  driverName: string;
  driverId: string;
  routeNumber: string;
  shift: 'Morning' | 'Evening' | 'General';
  scheduleKms: number;
  totalActualKms?: number;
  extraKms?: number; // KMs from manual trips + extra over plan
  manualTripsKms?: number; // KMs only from manual trips
  trips: Trip[];
  remarks?: string;
  createdAt: string;
}

export interface BreakdownRecord {
  id: string;
  date: string;
  routeNumber: string;
  vehicleNumber: string;
  driverId: string;
  driverName: string;
  tripName: string;
  breakdownTrip?: number;
  breakdownLossKm: number;
  breakdownTripCount: number;
  timeToClear: string;
  reason: string;
  attendedBy: string;
  remarks?: string;
  createdAt: string;
}

export interface Tyre {
  id: string;
  tyreNumber: string;
  brand: string;
  size: string;
  purchaseDate: string;
  status: 'available' | 'fitted' | 'punctured' | 'blast' | 'cut' | 'scrapped';
  totalKmRun: number;
  createdAt: string;
}

export interface TyreAssignment {
  id: string;
  tyreId: string;
  tyreNumber: string;
  vehicleNumber: string;
  assignedDate: string;
  removedDate?: string;
  kmAtAssignment: number;
  kmAtRemoval?: number;
  kmRun?: number;
  reason?: string;
  isActive: boolean;
}

export interface TyreIncidentRecord {
  id: string;
  tyreId: string;
  tyreNumber: string;
  vehicleNumber: string;
  incidentDate: string;
  incidentType: 'puncture' | 'blast' | 'cut';
  kmAtIncident: number;
  replacedWithTyreId?: string;
  replacedWithTyreNumber?: string;
  replacementSource?: string;
  repairStatus: 'pending' | 'repaired' | 'scrapped';
  remarks?: string;
  createdAt: string;
}

// Tab permission type
export type TabPermission = 
  | 'dashboard'
  | 'routeMaster'
  | 'driverMaster'
  | 'vehicleMaster'
  | 'submitLogsheet'
  | 'breakdownAnalysis'
  | 'tyreMgmt'
  | 'reports'
  | 'admin';

// User type for authentication
export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: 'admin' | 'user';
  permissions: TabPermission[];
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}
