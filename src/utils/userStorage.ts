import { User, AuthState } from '../types/user';

const USERS_KEY = 'depot_users';
const AUTH_KEY = 'depot_auth';

// Default admin user
const DEFAULT_ADMIN: User = {
  id: 'admin-001',
  username: 'admin',
  password: 'admin123', // In production, use hashed passwords
  fullName: 'System Administrator',
  role: 'admin',
  permissions: [
    'dashboard',
    'routeMaster',
    'driverMaster',
    'vehicleMaster',
    'submitLogsheet',
    'breakdownAnalysis',
    'tyreMaster',
    'reports',
    'adminPanel'
  ],
  isActive: true,
  createdAt: new Date().toISOString(),
  createdBy: 'system',
};

// Initialize with default admin if no users exist
const initializeUsers = (): User[] => {
  const stored = localStorage.getItem(USERS_KEY);
  if (!stored) {
    localStorage.setItem(USERS_KEY, JSON.stringify([DEFAULT_ADMIN]));
    return [DEFAULT_ADMIN];
  }
  const users = JSON.parse(stored);
  // Ensure admin always exists
  const adminExists = users.some((u: User) => u.username === 'admin');
  if (!adminExists) {
    users.push(DEFAULT_ADMIN);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  return users;
};

export const userStorage = {
  getUsers: (): User[] => {
    return initializeUsers();
  },

  getUserById: (id: string): User | undefined => {
    const users = initializeUsers();
    return users.find(u => u.id === id);
  },

  getUserByUsername: (username: string): User | undefined => {
    const users = initializeUsers();
    return users.find(u => u.username.toLowerCase() === username.toLowerCase());
  },

  createUser: (user: Omit<User, 'id' | 'createdAt'>): User => {
    const users = initializeUsers();
    const newUser: User = {
      ...user,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return newUser;
  },

  updateUser: (id: string, updates: Partial<User>): User | null => {
    const users = initializeUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return null;
    
    // Don't allow changing admin's username
    if (users[index].username === 'admin' && updates.username && updates.username !== 'admin') {
      updates.username = 'admin';
    }
    
    users[index] = { ...users[index], ...updates };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return users[index];
  },

  deleteUser: (id: string): boolean => {
    const users = initializeUsers();
    const user = users.find(u => u.id === id);
    
    // Don't allow deleting the main admin
    if (user?.username === 'admin') return false;
    
    const filtered = users.filter(u => u.id !== id);
    localStorage.setItem(USERS_KEY, JSON.stringify(filtered));
    return true;
  },

  // Authentication methods
  login: (username: string, password: string): User | null => {
    const users = initializeUsers();
    const user = users.find(
      u => u.username.toLowerCase() === username.toLowerCase() && 
           u.password === password &&
           u.isActive
    );
    
    if (user) {
      // Update last login
      user.lastLogin = new Date().toISOString();
      userStorage.updateUser(user.id, { lastLogin: user.lastLogin });
      
      // Save auth state
      const authState: AuthState = {
        isAuthenticated: true,
        currentUser: user,
      };
      localStorage.setItem(AUTH_KEY, JSON.stringify(authState));
      return user;
    }
    return null;
  },

  logout: (): void => {
    localStorage.removeItem(AUTH_KEY);
  },

  getAuthState: (): AuthState => {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      const authState = JSON.parse(stored);
      // Verify user still exists and is active
      if (authState.currentUser) {
        const user = userStorage.getUserById(authState.currentUser.id);
        if (user && user.isActive) {
          return { isAuthenticated: true, currentUser: user };
        }
      }
    }
    return { isAuthenticated: false, currentUser: null };
  },

  hasPermission: (permission: string): boolean => {
    const authState = userStorage.getAuthState();
    if (!authState.isAuthenticated || !authState.currentUser) return false;
    return authState.currentUser.permissions.includes(permission as any);
  },

  isAdmin: (): boolean => {
    const authState = userStorage.getAuthState();
    return authState.currentUser?.role === 'admin';
  },
};
