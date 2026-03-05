import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, UserPlus, Shield, Search, Edit2, Trash2, 
  Check, X, Eye, EyeOff, Save, AlertCircle, CheckCircle,
  Database, Download, Upload, HardDrive, RefreshCw, Trash
} from 'lucide-react';
import { User, TabPermission, ALL_TABS } from '../types/user';
import { userStorage } from '../utils/userStorage';
import { 
  downloadBackup, 
  importBackupData, 
  validateBackupFile, 
  getStorageStats,
  clearAllData,
  isBackupNeeded,
  recordBackup,
  BackupData
} from '../utils/dataBackup';

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'create' | 'backup'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  // Backup states
  const [storageStats, setStorageStats] = useState(getStorageStats());
  const [backupStatus, setBackupStatus] = useState(isBackupNeeded());
  const [importing, setImporting] = useState(false);
  const [importOptions, setImportOptions] = useState({
    importUsers: true,
    importLogsheets: true,
    importRoutes: true,
    importDrivers: true,
    importVehicles: true,
    importBreakdowns: true,
    importTyres: true,
    replaceExisting: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New user form
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'user' as 'admin' | 'user',
    permissions: ['dashboard'] as TabPermission[],
    isActive: true,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    setUsers(userStorage.getUsers());
  };

  const currentUser = userStorage.getAuthState().currentUser;

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newUser.username.trim() || !newUser.password.trim() || !newUser.fullName.trim()) {
      setError('Please fill all required fields');
      return;
    }

    if (newUser.password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    // Check if username exists
    if (userStorage.getUserByUsername(newUser.username)) {
      setError('Username already exists');
      return;
    }

    // If role is admin, give all permissions
    const permissions = newUser.role === 'admin' 
      ? ALL_TABS.map(t => t.id)
      : newUser.permissions;

    userStorage.createUser({
      ...newUser,
      permissions,
      createdBy: currentUser?.fullName || 'Admin',
    });

    setSuccess(`User "${newUser.username}" created successfully!`);
    setNewUser({
      username: '',
      password: '',
      fullName: '',
      role: 'user',
      permissions: ['dashboard'],
      isActive: true,
    });
    loadUsers();

    setTimeout(() => setSuccess(''), 3000);
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;
    setError('');
    setSuccess('');

    // If role is admin, give all permissions
    const permissions = editingUser.role === 'admin'
      ? ALL_TABS.map(t => t.id)
      : editingUser.permissions;

    userStorage.updateUser(editingUser.id, { ...editingUser, permissions });
    setSuccess(`User "${editingUser.username}" updated successfully!`);
    setEditingUser(null);
    loadUsers();

    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDeleteUser = (user: User) => {
    if (user.username === 'admin') {
      setError('Cannot delete the main admin account');
      return;
    }

    if (window.confirm(`Are you sure you want to delete user "${user.username}"? This cannot be undone.`)) {
      userStorage.deleteUser(user.id);
      setSuccess(`User "${user.username}" deleted successfully!`);
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleTogglePermission = (permission: TabPermission, isEditing: boolean) => {
    if (isEditing && editingUser) {
      const current = editingUser.permissions;
      const updated = current.includes(permission)
        ? current.filter(p => p !== permission)
        : [...current, permission];
      setEditingUser({ ...editingUser, permissions: updated });
    } else {
      const current = newUser.permissions;
      const updated = current.includes(permission)
        ? current.filter(p => p !== permission)
        : [...current, permission];
      setNewUser({ ...newUser, permissions: updated });
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Shield className="w-7 h-7 text-purple-600" />
          Admin Panel
        </h1>
        <p className="text-gray-600">Manage users and their permissions</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'users'
                  ? 'border-purple-500 text-purple-600 bg-purple-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              All Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'create'
                  ? 'border-purple-500 text-purple-600 bg-purple-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              Create New User
            </button>
            <button
              onClick={() => {
                setActiveTab('backup');
                setStorageStats(getStorageStats());
                setBackupStatus(isBackupNeeded());
              }}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'backup'
                  ? 'border-purple-500 text-purple-600 bg-purple-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Database className="w-4 h-4 inline mr-2" />
              Data Backup
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* All Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Search */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by username or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Users List */}
              <div className="space-y-3">
                {filteredUsers.map(user => (
                  <div
                    key={user.id}
                    className={`border rounded-lg p-4 ${
                      editingUser?.id === user.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                    }`}
                  >
                    {editingUser?.id === user.id ? (
                      // Edit Mode
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-purple-700">Editing: {user.username}</h3>
                          <div className="flex gap-2">
                            <button
                              onClick={handleUpdateUser}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-green-700"
                            >
                              <Save className="w-4 h-4" /> Save
                            </button>
                            <button
                              onClick={() => setEditingUser(null)}
                              className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-gray-600"
                            >
                              <X className="w-4 h-4" /> Cancel
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                            <input
                              type="text"
                              value={editingUser.fullName}
                              onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                value={editingUser.password}
                                onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg text-sm pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                            <select
                              value={editingUser.role}
                              onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as 'admin' | 'user' })}
                              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                              disabled={editingUser.username === 'admin'}
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editingUser.isActive}
                              onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.checked })}
                              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              disabled={editingUser.username === 'admin'}
                            />
                            <span>Active Account</span>
                          </label>
                        </div>

                        {editingUser.role !== 'admin' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-2">Tab Permissions</label>
                            <div className="flex flex-wrap gap-2">
                              {ALL_TABS.filter(t => !t.adminOnly).map(tab => (
                                <label
                                  key={tab.id}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs cursor-pointer ${
                                    editingUser.permissions.includes(tab.id)
                                      ? 'bg-purple-100 border-purple-300 text-purple-700'
                                      : 'bg-gray-50 border-gray-200 text-gray-600'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={editingUser.permissions.includes(tab.id)}
                                    onChange={() => handleTogglePermission(tab.id, true)}
                                    className="sr-only"
                                  />
                                  {editingUser.permissions.includes(tab.id) ? (
                                    <Check className="w-3 h-3" />
                                  ) : (
                                    <X className="w-3 h-3" />
                                  )}
                                  {tab.label}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                              {user.role === 'admin' ? <Shield className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-800">{user.fullName}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  user.role === 'admin' 
                                    ? 'bg-purple-100 text-purple-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {user.role === 'admin' ? 'Admin' : 'User'}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  user.isActive 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {user.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500">
                                @{user.username} • Last login: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                              </div>
                            </div>
                          </div>

                          {/* Permissions */}
                          <div className="mt-3 flex flex-wrap gap-1">
                            {user.permissions.map(perm => (
                              <span
                                key={perm}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                              >
                                {ALL_TABS.find(t => t.id === perm)?.label || perm}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm flex items-center gap-1 hover:bg-blue-200"
                          >
                            <Edit2 className="w-4 h-4" /> Edit
                          </button>
                          {user.username !== 'admin' && (
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm flex items-center gap-1 hover:bg-red-200"
                            >
                              <Trash2 className="w-4 h-4" /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {filteredUsers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No users found matching "{searchTerm}"
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Create User Tab */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateUser} className="max-w-2xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 pr-10"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'user' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newUser.isActive}
                    onChange={(e) => setNewUser({ ...newUser, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Active Account</span>
                </label>
              </div>

              {newUser.role !== 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tab Permissions
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Select which tabs this user can access. Admin users automatically get all permissions.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {ALL_TABS.filter(t => !t.adminOnly).map(tab => (
                      <label
                        key={tab.id}
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                          newUser.permissions.includes(tab.id)
                            ? 'bg-purple-50 border-purple-300'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={newUser.permissions.includes(tab.id)}
                          onChange={() => handleTogglePermission(tab.id, false)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">{tab.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 focus:ring-4 focus:ring-purple-200 transition-colors flex items-center gap-2"
                >
                  <UserPlus className="w-5 h-5" />
                  Create User
                </button>
              </div>
            </form>
          )}

          {/* Data Backup Tab */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              {/* Backup Reminder */}
              {backupStatus.needed && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-yellow-800">Backup Recommended!</h3>
                    <p className="text-sm text-yellow-700">
                      {backupStatus.lastBackup 
                        ? `Last backup was ${backupStatus.daysSinceBackup} days ago. Please create a new backup.`
                        : 'You have never created a backup. Please create one to prevent data loss.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Storage Statistics */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
                  <HardDrive className="w-5 h-5 text-blue-600" />
                  Current Data Statistics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                    <div className="text-3xl font-bold text-blue-600">{storageStats.logsheets}</div>
                    <div className="text-xs text-gray-600">Logsheets</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                    <div className="text-3xl font-bold text-green-600">{storageStats.routes}</div>
                    <div className="text-xs text-gray-600">Routes</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                    <div className="text-3xl font-bold text-purple-600">{storageStats.drivers}</div>
                    <div className="text-xs text-gray-600">Drivers</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                    <div className="text-3xl font-bold text-orange-600">{storageStats.vehicles}</div>
                    <div className="text-xs text-gray-600">Vehicles</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                    <div className="text-3xl font-bold text-teal-600">{storageStats.tyres}</div>
                    <div className="text-xs text-gray-600">Tyres</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    Users: {storageStats.users} | Breakdowns: {storageStats.breakdowns} | Tyre Incidents: {storageStats.tyreIncidents}
                  </span>
                  <span className="font-semibold text-purple-700">
                    Total Size: {storageStats.totalSizeKB} KB
                  </span>
                </div>
              </div>

              {/* Export Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
                  <Download className="w-5 h-5 text-green-600" />
                  Export Data (Backup)
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download all data as a JSON file. Save this file on your server PC or external storage for backup.
                </p>
                <button
                  onClick={() => {
                    const currentUserName = currentUser?.fullName || 'Unknown';
                    downloadBackup(currentUserName);
                    recordBackup();
                    setBackupStatus(isBackupNeeded());
                    setSuccess('Backup downloaded successfully! Save this file on your server PC.');
                    setTimeout(() => setSuccess(''), 5000);
                  }}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download Complete Backup
                </button>
                {backupStatus.lastBackup && (
                  <p className="mt-3 text-xs text-gray-500">
                    Last backup: {new Date(backupStatus.lastBackup).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Import Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Import Data (Restore)
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Restore data from a backup file. Select which data to import below.
                </p>

                {/* Import Options */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    { key: 'importUsers', label: 'Users' },
                    { key: 'importLogsheets', label: 'Logsheets' },
                    { key: 'importRoutes', label: 'Routes' },
                    { key: 'importDrivers', label: 'Drivers' },
                    { key: 'importVehicles', label: 'Vehicles' },
                    { key: 'importBreakdowns', label: 'Breakdowns' },
                    { key: 'importTyres', label: 'Tyres' },
                  ].map(opt => (
                    <label
                      key={opt.key}
                      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${
                        importOptions[opt.key as keyof typeof importOptions]
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={importOptions[opt.key as keyof typeof importOptions] as boolean}
                        onChange={(e) => setImportOptions({ ...importOptions, [opt.key]: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>

                <label className="flex items-center gap-2 p-3 rounded-lg border border-orange-200 bg-orange-50 mb-4">
                  <input
                    type="checkbox"
                    checked={importOptions.replaceExisting}
                    onChange={(e) => setImportOptions({ ...importOptions, replaceExisting: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-orange-600"
                  />
                  <span className="text-sm text-orange-800">
                    Replace existing data (⚠️ This will overwrite current data)
                  </span>
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    setImporting(true);
                    setError('');
                    
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const data = JSON.parse(event.target?.result as string);
                        const validation = validateBackupFile(data);
                        
                        if (!validation.valid) {
                          setError(validation.error || 'Invalid backup file');
                          setImporting(false);
                          return;
                        }
                        
                        const result = importBackupData(data as BackupData, importOptions);
                        
                        if (result.success) {
                          setSuccess(`Data imported successfully! Imported: ${Object.entries(result.imported).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
                          setStorageStats(getStorageStats());
                          loadUsers();
                        } else {
                          setError(result.message);
                        }
                      } catch (err) {
                        setError('Failed to parse backup file. Please select a valid JSON backup file.');
                      }
                      setImporting(false);
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Select Backup File to Import
                    </>
                  )}
                </button>
              </div>

              {/* Danger Zone */}
              <div className="bg-red-50 rounded-xl border border-red-200 p-6">
                <h3 className="text-lg font-semibold text-red-800 flex items-center gap-2 mb-4">
                  <Trash className="w-5 h-5 text-red-600" />
                  Danger Zone
                </h3>
                <p className="text-sm text-red-700 mb-4">
                  Clear only Reports data (logsheets), Breakdown Analysis data, and Tyre Management data.
                  Route/Driver/Vehicle masters and user accounts will NOT be deleted. This action cannot be undone.
                </p>
                <button
                  onClick={() => {
                    if (window.confirm('⚠️ WARNING: This will delete Reports, Breakdown Analysis, and Tyre Management data only.\n\nAre you absolutely sure? This cannot be undone!')) {
                      if (window.confirm('Last chance! Type "DELETE" in the next prompt to confirm.')) {
                        const confirmation = window.prompt('Type DELETE to confirm:');
                        if (confirmation === 'DELETE') {
                          clearAllData();
                          setStorageStats(getStorageStats());
                          setSuccess('Reports, Breakdown Analysis, and Tyre data have been cleared.');
                          setTimeout(() => setSuccess(''), 5000);
                        } else {
                          setError('Deletion cancelled - confirmation did not match.');
                        }
                      }
                    }
                  }}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 flex items-center gap-2"
                >
                  <Trash className="w-5 h-5" />
                  Clear Reports + Breakdown + Tyre Data
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
