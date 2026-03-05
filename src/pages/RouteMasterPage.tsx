import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, Map as MapIcon, MapPin, FileUp } from 'lucide-react';
import { routeStorage } from '../utils/routeStorage';
import { RouteDefinition, RouteTrip } from '../types';
import { TimeInput } from '../components/TimeInput';
import { mapRowsToRoutes, parseExcelRows } from '../utils/excelImport';

export function RouteMasterPage() {
  const [routes, setRoutes] = useState<RouteDefinition[]>([]);
  const [activeRoute, setActiveRoute] = useState<RouteDefinition | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Load routes on mount
  useEffect(() => {
    void loadRoutes();
  }, []);

  const loadRoutes = async () => {
    const data = await routeStorage.getRoutesAsync();
    setRoutes(data);
  };

  const handleCreateNew = () => {
    setActiveRoute({
      routeNumber: '',
      scheduleKms: 0,
      shift: 'General',
      trips: []
    });
  };

  const handleEdit = (route: RouteDefinition) => {
    setActiveRoute({ ...route, trips: [...route.trips] });
  };

  const handleDelete = async (routeNumber: string) => {
    if (confirm(`Are you sure you want to delete Route ${routeNumber}?`)) {
      await routeStorage.deleteRouteAsync(routeNumber);
      await loadRoutes();
      if (activeRoute?.routeNumber === routeNumber) {
        setActiveRoute(null);
      }
    }
  };

  const handleAddTrip = () => {
    if (!activeRoute) return;
    const newTrip: RouteTrip = {
      id: `T-${Date.now()}`,
      name: '',
      planKm: 0,
      scheduleOutTime: '',
      scheduleInTime: ''
    };
    setActiveRoute({
      ...activeRoute,
      trips: [...activeRoute.trips, newTrip]
    });
  };

  const handleRemoveTrip = (index: number) => {
    if (!activeRoute) return;
    const newTrips = [...activeRoute.trips];
    newTrips.splice(index, 1);
    setActiveRoute({
      ...activeRoute,
      trips: newTrips
    });
    // Auto update total KMs
    updateTotalKms(newTrips);
  };

  const handleTripChange = (index: number, field: keyof RouteTrip, value: any) => {
    if (!activeRoute) return;
    const newTrips = [...activeRoute.trips];
    newTrips[index] = { ...newTrips[index], [field]: value };
    setActiveRoute({
      ...activeRoute,
      trips: newTrips
    });

    if (field === 'planKm') {
      updateTotalKms(newTrips);
    }
  };

  const updateTotalKms = (trips: RouteTrip[]) => {
    if (!activeRoute) return;
    const total = trips.reduce((sum, t) => sum + (Number(t.planKm) || 0), 0);
    setActiveRoute(prev => prev ? { ...prev, scheduleKms: total } : null);
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoute) return;

    if (!activeRoute.routeNumber.trim()) {
      alert("Please enter a Route Number.");
      return;
    }

    if (activeRoute.trips.length === 0) {
      alert("Please add at least one trip.");
      return;
    }

    try {
      await routeStorage.saveRoutesAsync([
        ...routes.filter((r) => r.routeNumber !== activeRoute.routeNumber),
        activeRoute,
      ]);
      alert('Route successfully saved!');
      await loadRoutes();
      setActiveRoute(null);
    } catch (err) {
      alert("Failed to save route. Please try again.");
    }
  };

  const handleImportRoutes = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const rows = await parseExcelRows(file);
      const importedRoutes = mapRowsToRoutes(rows);
      if (importedRoutes.length === 0) {
        alert('No valid route rows found in the Excel file.');
        return;
      }

      const merged = new Map(routes.map((route) => [route.routeNumber, route]));
      importedRoutes.forEach((route) => merged.set(route.routeNumber, route));

      await routeStorage.saveRoutesAsync(Array.from(merged.values()));
      await loadRoutes();
      alert(`Imported ${importedRoutes.length} route records successfully.`);
    } catch {
      alert('Failed to import route Excel file. Please verify columns and try again.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Route Master</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage schedule logsheets and template routes</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportRoutes}
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
            Create New Route
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Route List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">Existing Routes</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {routes.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">No routes found. Create one.</div>
            ) : (
              routes.map(route => (
                <div 
                  key={route.routeNumber}
                  className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${activeRoute?.routeNumber === route.routeNumber ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'}`}
                  onClick={() => handleEdit(route)}
                >
                  <div>
                    <div className="font-bold text-gray-900 flex items-center">
                      <MapIcon className="w-4 h-4 mr-2 text-blue-500" />
                      {route.routeNumber}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {route.trips.length} Trips | {route.scheduleKms} KM | Shift: {route.shift}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(route.routeNumber);
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

        {/* Route Editor */}
        <div className="lg:col-span-2">
          {activeRoute ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-blue-600 px-6 py-4">
                <h2 className="text-lg font-bold text-white">
                  {routes.some(r => r.routeNumber === activeRoute.routeNumber) ? 'Edit Schedule Route' : 'Create Schedule Route'}
                </h2>
              </div>
              
              <form onSubmit={handleSaveRoute} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Route Number *</label>
                    <input
                      type="text"
                      value={activeRoute.routeNumber}
                      onChange={(e) => setActiveRoute({ ...activeRoute, routeNumber: e.target.value })}
                      placeholder="e.g. R-105"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                      required
                      disabled={routes.some(r => r.routeNumber === activeRoute.routeNumber)} // Disable if editing to prevent ID change
                    />
                    {routes.some(r => r.routeNumber === activeRoute.routeNumber) && (
                      <p className="text-xs text-orange-500 mt-1">Cannot edit route number.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Shift *</label>
                    <select
                      value={activeRoute.shift || 'General'}
                      onChange={(e) => setActiveRoute({ ...activeRoute, shift: e.target.value as any })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                      required
                    >
                      <option value="General">General</option>
                      <option value="Morning">Morning</option>
                      <option value="Evening">Evening</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Total Schedule KMs</label>
                    <div className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 font-bold">
                      {activeRoute.scheduleKms} KM
                    </div>
                  </div>
                </div>

                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">Route Trips</h3>
                  <button
                    type="button"
                    onClick={handleAddTrip}
                    className="text-sm bg-blue-50 text-blue-600 font-medium px-3 py-1.5 rounded-md hover:bg-blue-100 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Trip
                  </button>
                </div>

                {activeRoute.trips.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg text-gray-500">
                    No trips added yet. Click 'Add Trip' to define the route schedule.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeRoute.trips.map((trip, index) => (
                      <div key={trip.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 relative">
                        <button
                          type="button"
                          onClick={() => handleRemoveTrip(index)}
                          className="absolute top-2 right-2 p-1.5 text-red-500 hover:bg-red-100 rounded-md"
                          title="Remove Trip"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        
                        <div className="flex items-center mb-3">
                          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded mr-2">Trip {index + 1}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-5">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Route Name (From - To) *</label>
                            <input
                              type="text"
                              value={trip.name}
                              onChange={(e) => handleTripChange(index, 'name', e.target.value)}
                              placeholder="e.g. Depot to City Center"
                              className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              required
                            />
                          </div>
                          
                          <div className="md:col-span-3">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Plan KM *</label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={trip.planKm}
                              onChange={(e) => handleTripChange(index, 'planKm', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              required
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Sch. Out</label>
                            <TimeInput
                              value={trip.scheduleOutTime}
                              onChange={(val) => handleTripChange(index, 'scheduleOutTime', val)}
                              className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                          </div>
                          
                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Sch. In</label>
                            <TimeInput
                              value={trip.scheduleInTime}
                              onChange={(val) => handleTripChange(index, 'scheduleInTime', val)}
                              className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveRoute(null)}
                    className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 mr-3"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 shadow-sm flex items-center"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Route
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500 flex flex-col items-center justify-center h-full min-h-[400px]">
              <MapPin className="w-16 h-16 text-gray-200 mb-4" />
              <h3 className="text-xl font-medium text-gray-800 mb-2">Select or Create a Route</h3>
              <p className="max-w-sm mx-auto text-sm">Click on a route from the left sidebar to edit it, or create a new route to define its scheduled trips.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}