export interface Tyre {
  id: string;
  tyreNumber: string;
  brand?: string;
  size?: string;
  purchaseDate?: string;
  status: 'available' | 'fitted' | 'punctured' | 'blast' | 'cut' | 'scrapped';
  currentVehicle?: string;
  totalKmRun: number;
  createdAt: string;
  scrappedDate?: string;
  scrappedKm?: number;
}

export type TyreRemovalReason = 'puncture' | 'blast' | 'cut' | 'rotation' | 'replacement' | 'transferred' | 'scrap' | 'other';

export interface TyreAssignment {
  id: string;
  tyreId: string;
  tyreNumber: string;
  vehicleNumber: string;
  assignedDate: string;
  unassignedDate?: string;
  kmAtAssignment: number;
  kmAtUnassignment?: number;
  kmRun: number;
  reason?: TyreRemovalReason;
  reasonDetails?: string;
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
  replacementTyreId?: string;
  replacementTyreNumber?: string;
  replacementSource?: 'available' | 'from_vehicle';
  replacementFromVehicle?: string;
  repairStatus: 'pending' | 'repaired' | 'scrapped';
  repairDate?: string;
  repairCost?: number;
  remarks?: string;
}

export interface TyreLifecycle {
  tyreId: string;
  tyreNumber: string;
  purchaseDate: string;
  totalKmRun: number;
  vehicleHistory: {
    vehicleNumber: string;
    assignedDate: string;
    removedDate?: string;
    kmRun: number;
    removalReason?: TyreRemovalReason;
  }[];
  incidents: {
    date: string;
    type: 'puncture' | 'blast' | 'cut';
    vehicleNumber: string;
    kmAtIncident: number;
    status: string;
  }[];
  scrappedDate?: string;
  scrappedKm?: number;
}
