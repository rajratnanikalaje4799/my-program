// Data Backup Utility - Export/Import all data to/from JSON files
// Store backup files on your server PC for safety

import { storage } from './storage';
import { driverStorage } from './driverStorage';
import { vehicleStorage } from './vehicleStorage';
import { breakdownStorage } from './breakdownStorage';
import { tyreStorage } from './tyreStorage';

export interface BackupData {
  version: string;
  exportDate: string;
  exportedBy: string;
  data: {
    users: any[];
    logsheets: any[];
    routes: any[];
    drivers: any[];
    vehicles: any[];
    breakdowns: any[];
    tyres: any[];
    tyreAssignments: any[];
    tyreIncidents: any[];
  };
  metadata: {
    totalLogsheets: number;
    totalRoutes: number;
    totalDrivers: number;
    totalVehicles: number;
    totalBreakdowns: number;
    totalTyres: number;
  };
}

// Get all users from localStorage
const getUsers = (): any[] => {
  const data = localStorage.getItem('depot_users');
  return data ? JSON.parse(data) : [];
};

// Get all routes from localStorage
const getRoutes = (): any[] => {
  const data = localStorage.getItem('depot_routes');
  return data ? JSON.parse(data) : [];
};

// Save all users to localStorage
const saveUsers = (users: any[]): void => {
  localStorage.setItem('depot_users', JSON.stringify(users));
};

// Export all data to a single JSON object
export const exportAllData = (exportedBy: string): BackupData => {
  const users = getUsers();
  const logsheets = storage.getLogsheets();
  const routes = getRoutes();
  const drivers = driverStorage.getDrivers();
  const vehicles = vehicleStorage.getVehicles();
  const breakdowns = breakdownStorage.getAll();
  const tyres = tyreStorage.getTyres();
  const tyreAssignments = tyreStorage.getAssignments();
  const tyreIncidents = tyreStorage.getIncidentRecords();

  const backup: BackupData = {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    exportedBy: exportedBy,
    data: {
      users,
      logsheets,
      routes,
      drivers,
      vehicles,
      breakdowns,
      tyres,
      tyreAssignments,
      tyreIncidents,
    },
    metadata: {
      totalLogsheets: logsheets.length,
      totalRoutes: routes.length,
      totalDrivers: drivers.length,
      totalVehicles: vehicles.length,
      totalBreakdowns: breakdowns.length,
      totalTyres: tyres.length,
    },
  };

  return backup;
};

