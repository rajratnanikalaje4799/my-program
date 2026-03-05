import { useState, useMemo } from 'react';
import { AlertTriangle, Plus, Trash2, FileSpreadsheet, Search } from 'lucide-react';
import { breakdownStorage, BreakdownRecord } from '../utils/breakdownStorage';
import { driverStorage } from '../utils/driverStorage';
import { vehicleStorage } from '../utils/vehicleStorage';
import { storage } from '../utils/storage';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export function BreakdownAnalysis() {
  const [activeTab, setActiveTab] = useState<'submit' | 'report'>('submit');
  
  // Submit form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    routeNumber: '',
    driverId: '',
    driverName: '',
    vehicleNumber: '',
    tripName: '',
    breakdownLossKm: '',
    breakdownTrip: '',
    attendedBy: '',
    reason: '',
    timeToClear: '',
    remarks: '',
  });

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [breakdowns, setBreakdowns] = useState<BreakdownRecord[]>(breakdownStorage.getAll());

  // Report filters
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportRoute, setReportRoute] = useState('');

  // Get masters data
  const drivers = driverStorage.getDrivers().filter((d) => d.status === 'Active');
  const vehicles = vehicleStorage.getVehicles().filter((v) => v.status === 'Active');
  const logsheets = storage.getLogsheets();

  // Get routes that have breakdown trips for the selected date
  const breakdownRoutesForDate = useMemo(() => {
    const routesWithBreakdown: {
      routeNumber: string;
      vehicleNumber: string;
      driverId: string;
      driverName: string;
      breakdownLossKm: number;
      breakdownTripCount: number;
      breakdownTrips: { tripName: string; planKm: number }[];
    }[] = [];

    logsheets
      .filter((log) => log.date === formData.date)
      .forEach((log) => {
        const breakdownTrips = log.trips.filter(
          (trip) => !trip.isCompleted && trip.reason === 'Breakdown'
        );

        if (breakdownTrips.length > 0) {
          const totalBreakdownKm = breakdownTrips.reduce((sum, t) => sum + (t.planKm || 0), 0);
          routesWithBreakdown.push({
            routeNumber: log.routeNumber,
            vehicleNumber: log.vehicleNumber,
            driverId: log.driverId,
            driverName: log.driverName,
            breakdownLossKm: totalBreakdownKm,
            breakdownTripCount: breakdownTrips.length,
            breakdownTrips: breakdownTrips.map((t) => ({
              tripName: t.name || '',
              planKm: t.planKm || 0,
            })),
          });
        }
      });

    return routesWithBreakdown;
  }, [logsheets, formData.date]);

  const breakdownReasons = [
    'Engine Failure',
    'Tyre Puncture',
    'Brake Failure',
    'Electrical Issue',
    'Fuel Problem',
    'Overheating',
    'Transmission Issue',
    'Steering Problem',
    'Suspension Issue',
    'Other',
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Auto-fill driver name when driver ID is selected
    if (field === 'driverId') {
      const driver = drivers.find((d) => d.driverId === value);
      if (driver) {
        setFormData((prev) => ({ ...prev, driverId: value, driverName: driver.name }));
      }
    }

    // Auto-fill driver ID when driver name is selected
    if (field === 'driverName') {
      const driver = drivers.find((d) => d.name === value);
      if (driver) {
        setFormData((prev) => ({ ...prev, driverName: value, driverId: driver.driverId }));
      }
    }

    // Auto-fill data when route is selected
    if (field === 'routeNumber') {
      const selectedRouteData = breakdownRoutesForDate.find((r) => r.routeNumber === value);
      if (selectedRouteData) {
        setFormData((prev) => ({
          ...prev,
          routeNumber: value,
          vehicleNumber: selectedRouteData.vehicleNumber,
          driverId: selectedRouteData.driverId,
          driverName: selectedRouteData.driverName,
          breakdownLossKm: selectedRouteData.breakdownLossKm.toString(),
          breakdownTrip: selectedRouteData.breakdownTripCount.toString(),
        }));
      }
    }

    // Reset route-related fields when date changes
    if (field === 'date') {
      setFormData((prev) => ({
        ...prev,
        date: value,
        routeNumber: '',
        vehicleNumber: '',
        driverId: '',
        driverName: '',
        breakdownLossKm: '',
        breakdownTrip: '',
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Validation
    if (!formData.date || !formData.routeNumber || !formData.driverId || !formData.reason) {
      setErrorMessage('Please fill in all required fields (Date, Route, Driver, Reason)');
      return;
    }

    // Check for duplicate entry - same route + same date + same vehicle not allowed
    const existingEntry = breakdowns.find(
      (b) =>
        b.date === formData.date &&
        b.routeNumber === formData.routeNumber &&
        b.vehicleNumber === formData.vehicleNumber
    );

    if (existingEntry) {
      setErrorMessage(
        `⚠️ Duplicate Entry Not Allowed!\n\nThis route (${formData.routeNumber}) already has a breakdown entry for ${formData.date} with the same vehicle (${formData.vehicleNumber}).\n\nIf vehicle is changed, then new entry is allowed.`
      );
      return;
    }

    // Check if same route exists with different vehicle (allowed - show info)
    const existingRouteWithDiffVehicle = breakdowns.find(
      (b) =>
        b.date === formData.date &&
        b.routeNumber === formData.routeNumber &&
        b.vehicleNumber !== formData.vehicleNumber
    );

    if (existingRouteWithDiffVehicle) {
      // Allowed but show info that this is a vehicle change entry
      console.log('New entry allowed - vehicle changed for same route');
    }

    const newRecord: BreakdownRecord = {
      id: Date.now().toString(),
      date: formData.date,
      routeNumber: formData.routeNumber,
      driverId: formData.driverId,
      driverName: formData.driverName,
      vehicleNumber: formData.vehicleNumber,
      tripName: formData.tripName,
      breakdownLossKm: parseFloat(formData.breakdownLossKm) || 0,
      breakdownTripCount: parseInt(formData.breakdownTrip) || 0,
      breakdownTrip: parseInt(formData.breakdownTrip) || 0,
      attendedBy: formData.attendedBy,
      reason: formData.reason,
      timeToClear: formData.timeToClear,
      remarks: formData.remarks,
      createdAt: new Date().toISOString(),
    };

    breakdownStorage.save(newRecord);
    setBreakdowns(breakdownStorage.getAll());
    setSuccessMessage('Breakdown record saved successfully. Ready for next entry.');

    // Reset form but keep date
    setFormData({
      date: formData.date,
      routeNumber: '',
      driverId: '',
      driverName: '',
      vehicleNumber: '',
      tripName: '',
      breakdownLossKm: '',
      breakdownTrip: '',
      attendedBy: '',
      reason: '',
      timeToClear: '',
      remarks: '',
    });

    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this breakdown record?')) {
      breakdownStorage.delete(id);
      setBreakdowns(breakdownStorage.getAll());
    }
  };

  // Filter breakdowns for report
  const filteredBreakdowns = useMemo(() => {
    return breakdowns.filter((b) => {
      const matchDate = b.date === reportDate;
      const matchRoute = !reportRoute || b.routeNumber === reportRoute;
      return matchDate && matchRoute;
    });
  }, [breakdowns, reportDate, reportRoute]);

  const routesForReportDate = useMemo(() => {
    const routeSet = new Set(breakdowns.filter((b) => b.date === reportDate).map((b) => b.routeNumber));
    return Array.from(routeSet);
  }, [breakdowns, reportDate]);

  // Export to Excel
  const exportToExcel = () => {
    const data = filteredBreakdowns.map((b) => ({
      Date: b.date,
      'Route Number': b.routeNumber,
      'Driver ID': b.driverId,
      'Driver Name': b.driverName,
      'Vehicle Number': b.vehicleNumber,
      'Trip Name': b.tripName,
      'Breakdown Loss KM': b.breakdownLossKm,
      'Breakdown Trip': b.breakdownTrip,
      'Attended By': b.attendedBy,
      Reason: b.reason,
      'Time to Clear': b.timeToClear,
      Remarks: b.remarks,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Breakdown Report');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `Breakdown_Report_${reportDate}.xlsx`);
  };

  // Calculate totals
  const totalLossKm = filteredBreakdowns.reduce((sum, b) => sum + b.breakdownLossKm, 0);
  const totalTrips = filteredBreakdowns.reduce((sum, b) => sum + (b.breakdownTrip || b.breakdownTripCount || 0), 0);

  // Calculate route-wise breakdown loss for the selected date
  const routeWiseBreakdown = useMemo(() => {
    const routeMap = new Map<string, { 
      routeNumber: string; 
      totalLossKm: number; 
      totalTrips: number;
      breakdownCount: number;
      reasons: string[];
      drivers: string[];
      vehicles: string[];
    }>();

    breakdowns
      .filter((b) => b.date === reportDate)
      .forEach((b) => {
        const existing = routeMap.get(b.routeNumber);
        if (existing) {
          existing.totalLossKm += b.breakdownLossKm;
          existing.totalTrips += b.breakdownTrip || b.breakdownTripCount || 0;
          existing.breakdownCount += 1;
          if (!existing.reasons.includes(b.reason)) existing.reasons.push(b.reason);
          if (!existing.drivers.includes(b.driverName)) existing.drivers.push(b.driverName);
          if (!existing.vehicles.includes(b.vehicleNumber)) existing.vehicles.push(b.vehicleNumber);
        } else {
          routeMap.set(b.routeNumber, {
            routeNumber: b.routeNumber,
            totalLossKm: b.breakdownLossKm,
            totalTrips: b.breakdownTrip || b.breakdownTripCount || 0,
            breakdownCount: 1,
            reasons: [b.reason],
            drivers: [b.driverName],
            vehicles: [b.vehicleNumber],
          });
        }
      });

    return Array.from(routeMap.values()).sort((a, b) => b.totalLossKm - a.totalLossKm);
  }, [breakdowns, reportDate]);

  // Get highest loss route
  const highestLossRoute = routeWiseBreakdown.length > 0 ? routeWiseBreakdown[0] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center">
          <AlertTriangle className="h-8 w-8 text-orange-500 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Breakdown Analysis</h1>
            <p className="text-sm text-gray-500">Record and analyze vehicle breakdowns</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('submit')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === 'submit'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Plus className="h-4 w-4 inline mr-2" />
              Submit Breakdown
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === 'report'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Search className="h-4 w-4 inline mr-2" />
              Breakdown Report
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Submit Tab */}
          {activeTab === 'submit' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Submit Breakdown Record</h2>

              {successMessage && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                  {successMessage}
                </div>
              )}

              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Row 1: Date, Route, Vehicle */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Route Number <span className="text-red-500">*</span>
                      {breakdownRoutesForDate.length === 0 && formData.date && (
                        <span className="text-xs text-gray-500 ml-2">(No breakdown routes for this date)</span>
                      )}
                    </label>
                    <select
                      value={formData.routeNumber}
                      onChange={(e) => handleInputChange('routeNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                      required
                    >
                      <option value="">Select Breakdown Route</option>
                      {breakdownRoutesForDate.map((r) => (
                        <option key={r.routeNumber} value={r.routeNumber}>
                          {r.routeNumber} - {r.breakdownTripCount} trip(s) - {r.breakdownLossKm} KM loss
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
                    <select
                      value={formData.vehicleNumber}
                      onChange={(e) => handleInputChange('vehicleNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                    >
                      <option value="">Select Vehicle</option>
                      {vehicles.map((v) => (
                        <option key={v.vehicleNumber} value={v.vehicleNumber}>
                          {v.vehicleNumber} ({v.type || 'N/A'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Driver ID, Driver Name, Trip Name */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Driver ID <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.driverId}
                      onChange={(e) => handleInputChange('driverId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                      required
                    >
                      <option value="">Select Driver ID</option>
                      {drivers.map((d) => (
                        <option key={d.driverId} value={d.driverId}>
                          {d.driverId}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
                    <select
                      value={formData.driverName}
                      onChange={(e) => handleInputChange('driverName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                    >
                      <option value="">Select Driver Name</option>
                      {drivers.map((d) => (
                        <option key={d.driverId} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trip Name</label>
                    <input
                      type="text"
                      value={formData.tripName}
                      onChange={(e) => handleInputChange('tripName', e.target.value)}
                      placeholder="e.g. Depot to Station"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Row 3: Breakdown Loss KM, Breakdown Trip, Time to Clear */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Breakdown Loss KM
                      <span className="text-xs text-green-600 ml-2">(Auto-fetched)</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.breakdownLossKm}
                      readOnly
                      placeholder="Select route to auto-fetch"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-green-50 text-green-800 font-semibold cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Breakdown Trip Count
                      <span className="text-xs text-green-600 ml-2">(Auto-fetched)</span>
                    </label>
                    <input
                      type="number"
                      value={formData.breakdownTrip}
                      readOnly
                      placeholder="Select route to auto-fetch"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-green-50 text-green-800 font-semibold cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time to Clear (HH:MM)</label>
                    <input
                      type="text"
                      value={formData.timeToClear}
                      onChange={(e) => handleInputChange('timeToClear', e.target.value)}
                      placeholder="e.g. 1:30"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Row 4: Reason, Attended By */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Breakdown Reason <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.reason}
                      onChange={(e) => handleInputChange('reason', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                      required
                    >
                      <option value="">Select Reason</option>
                      {breakdownReasons.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Attended By</label>
                    <input
                      type="text"
                      value={formData.attendedBy}
                      onChange={(e) => handleInputChange('attendedBy', e.target.value)}
                      placeholder="Mechanic name / Team"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Row 5: Remarks */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => handleInputChange('remarks', e.target.value)}
                    rows={3}
                    placeholder="Additional notes about the breakdown..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    Submit Breakdown Record
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Report Tab */}
          {activeTab === 'report' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center space-x-2">
                  <label className="font-medium text-gray-700">Select Date:</label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => {
                      setReportDate(e.target.value);
                      setReportRoute('');
                    }}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="font-medium text-gray-700">Route:</label>
                  <select
                    value={reportRoute}
                    onChange={(e) => setReportRoute(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-white min-w-[160px]"
                  >
                    <option value="">All Routes</option>
                    {routesForReportDate.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={exportToExcel}
                  className="ml-auto flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export to Excel
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="text-sm text-orange-600 font-medium">Total Breakdowns</div>
                  <div className="text-3xl font-bold text-orange-700">{filteredBreakdowns.length}</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="text-sm text-red-600 font-medium">Total Loss KM</div>
                  <div className="text-3xl font-bold text-red-700">{totalLossKm.toFixed(1)}</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="text-sm text-amber-600 font-medium">Total Trips Affected</div>
                  <div className="text-3xl font-bold text-amber-700">{totalTrips}</div>
                </div>
              </div>

              {/* Highest Loss Route Alert */}
              {highestLossRoute && (
                <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl p-5 shadow-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      <AlertTriangle className="h-8 w-8 mr-4 text-yellow-300 animate-pulse" />
                      <div>
                        <div className="text-lg font-bold mb-1">⚠️ Highest Breakdown Loss Route of the Day</div>
                        <div className="text-3xl font-extrabold text-yellow-300">{highestLossRoute.routeNumber}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm opacity-90">Date</div>
                      <div className="text-lg font-semibold">{reportDate}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-red-400">
                    <div>
                      <div className="text-xs text-red-200 uppercase">Loss KM</div>
                      <div className="text-2xl font-bold text-yellow-300">{highestLossRoute.totalLossKm.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-red-200 uppercase">Trips Affected</div>
                      <div className="text-2xl font-bold">{highestLossRoute.totalTrips}</div>
                    </div>
                    <div>
                      <div className="text-xs text-red-200 uppercase">Breakdown Count</div>
                      <div className="text-2xl font-bold">{highestLossRoute.breakdownCount}</div>
                    </div>
                    <div>
                      <div className="text-xs text-red-200 uppercase">Vehicles Involved</div>
                      <div className="text-lg font-semibold">{highestLossRoute.vehicles.filter(v => v).join(', ') || '-'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <div className="text-xs text-red-200 uppercase mb-1">Breakdown Reasons</div>
                      <div className="flex flex-wrap gap-1">
                        {highestLossRoute.reasons.filter(r => r).map((reason, idx) => (
                          <span key={idx} className="px-2 py-1 bg-red-800 rounded text-xs font-medium">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-red-200 uppercase mb-1">Drivers</div>
                      <div className="text-sm font-medium">{highestLossRoute.drivers.filter(d => d).join(', ') || '-'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Route-wise Breakdown Summary Table */}
              {routeWiseBreakdown.length > 1 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                    <h3 className="text-sm font-bold text-gray-700 uppercase">Route-wise Breakdown Loss Ranking</h3>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rank</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Route</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Breakdowns</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Loss KM</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Trips Affected</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reasons</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vehicles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {routeWiseBreakdown.map((route, index) => (
                        <tr 
                          key={route.routeNumber} 
                          className={index === 0 ? 'bg-red-50' : 'hover:bg-gray-50'}
                        >
                          <td className="px-4 py-3 text-sm">
                            {index === 0 ? (
                              <span className="px-2 py-1 bg-red-600 text-white rounded-full text-xs font-bold">
                                #1 HIGH
                              </span>
                            ) : (
                              <span className="text-gray-600 font-medium">#{index + 1}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">{route.routeNumber}</td>
                          <td className="px-4 py-3 text-sm text-center font-semibold text-gray-700">{route.breakdownCount}</td>
                          <td className="px-4 py-3 text-sm text-center font-bold text-red-600">{route.totalLossKm.toFixed(1)}</td>
                          <td className="px-4 py-3 text-sm text-center font-semibold text-amber-600">{route.totalTrips}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex flex-wrap gap-1">
                              {route.reasons.filter(r => r).map((reason, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{route.vehicles.filter(v => v).join(', ') || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Report Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Route</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Driver ID</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Driver Name</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vehicle</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Trip</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Loss KM</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Loss Trips</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reason</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Attended By</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Time to Clear</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBreakdowns.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                          No breakdown records found for selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredBreakdowns.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3 text-sm text-gray-700">{b.date}</td>
                          <td className="px-3 py-3 text-sm font-medium text-gray-900">{b.routeNumber}</td>
                          <td className="px-3 py-3 text-sm text-gray-700">{b.driverId}</td>
                          <td className="px-3 py-3 text-sm text-gray-700">{b.driverName}</td>
                          <td className="px-3 py-3 text-sm text-gray-700">{b.vehicleNumber}</td>
                          <td className="px-3 py-3 text-sm text-gray-700">{b.tripName || '-'}</td>
                          <td className="px-3 py-3 text-sm text-center font-semibold text-red-600">{b.breakdownLossKm}</td>
                          <td className="px-3 py-3 text-sm text-center font-semibold text-amber-600">{b.breakdownTrip}</td>
                          <td className="px-3 py-3 text-sm text-gray-700">
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                              {b.reason}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-700">{b.attendedBy || '-'}</td>
                          <td className="px-3 py-3 text-sm text-center text-gray-700">{b.timeToClear || '-'}</td>
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={() => handleDelete(b.id)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredBreakdowns.length > 0 && (
                    <tfoot className="bg-gray-100">
                      <tr>
                        <td colSpan={6} className="px-3 py-3 text-sm font-bold text-gray-700 text-right">
                          TOTAL:
                        </td>
                        <td className="px-3 py-3 text-sm text-center font-bold text-red-700">{totalLossKm.toFixed(1)}</td>
                        <td className="px-3 py-3 text-sm text-center font-bold text-amber-700">{totalTrips}</td>
                        <td colSpan={4}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
