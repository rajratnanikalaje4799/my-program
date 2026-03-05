export type TabPermission = 
  | 'dashboard'
  | 'routeMaster'
  | 'driverMaster'
  | 'vehicleMaster'
  | 'submitLogsheet'
  | 'breakdownAnalysis'
  | 'tyreMaster'
  | 'reports'
  | 'adminPanel';

export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: 'admin' | 'user';
  permissions: TabPermission[];
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  lastLogin?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  currentUser: User | null;
}

export const ALL_TABS: { id: TabPermission; label: string; adminOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'routeMaster', label: 'Route Master' },
  { id: 'driverMaster', label: 'Driver Master' },
  { id: 'vehicleMaster', label: 'Vehicle Master' },
  { id: 'submitLogsheet', label: 'Submit Logsheet' },
  { id: 'breakdownAnalysis', label: 'Breakdown Analysis' },
  { id: 'tyreMaster', label: 'Tyre Management' },
  { id: 'reports', label: 'Reports' },
  { id: 'adminPanel', label: 'Admin Panel', adminOnly: true },
];
