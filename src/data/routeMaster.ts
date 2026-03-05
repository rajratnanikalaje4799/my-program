import { RouteDefinition } from '../types';

export const ROUTE_MASTER: RouteDefinition[] = [
  {
    routeNumber: "R-101",
    scheduleKms: 120,
    shift: "Morning",
    trips: [
      { id: "T-101-1", name: "Depot to City Center", planKm: 45, scheduleOutTime: "08:00", scheduleInTime: "09:30" },
      { id: "T-101-2", name: "City Center to Central Station", planKm: 30, scheduleOutTime: "10:00", scheduleInTime: "10:45" },
      { id: "T-101-3", name: "Central Station to Depot", planKm: 45, scheduleOutTime: "11:15", scheduleInTime: "12:30" }
    ]
  },
  {
    routeNumber: "R-102",
    scheduleKms: 180,
    shift: "Evening",
    trips: [
      { id: "T-102-1", name: "Depot to North Terminal", planKm: 60, scheduleOutTime: "06:30", scheduleInTime: "08:15" },
      { id: "T-102-2", name: "North Terminal to Airport", planKm: 50, scheduleOutTime: "09:00", scheduleInTime: "10:30" },
      { id: "T-102-3", name: "Airport to South Hub", planKm: 40, scheduleOutTime: "11:00", scheduleInTime: "12:45" },
      { id: "T-102-4", name: "South Hub to Depot", planKm: 30, scheduleOutTime: "13:15", scheduleInTime: "15:00" }
    ]
  },
  {
    routeNumber: "R-103",
    scheduleKms: 95,
    shift: "General",
    trips: [
      { id: "T-103-1", name: "Depot to East Market", planKm: 35, scheduleOutTime: "07:00", scheduleInTime: "07:45" },
      { id: "T-103-2", name: "East Market to West Mall", planKm: 40, scheduleOutTime: "08:00", scheduleInTime: "09:15" },
      { id: "T-103-3", name: "West Mall to Depot", planKm: 20, scheduleOutTime: "09:30", scheduleInTime: "10:20" }
    ]
  }
];
