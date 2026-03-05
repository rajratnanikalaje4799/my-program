import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, User, IdCard, FileUp } from 'lucide-react';
import { driverStorage } from '../utils/driverStorage';
import { Driver } from '../types';
import { mapRowsToDrivers, parseExcelRows } from '../utils/excelImport';

import { Search } from 'lucide-react';

export function DriverMasterPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activeDriver, setActiveDriver] = useState<Driver | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  useEffect(() => {
    void loadDrivers();
  }, []);

  const loadDrivers = async () => {
    const data = await driverStorage.getDriversAsync();
    setDrivers(data);
  };

  const handleCreateNew = () => {
    setActiveDriver({
      driverId: '',
      name: '',
      licenseNumber: '',
      contactNumber: '',
      status: 'Active'
    });
  };

  const handleEdit = (driver: Driver) => {
    setActiveDriver({ ...driver });
  };

  const handleDelete = async (driverId: string) => {
    if (confirm(`Are you sure you want to delete Driver ${driverId}?`)) {
      await driverStorage.deleteDriverAsync(driverId);
      await loadDrivers();
      if (activeDriver?.driverId === driverId) {
        setActiveDriver(null);
      }
    }
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDriver) return;

    if (!activeDriver.driverId.trim() || !activeDriver.name.trim()) {
      alert("Please enter a Driver ID and Name.");
      return;
    }

    try {
      await driverStorage.saveDriversAsync(
        [...drivers.filter((d) => d.driverId !== activeDriver.driverId), activeDriver],
      );
      alert('Driver successfully saved!');
      await loadDrivers();
      setActiveDriver(null);
    } catch (err) {
      alert("Failed to save driver. Please try again.");
    }
  };

  const handleImportDrivers = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const rows = await parseExcelRows(file);
      const importedDrivers = mapRowsToDrivers(rows);
      if (importedDrivers.length === 0) {
        alert('No valid driver rows found in the Excel file.');
        return;
      }

      const merged = new Map(drivers.map((driver) => [driver.driverId, driver]));
      importedDrivers.forEach((driver) => merged.set(driver.driverId, driver));

      await driverStorage.saveDriversAsync(Array.from(merged.values()));
      await loadDrivers();
      alert(`Imported ${importedDrivers.length} driver records successfully.`);
    } catch {
      alert('Failed to import driver Excel file. Please verify columns and try again.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Driver Master</h1>
          <p className="text-gray-500 text-sm mt-1">Manage depot driver database</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportDrivers}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center"
          >
            <FileUp className="w-5 h-5 mr-2" />
            Import Excel
          </button>
          <button
            onClick={handleCreateNew}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Driver
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">Existing Drivers</h2>
          </div>
          <div className="p-4 border-b border-gray-100 bg-white">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by ID or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {drivers.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.driverId.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">No drivers found.</div>
            ) : (
              drivers.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.driverId.toLowerCase().includes(searchTerm.toLowerCase())).map(driver => (
                <div 
                  key={driver.driverId}
                  className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${activeDriver?.driverId === driver.driverId ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'}`}
                  onClick={() => handleEdit(driver)}
                >
                  <div>
                    <div className="font-bold text-gray-900 flex items-center">
                      <User className="w-4 h-4 mr-2 text-blue-500" />
                      {driver.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center">
                      <IdCard className="w-3.5 h-3.5 mr-1" />
                      {driver.driverId} | {driver.status}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(driver.driverId);
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {activeDriver ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-blue-600 px-6 py-4">
                <h2 className="text-lg font-bold text-white">
                  {drivers.some(d => d.driverId === activeDriver.driverId) ? 'Edit Driver' : 'Create New Driver'}
                </h2>
              </div>
              
              <form onSubmit={handleSaveDriver} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Driver ID *</label>
                    <input
                      type="text"
                      value={activeDriver.driverId}
                      onChange={(e) => setActiveDriver({ ...activeDriver, driverId: e.target.value })}
                      placeholder="e.g. EMP-101"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      required
                      disabled={drivers.some(d => d.driverId === activeDriver.driverId)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                    <input
                      type="text"
                      value={activeDriver.name}
                      onChange={(e) => setActiveDriver({ ...activeDriver, name: e.target.value })}
                      placeholder="e.g. John Doe"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">License Number</label>
                    <input
                      type="text"
                      value={activeDriver.licenseNumber || ''}
                      onChange={(e) => setActiveDriver({ ...activeDriver, licenseNumber: e.target.value })}
                      placeholder="e.g. DL-1234567"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Number</label>
                    <input
                      type="text"
                      value={activeDriver.contactNumber || ''}
                      onChange={(e) => setActiveDriver({ ...activeDriver, contactNumber: e.target.value })}
                      placeholder="e.g. 555-0101"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                    <select
                      value={activeDriver.status}
                      onChange={(e) => setActiveDriver({ ...activeDriver, status: e.target.value as 'Active' | 'Inactive' })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveDriver(null)}
                    className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 mr-3"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 shadow-sm flex items-center"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Driver
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500 flex flex-col items-center justify-center h-full min-h-[400px]">
              <User className="w-16 h-16 text-gray-200 mb-4" />
              <h3 className="text-xl font-medium text-gray-800 mb-2">Select or Add a Driver</h3>
              <p className="max-w-sm mx-auto text-sm">Click on a driver from the left sidebar to edit, or add a new driver.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}