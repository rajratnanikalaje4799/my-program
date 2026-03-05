import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { storage } from '../utils/storage';
import { routeStorage } from '../utils/routeStorage';
import { driverStorage } from '../utils/driverStorage';
import { vehicleStorage } from '../utils/vehicleStorage';
import { Trip, RouteDefinition, Logsheet } from '../types';
import { TimeInput } from '../components/TimeInput';

const REASONS = [
  'Driver',
  'Conductor',
  'Vehicle',
  'Breakdown',
  'Traffic',
  'Route Change',
  'Accident',
  'Other',
  'Schedule Suspend',
];

export function SubmitLogsheet() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    vehicleNumber: '',
    driverName: '',
    driverId: '',
    routeNumber: '',
    shift: 'General' as 'Morning' | 'Evening' | 'General',
    scheduleKms: 0,
    remarks: '',
  });

  const [routeStats, setRouteStats] = useState({
    total: 0,
    completedToday: 0,
    remaining: 0,
  });

  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  // Calculate route statistics when date changes or after submit
  useEffect(() => {
    const allRoutes = routeStorage.getRoutes();
    const totalRoutes = allRoutes.length;

    const allLogsheets = storage.getLogsheets();
    const todayLogsheets = allLogsheets.filter((log: Logsheet) => log.date === formData.date);
    const completedRoutes = new Set(todayLogsheets.map((log: Logsheet) => log.routeNumber)).size;

    setRouteStats({
      total: totalRoutes,
      completedToday: completedRoutes,
      remaining: Math.max(0, totalRoutes - completedRoutes),
    });
  }, [formData.date, success]);

  // When route changes, load trips from Route Master and auto-fill shift
  useEffect(() => {
    if (formData.routeNumber) {
      const routes = routeStorage.getRoutes();
      const routeInfo = routes.find((r: RouteDefinition) => r.routeNumber === formData.routeNumber);
      if (routeInfo) {
        // Auto-fill scheduleKms AND shift from Route Master
        setFormData((prev) => ({ 
          ...prev, 
          scheduleKms: routeInfo.scheduleKms,
          shift: routeInfo.shift // Auto-fill shift from Route Master
        }));
        const mappedTrips: Trip[] = routeInfo.trips.map((t) => ({
          id: t.id,
          name: t.name,
          planKm: t.planKm,
          actualKm: t.planKm,
          scheduleOutTime: t.scheduleOutTime,
          scheduleInTime: t.scheduleInTime,
          actualOutTime: '',
          actualInTime: '',
          isCompleted: true,
          reason: '',
        }));
        setTrips(mappedTrips);
      } else {
        setFormData((prev) => ({ ...prev, scheduleKms: 0 }));
        setTrips([]);
      }
    } else {
      setFormData((prev) => ({ ...prev, scheduleKms: 0 }));
      setTrips([]);
    }
  }, [formData.routeNumber]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTripChange = (index: number, field: keyof Trip, value: string | boolean | number) => {
    const newTrips = [...trips];
    newTrips[index] = { ...newTrips[index], [field]: value } as any;

    if (field === 'isCompleted') {
      if (value === true) {
        newTrips[index].reason = '';
        if (!newTrips[index].isManual) {
          newTrips[index].actualKm = newTrips[index].planKm;
        }
      } else {
        newTrips[index].actualKm = '';
        if (!newTrips[index].reason) {
          newTrips[index].reason = REASONS[0];
        }
      }
    }

    if (field === 'name' && newTrips[index].isManual) {
      const match = routeStorage
        .getRoutes()
        .flatMap((r) => r.trips)
        .find((t) => t.name.toLowerCase() === String(value).toLowerCase());
      if (match) {
        newTrips[index].actualKm = match.planKm;
      }
    }

    setTrips(newTrips);
  };

  const handleAddManualTrip = () => {
    setTrips([
      ...trips,
      {
        id: `manual-${Date.now()}`,
        name: '',
        planKm: 0,
        actualKm: '',
        scheduleOutTime: '',
        scheduleInTime: '',
        actualOutTime: '',
        actualInTime: '',
        isCompleted: true,
        reason: '',
        isManual: true,
      },
    ]);
  };

  const handleRemoveTrip = (index: number) => {
    setTrips((prev) => prev.filter((_, i) => i !== index));
  };

  const allKnownTrips = Array.from(
    new Set(routeStorage.getRoutes().flatMap((r) => r.trips.map((t) => t.name))),
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (
      !formData.vehicleNumber ||
      !formData.driverName ||
      !formData.driverId ||
      !formData.routeNumber ||
      !formData.date
    ) {
      setError('Please fill in all required fields.');
      return;
    }

    if (trips.length === 0) {
      setError('Selected route has no trips. Please choose a valid Route Number.');
      return;
    }

    const incompleteWithoutReason = trips.some((t) => !t.isCompleted && !t.reason);
    if (incompleteWithoutReason) {
      setError('Please specify a reason for all incomplete trips.');
      return;
    }

    // Calculate actual KMs (excluding manual trips for schedule comparison)
    const scheduleTripsActualKms = trips
      .filter((trip) => !trip.isManual)
      .reduce((sum, trip) => {
        const val = typeof trip.actualKm === 'number' ? trip.actualKm : Number(trip.actualKm);
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

    // Calculate manual trips KMs (these go entirely to extra)
    const manualTripsKms = trips
      .filter((trip) => trip.isManual)
      .reduce((sum, trip) => {
        const val = typeof trip.actualKm === 'number' ? trip.actualKm : Number(trip.actualKm);
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

    // Total actual KMs includes both
    const totalActualKms = scheduleTripsActualKms + manualTripsKms;

    // Calculate extra KMs (schedule trips over plan + all manual trips)
    const scheduleTripsExtraKms = trips
      .filter((trip) => !trip.isManual)
      .reduce((sum, trip) => {
        const actual = typeof trip.actualKm === 'number' ? trip.actualKm : Number(trip.actualKm);
        const extra = Math.max(0, (isNaN(actual) ? 0 : actual) - trip.planKm);
        return sum + extra;
      }, 0);

    const totalExtraKms = scheduleTripsExtraKms + manualTripsKms;

    try {
      storage.saveLogsheet({
        id: `log-${Date.now()}`,
        date: formData.date,
        vehicleNumber: formData.vehicleNumber.toUpperCase(),
        driverName: formData.driverName,
        driverId: formData.driverId,
        routeNumber: formData.routeNumber,
        shift: formData.shift,
        scheduleKms: formData.scheduleKms,
        totalActualKms,
        extraKms: totalExtraKms,
        manualTripsKms: manualTripsKms,
        trips,
        remarks: formData.remarks,
        createdAt: new Date().toISOString(),
      });

      // Reset for next logsheet, keep date & shift
      setFormData((prev) => ({
        date: prev.date,
        shift: prev.shift,
        vehicleNumber: '',
        driverName: '',
        driverId: '',
        routeNumber: '',
        scheduleKms: 0,
        remarks: '',
      }));
      setTrips([]);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the logsheet.');
    }
  };

  const totalActualKmsDisplay = trips.reduce(
    (sum, t) => sum + (Number(t.actualKm) || 0),
    0,
  );

  // Calculate extra KMs for display
  const extraKmsDisplay = trips.reduce((sum, t) => {
    const actual = Number(t.actualKm) || 0;
    if (t.isManual) {
      return sum + actual; // All manual trip KMs are extra
    } else {
      return sum + Math.max(0, actual - t.planKm); // Only over-plan KMs
    }
  }, 0);

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-12">
      <div className="bg-blue-600 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Submit New Logsheet</h2>
          <p className="text-blue-100 text-sm mt-1">
            Record daily vehicle usage based on Schedule Data.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-4 text-sm font-medium">
          <div className="bg-blue-800/50 rounded-lg px-4 py-2 text-blue-100 border border-blue-500/30">
            Total Routes:
            <span className="text-white ml-1 text-base">{routeStats.total}</span>
          </div>
          <div className="bg-blue-800/50 rounded-lg px-4 py-2 text-blue-100 border border-blue-500/30">
            Submitted Today:
            <span className="text-green-300 ml-1 text-base">{routeStats.completedToday}</span>
          </div>
          <div className="bg-blue-800/50 rounded-lg px-4 py-2 text-blue-100 border border-blue-500/30">
            Remaining:
            <span className="text-yellow-300 ml-1 text-base">{routeStats.remaining}</span>
          </div>
        </div>
      </div>

      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-center text-red-700">
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 flex items-center text-green-700">
            <CheckCircle2 className="w-5 h-5 mr-3 flex-shrink-0" />
            <span className="font-medium">Logsheet saved successfully. Ready for next entry.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date *</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Vehicle Number *</label>
              <div className="relative">
                <input
                  type="text"
                  name="vehicleNumber"
                  list="vehicles-list"
                  placeholder="Select or type e.g. KA-01-AB-1234"
                  value={formData.vehicleNumber}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  required
                />
                <datalist id="vehicles-list">
                  {vehicleStorage
                    .getVehicles()
                    .filter((v) => v.status === 'Active')
                    .map((v) => (
                      <option key={v.vehicleNumber} value={v.vehicleNumber}>
                        {v.type ? `(${v.type})` : ''}
                      </option>
                    ))}
                </datalist>
              </div>
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Driver Name *</label>
              <div className="relative">
                <input
                  type="text"
                  name="driverName"
                  list="drivers-name-list"
                  placeholder="Select or type Full Name"
                  value={formData.driverName}
                  onChange={(e) => {
                    handleChange(e);
                    const driver = driverStorage
                      .getDrivers()
                      .find((d) => d.name === e.target.value);
                    if (driver) {
                      setFormData((prev) => ({
                        ...prev,
                        driverName: e.target.value,
                        driverId: driver.driverId,
                      }));
                    }
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  required
                />
                <datalist id="drivers-name-list">
                  {driverStorage
                    .getDrivers()
                    .filter((d) => d.status === 'Active')
                    .map((d) => (
                      <option key={d.driverId} value={d.name}>
                        {d.driverId}
                      </option>
                    ))}
                </datalist>
              </div>
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Driver ID *</label>
              <div className="relative">
                <input
                  type="text"
                  name="driverId"
                  list="drivers-id-list"
                  placeholder="Select or type e.g. EMP-9876"
                  value={formData.driverId}
                  onChange={(e) => {
                    handleChange(e);
                    const driver = driverStorage
                      .getDrivers()
                      .find((d) => d.driverId === e.target.value);
                    if (driver) {
                      setFormData((prev) => ({
                        ...prev,
                        driverId: e.target.value,
                        driverName: driver.name,
                      }));
                    }
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  required
                />
                <datalist id="drivers-id-list">
                  {driverStorage
                    .getDrivers()
                    .filter((d) => d.status === 'Active')
                    .map((d) => (
                      <option key={d.driverId} value={d.driverId}>
                        {d.name}
                      </option>
                    ))}
                </datalist>
              </div>
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Shift *</label>
              <select
                name="shift"
                value={formData.shift}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow bg-white"
                required
              >
                <option value="General">General</option>
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Route Number *</label>
              <select
                name="routeNumber"
                value={formData.routeNumber}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow bg-white"
                required
              >
                <option value="" disabled>
                  Select Route
                </option>
                {routeStorage.getRoutes().map((route: RouteDefinition) => (
                  <option key={route.routeNumber} value={route.routeNumber}>
                    {route.routeNumber} - {route.shift} Shift
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-gray-600 font-medium mr-4">Total Schedule KMs:</span>
                <span className="text-xl font-bold text-blue-600">{formData.scheduleKms} KM</span>
              </div>
              <div>
                <span className="text-gray-600 font-medium mr-4">Calculated Actual KMs:</span>
                <span className="text-xl font-bold text-green-600">{totalActualKmsDisplay} KM</span>
              </div>
              <div>
                <span className="text-gray-600 font-medium mr-4">Extra KMs:</span>
                <span className="text-xl font-bold text-orange-600">{extraKmsDisplay} KM</span>
              </div>
            </div>
          </div>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t-2 border-dashed border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm font-semibold text-gray-500 tracking-wider uppercase">
                Route Trips List
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {trips.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                Please select a Route Number from the top to load schedule trips automatically.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        OK
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Route (From - To)
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Plan KM
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actual KM
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Extra KM
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sch. Time (Out-In)
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Act. Time (Out-In)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason (If Not OK)
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Remove
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {trips.map((trip, index) => (
                      <tr key={trip.id} className={trip.isCompleted ? 'bg-white' : 'bg-red-50'}>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <input
                            type="checkbox"
                            checked={trip.isCompleted}
                            onChange={(e) =>
                              handleTripChange(index, 'isCompleted', e.target.checked)
                            }
                            className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer"
                            title="Mark trip as completed (OK)"
                          />
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          {trip.isManual ? (
                            <div className="relative">
                              <input
                                type="text"
                                list="manual-trips-list"
                                value={trip.name}
                                onChange={(e) =>
                                  handleTripChange(index, 'name', e.target.value)
                                }
                                placeholder="Select or type route"
                                className="w-48 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 outline-none"
                              />
                              <datalist id="manual-trips-list">
                                {allKnownTrips.map((kt) => (
                                  <option key={kt} value={kt} />
                                ))}
                              </datalist>
                            </div>
                          ) : (
                            <div className="text-sm font-semibold text-gray-900">
                              {trip.name}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-500 font-medium">
                          {trip.isManual ? (
                            <span className="text-gray-400 italic text-sm">-</span>
                          ) : (
                            trip.planKm
                          )}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          {trip.isManual ? (
                            <input
                              type="number"
                              min={0}
                              value={trip.actualKm}
                              onChange={(e) =>
                                handleTripChange(index, 'actualKm', e.target.value)
                              }
                              className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
                              placeholder="KM"
                            />
                          ) : (
                            <input
                              type="number"
                              min={0}
                              value={trip.actualKm}
                              onChange={(e) =>
                                handleTripChange(index, 'actualKm', e.target.value)
                              }
                              className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 text-sm"
                              disabled={!trip.isCompleted}
                              placeholder="KM"
                            />
                          )}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium text-orange-600">
                          {trip.isManual
                            ? Number(trip.actualKm) || 0
                            : Math.max(0, (Number(trip.actualKm) || 0) - trip.planKm)}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-500 font-medium">
                          {trip.isManual ? (
                            <div className="flex flex-col space-y-1">
                              <TimeInput
                                value={trip.scheduleOutTime}
                                onChange={(val) =>
                                  handleTripChange(index, 'scheduleOutTime', val)
                                }
                                placeholder="Sch Out"
                                className="w-[85px] px-1 py-1 text-xs border border-gray-300 rounded"
                              />
                              <TimeInput
                                value={trip.scheduleInTime}
                                onChange={(val) =>
                                  handleTripChange(index, 'scheduleInTime', val)
                                }
                                placeholder="Sch In"
                                className="w-[85px] px-1 py-1 text-xs border border-gray-300 rounded"
                              />
                            </div>
                          ) : (
                            <div>
                              {trip.scheduleOutTime} - {trip.scheduleInTime}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="flex flex-col space-y-1 items-center">
                            <TimeInput
                              value={trip.actualOutTime}
                              onChange={(val) =>
                                handleTripChange(index, 'actualOutTime', val)
                              }
                              placeholder="Out e.g. 7.10"
                              className="w-[85px] px-1 py-1 text-xs border border-gray-300 rounded focus:ring-blue-500"
                            />
                            <TimeInput
                              value={trip.actualInTime}
                              onChange={(val) =>
                                handleTripChange(index, 'actualInTime', val)
                              }
                              placeholder="In e.g. 8.20"
                              className="w-[85px] px-1 py-1 text-xs border border-gray-300 rounded focus:ring-blue-500"
                            />
                          </div>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          {!trip.isCompleted ? (
                            <select
                              value={trip.reason || ''}
                              onChange={(e) =>
                                handleTripChange(index, 'reason', e.target.value)
                              }
                              className="block w-full py-1 px-2 border border-red-300 bg-white rounded shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm text-red-700 font-medium"
                              required
                            >
                              <option value="" disabled>
                                Select Reason...
                              </option>
                              {REASONS.map((reason) => (
                                <option key={reason} value={reason}>
                                  {reason}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-gray-400 text-sm italic">-</span>
                          )}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          {trip.isManual ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveTrip(index)}
                              className="inline-flex items-center justify-center p-2 text-red-500 hover:bg-red-50 rounded-md"
                              title="Delete manual trip"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {trips.length > 0 && (
              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={handleAddManualTrip}
                  className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 border border-gray-300 transition-colors shadow-sm text-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Manual Trip
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Remarks / Notes
            </label>
            <textarea
              name="remarks"
              rows={3}
              placeholder="Any issues, delays, or extra info?"
              value={formData.remarks}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow resize-none"
            />
          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 mr-4 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={trips.length === 0}
              className="px-8 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
