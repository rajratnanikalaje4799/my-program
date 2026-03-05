import { ReactNode, useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Map, LayoutDashboard, Bus, ClipboardList, Users, Car, FileText, AlertTriangle, Circle, Shield, LogOut, User, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { userStorage } from '../utils/userStorage';
import { TabPermission } from '../types/user';
import { checkServerConnection, getServerStatus } from '../utils/api';

interface LayoutProps {
  children: ReactNode;
  onLogout: () => void;
}

export function Layout({ children, onLogout }: LayoutProps) {
  const authState = userStorage.getAuthState();
  const currentUser = authState.currentUser;
  
  // Server connection status
  const [isServerConnected, setIsServerConnected] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const serverStatus = getServerStatus();

  // Check server connection on mount and periodically
  useEffect(() => {
    const checkConnection = async () => {
      setIsChecking(true);
      const connected = await checkServerConnection();
      setIsServerConnected(connected);
      setIsChecking(false);
    };
    
    checkConnection();
    
    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshConnection = async () => {
    setIsChecking(true);
    const connected = await checkServerConnection();
    setIsServerConnected(connected);
    setIsChecking(false);
  };

  const allNavItems: { to: string; icon: any; label: string; permission: TabPermission }[] = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard' },
    { to: '/master', icon: Map, label: 'Route Master', permission: 'routeMaster' },
    { to: '/drivers', icon: Users, label: 'Driver Master', permission: 'driverMaster' },
    { to: '/vehicles', icon: Car, label: 'Vehicle Master', permission: 'vehicleMaster' },
    { to: '/submit', icon: ClipboardList, label: 'Submit Logsheet', permission: 'submitLogsheet' },
    { to: '/breakdown', icon: AlertTriangle, label: 'Breakdown Analysis', permission: 'breakdownAnalysis' },
    { to: '/tyres', icon: Circle, label: 'Tyre Management', permission: 'tyreMaster' },
    { to: '/reports', icon: FileText, label: 'Reports', permission: 'reports' },
    { to: '/admin', icon: Shield, label: 'Admin Panel', permission: 'adminPanel' },
  ];

  // Filter nav items based on user permissions
  const navItems = allNavItems.filter(item => 
    currentUser?.permissions.includes(item.permission)
  );

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      userStorage.logout();
      onLogout();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="h-20 flex items-center px-6 border-b border-slate-800">
          <Bus className="h-8 w-8 text-blue-400 mr-3" />
          <div className="leading-tight">
            <h1 className="text-lg font-bold tracking-wider text-slate-100">DEPOT MGT</h1>
            <p className="text-[11px] text-blue-200 mt-0.5">City Life Line Travels Pvt. Ltd.</p>
          </div>
        </div>

        {/* User Info */}
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
              currentUser?.role === 'admin' ? 'bg-purple-600' : 'bg-blue-600'
            }`}>
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {currentUser?.fullName || 'Guest'}
              </p>
              <p className="text-xs text-slate-400 truncate">
                @{currentUser?.username} • {currentUser?.role === 'admin' ? 'Admin' : 'User'}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2.5 rounded-lg transition-colors duration-200 ${
                        isActive
                          ? item.permission === 'adminPanel' 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout Button */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2.5 rounded-lg text-slate-300 hover:bg-red-600 hover:text-white transition-colors duration-200"
          >
            <LogOut className="h-5 w-5 mr-3" />
            <span className="font-medium">Logout</span>
          </button>
        </div>

        {/* Server Connection Status */}
        <div className="px-3 py-2 border-t border-slate-800">
          <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${
            isServerConnected ? 'bg-green-900/30' : 'bg-red-900/30'
          }`}>
            <div className="flex items-center gap-2">
              {isChecking ? (
                <RefreshCw className="h-4 w-4 text-yellow-400 animate-spin" />
              ) : isServerConnected ? (
                <Wifi className="h-4 w-4 text-green-400" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-400" />
              )}
              <span className={`text-xs font-medium ${
                isServerConnected ? 'text-green-300' : 'text-red-300'
              }`}>
                {isChecking ? 'Checking...' : isServerConnected ? 'Server Connected' : 'Offline Mode'}
              </span>
            </div>
            <button
              onClick={handleRefreshConnection}
              disabled={isChecking}
              className="text-slate-400 hover:text-white transition-colors"
              title="Check connection"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {!isServerConnected && (
            <p className="text-[10px] text-red-300 mt-1 px-1">
              Server: {serverStatus.url}
            </p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-500 text-center">
          Depot Management System &copy; {new Date().getFullYear()}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-800">System Control Panel</h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              currentUser?.role === 'admin' 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {currentUser?.role === 'admin' ? 'Administrator' : 'User'}
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
