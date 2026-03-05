import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { SubmitLogsheet } from './pages/SubmitLogsheet';
import { RouteMasterPage } from './pages/RouteMasterPage';
import { DriverMasterPage } from './pages/DriverMasterPage';
import { VehicleMasterPage } from './pages/VehicleMasterPage';
import { BreakdownAnalysis } from './pages/BreakdownAnalysis';
import TyreManagement from './pages/TyreManagement';
import { Reports } from './pages/Reports';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import { userStorage } from './utils/userStorage';
import { TabPermission } from './types/user';

// Protected Route Component
function ProtectedRoute({ 
  children, 
  permission 
}: { 
  children: React.ReactNode; 
  permission: TabPermission;
}) {
  const authState = userStorage.getAuthState();
  
  if (!authState.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!authState.currentUser?.permissions.includes(permission)) {
    // Redirect to first allowed page
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const authState = userStorage.getAuthState();
    setIsAuthenticated(authState.isAuthenticated);
    setIsLoading(false);
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <HashRouter>
      <Layout onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute permission="dashboard">
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/submit" element={
            <ProtectedRoute permission="submitLogsheet">
              <SubmitLogsheet />
            </ProtectedRoute>
          } />
          <Route path="/master" element={
            <ProtectedRoute permission="routeMaster">
              <RouteMasterPage />
            </ProtectedRoute>
          } />
          <Route path="/drivers" element={
            <ProtectedRoute permission="driverMaster">
              <DriverMasterPage />
            </ProtectedRoute>
          } />
          <Route path="/vehicles" element={
            <ProtectedRoute permission="vehicleMaster">
              <VehicleMasterPage />
            </ProtectedRoute>
          } />
          <Route path="/breakdown" element={
            <ProtectedRoute permission="breakdownAnalysis">
              <BreakdownAnalysis />
            </ProtectedRoute>
          } />
          <Route path="/tyres" element={
            <ProtectedRoute permission="tyreMaster">
              <TyreManagement />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute permission="reports">
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute permission="adminPanel">
              <AdminPanel />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
