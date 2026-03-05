import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, Truck, FileUp } from 'lucide-react';
import { vehicleStorage } from '../utils/vehicleStorage';
import { Vehicle } from '../types';
import { mapRowsToVehicles, parseExcelRows } from '../utils/excelImport';

import { Search } from 'lucide-react';

export function VehicleMasterPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeVehicle, setActiveVehicle] = useState<Vehicle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  useEffect(() => {
    void loadVehicles();
  }, []);

  const loadVehicles = async () => {
    const data = await vehicleStorage.getVehiclesAsync();
    setVehicles(data);
  };

  const handleCreateNew = () => {
    setActiveVehicle({
      vehicleNumber: '',
      type: '',
      status: 'Active'
    });
  };

  const handleEdit = (vehicle: Vehicle) => {
    setActiveVehicle({ ...vehicle });
  };

  const handleDelete = async (vehicleNumber: string) => {
    if (confirm(`Are you sure you want to delete Vehicle ${vehicleNumber}?`)) {
      await vehicleStorage.deleteVehicleAsync(vehicleNumber);
      await loadVehicles();
      if (activeVehicle?.vehicleNumber === vehicleNumber) {
        setActiveVehicle(null);
      }
    }
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVehicle) return;

    if (!activeVehicle.vehicleNumber.trim()) {
      alert("Please enter a Vehicle Number.");
      return;
    }

    try {
      const payload = {
        ...activeVehicle,
        vehicleNumber: activeVehicle.vehicleNumber.toUpperCase()
      };
      await vehicleStorage.saveVehiclesAsync([
        ...vehicles.filter((v) => v.vehicleNumber !== payload.vehicleNumber),
        payload,
      ]);
      alert('Vehicle successfully saved!');
      await loadVehicles();
      setActiveVehicle(null);
    } catch (err) {
      alert("Failed to save vehicle. Please try again.");
    }
  };

  const handleImportVehicles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const rows = await parseExcelRows(file);
      const importedVehicles = mapRowsToVehicles(rows);
      if (importedVehicles.length === 0) {
        alert('No valid vehicle rows found in the Excel file.');
        return;
      }

      const merged = new Map(vehicles.map((vehicle) => [vehicle.vehicleNumber, vehicle]));
      importedVehicles.forEach((vehicle) => merged.set(vehicle.vehicleNumber, vehicle));

      await vehicleStorage.saveVehiclesAsync(Array.from(merged.values()));
      await loadVehicles();
      alert(`Imported ${importedVehicles.length} vehicle records successfully.`);
    } catch {
      alert('Failed to import vehicle Excel file. Please verify columns and try again.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vehicle Master</h1>
          <p className="text-gray-500 text-sm mt-1">Manage depot fleet and vehicle statuses</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportVehicles}
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
            Add Vehicle
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">Existing Vehicles</h2>
          </div>
          <div className="p-4 border-b border-gray-100 bg-white">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Vehicle Number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>
          </div>
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {vehicles.filter(v => v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">No vehicles found.</div>
            ) : (
              vehicles.filter(v => v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase())).map(vehicle => (
                <div 
                  key={vehicle.vehicleNumber}
                  className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${activeVehicle?.vehicleNumber === vehicle.vehicleNumber ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'}`}
                  onClick={() => handleEdit(vehicle)}
                >
                  <div>
                    <div className="font-bold text-gray-900 flex items-center">
                      <Truck className="w-4 h-4 mr-2 text-blue-500" />
                      {vehicle.vehicleNumber}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Type: {vehicle.type || 'N/A'} | Status: {vehicle.status}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(vehicle.vehicleNumber);
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
          {activeVehicle ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-blue-600 px-6 py-4">
                <h2 className="text-lg font-bold text-white">
                  {vehicles.some(v => v.vehicleNumber === activeVehicle.vehicleNumber) ? 'Edit Vehicle' : 'Create New Vehicle'}
                </h2>
              </div>
              
              <form onSubmit={handleSaveVehicle} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Vehicle Number *</label>
                    <input
                      type="text"
                      value={activeVehicle.vehicleNumber}
                      onChange={(e) => setActiveVehicle({ ...activeVehicle, vehicleNumber: e.target.value })}
                      placeholder="e.g. KA-01-AB-1234"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase"
                      required
                      disabled={vehicles.some(v => v.vehicleNumber === activeVehicle.vehicleNumber)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Vehicle Type</label>
                    <input
                      type="text"
                      value={activeVehicle.type || ''}
                      onChange={(e) => setActiveVehicle({ ...activeVehicle, type: e.target.value })}
                      placeholder="e.g. Bus, Truck"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                    <select
                      value={activeVehicle.status}
                      onChange={(e) => setActiveVehicle({ ...activeVehicle, status: e.target.value as any })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveVehicle(null)}
                    className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 mr-3"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 shadow-sm flex items-center"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Vehicle
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500 flex flex-col items-center justify-center h-full min-h-[400px]">
              <Truck className="w-16 h-16 text-gray-200 mb-4" />
              <h3 className="text-xl font-medium text-gray-800 mb-2">Select or Add a Vehicle</h3>
              <p className="max-w-sm mx-auto text-sm">Click on a vehicle from the left sidebar to edit, or add a new vehicle to the fleet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}