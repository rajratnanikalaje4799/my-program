import { useState, useEffect, useMemo } from 'react';
import { Circle, Truck, AlertTriangle, FileText, Plus, Trash2, RefreshCw, XCircle, Download, History, Search } from 'lucide-react';
import { Tyre, TyreAssignment, TyreIncidentRecord, TyreRemovalReason } from '../types/tyre';
import { tyreStorage } from '../utils/tyreStorage';
import { vehicleStorage } from '../utils/vehicleStorage';
import { storage } from '../utils/storage';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const INCIDENT_TYPES = [
  { value: 'puncture', label: 'Puncture', color: 'bg-orange-100 text-orange-800' },
  { value: 'blast', label: 'Tyre Blast', color: 'bg-red-100 text-red-800' },
  { value: 'cut', label: 'Tyre Cut', color: 'bg-purple-100 text-purple-800' }
] as const;

export default function TyreManagement() {
  const [activeTab, setActiveTab] = useState<'Master' | 'Assign' | 'Incident' | 'Report' | 'History'>('Master');
  
  // Master State
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [newTyre, setNewTyre] = useState({
    tyreNumber: '',
    brand: '',
    size: '',
    purchaseDate: new Date().toISOString().split('T')[0]
  });
  const [searchTyre, setSearchTyre] = useState('');

  // Assignment State
  const [vehicles] = useState(() => vehicleStorage.getVehicles().filter(v => v.status === 'Active'));
  const [selectedVehicleForAssign, setSelectedVehicleForAssign] = useState('');
  const [selectedTyreForAssign, setSelectedTyreForAssign] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().split('T')[0]);

  // Incident State
  const [selectedVehicleForIncident, setSelectedVehicleForIncident] = useState('');
  const [selectedIncidentTyre, setSelectedIncidentTyre] = useState('');
  const [incidentType, setIncidentType] = useState<'puncture' | 'blast' | 'cut'>('puncture');
  const [replacementTyre, setReplacementTyre] = useState('');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [incidentRemarks, setIncidentRemarks] = useState('');

  // Report State
  const [reportTyreSearch, setReportTyreSearch] = useState('');
  const [assignments, setAssignments] = useState<TyreAssignment[]>([]);
  const [incidentRecords, setIncidentRecords] = useState<TyreIncidentRecord[]>([]);

  // History State
  const [historyTyreSearch, setHistoryTyreSearch] = useState('');
  const [selectedTyreForHistory, setSelectedTyreForHistory] = useState<Tyre | null>(null);

  // Messages
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setTyres(tyreStorage.getTyres());
    setAssignments(tyreStorage.getAssignments());
    setIncidentRecords(tyreStorage.getIncidentRecords());
  };

  // Calculate KM run for a tyre based on logsheet actual KMs
  const calculateTyreKm = (tyreId: string): number => {
    const tyreAssignments = tyreStorage.getTyreHistory(tyreId);
    const logsheets = storage.getLogsheets();
    
    let totalKm = 0;
    
    tyreAssignments.forEach(assignment => {
      const assignStart = new Date(assignment.assignedDate);
      const assignEnd = assignment.unassignedDate ? new Date(assignment.unassignedDate) : new Date();
      
      logsheets.forEach(log => {
        const logDate = new Date(log.date);
        if (
          log.vehicleNumber === assignment.vehicleNumber &&
          logDate >= assignStart &&
          logDate <= assignEnd
        ) {
          totalKm += log.totalActualKms || 0;
        }
      });
    });
    
    return totalKm;
  };

  // Get current vehicle KM from logsheets
  const getVehicleCurrentKm = (vehicleNumber: string): number => {
    const logsheets = storage.getLogsheets();
    let totalKm = 0;
    logsheets.forEach(log => {
      if (log.vehicleNumber === vehicleNumber) {
        totalKm += log.totalActualKms || 0;
      }
    });
    return totalKm;
  };

  // Get detailed tyre lifecycle
  const getTyreLifecycle = (tyre: Tyre) => {
    const tyreAssignments = assignments.filter(a => a.tyreId === tyre.id);
    const tyreIncidents = incidentRecords.filter(i => i.tyreId === tyre.id);
    
    const vehicleHistory = tyreAssignments.map(a => {
      const kmRun = a.isActive 
        ? getVehicleCurrentKm(a.vehicleNumber) - a.kmAtAssignment
        : a.kmRun;
      
      return {
        vehicleNumber: a.vehicleNumber,
        assignedDate: a.assignedDate,
        removedDate: a.unassignedDate,
        kmRun: kmRun,
        removalReason: a.reason
      };
    });

    const incidents = tyreIncidents.map(i => ({
      date: i.incidentDate,
      type: i.incidentType,
      vehicleNumber: i.vehicleNumber,
      kmAtIncident: i.kmAtIncident,
      status: i.repairStatus,
      replacedWith: i.replacementTyreNumber,
      replacementSource: i.replacementSource,
      replacementFromVehicle: i.replacementFromVehicle
    }));

    const totalKm = calculateTyreKm(tyre.id);

    return {
      tyre,
      vehicleHistory,
      incidents,
      totalKm,
      scrappedDate: tyre.scrappedDate,
      scrappedKm: tyre.scrappedKm
    };
  };

  // Available tyres for assignment
  const availableTyres = useMemo(() => {
    return tyres.filter(t => t.status === 'available');
  }, [tyres]);

  // Tyres available for replacement (available + fitted to OTHER vehicles)
  const tyresForReplacement = useMemo(() => {
    const available = tyres.filter(t => t.status === 'available');
    const fittedToOtherVehicles = tyres.filter(t => 
      t.status === 'fitted' && 
      t.currentVehicle && 
      t.currentVehicle !== selectedVehicleForIncident
    );
    return { available, fittedToOtherVehicles };
  }, [tyres, selectedVehicleForIncident]);

  // Tyres fitted to selected vehicle
  const tyresFittedToVehicle = useMemo(() => {
    if (!selectedVehicleForIncident) return [];
    const activeAssignments = assignments.filter(
      a => a.vehicleNumber === selectedVehicleForIncident && a.isActive
    );
    return activeAssignments.map(a => {
      const tyre = tyres.find(t => t.id === a.tyreId);
      return { assignment: a, tyre };
    }).filter(item => item.tyre);
  }, [selectedVehicleForIncident, assignments, tyres]);

  // Filter tyres for search
  const filteredTyres = useMemo(() => {
    if (!searchTyre) return tyres;
    return tyres.filter(t => 
      t.tyreNumber.toLowerCase().includes(searchTyre.toLowerCase())
    );
  }, [tyres, searchTyre]);

  // Report filtered tyres
  const reportFilteredTyres = useMemo(() => {
    if (!reportTyreSearch) return tyres;
    return tyres.filter(t => 
      t.tyreNumber.toLowerCase().includes(reportTyreSearch.toLowerCase())
    );
  }, [tyres, reportTyreSearch]);

  // History filtered tyres
  const historyFilteredTyres = useMemo(() => {
    if (!historyTyreSearch) return [];
    return tyres.filter(t => 
      t.tyreNumber.toLowerCase().includes(historyTyreSearch.toLowerCase())
    );
  }, [tyres, historyTyreSearch]);

  const showMessage = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') {
      setSuccess(msg);
      setError('');
    } else {
      setError(msg);
      setSuccess('');
    }
    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 3000);
  };

  // Add new tyre
  const handleAddTyre = () => {
    if (!newTyre.tyreNumber.trim()) {
      showMessage('error', 'Tyre number is required');
      return;
    }

    if (tyres.some(t => t.tyreNumber.toLowerCase() === newTyre.tyreNumber.toLowerCase())) {
      showMessage('error', 'Tyre number already exists');
      return;
    }

    const tyre: Tyre = {
      id: Date.now().toString(),
      tyreNumber: newTyre.tyreNumber.toUpperCase(),
      brand: newTyre.brand,
      size: newTyre.size,
      purchaseDate: newTyre.purchaseDate,
      status: 'available',
      totalKmRun: 0,
      createdAt: new Date().toISOString()
    };

    tyreStorage.saveTyre(tyre);
    setNewTyre({ tyreNumber: '', brand: '', size: '', purchaseDate: new Date().toISOString().split('T')[0] });
    loadData();
    showMessage('success', 'Tyre added successfully');
  };

  // Delete tyre
  const handleDeleteTyre = (id: string) => {
    const tyre = tyres.find(t => t.id === id);
    if (tyre?.status === 'fitted') {
      showMessage('error', 'Cannot delete tyre that is currently fitted to a vehicle');
      return;
    }
    if (confirm('Are you sure you want to delete this tyre?')) {
      tyreStorage.deleteTyre(id);
      loadData();
      showMessage('success', 'Tyre deleted');
    }
  };

  // Assign tyre to vehicle
  const handleAssignTyre = () => {
    if (!selectedVehicleForAssign || !selectedTyreForAssign) {
      showMessage('error', 'Please select both vehicle and tyre');
      return;
    }

    const tyre = tyres.find(t => t.id === selectedTyreForAssign);
    if (!tyre) return;

    const vehicleKm = getVehicleCurrentKm(selectedVehicleForAssign);

    const assignment: TyreAssignment = {
      id: Date.now().toString(),
      tyreId: tyre.id,
      tyreNumber: tyre.tyreNumber,
      vehicleNumber: selectedVehicleForAssign,
      assignedDate: assignmentDate,
      kmAtAssignment: vehicleKm,
      kmRun: 0,
      isActive: true
    };

    tyre.status = 'fitted';
    tyre.currentVehicle = selectedVehicleForAssign;
    tyreStorage.updateTyre(tyre);
    tyreStorage.saveAssignment(assignment);

    setSelectedVehicleForAssign('');
    setSelectedTyreForAssign('');
    loadData();
    showMessage('success', `Tyre ${tyre.tyreNumber} assigned to ${selectedVehicleForAssign}`);
  };

  // Handle incident (puncture, blast, cut) and replacement
  const handleIncidentReplace = () => {
    if (!selectedVehicleForIncident || !selectedIncidentTyre) {
      showMessage('error', 'Please select vehicle and incident tyre');
      return;
    }

    const incidentTyre = tyres.find(t => t.id === selectedIncidentTyre);
    if (!incidentTyre) return;

    const currentAssignment = assignments.find(
      a => a.tyreId === selectedIncidentTyre && a.isActive
    );
    if (!currentAssignment) return;

    const vehicleKm = getVehicleCurrentKm(selectedVehicleForIncident);
    const kmRun = vehicleKm - currentAssignment.kmAtAssignment;

    // End current assignment
    currentAssignment.isActive = false;
    currentAssignment.unassignedDate = incidentDate;
    currentAssignment.kmAtUnassignment = vehicleKm;
    currentAssignment.kmRun = kmRun;
    currentAssignment.reason = incidentType as TyreRemovalReason;
    tyreStorage.updateAssignment(currentAssignment);

    // Update incident tyre status
    incidentTyre.status = incidentType === 'puncture' ? 'punctured' : incidentType;
    incidentTyre.currentVehicle = undefined;
    incidentTyre.totalKmRun = calculateTyreKm(incidentTyre.id);
    tyreStorage.updateTyre(incidentTyre);

    // Create incident record
    const incidentRecord: TyreIncidentRecord = {
      id: Date.now().toString(),
      tyreId: incidentTyre.id,
      tyreNumber: incidentTyre.tyreNumber,
      vehicleNumber: selectedVehicleForIncident,
      incidentDate: incidentDate,
      incidentType: incidentType,
      kmAtIncident: vehicleKm,
      repairStatus: incidentType === 'blast' ? 'scrapped' : 'pending',
      remarks: incidentRemarks
    };

    // If replacement tyre selected
    if (replacementTyre) {
      const newTyre = tyres.find(t => t.id === replacementTyre);
      if (newTyre) {
        incidentRecord.replacementTyreId = newTyre.id;
        incidentRecord.replacementTyreNumber = newTyre.tyreNumber;

        // If replacement tyre is from another vehicle
        if (newTyre.status === 'fitted' && newTyre.currentVehicle) {
          const previousVehicle = newTyre.currentVehicle;
          const previousVehicleKm = getVehicleCurrentKm(previousVehicle);
          
          incidentRecord.replacementSource = 'from_vehicle';
          incidentRecord.replacementFromVehicle = previousVehicle;
          
          const previousAssignment = assignments.find(
            a => a.tyreId === newTyre.id && a.isActive
          );
          
          if (previousAssignment) {
            previousAssignment.isActive = false;
            previousAssignment.unassignedDate = incidentDate;
            previousAssignment.kmAtUnassignment = previousVehicleKm;
            previousAssignment.kmRun = previousVehicleKm - previousAssignment.kmAtAssignment;
            previousAssignment.reason = 'transferred';
            previousAssignment.reasonDetails = `Transferred to ${selectedVehicleForIncident} to replace ${incidentType} tyre`;
            tyreStorage.updateAssignment(previousAssignment);
          }
          
          incidentRecord.remarks = (incidentRecord.remarks || '') + 
            ` | Replacement tyre taken from vehicle ${previousVehicle}`;
        } else {
          incidentRecord.replacementSource = 'available';
        }

        // Assign replacement tyre to the current vehicle
        const newAssignment: TyreAssignment = {
          id: (Date.now() + 1).toString(),
          tyreId: newTyre.id,
          tyreNumber: newTyre.tyreNumber,
          vehicleNumber: selectedVehicleForIncident,
          assignedDate: incidentDate,
          kmAtAssignment: vehicleKm,
          kmRun: 0,
          isActive: true
        };

        newTyre.status = 'fitted';
        newTyre.currentVehicle = selectedVehicleForIncident;
        tyreStorage.updateTyre(newTyre);
        tyreStorage.saveAssignment(newAssignment);
      }
    }

    tyreStorage.saveIncidentRecord(incidentRecord);

    // Reset form
    setSelectedVehicleForIncident('');
    setSelectedIncidentTyre('');
    setReplacementTyre('');
    setIncidentRemarks('');
    setIncidentType('puncture');
    loadData();
    showMessage('success', `${incidentType.charAt(0).toUpperCase() + incidentType.slice(1)} recorded and tyre replaced successfully`);
  };

  // Mark tyre as scrapped - REMOVES FROM SYSTEM COMPLETELY
  const handleScrapTyre = (tyreId: string) => {
    const tyre = tyres.find(t => t.id === tyreId);
    if (!tyre) return;

    if (tyre.status === 'fitted') {
      showMessage('error', 'Cannot scrap a tyre that is currently fitted. Remove it first.');
      return;
    }

    const totalKm = calculateTyreKm(tyreId);
    if (confirm(`Are you sure you want to SCRAP tyre ${tyre.tyreNumber}?\n\nTotal KM Run: ${totalKm} KM\n\nThis tyre will be PERMANENTLY REMOVED from the system and cannot be recovered.`)) {
      tyreStorage.deleteTyre(tyreId);
      loadData();
      showMessage('success', `Tyre ${tyre.tyreNumber} has been scrapped and removed from the system (Total KM: ${totalKm})`);
    }
  };

  // Mark tyre as repaired
  const handleRepairTyre = (tyreId: string) => {
    const tyre = tyres.find(t => t.id === tyreId);
    if (!tyre || (tyre.status !== 'punctured' && tyre.status !== 'cut')) return;

    tyre.status = 'available';
    tyreStorage.updateTyre(tyre);

    const records = tyreStorage.getIncidentRecords();
    const latestRecord = records.filter(r => r.tyreId === tyreId).pop();
    if (latestRecord && latestRecord.repairStatus === 'pending') {
      latestRecord.repairStatus = 'repaired';
      latestRecord.repairDate = new Date().toISOString().split('T')[0];
      tyreStorage.updateIncidentRecord(latestRecord);
    }

    loadData();
    showMessage('success', `Tyre ${tyre.tyreNumber} marked as repaired and available`);
  };

  // Export report to Excel
  const exportReport = () => {
    const reportData = reportFilteredTyres.map(tyre => {
      const history = assignments.filter(a => a.tyreId === tyre.id);
      const incidents = incidentRecords.filter(i => i.tyreId === tyre.id);
      const totalKm = calculateTyreKm(tyre.id);
      const punctures = incidents.filter(i => i.incidentType === 'puncture').length;
      const blasts = incidents.filter(i => i.incidentType === 'blast').length;
      const cuts = incidents.filter(i => i.incidentType === 'cut').length;

      return {
        'Tyre Number': tyre.tyreNumber,
        'Brand': tyre.brand || '-',
        'Size': tyre.size || '-',
        'Purchase Date': tyre.purchaseDate || '-',
        'Status': tyre.status.toUpperCase(),
        'Current Vehicle': tyre.currentVehicle || '-',
        'Total KM Run': totalKm,
        'Total Assignments': history.length,
        'Punctures': punctures,
        'Blasts': blasts,
        'Cuts': cuts,
        'Vehicles Used': history.map(h => h.vehicleNumber).join(', ') || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tyre Report');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(dataBlob, `Tyre_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export tyre history to Excel
  const exportTyreHistory = (tyre: Tyre) => {
    const lifecycle = getTyreLifecycle(tyre);
    
    const historyData = lifecycle.vehicleHistory.map((h, idx) => ({
      'S.No': idx + 1,
      'Vehicle Number': h.vehicleNumber,
      'Assigned Date': h.assignedDate,
      'Removed Date': h.removedDate || 'Still Fitted',
      'KM Run': h.kmRun,
      'Removal Reason': h.removalReason || '-'
    }));

    const incidentData = lifecycle.incidents.map((i, idx) => ({
      'S.No': idx + 1,
      'Date': i.date,
      'Type': i.type.toUpperCase(),
      'Vehicle': i.vehicleNumber,
      'KM at Incident': i.kmAtIncident,
      'Status': i.status,
      'Replaced With': i.replacedWith || '-',
      'Source': i.replacementSource || '-'
    }));

    const summaryData = [{
      'Tyre Number': tyre.tyreNumber,
      'Brand': tyre.brand || '-',
      'Size': tyre.size || '-',
      'Purchase Date': tyre.purchaseDate || '-',
      'Status': tyre.status.toUpperCase(),
      'Total KM Run': lifecycle.totalKm,
      'Total Vehicles': lifecycle.vehicleHistory.length,
      'Total Incidents': lifecycle.incidents.length
    }];

    const wb = XLSX.utils.book_new();
    
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
    
    const ws2 = XLSX.utils.json_to_sheet(historyData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Vehicle History');
    
    const ws3 = XLSX.utils.json_to_sheet(incidentData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Incidents');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(dataBlob, `Tyre_History_${tyre.tyreNumber}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'fitted': return 'bg-blue-100 text-blue-800';
      case 'punctured': return 'bg-orange-100 text-orange-800';
      case 'blast': return 'bg-red-100 text-red-800';
      case 'cut': return 'bg-purple-100 text-purple-800';
      case 'scrapped': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Tyre Management</h1>
        <div className="text-sm text-gray-500">
          Total Tyres: <span className="font-bold text-blue-600">{tyres.length}</span> | 
          Fitted: <span className="font-bold text-green-600">{tyres.filter(t => t.status === 'fitted').length}</span> |
          Available: <span className="font-bold text-teal-600">{tyres.filter(t => t.status === 'available').length}</span>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <nav className="flex border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('Master')}
            className={`flex items-center space-x-2 py-4 px-6 text-sm font-medium border-b-2 whitespace-nowrap ${
              activeTab === 'Master'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Circle className="w-4 h-4" />
            <span>Tyre Master</span>
          </button>
          <button
            onClick={() => setActiveTab('Assign')}
            className={`flex items-center space-x-2 py-4 px-6 text-sm font-medium border-b-2 whitespace-nowrap ${
              activeTab === 'Assign'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Assign to Vehicle</span>
          </button>
          <button
            onClick={() => setActiveTab('Incident')}
            className={`flex items-center space-x-2 py-4 px-6 text-sm font-medium border-b-2 whitespace-nowrap ${
              activeTab === 'Incident'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Puncture / Blast / Cut</span>
          </button>
          <button
            onClick={() => setActiveTab('History')}
            className={`flex items-center space-x-2 py-4 px-6 text-sm font-medium border-b-2 whitespace-nowrap ${
              activeTab === 'History'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Tyre History</span>
          </button>
          <button
            onClick={() => setActiveTab('Report')}
            className={`flex items-center space-x-2 py-4 px-6 text-sm font-medium border-b-2 whitespace-nowrap ${
              activeTab === 'Report'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Tyre Report</span>
          </button>
        </nav>

        <div className="p-6">
          {/* Tyre Master Tab */}
          {activeTab === 'Master' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Add New Tyre</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tyre Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newTyre.tyreNumber}
                      onChange={(e) => setNewTyre({ ...newTyre, tyreNumber: e.target.value })}
                      placeholder="e.g., TYR-001"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                    <input
                      type="text"
                      value={newTyre.brand}
                      onChange={(e) => setNewTyre({ ...newTyre, brand: e.target.value })}
                      placeholder="e.g., MRF"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                    <input
                      type="text"
                      value={newTyre.size}
                      onChange={(e) => setNewTyre({ ...newTyre, size: e.target.value })}
                      placeholder="e.g., 295/80R22.5"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                    <input
                      type="date"
                      value={newTyre.purchaseDate}
                      onChange={(e) => setNewTyre({ ...newTyre, purchaseDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleAddTyre}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Tyre</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={searchTyre}
                  onChange={(e) => setSearchTyre(e.target.value)}
                  placeholder="Search by tyre number..."
                  className="w-full md:w-64 px-3 py-2 border rounded-md"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tyre Number</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Vehicle</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total KM Run</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTyres.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          No tyres found. Add your first tyre above.
                        </td>
                      </tr>
                    ) : (
                      filteredTyres.map((tyre) => (
                        <tr key={tyre.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{tyre.tyreNumber}</td>
                          <td className="px-4 py-3 text-gray-600">{tyre.brand || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{tyre.size || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{tyre.purchaseDate || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(tyre.status)}`}>
                              {tyre.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{tyre.currentVehicle || '-'}</td>
                          <td className="px-4 py-3 font-medium text-blue-600">{calculateTyreKm(tyre.id)} KM</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              {(tyre.status === 'punctured' || tyre.status === 'cut') && (
                                <button
                                  onClick={() => handleRepairTyre(tyre.id)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  title="Mark as Repaired"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              )}
                              {tyre.status !== 'fitted' && (
                                <button
                                  onClick={() => handleScrapTyre(tyre.id)}
                                  className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                                  title="Scrap Tyre (Remove from System)"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                              {tyre.status !== 'fitted' && (
                                <button
                                  onClick={() => handleDeleteTyre(tyre.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Assign to Vehicle Tab */}
          {activeTab === 'Assign' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Assign Tyre to Vehicle</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Vehicle</label>
                    <select
                      value={selectedVehicleForAssign}
                      onChange={(e) => setSelectedVehicleForAssign(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-white"
                    >
                      <option value="">-- Select Vehicle --</option>
                      {vehicles.map(v => (
                        <option key={v.vehicleNumber} value={v.vehicleNumber}>{v.vehicleNumber} ({v.type || 'Bus'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Available Tyre</label>
                    <select
                      value={selectedTyreForAssign}
                      onChange={(e) => setSelectedTyreForAssign(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-white"
                    >
                      <option value="">-- Select Tyre --</option>
                      {availableTyres.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.tyreNumber} {t.brand ? `(${t.brand})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assignment Date</label>
                    <input
                      type="date"
                      value={assignmentDate}
                      onChange={(e) => setAssignmentDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleAssignTyre}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Assign Tyre
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Currently Fitted Tyres</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tyre Number</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">KM at Assignment</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current KM Run</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {assignments.filter(a => a.isActive).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            No tyres currently assigned to vehicles.
                          </td>
                        </tr>
                      ) : (
                        assignments.filter(a => a.isActive).map((assignment) => {
                          const currentVehicleKm = getVehicleCurrentKm(assignment.vehicleNumber);
                          const kmRun = currentVehicleKm - assignment.kmAtAssignment;
                          return (
                            <tr key={assignment.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{assignment.tyreNumber}</td>
                              <td className="px-4 py-3 text-gray-600">{assignment.vehicleNumber}</td>
                              <td className="px-4 py-3 text-gray-600">{assignment.assignedDate}</td>
                              <td className="px-4 py-3 text-gray-600">{assignment.kmAtAssignment} KM</td>
                              <td className="px-4 py-3 font-medium text-blue-600">{kmRun} KM</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Incident (Puncture/Blast/Cut) Tab */}
          {activeTab === 'Incident' && (
            <div className="space-y-6">
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Report Tyre Incident & Replace</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Vehicle</label>
                    <select
                      value={selectedVehicleForIncident}
                      onChange={(e) => {
                        setSelectedVehicleForIncident(e.target.value);
                        setSelectedIncidentTyre('');
                      }}
                      className="w-full px-3 py-2 border rounded-md bg-white"
                    >
                      <option value="">-- Select Vehicle --</option>
                      {vehicles.map(v => (
                        <option key={v.vehicleNumber} value={v.vehicleNumber}>{v.vehicleNumber}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Incident Tyre</label>
                    <select
                      value={selectedIncidentTyre}
                      onChange={(e) => setSelectedIncidentTyre(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-white"
                      disabled={!selectedVehicleForIncident}
                    >
                      <option value="">-- Select Tyre --</option>
                      {tyresFittedToVehicle.map(item => (
                        <option key={item.tyre!.id} value={item.tyre!.id}>
                          {item.tyre!.tyreNumber} ({item.tyre!.brand || 'No brand'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Incident Type</label>
                    <select
                      value={incidentType}
                      onChange={(e) => setIncidentType(e.target.value as 'puncture' | 'blast' | 'cut')}
                      className="w-full px-3 py-2 border rounded-md bg-white"
                    >
                      {INCIDENT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Incident Date</label>
                    <input
                      type="date"
                      value={incidentDate}
                      onChange={(e) => setIncidentDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Replace With</label>
                    <select
                      value={replacementTyre}
                      onChange={(e) => setReplacementTyre(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-white"
                    >
                      <option value="">-- No Replacement --</option>
                      {tyresForReplacement.available.length > 0 && (
                        <optgroup label="🟢 Available Tyres">
                          {tyresForReplacement.available.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.tyreNumber} {t.brand ? `(${t.brand})` : ''} - Available
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {tyresForReplacement.fittedToOtherVehicles.length > 0 && (
                        <optgroup label="🔵 Take From Other Vehicle">
                          {tyresForReplacement.fittedToOtherVehicles.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.tyreNumber} {t.brand ? `(${t.brand})` : ''} - On {t.currentVehicle}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      You can use an available tyre or take from another vehicle
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                    <input
                      type="text"
                      value={incidentRemarks}
                      onChange={(e) => setIncidentRemarks(e.target.value)}
                      placeholder="e.g., Front left tyre, road hazard"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleIncidentReplace}
                    className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                    disabled={!selectedVehicleForIncident || !selectedIncidentTyre}
                  >
                    Record Incident & Replace
                  </button>
                </div>
              </div>

              {/* Incident History */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Incident History</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tyre</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">KM at Incident</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Replaced With</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {incidentRecords.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                            No incident records found.
                          </td>
                        </tr>
                      ) : (
                        incidentRecords.map((record) => {
                          const typeInfo = INCIDENT_TYPES.find(t => t.value === record.incidentType);
                          return (
                            <tr key={record.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-600">{record.incidentDate}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeInfo?.color || 'bg-gray-100'}`}>
                                  {record.incidentType.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-900">{record.tyreNumber}</td>
                              <td className="px-4 py-3 text-gray-600">{record.vehicleNumber}</td>
                              <td className="px-4 py-3 text-gray-600">{record.kmAtIncident} KM</td>
                              <td className="px-4 py-3 text-gray-600">{record.replacementTyreNumber || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">
                                {record.replacementSource === 'from_vehicle' 
                                  ? `From ${record.replacementFromVehicle}` 
                                  : record.replacementSource === 'available' 
                                  ? 'Available Stock' 
                                  : '-'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  record.repairStatus === 'repaired' 
                                    ? 'bg-green-100 text-green-800'
                                    : record.repairStatus === 'scrapped'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {record.repairStatus.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-sm">{record.remarks || '-'}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tyre History Tab */}
          {activeTab === 'History' && (
            <div className="space-y-6">
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center space-x-2">
                  <History className="w-5 h-5" />
                  <span>Complete Tyre History (Until Scrap)</span>
                </h3>
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search Tyre Number</label>
                    <div className="relative">
                      <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={historyTyreSearch}
                        onChange={(e) => {
                          setHistoryTyreSearch(e.target.value);
                          setSelectedTyreForHistory(null);
                        }}
                        placeholder="Type tyre number to search..."
                        className="w-full pl-10 pr-4 py-2 border rounded-md"
                      />
                    </div>
                  </div>
                </div>

                {historyTyreSearch && historyFilteredTyres.length > 0 && !selectedTyreForHistory && (
                  <div className="mt-4 border rounded-md bg-white max-h-48 overflow-y-auto">
                    {historyFilteredTyres.map(tyre => (
                      <button
                        key={tyre.id}
                        onClick={() => setSelectedTyreForHistory(tyre)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                      >
                        <span className="font-medium">{tyre.tyreNumber}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(tyre.status)}`}>
                          {tyre.status.toUpperCase()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Tyre Complete History */}
              {selectedTyreForHistory && (
                <div className="space-y-4">
                  {(() => {
                    const lifecycle = getTyreLifecycle(selectedTyreForHistory);
                    return (
                      <>
                        {/* Tyre Summary Header */}
                        <div className="bg-white border-2 border-purple-300 rounded-lg p-4">
                          <div className="flex flex-wrap justify-between items-start">
                            <div>
                              <h3 className="text-2xl font-bold text-gray-900">{selectedTyreForHistory.tyreNumber}</h3>
                              <p className="text-sm text-gray-500">
                                {selectedTyreForHistory.brand || 'No brand'} • {selectedTyreForHistory.size || 'No size'} • 
                                Purchased: {selectedTyreForHistory.purchaseDate || 'N/A'}
                              </p>
                            </div>
                            <div className="flex items-center space-x-4">
                              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedTyreForHistory.status)}`}>
                                {selectedTyreForHistory.status.toUpperCase()}
                              </span>
                              <button
                                onClick={() => exportTyreHistory(selectedTyreForHistory)}
                                className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 flex items-center space-x-1"
                              >
                                <Download className="w-4 h-4" />
                                <span>Export</span>
                              </button>
                              <button
                                onClick={() => setSelectedTyreForHistory(null)}
                                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                          
                          {/* KM Summary */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            <div className="bg-blue-50 rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-blue-600">{lifecycle.totalKm}</div>
                              <div className="text-xs text-blue-700">Total KM Run</div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-green-600">{lifecycle.vehicleHistory.length}</div>
                              <div className="text-xs text-green-700">Vehicles Used</div>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-orange-600">{lifecycle.incidents.length}</div>
                              <div className="text-xs text-orange-700">Total Incidents</div>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-purple-600">
                                {selectedTyreForHistory.currentVehicle || 'None'}
                              </div>
                              <div className="text-xs text-purple-700">Current Vehicle</div>
                            </div>
                          </div>
                        </div>

                        {/* Vehicle History Table */}
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <h4 className="text-lg font-semibold text-gray-800 mb-3">Vehicle Assignment History</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">S.No</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned Date</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Removed Date</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">KM Run</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Removal Reason</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {lifecycle.vehicleHistory.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                                      No vehicle history found.
                                    </td>
                                  </tr>
                                ) : (
                                  lifecycle.vehicleHistory.map((h, idx) => (
                                    <tr key={idx} className={!h.removedDate ? 'bg-green-50' : ''}>
                                      <td className="px-4 py-2 text-gray-600">{idx + 1}</td>
                                      <td className="px-4 py-2 font-medium text-gray-900">{h.vehicleNumber}</td>
                                      <td className="px-4 py-2 text-gray-600">{h.assignedDate}</td>
                                      <td className="px-4 py-2 text-gray-600">
                                        {h.removedDate || <span className="text-green-600 font-medium">Still Fitted</span>}
                                      </td>
                                      <td className="px-4 py-2 font-medium text-blue-600">{h.kmRun} KM</td>
                                      <td className="px-4 py-2">
                                        {h.removalReason ? (
                                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                                            h.removalReason === 'puncture' ? 'bg-orange-100 text-orange-700' :
                                            h.removalReason === 'blast' ? 'bg-red-100 text-red-700' :
                                            h.removalReason === 'cut' ? 'bg-purple-100 text-purple-700' :
                                            h.removalReason === 'transferred' ? 'bg-blue-100 text-blue-700' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                            {h.removalReason.toUpperCase()}
                                          </span>
                                        ) : '-'}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Incidents History Table */}
                        {lifecycle.incidents.length > 0 && (
                          <div className="bg-white rounded-lg border border-orange-200 p-4">
                            <h4 className="text-lg font-semibold text-orange-800 mb-3">Incident History</h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-orange-50">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">S.No</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">KM at Incident</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Replaced With</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {lifecycle.incidents.map((i, idx) => (
                                    <tr key={idx}>
                                      <td className="px-4 py-2 text-gray-600">{idx + 1}</td>
                                      <td className="px-4 py-2 text-gray-600">{i.date}</td>
                                      <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                                          i.type === 'puncture' ? 'bg-orange-100 text-orange-700' :
                                          i.type === 'blast' ? 'bg-red-100 text-red-700' :
                                          'bg-purple-100 text-purple-700'
                                        }`}>
                                          {i.type.toUpperCase()}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-gray-600">{i.vehicleNumber}</td>
                                      <td className="px-4 py-2 text-gray-600">{i.kmAtIncident} KM</td>
                                      <td className="px-4 py-2 text-gray-600">{i.replacedWith || '-'}</td>
                                      <td className="px-4 py-2 text-gray-600">
                                        {i.replacementSource === 'from_vehicle' 
                                          ? `From ${i.replacementFromVehicle}` 
                                          : i.replacementSource === 'available' 
                                          ? 'Stock' 
                                          : '-'}
                                      </td>
                                      <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                                          i.status === 'repaired' ? 'bg-green-100 text-green-700' :
                                          i.status === 'scrapped' ? 'bg-red-100 text-red-700' :
                                          'bg-yellow-100 text-yellow-700'
                                        }`}>
                                          {i.status.toUpperCase()}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {!selectedTyreForHistory && !historyTyreSearch && (
                <div className="text-center text-gray-500 py-12">
                  <History className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">Search for a tyre number to view its complete history</p>
                  <p className="text-sm">Track every vehicle assignment, KM run, and incidents until scrap</p>
                </div>
              )}
            </div>
          )}

          {/* Tyre Report Tab */}
          {activeTab === 'Report' && (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                  <input
                    type="text"
                    value={reportTyreSearch}
                    onChange={(e) => setReportTyreSearch(e.target.value)}
                    placeholder="Search by tyre number..."
                    className="w-full md:w-64 px-3 py-2 border rounded-md"
                  />
                </div>
                <button
                  onClick={exportReport}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Export to Excel</span>
                </button>
              </div>

              <div className="space-y-4">
                {reportFilteredTyres.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No tyres found.</div>
                ) : (
                  reportFilteredTyres.map((tyre) => {
                    const history = assignments.filter(a => a.tyreId === tyre.id);
                    const incidents = incidentRecords.filter(i => i.tyreId === tyre.id);
                    const totalKm = calculateTyreKm(tyre.id);
                    const punctures = incidents.filter(i => i.incidentType === 'puncture').length;
                    const blasts = incidents.filter(i => i.incidentType === 'blast').length;
                    const cuts = incidents.filter(i => i.incidentType === 'cut').length;

                    return (
                      <div key={tyre.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="flex flex-wrap justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">{tyre.tyreNumber}</h3>
                            <p className="text-sm text-gray-500">
                              {tyre.brand || 'No brand'} • {tyre.size || 'No size'} • Purchased: {tyre.purchaseDate || 'N/A'}
                            </p>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(tyre.status)}`}>
                              {tyre.status.toUpperCase()}
                            </span>
                            <div className="text-right">
                              <div className="text-xl font-bold text-blue-600">{totalKm} KM</div>
                              <div className="text-xs text-gray-500">Total KM Run</div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                          <div className="bg-gray-50 rounded p-2 text-center">
                            <div className="font-bold text-gray-800">{history.length}</div>
                            <div className="text-xs text-gray-500">Vehicles</div>
                          </div>
                          <div className="bg-orange-50 rounded p-2 text-center">
                            <div className="font-bold text-orange-600">{punctures}</div>
                            <div className="text-xs text-orange-700">Punctures</div>
                          </div>
                          <div className="bg-red-50 rounded p-2 text-center">
                            <div className="font-bold text-red-600">{blasts}</div>
                            <div className="text-xs text-red-700">Blasts</div>
                          </div>
                          <div className="bg-purple-50 rounded p-2 text-center">
                            <div className="font-bold text-purple-600">{cuts}</div>
                            <div className="text-xs text-purple-700">Cuts</div>
                          </div>
                          <div className="bg-blue-50 rounded p-2 text-center">
                            <div className="font-bold text-blue-600">{tyre.currentVehicle || '-'}</div>
                            <div className="text-xs text-blue-700">Current Vehicle</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