// Download backup as JSON file
export const downloadBackup = (exportedBy: string): void => {
  const backup = exportAllData(exportedBy);
  const fileName = `depot_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Import data from backup JSON
export const importBackupData = (backup: BackupData, options: {
  importUsers?: boolean;
  importLogsheets?: boolean;
  importRoutes?: boolean;
  importDrivers?: boolean;
  importVehicles?: boolean;
  importBreakdowns?: boolean;
  importTyres?: boolean;
  replaceExisting?: boolean;
}): { success: boolean; message: string; imported: Record<string, number> } => {
  try {
    const imported: Record<string, number> = {};

    if (options.importUsers && backup.data.users) {
      if (options.replaceExisting) {
        saveUsers(backup.data.users);
      } else {
        const existing = getUsers();
        const existingIds = new Set(existing.map((u: any) => u.id));
        const newUsers = backup.data.users.filter((u: any) => !existingIds.has(u.id));
        saveUsers([...existing, ...newUsers]);
      }
      imported.users = backup.data.users.length;
    }

    if (options.importLogsheets && backup.data.logsheets) {
      if (options.replaceExisting) {
        localStorage.setItem('depot_logsheets', JSON.stringify(backup.data.logsheets));
      } else {
        const existing = storage.getLogsheets();
        const existingIds = new Set(existing.map((l: any) => l.id));
        const newLogsheets = backup.data.logsheets.filter((l: any) => !existingIds.has(l.id));
        localStorage.setItem('depot_logsheets', JSON.stringify([...existing, ...newLogsheets]));
      }
      imported.logsheets = backup.data.logsheets.length;
    }

    if (options.importRoutes && backup.data.routes) {
      if (options.replaceExisting) {
        localStorage.setItem('depot_routes', JSON.stringify(backup.data.routes));
      } else {
        const existing = getRoutes();
        const existingIds = new Set(existing.map((r: any) => r.id));
        const newRoutes = backup.data.routes.filter((r: any) => !existingIds.has(r.id));
        localStorage.setItem('depot_routes', JSON.stringify([...existing, ...newRoutes]));
      }
      imported.routes = backup.data.routes.length;
    }

    if (options.importDrivers && backup.data.drivers) {
      if (options.replaceExisting) {
        localStorage.setItem('depot_drivers', JSON.stringify(backup.data.drivers));
      } else {
        const existing = driverStorage.getDrivers();
        const existingIds = new Set(existing.map((d: any) => d.id));
        const newDrivers = backup.data.drivers.filter((d: any) => !existingIds.has(d.id));
        localStorage.setItem('depot_drivers', JSON.stringify([...existing, ...newDrivers]));
      }
      imported.drivers = backup.data.drivers.length;
    }

    if (options.importVehicles && backup.data.vehicles) {
      if (options.replaceExisting) {
        localStorage.setItem('depot_vehicles', JSON.stringify(backup.data.vehicles));
      } else {
        const existing = vehicleStorage.getVehicles();
        const existingIds = new Set(existing.map((v: any) => v.id));
        const newVehicles = backup.data.vehicles.filter((v: any) => !existingIds.has(v.id));
        localStorage.setItem('depot_vehicles', JSON.stringify([...existing, ...newVehicles]));
      }
      imported.vehicles = backup.data.vehicles.length;
    }

    if (options.importBreakdowns && backup.data.breakdowns) {
      if (options.replaceExisting) {
        localStorage.setItem('depot_breakdowns', JSON.stringify(backup.data.breakdowns));
      } else {
        const existing = breakdownStorage.getAll();
        const existingIds = new Set(existing.map((b: any) => b.id));
        const newBreakdowns = backup.data.breakdowns.filter((b: any) => !existingIds.has(b.id));
        localStorage.setItem('depot_breakdowns', JSON.stringify([...existing, ...newBreakdowns]));
      }
      imported.breakdowns = backup.data.breakdowns.length;
    }

    if (options.importTyres && backup.data.tyres) {
      if (options.replaceExisting) {
        localStorage.setItem('depot_tyres', JSON.stringify(backup.data.tyres));
        if (backup.data.tyreAssignments) {
          localStorage.setItem('depot_tyre_assignments', JSON.stringify(backup.data.tyreAssignments));
        }
        if (backup.data.tyreIncidents) {
          localStorage.setItem('depot_tyre_punctures', JSON.stringify(backup.data.tyreIncidents));
        }
      } else {
        // Tyres
        const existingTyres = tyreStorage.getTyres();
        const existingTyreIds = new Set(existingTyres.map((t: any) => t.id));
        const newTyres = backup.data.tyres.filter((t: any) => !existingTyreIds.has(t.id));
        localStorage.setItem('depot_tyres', JSON.stringify([...existingTyres, ...newTyres]));
        
        // Assignments
        if (backup.data.tyreAssignments) {
          const existingAssignments = tyreStorage.getAssignments();
          const existingAssignmentIds = new Set(existingAssignments.map((a: any) => a.id));
          const newAssignments = backup.data.tyreAssignments.filter((a: any) => !existingAssignmentIds.has(a.id));
          localStorage.setItem('depot_tyre_assignments', JSON.stringify([...existingAssignments, ...newAssignments]));
        }
        
        // Incidents
        if (backup.data.tyreIncidents) {
          const existingIncidents = tyreStorage.getIncidentRecords();
          const existingIncidentIds = new Set(existingIncidents.map((i: any) => i.id));
          const newIncidents = backup.data.tyreIncidents.filter((i: any) => !existingIncidentIds.has(i.id));
          localStorage.setItem('depot_tyre_punctures', JSON.stringify([...existingIncidents, ...newIncidents]));
        }
      }
      imported.tyres = backup.data.tyres.length;
    }

    return {
      success: true,
      message: 'Data imported successfully!',
      imported,
    };
  } catch (error) {
    return {
      success: false,
      message: `Import failed: ${error}`,
      imported: {},
    };
  }
};

// Validate backup file structure
export const validateBackupFile = (data: any): { valid: boolean; error?: string } => {
  if (!data) {
    return { valid: false, error: 'No data found in file' };
  }
  
  if (!data.version) {
    return { valid: false, error: 'Invalid backup file: missing version' };
  }
  
  if (!data.data) {
    return { valid: false, error: 'Invalid backup file: missing data section' };
  }
  
  if (!data.exportDate) {
    return { valid: false, error: 'Invalid backup file: missing export date' };
  }
  
  return { valid: true };
};

// Get storage statistics
export const getStorageStats = (): {
  users: number;
  logsheets: number;
  routes: number;
  drivers: number;
  vehicles: number;
  breakdowns: number;
  tyres: number;
  tyreAssignments: number;
  tyreIncidents: number;
  totalSizeKB: number;
} => {
  let totalSize = 0;
  
  const keys = [
    'depot_users',
    'depot_logsheets',
    'depot_routes',
    'depot_drivers',
    'depot_vehicles',
    'depot_breakdowns',
    'depot_tyres',
    'depot_tyre_assignments',
    'depot_tyre_punctures',
    'depot_currentUser',
  ];
  
  keys.forEach(key => {
    const data = localStorage.getItem(key);
    if (data) {
      totalSize += data.length * 2; // UTF-16 encoding
    }
  });

  return {
    users: getUsers().length,
    logsheets: storage.getLogsheets().length,
    routes: getRoutes().length,
    drivers: driverStorage.getDrivers().length,
    vehicles: vehicleStorage.getVehicles().length,
    breakdowns: breakdownStorage.getAll().length,
    tyres: tyreStorage.getTyres().length,
    tyreAssignments: tyreStorage.getAssignments().length,
    tyreIncidents: tyreStorage.getIncidentRecords().length,
    totalSizeKB: Math.round(totalSize / 1024),
  };
};

// Clear all data (dangerous - use with caution)
export const clearAllData = (): void => {
  // Intentionally limited clear: only report, breakdown and tyre related data.
  const keys = [
    'depot_logsheets',
    'depot_breakdowns',
    'depot_tyres',
    'depot_tyre_assignments',
    'depot_tyre_punctures',
  ];
  
  keys.forEach(key => {
    localStorage.removeItem(key);
  });
};

// Auto-backup reminder (returns true if backup is needed)
export const isBackupNeeded = (): { needed: boolean; lastBackup: string | null; daysSinceBackup: number } => {
  const lastBackup = localStorage.getItem('depot_last_backup');
  
  if (!lastBackup) {
    return { needed: true, lastBackup: null, daysSinceBackup: -1 };
  }
  
  const lastBackupDate = new Date(lastBackup);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastBackupDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return {
    needed: diffDays >= 7, // Backup needed if more than 7 days
    lastBackup,
    daysSinceBackup: diffDays,
  };
};

// Record backup timestamp
export const recordBackup = (): void => {
  localStorage.setItem('depot_last_backup', new Date().toISOString());
};
