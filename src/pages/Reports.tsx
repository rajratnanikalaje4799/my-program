import { useState, useMemo, Fragment } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { storage } from '../utils/storage';
import { vehicleStorage } from '../utils/vehicleStorage';
import { Logsheet, Trip, Vehicle } from '../types';

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

declare module 'file-saver';

type TabType = 'DateSummary' | 'DailyReport' | 'DriverKms' | 'TripWise' | 'LogsheetView' | 'DeleteLogsheet';

export function Reports() {
  const exportToExcel = (rows: any[], sheetName: string, fileName: string) => {
    if (!rows || rows.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);
  };

  const [activeTab, setActiveTab] = useState<TabType>('DateSummary');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [deleteRoute, setDeleteRoute] = useState('');

  const logsheets = useMemo(() => storage.getLogsheets(), [activeTab, selectedDate, selectedMonth]);
  const vehicles = useMemo(() => vehicleStorage.getVehicles(), []);

  const getVehicleType = (vehicleNum: string) => {
    const v = vehicles.find((vv: Vehicle) => vv.vehicleNumber === vehicleNum);
    return v?.type || 'Unknown';
  };

  const calculateReasonTrips = (trips: Trip[], reason: string) => {
    return trips.filter((t) => !t.isCompleted && t.reason === reason).length;
  };

  const calculateReasonKms = (trips: Trip[], reason: string) => {
    return trips
      .filter((t) => !t.isCompleted && t.reason === reason)
      .reduce((sum, t) => sum + (Number(t.planKm) || 0), 0);
  };

  // Date Summary Data
  const dateSummaryData = useMemo(() => {
    return logsheets
      .filter((log: Logsheet) => log.date === selectedDate)
      .map((log: Logsheet) => {
        const planTripCount = log.trips.length;
        const actualTripCount = log.trips.filter((t) => t.isCompleted).length;
        return {
          ...log,
          vehicleType: getVehicleType(log.vehicleNumber),
          planTripCount,
          actualTripCount,
          reasons: REASONS.reduce((acc, r) => {
            acc[r] = {
              trips: calculateReasonTrips(log.trips, r),
              kms: calculateReasonKms(log.trips, r),
            };
            return acc;
          }, {} as Record<string, { trips: number; kms: number }>),
        };
      });
  }, [logsheets, selectedDate, vehicles]);

  // Daily Report Data
  const dailyReportData = useMemo(() => {
    const todayLogs = logsheets.filter((log: Logsheet) => log.date === selectedDate);
    
    // Shift-wise calculations - Actual KM should NOT include Extra KM
    const shiftCalc = { 
      Morning: { sch: 0, actualFromTrips: 0, extra: 0, lossKMs: {} as Record<string, number> }, 
      Evening: { sch: 0, actualFromTrips: 0, extra: 0, lossKMs: {} as Record<string, number> }, 
      General: { sch: 0, actualFromTrips: 0, extra: 0, lossKMs: {} as Record<string, number> } 
    };
    
    // Initialize loss KMs for each shift
    (['Morning', 'Evening', 'General'] as const).forEach(s => {
      REASONS.forEach(r => { shiftCalc[s].lossKMs[r] = 0; });
    });
    
    const totalReasonKMs: Record<string, number> = {};
    REASONS.forEach((r) => { totalReasonKMs[r] = 0; });

    todayLogs.forEach((log: Logsheet) => {
      const shift = (log.shift || 'General') as 'Morning' | 'Evening' | 'General';
      
      // Schedule KMs
      shiftCalc[shift].sch += log.scheduleKms || 0;
      
      // Calculate Actual KM and Extra KM separately from trips
      log.trips.forEach((t: Trip) => {
        const actual = Number(t.actualKm) || 0;
        const plan = Number(t.planKm) || 0;
        
        if (t.isManual) {
          // Manual trips: ALL KM goes to Extra only
          shiftCalc[shift].extra += actual;
        } else if (t.isCompleted) {
          // Completed schedule trips: 
          // Actual KM = min(actual, plan) - the planned portion
          // Extra KM = any amount over plan
          shiftCalc[shift].actualFromTrips += Math.min(actual, plan);
          if (actual > plan) {
            shiftCalc[shift].extra += (actual - plan);
          }
        } else {
          // Not completed - plan KM is loss
          if (t.reason && shiftCalc[shift].lossKMs[t.reason] !== undefined) {
            shiftCalc[shift].lossKMs[t.reason] += plan;
            totalReasonKMs[t.reason] += plan;
          }
        }
      });
    });

    const schKmMorn = shiftCalc.Morning.sch;
    const schKmEve = shiftCalc.Evening.sch;
    const schKmGen = shiftCalc.General.sch;
    const totalSchKm = schKmMorn + schKmEve + schKmGen;
    
    // Actual KM = only from completed schedule trips (NOT including extra)
    const actKmMorn = shiftCalc.Morning.actualFromTrips;
    const actKmEve = shiftCalc.Evening.actualFromTrips;
    const actKmGen = shiftCalc.General.actualFromTrips;
    const actualKm = actKmMorn + actKmEve + actKmGen;
    
    // Extra KM = manual trips + over-plan from schedule trips
    const extraKmMorn = shiftCalc.Morning.extra;
    const extraKmEve = shiftCalc.Evening.extra;
    const extraKmGen = shiftCalc.General.extra;
    const extraKm = extraKmMorn + extraKmEve + extraKmGen;
    
    // Total KM = Actual + Extra
    const totalKmMorn = actKmMorn + extraKmMorn;
    const totalKmEve = actKmEve + extraKmEve;
    const totalKmGen = actKmGen + extraKmGen;
    const totalKm = actualKm + extraKm;
    
    // Percentage based on actual vs schedule (not including extra)
    const percentage = totalSchKm > 0 ? ((actualKm / totalSchKm) * 100).toFixed(2) : '0.00';
    const percMorn = schKmMorn > 0 ? ((actKmMorn / schKmMorn) * 100).toFixed(2) : '0.00';
    const percEve = schKmEve > 0 ? ((actKmEve / schKmEve) * 100).toFixed(2) : '0.00';
    const percGen = schKmGen > 0 ? ((actKmGen / schKmGen) * 100).toFixed(2) : '0.00';

    return { 
      schKmMorn, schKmEve, schKmGen, totalSchKm, 
      actKmMorn, actKmEve, actKmGen, actualKm, 
      extraKmMorn, extraKmEve, extraKmGen, extraKm,
      totalKmMorn, totalKmEve, totalKmGen, totalKm,
      percMorn, percEve, percGen, percentage,
      shiftLossKMs: {
        Morning: shiftCalc.Morning.lossKMs,
        Evening: shiftCalc.Evening.lossKMs,
        General: shiftCalc.General.lossKMs
      },
      reasonKMs: totalReasonKMs
    };
  }, [logsheets, selectedDate]);

  // Trip Wise Data
  const tripWiseData = useMemo(() => {
    const dayLogs = logsheets.filter((log: Logsheet) => log.date === selectedDate);
    const rows: Array<{
      id: string; date: string; routeNumber: string; shift: string;
      vehicleNumber: string; vehicleType: string; driverName: string; driverId: string;
      tripName: string; planKm: number; actualKm: number; extraKm: number;
      scheduleOutTime: string; scheduleInTime: string; actualOutTime: string; actualInTime: string;
      isCompleted: boolean; reason?: string;
    }> = [];

    dayLogs.forEach((log) => {
      log.trips.forEach((t) => {
        const actual = Number(t.actualKm) || 0;
        const extra = t.isManual ? actual : Math.max(0, actual - t.planKm);
        rows.push({
          id: `${log.id}-${t.id}`, date: log.date, routeNumber: log.routeNumber, shift: log.shift,
          vehicleNumber: log.vehicleNumber, vehicleType: getVehicleType(log.vehicleNumber),
          driverName: log.driverName, driverId: log.driverId, tripName: t.name,
          planKm: t.planKm, actualKm: actual, extraKm: extra,
          scheduleOutTime: t.scheduleOutTime, scheduleInTime: t.scheduleInTime,
          actualOutTime: t.actualOutTime, actualInTime: t.actualInTime,
          isCompleted: t.isCompleted, reason: t.reason,
        });
      });
    });
    return rows;
  }, [logsheets, selectedDate, vehicles]);

  // Driver KMs Data
  const driverKMsData = useMemo(() => {
    const monthLogs = logsheets.filter((log: Logsheet) => log.date.startsWith(selectedMonth));
    const driverMap: Record<string, any> = {};

    monthLogs.forEach((log: Logsheet) => {
      if (!driverMap[log.driverId]) {
        driverMap[log.driverId] = { driverId: log.driverId, name: log.driverName, days: {}, shiftsPerDay: {} };
        for (let i = 1; i <= 31; i++) { driverMap[log.driverId].days[i] = 0; driverMap[log.driverId].shiftsPerDay[i] = 0; }
      }
      const day = parseInt(log.date.split('-')[2], 10);
      driverMap[log.driverId].days[day] += log.totalActualKms || 0;
      driverMap[log.driverId].shiftsPerDay[day] += 1;
    });

    return Object.values(driverMap).map((d: any) => {
      let doubleDutyCount = 0, singleDutyCount = 0;
      for (let i = 1; i <= 31; i++) {
        if (d.shiftsPerDay[i] === 1) singleDutyCount++;
        else if (d.shiftsPerDay[i] > 1) doubleDutyCount++;
      }
      return { ...d, singleDutyCount, doubleDutyCount };
    });
  }, [logsheets, selectedMonth]);

  const daysInMonth = useMemo(() => {
    if (!selectedMonth) return 31;
    const [year, month] = selectedMonth.split('-');
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  }, [selectedMonth]);

  // Delete tab data
  const deleteLogsForDate = useMemo(() => logsheets.filter((l) => l.date === selectedDate), [logsheets, selectedDate]);
  const deleteRoutesForDate = useMemo(() => Array.from(new Set(deleteLogsForDate.map((l) => l.routeNumber))), [deleteLogsForDate]);
  const deleteFilteredLogs = useMemo(() => deleteLogsForDate.filter((l) => !deleteRoute || l.routeNumber === deleteRoute), [deleteLogsForDate, deleteRoute]);

  const handleDeleteLogsheet = (id: string) => {
    if (!confirm('Delete this logsheet? This cannot be undone.')) return;
    storage.deleteLogsheet(id);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex -mb-px">
            {[
              { key: 'DateSummary', label: 'Selected Date Summary' },
              { key: 'DailyReport', label: 'Daily Report' },
              { key: 'DriverKms', label: 'Driver KMs' },
              { key: 'TripWise', label: 'Trip Wise Report' },
              { key: 'LogsheetView', label: 'Logsheet View' },
              { key: 'DeleteLogsheet', label: 'Delete Logsheet' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`py-4 px-6 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* TAB 1: Selected Date Summary */}
          {activeTab === 'DateSummary' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <label className="font-medium text-gray-700">Select Date:</label>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-2 border rounded-md" />
                </div>
                <button
                  type="button"
                  onClick={() => exportToExcel(
                    dateSummaryData.map((log) => ({
                      Date: log.date, Route: log.routeNumber, Shift: log.shift,
                      VehicleNo: log.vehicleNumber, VehicleType: log.vehicleType,
                      DriverName: log.driverName, DriverID: log.driverId,
                      PlanKM: log.scheduleKms, PlanTrips: log.planTripCount,
                      ActualKM: log.totalActualKms, ActualTrips: log.actualTripCount,
                      ExtraKM: Math.max(0, (log.totalActualKms || 0) - log.scheduleKms),
                      ...REASONS.reduce((acc, r) => {
                        acc[`${r}KM`] = log.reasons[r].kms;
                        acc[`${r}Trips`] = log.reasons[r].trips;
                        return acc;
                      }, {} as Record<string, number>),
                    })),
                    'DateSummary',
                    `DateSummary_${selectedDate}.xlsx`
                  )}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                >
                  Export to Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shift</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle No</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver Name</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver ID</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Plan KM</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Plan Trips</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actual KM</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Act. Trips</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Extra KM</th>
                      {REASONS.map((r) => (
                        <Fragment key={r}>
                          <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">{r} KM</th>
                          <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">{r} Trips</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dateSummaryData.length === 0 ? (
                      <tr><td colSpan={12 + REASONS.length * 2} className="text-center py-4 text-gray-500">No logs found for {selectedDate}.</td></tr>
                    ) : (
                      dateSummaryData.map((log) => (
                        <tr key={log.id}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{log.date}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{log.routeNumber}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{log.shift}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{log.vehicleNumber}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{log.vehicleType}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{log.driverName}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{log.driverId}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{log.scheduleKms}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{log.planTripCount}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center font-bold">{log.totalActualKms}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{log.actualTripCount}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center font-medium text-orange-600">{Math.max(0, (log.totalActualKms || 0) - log.scheduleKms)}</td>
                          {REASONS.map((r) => (
                            <Fragment key={`${r}-cells`}>
                              <td className={`px-2 py-2 whitespace-nowrap text-sm text-center ${log.reasons[r].kms > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}`}>{log.reasons[r].kms}</td>
                              <td className={`px-2 py-2 whitespace-nowrap text-sm text-center ${log.reasons[r].trips > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}`}>{log.reasons[r].trips}</td>
                            </Fragment>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Daily Report */}
          {activeTab === 'DailyReport' && (
            <div className="space-y-6">
              {/* Header with Date and Export */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <label className="font-medium text-gray-700">Select Date:</label>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-2 border rounded-md" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Create shift rows - Morning, Evening, General as separate rows
                    // Actual KM does NOT include Extra KM
                    // Total KM = Actual + Extra
                    const shiftRows = [
                      { 
                        Date: selectedDate, 
                        Shift: 'Morning', 
                        ScheduleKM: dailyReportData.schKmMorn, 
                        ActualKM: dailyReportData.actKmMorn,
                        ExtraKM: dailyReportData.extraKmMorn,
                        TotalKM: dailyReportData.totalKmMorn,
                        Percentage: dailyReportData.percMorn + '%',
                        // Shift-wise Loss KMs
                        ...REASONS.reduce((acc, r) => {
                          const lossKm = dailyReportData.shiftLossKMs.Morning[r] || 0;
                          const perc = dailyReportData.schKmMorn > 0 ? ((lossKm / dailyReportData.schKmMorn) * 100).toFixed(2) : '0.00';
                          acc[`${r}_LossKM`] = lossKm;
                          acc[`${r}_LossPerc`] = r !== 'Schedule Suspend' ? perc + '%' : 'N/A';
                          return acc;
                        }, {} as Record<string, any>)
                      },
                      { 
                        Date: selectedDate, 
                        Shift: 'Evening', 
                        ScheduleKM: dailyReportData.schKmEve, 
                        ActualKM: dailyReportData.actKmEve,
                        ExtraKM: dailyReportData.extraKmEve,
                        TotalKM: dailyReportData.totalKmEve,
                        Percentage: dailyReportData.percEve + '%',
                        ...REASONS.reduce((acc, r) => {
                          const lossKm = dailyReportData.shiftLossKMs.Evening[r] || 0;
                          const perc = dailyReportData.schKmEve > 0 ? ((lossKm / dailyReportData.schKmEve) * 100).toFixed(2) : '0.00';
                          acc[`${r}_LossKM`] = lossKm;
                          acc[`${r}_LossPerc`] = r !== 'Schedule Suspend' ? perc + '%' : 'N/A';
                          return acc;
                        }, {} as Record<string, any>)
                      },
                      { 
                        Date: selectedDate, 
                        Shift: 'General', 
                        ScheduleKM: dailyReportData.schKmGen, 
                        ActualKM: dailyReportData.actKmGen,
                        ExtraKM: dailyReportData.extraKmGen,
                        TotalKM: dailyReportData.totalKmGen,
                        Percentage: dailyReportData.percGen + '%',
                        ...REASONS.reduce((acc, r) => {
                          const lossKm = dailyReportData.shiftLossKMs.General[r] || 0;
                          const perc = dailyReportData.schKmGen > 0 ? ((lossKm / dailyReportData.schKmGen) * 100).toFixed(2) : '0.00';
                          acc[`${r}_LossKM`] = lossKm;
                          acc[`${r}_LossPerc`] = r !== 'Schedule Suspend' ? perc + '%' : 'N/A';
                          return acc;
                        }, {} as Record<string, any>)
                      },
                      { 
                        Date: selectedDate, 
                        Shift: 'TOTAL', 
                        ScheduleKM: dailyReportData.totalSchKm, 
                        ActualKM: dailyReportData.actualKm,
                        ExtraKM: dailyReportData.extraKm,
                        TotalKM: dailyReportData.totalKm,
                        Percentage: dailyReportData.percentage + '%',
                        ...REASONS.reduce((acc, r) => {
                          const lossKm = dailyReportData.reasonKMs[r] || 0;
                          const perc = dailyReportData.totalSchKm > 0 ? ((lossKm / dailyReportData.totalSchKm) * 100).toFixed(2) : '0.00';
                          acc[`${r}_LossKM`] = lossKm;
                          acc[`${r}_LossPerc`] = r !== 'Schedule Suspend' ? perc + '%' : 'N/A';
                          return acc;
                        }, {} as Record<string, any>)
                      },
                    ];

                    // Create workbook with shift rows including loss KMs
                    const wb = XLSX.utils.book_new();
                    const ws1 = XLSX.utils.json_to_sheet(shiftRows);
                    XLSX.utils.book_append_sheet(wb, ws1, 'Daily Report');
                    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    saveAs(blob, `DailyReport_${selectedDate}.xlsx`);
                  }}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                >
                  Export to Excel
                </button>
              </div>

              {/* ROW 1: Shift-wise Summary Table (Horizontal) */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-800 mb-3 uppercase tracking-wide">Shift-wise Summary</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg shadow-sm overflow-hidden">
                    <thead className="bg-blue-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-blue-800 uppercase">Shift</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase">Schedule KM</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase">Actual KM</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase">Extra KM</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase">Total KM</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase">Percentage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr className="hover:bg-blue-50">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">Morning</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-blue-600">{dailyReportData.schKmMorn}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-green-600">{dailyReportData.actKmMorn}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-orange-600">{dailyReportData.extraKmMorn}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-purple-600">{dailyReportData.totalKmMorn}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold">{dailyReportData.percMorn}%</td>
                      </tr>
                      <tr className="hover:bg-blue-50">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">Evening</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-blue-600">{dailyReportData.schKmEve}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-green-600">{dailyReportData.actKmEve}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-orange-600">{dailyReportData.extraKmEve}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-purple-600">{dailyReportData.totalKmEve}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold">{dailyReportData.percEve}%</td>
                      </tr>
                      <tr className="hover:bg-blue-50">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">General</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-blue-600">{dailyReportData.schKmGen}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-green-600">{dailyReportData.actKmGen}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-orange-600">{dailyReportData.extraKmGen}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-purple-600">{dailyReportData.totalKmGen}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold">{dailyReportData.percGen}%</td>
                      </tr>
                      <tr className="bg-gray-100 font-bold">
                        <td className="px-4 py-3 text-sm font-bold text-gray-800">TOTAL</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-gray-800">{dailyReportData.totalSchKm}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-green-700">{dailyReportData.actualKm}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-orange-700">{dailyReportData.extraKm}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-purple-700">{dailyReportData.totalKm}</td>
                        <td className={`px-4 py-3 text-center text-sm font-bold ${Number(dailyReportData.percentage) >= 90 ? 'text-green-600' : Number(dailyReportData.percentage) >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>{dailyReportData.percentage}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ROW 2: Loss KMs by Reason - Shift-wise Table */}
              <div className="bg-gradient-to-r from-red-50 to-rose-100 rounded-xl p-4 border border-red-200">
                <h3 className="text-sm font-semibold text-red-800 mb-3 uppercase tracking-wide">Loss KMs by Reason (Shift-wise)</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg shadow-sm overflow-hidden">
                    <thead className="bg-red-100">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-red-800 uppercase border-r border-red-200">Shift</th>
                        {REASONS.filter(r => r !== 'Schedule Suspend').map((r) => (
                          <th key={r} className="px-2 py-3 text-center text-xs font-semibold text-red-800 uppercase border-r border-red-200 last:border-r-0" colSpan={2}>
                            {r}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-red-50">
                        <th className="px-3 py-2 text-left text-xs text-red-600 border-r border-red-200"></th>
                        {REASONS.filter(r => r !== 'Schedule Suspend').map((r) => (
                          <Fragment key={r}>
                            <th className="px-2 py-2 text-center text-xs text-red-600 border-r border-red-100">KM</th>
                            <th className="px-2 py-2 text-center text-xs text-red-600 border-r border-red-200">%</th>
                          </Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(['Morning', 'Evening', 'General'] as const).map((shift) => {
                        const shiftSch = shift === 'Morning' ? dailyReportData.schKmMorn : shift === 'Evening' ? dailyReportData.schKmEve : dailyReportData.schKmGen;
                        return (
                          <tr key={shift} className="hover:bg-red-50">
                            <td className="px-3 py-2 text-sm font-semibold text-gray-700 border-r border-gray-200">{shift}</td>
                            {REASONS.filter(r => r !== 'Schedule Suspend').map((r) => {
                              const lossKm = dailyReportData.shiftLossKMs[shift][r] || 0;
                              const perc = shiftSch > 0 ? ((lossKm / shiftSch) * 100).toFixed(2) : '0.00';
                              return (
                                <Fragment key={r}>
                                  <td className={`px-2 py-2 text-center text-sm border-r border-gray-100 ${lossKm > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}`}>{lossKm}</td>
                                  <td className={`px-2 py-2 text-center text-sm border-r border-gray-200 ${lossKm > 0 ? 'text-red-500' : 'text-gray-400'}`}>{perc}%</td>
                                </Fragment>
                              );
                            })}
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-100 font-bold">
                        <td className="px-3 py-2 text-sm font-bold text-gray-800 border-r border-gray-200">TOTAL</td>
                        {REASONS.filter(r => r !== 'Schedule Suspend').map((r) => {
                          const lossKm = dailyReportData.reasonKMs[r] || 0;
                          const perc = dailyReportData.totalSchKm > 0 ? ((lossKm / dailyReportData.totalSchKm) * 100).toFixed(2) : '0.00';
                          return (
                            <Fragment key={r}>
                              <td className={`px-2 py-2 text-center text-sm border-r border-gray-100 ${lossKm > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}`}>{lossKm}</td>
                              <td className={`px-2 py-2 text-center text-sm border-r border-gray-200 ${lossKm > 0 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>{perc}%</td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Schedule Suspend - Separate per shift */}
                <div className="mt-4 bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-orange-800">Schedule Suspend (KM only - No percentage)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center p-2 bg-white rounded">
                      <div className="text-xs text-gray-500">Morning</div>
                      <div className="text-lg font-bold text-orange-600">{dailyReportData.shiftLossKMs.Morning['Schedule Suspend'] || 0}</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded">
                      <div className="text-xs text-gray-500">Evening</div>
                      <div className="text-lg font-bold text-orange-600">{dailyReportData.shiftLossKMs.Evening['Schedule Suspend'] || 0}</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded">
                      <div className="text-xs text-gray-500">General</div>
                      <div className="text-lg font-bold text-orange-600">{dailyReportData.shiftLossKMs.General['Schedule Suspend'] || 0}</div>
                    </div>
                    <div className="text-center p-2 bg-orange-100 rounded">
                      <div className="text-xs text-gray-600 font-semibold">TOTAL</div>
                      <div className="text-xl font-bold text-orange-700">{dailyReportData.reasonKMs['Schedule Suspend'] || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Driver KMs */}
          {activeTab === 'DriverKms' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <label className="font-medium text-gray-700">Select Month:</label>
                  <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-2 border rounded-md" />
                </div>
                <button
                  type="button"
                  onClick={() => exportToExcel(
                    driverKMsData.map((d: any) => ({
                      Month: selectedMonth, DriverID: d.driverId, Name: d.name,
                      SingleDuty: d.singleDutyCount, DoubleDuty: d.doubleDutyCount,
                      ...Array.from({ length: daysInMonth }, (_, i) => i + 1).reduce((acc, day) => {
                        acc[`Day${day}`] = d.days[day] || 0;
                        return acc;
                      }, {} as Record<string, number>),
                    })),
                    'DriverKMs',
                    `DriverKMs_${selectedMonth}.xlsx`
                  )}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                >
                  Export to Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Driver ID</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-20 bg-gray-50 z-10">Name</th>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">Single Duty</th>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">Double Duty</th>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                        <th key={day} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {driverKMsData.length === 0 ? (
                      <tr><td colSpan={daysInMonth + 4} className="text-center py-4 text-gray-500">No driver data for {selectedMonth}.</td></tr>
                    ) : (
                      driverKMsData.map((d: any) => (
                        <tr key={d.driverId} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium sticky left-0 bg-white">{d.driverId}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm sticky left-20 bg-white">{d.name}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm text-center">{d.singleDutyCount}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm text-center font-bold text-blue-600">{d.doubleDutyCount}</td>
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                            <td key={day} className={`px-2 py-2 whitespace-nowrap text-sm text-center ${d.days[day] > 0 ? 'text-green-600 font-medium' : 'text-gray-300'}`}>{d.days[day] || '-'}</td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Trip Wise Report */}
          {activeTab === 'TripWise' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <label className="font-medium text-gray-700">Select Date:</label>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-2 border rounded-md" />
                </div>
                <button
                  type="button"
                  onClick={() => exportToExcel(
                    tripWiseData.map((row) => ({
                      Date: row.date, Route: row.routeNumber, Shift: row.shift,
                      VehicleNo: row.vehicleNumber, VehicleType: row.vehicleType,
                      DriverName: row.driverName, DriverID: row.driverId, TripName: row.tripName,
                      PlanKM: row.planKm, ActualKM: row.actualKm, ExtraKM: row.extraKm,
                      SchOut: row.scheduleOutTime, SchIn: row.scheduleInTime,
                      ActOut: row.actualOutTime, ActIn: row.actualInTime,
                      Status: row.isCompleted ? 'OK' : 'Not OK', Reason: row.reason || '',
                    })),
                    'TripWise',
                    `TripWise_${selectedDate}.xlsx`
                  )}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                >
                  Export to Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shift</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle No</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver Name</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver ID</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trip Name</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Plan KM</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actual KM</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Extra KM</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sch Out</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sch In</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Act Out</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Act In</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tripWiseData.length === 0 ? (
                      <tr><td colSpan={17} className="text-center py-4 text-gray-500">No trips found for {selectedDate}.</td></tr>
                    ) : (
                      tripWiseData.map((row) => (
                        <tr key={row.id} className={row.isCompleted ? '' : 'bg-red-50'}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{row.date}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{row.routeNumber}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{row.shift}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{row.vehicleNumber}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{row.vehicleType}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{row.driverName}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{row.driverId}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{row.tripName}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{row.planKm}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center font-bold">{row.actualKm}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-orange-600 font-medium">{row.extraKm}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{row.scheduleOutTime}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{row.scheduleInTime}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{row.actualOutTime}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{row.actualInTime}</td>
                          <td className={`px-3 py-2 whitespace-nowrap text-sm text-center ${row.isCompleted ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}`}>{row.isCompleted ? 'OK' : 'Not OK'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{row.reason || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: Logsheet View */}
          {activeTab === 'LogsheetView' && (() => {
            const viewLogsForDate = logsheets.filter((l: Logsheet) => l.date === selectedDate);
            const viewRoutesForDate = Array.from(new Set(viewLogsForDate.map((l: Logsheet) => l.routeNumber)));
            
            return (
              <div className="space-y-4">
                {/* Step 1: Select Date */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="text-sm font-semibold text-blue-800 mb-3">Step 1: Select Date</h3>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <label className="font-medium text-gray-700">Date:</label>
                      <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => { setSelectedDate(e.target.value); setDeleteRoute(''); }} 
                        className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500" 
                      />
                    </div>
                    <div className="text-sm text-gray-600">
                      Found <span className="font-bold text-blue-600">{viewLogsForDate.length}</span> logsheet(s) for this date
                    </div>
                  </div>
                </div>

                {/* Step 2: Select Route */}
                {viewLogsForDate.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <h3 className="text-sm font-semibold text-green-800 mb-3">Step 2: Select Route to View</h3>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <label className="font-medium text-gray-700">Route:</label>
                        <select 
                          value={deleteRoute} 
                          onChange={(e) => setDeleteRoute(e.target.value)} 
                          className="px-4 py-2 border rounded-md bg-white min-w-[200px] focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">-- Select Route --</option>
                          {viewRoutesForDate.map((r) => {
                            const log = viewLogsForDate.find((l: Logsheet) => l.routeNumber === r);
                            return (
                              <option key={r} value={r}>
                                {r} - {log?.shift} Shift - {log?.driverName}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      {deleteRoute && (
                        <button
                          type="button"
                          onClick={() => setDeleteRoute('')}
                          className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Prompt to select route */}
                {viewLogsForDate.length > 0 && !deleteRoute && (
                  <div className="text-center py-8 text-gray-500 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="text-lg text-yellow-800">Please select a route from above</div>
                    <div className="text-sm mt-1 text-yellow-600">Choose a route to view the complete logsheet details</div>
                  </div>
                )}

                {viewLogsForDate.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    <div className="text-lg">No logsheets found for {selectedDate}</div>
                    <div className="text-sm mt-1">Please select a different date or submit a logsheet first</div>
                  </div>
                ) : deleteRoute ? (
                  viewLogsForDate.filter((l: Logsheet) => l.routeNumber === deleteRoute).map((log: Logsheet) => {
                    const vehicleType = getVehicleType(log.vehicleNumber);
                    const completedTrips = log.trips.filter((t: Trip) => t.isCompleted).length;
                    const totalTrips = log.trips.length;
                    const scheduleTrips = log.trips.filter((t: Trip) => !t.isManual);
                    const manualTrips = log.trips.filter((t: Trip) => t.isManual);
                    const extraKm = log.extraKms || manualTrips.reduce((sum: number, t: Trip) => sum + (Number(t.actualKm) || 0), 0);

                    return (
                      <div key={log.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
                        {/* Header - Logsheet Info */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
                          <div className="flex flex-wrap justify-between items-start gap-4">
                            <div>
                              <h3 className="text-lg font-bold">Route: {log.routeNumber}</h3>
                              <div className="text-blue-100 text-sm mt-1">
                                {log.date} • {log.shift} Shift
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold">{completedTrips}/{totalTrips}</div>
                              <div className="text-blue-100 text-xs">Trips Completed</div>
                            </div>
                          </div>
                        </div>

                        {/* Vehicle & Driver Info */}
                        <div className="bg-gray-50 p-4 border-b border-gray-200">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div>
                              <div className="text-gray-500 text-xs uppercase">Vehicle No</div>
                              <div className="font-semibold text-gray-800">{log.vehicleNumber}</div>
                            </div>
                            <div>
                              <div className="text-gray-500 text-xs uppercase">Vehicle Type</div>
                              <div className="font-semibold text-gray-800">{vehicleType}</div>
                            </div>
                            <div>
                              <div className="text-gray-500 text-xs uppercase">Driver Name</div>
                              <div className="font-semibold text-gray-800">{log.driverName}</div>
                            </div>
                            <div>
                              <div className="text-gray-500 text-xs uppercase">Driver ID</div>
                              <div className="font-semibold text-gray-800">{log.driverId}</div>
                            </div>
                            <div>
                              <div className="text-gray-500 text-xs uppercase">Remarks</div>
                              <div className="font-semibold text-gray-800">{log.remarks || '-'}</div>
                            </div>
                          </div>
                        </div>

                        {/* KM Summary */}
                        <div className="p-4 border-b border-gray-200">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-blue-50 rounded-lg p-3 text-center">
                              <div className="text-xs text-blue-600 uppercase font-semibold">Schedule KM</div>
                              <div className="text-2xl font-bold text-blue-700">{log.scheduleKms}</div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 text-center">
                              <div className="text-xs text-green-600 uppercase font-semibold">Actual KM</div>
                              <div className="text-2xl font-bold text-green-700">{log.totalActualKms || 0}</div>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-3 text-center">
                              <div className="text-xs text-orange-600 uppercase font-semibold">Extra KM</div>
                              <div className="text-2xl font-bold text-orange-700">{extraKm}</div>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-3 text-center">
                              <div className="text-xs text-purple-600 uppercase font-semibold">Total KM</div>
                              <div className="text-2xl font-bold text-purple-700">{(log.totalActualKms || 0)}</div>
                            </div>
                          </div>
                        </div>

                        {/* Schedule Trips Table */}
                        {scheduleTrips.length > 0 && (
                          <div className="p-4 border-b border-gray-200">
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">Schedule Trips</span>
                              <span className="text-sm text-gray-500">({scheduleTrips.length} trips)</span>
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">OK</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Trip (Route)</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Plan KM</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actual KM</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Sch Out</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Sch In</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Act Out</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Act In</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Reason</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {scheduleTrips.map((trip: Trip) => (
                                    <tr key={trip.id} className={trip.isCompleted ? 'bg-green-50' : 'bg-red-50'}>
                                      <td className="px-3 py-2 text-center">
                                        <div className={`w-6 h-6 rounded flex items-center justify-center ${trip.isCompleted ? 'bg-green-500 text-white' : 'bg-red-200 text-red-600'}`}>
                                          {trip.isCompleted ? '✓' : '✗'}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-sm font-medium text-gray-800">{trip.name}</td>
                                      <td className="px-3 py-2 text-center text-sm">{trip.planKm}</td>
                                      <td className="px-3 py-2 text-center text-sm font-bold">{trip.actualKm || '-'}</td>
                                      <td className="px-3 py-2 text-center text-sm text-gray-600">{trip.scheduleOutTime || '-'}</td>
                                      <td className="px-3 py-2 text-center text-sm text-gray-600">{trip.scheduleInTime || '-'}</td>
                                      <td className="px-3 py-2 text-center text-sm text-blue-600 font-medium">{trip.actualOutTime || '-'}</td>
                                      <td className="px-3 py-2 text-center text-sm text-blue-600 font-medium">{trip.actualInTime || '-'}</td>
                                      <td className="px-3 py-2 text-center">
                                        {trip.isCompleted ? (
                                          <span className="text-green-600 text-xs font-medium">OK</span>
                                        ) : (
                                          <span className="text-red-600 text-xs font-semibold bg-red-100 px-2 py-1 rounded">{trip.reason || '-'}</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Manual Trips Table */}
                        {manualTrips.length > 0 && (
                          <div className="p-4">
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">Manual Trips (Extra)</span>
                              <span className="text-sm text-gray-500">({manualTrips.length} trips)</span>
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                                <thead className="bg-orange-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Trip Name</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actual KM (Extra)</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Act Out</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Act In</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {manualTrips.map((trip: Trip) => (
                                    <tr key={trip.id} className="bg-orange-50">
                                      <td className="px-3 py-2 text-sm font-medium text-gray-800">{trip.name}</td>
                                      <td className="px-3 py-2 text-center text-sm font-bold text-orange-600">{trip.actualKm}</td>
                                      <td className="px-3 py-2 text-center text-sm text-blue-600">{trip.actualOutTime || '-'}</td>
                                      <td className="px-3 py-2 text-center text-sm text-blue-600">{trip.actualInTime || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : null}
              </div>
            );
          })()}

          {/* TAB 6: Delete Logsheet */}
          {activeTab === 'DeleteLogsheet' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center space-x-2">
                  <label className="font-medium text-gray-700">Select Date:</label>
                  <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setDeleteRoute(''); }} className="px-3 py-2 border rounded-md" />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="font-medium text-gray-700">Route:</label>
                  <select value={deleteRoute} onChange={(e) => setDeleteRoute(e.target.value)} className="px-3 py-2 border rounded-md bg-white min-w-[160px]">
                    <option value="">All Routes</option>
                    {deleteRoutesForDate.map((r) => (<option key={r} value={r}>{r}</option>))}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shift</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle No</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Plan KM</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actual KM</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Trips</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {deleteFilteredLogs.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-4 text-gray-500">No logsheets found for selected filters.</td></tr>
                    ) : (
                      deleteFilteredLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{log.date}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{log.routeNumber}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{log.shift}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{log.vehicleNumber}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{log.driverName}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{log.scheduleKms}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{log.totalActualKms || 0}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{log.trips.length}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                            <button type="button" onClick={() => handleDeleteLogsheet(log.id)} className="px-3 py-1 text-xs rounded-md bg-red-600 text-white hover:bg-red-700">Delete</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
