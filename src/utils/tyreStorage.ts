import { Tyre, TyreAssignment, TyreIncidentRecord } from '../types/tyre';

const TYRES_KEY = 'depot_tyres';
const ASSIGNMENTS_KEY = 'depot_tyre_assignments';
const PUNCTURES_KEY = 'depot_tyre_punctures';

export const tyreStorage = {
  // Tyre Master
  getTyres: (): Tyre[] => {
    const data = localStorage.getItem(TYRES_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveTyre: (tyre: Tyre): void => {
    const tyres = tyreStorage.getTyres();
    tyres.push(tyre);
    localStorage.setItem(TYRES_KEY, JSON.stringify(tyres));
  },

  updateTyre: (updatedTyre: Tyre): void => {
    const tyres = tyreStorage.getTyres();
    const index = tyres.findIndex(t => t.id === updatedTyre.id);
    if (index !== -1) {
      tyres[index] = updatedTyre;
      localStorage.setItem(TYRES_KEY, JSON.stringify(tyres));
    }
  },

  deleteTyre: (id: string): void => {
    const tyres = tyreStorage.getTyres().filter(t => t.id !== id);
    localStorage.setItem(TYRES_KEY, JSON.stringify(tyres));
  },

  // Tyre Assignments
  getAssignments: (): TyreAssignment[] => {
    const data = localStorage.getItem(ASSIGNMENTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveAssignment: (assignment: TyreAssignment): void => {
    const assignments = tyreStorage.getAssignments();
    assignments.push(assignment);
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
  },

  updateAssignment: (updatedAssignment: TyreAssignment): void => {
    const assignments = tyreStorage.getAssignments();
    const index = assignments.findIndex(a => a.id === updatedAssignment.id);
    if (index !== -1) {
      assignments[index] = updatedAssignment;
      localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
    }
  },

  getActiveAssignmentForVehicle: (vehicleNumber: string): TyreAssignment[] => {
    return tyreStorage.getAssignments().filter(
      a => a.vehicleNumber === vehicleNumber && a.isActive
    );
  },

  getActiveAssignmentForTyre: (tyreId: string): TyreAssignment | undefined => {
    return tyreStorage.getAssignments().find(
      a => a.tyreId === tyreId && a.isActive
    );
  },

  getTyreHistory: (tyreId: string): TyreAssignment[] => {
    return tyreStorage.getAssignments().filter(a => a.tyreId === tyreId);
  },

  // Incident Records (Puncture, Blast, Cut)
  getIncidentRecords: (): TyreIncidentRecord[] => {
    const data = localStorage.getItem(PUNCTURES_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveIncidentRecord: (record: TyreIncidentRecord): void => {
    const records = tyreStorage.getIncidentRecords();
    records.push(record);
    localStorage.setItem(PUNCTURES_KEY, JSON.stringify(records));
  },

  updateIncidentRecord: (updatedRecord: TyreIncidentRecord): void => {
    const records = tyreStorage.getIncidentRecords();
    const index = records.findIndex(r => r.id === updatedRecord.id);
    if (index !== -1) {
      records[index] = updatedRecord;
      localStorage.setItem(PUNCTURES_KEY, JSON.stringify(records));
    }
  },

  getIncidentHistoryForTyre: (tyreId: string): TyreIncidentRecord[] => {
    return tyreStorage.getIncidentRecords().filter(r => r.tyreId === tyreId);
  },

  deleteIncidentRecord: (id: string): void => {
    const records = tyreStorage.getIncidentRecords().filter(r => r.id !== id);
    localStorage.setItem(PUNCTURES_KEY, JSON.stringify(records));
  }
};
