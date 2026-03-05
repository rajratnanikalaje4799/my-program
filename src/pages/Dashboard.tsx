import { useState, useEffect } from 'react';
import { storage } from '../utils/storage';
import { Logsheet } from '../types';
import { Calendar, Activity } from 'lucide-react';

export function Dashboard() {
  const [logsheets, setLogsheets] = useState<Logsheet[]>([]);

  useEffect(() => {
    setLogsheets(storage.getLogsheets());
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Depot Overview</h1>
          <p className="text-gray-500 text-sm mt-1">Manage and track your vehicle operations based on Schedule Data</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-500" />
            Recent Logsheets
          </h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full">
            {logsheets.length} Total Records
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center">
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Logsheets Processed</span>
            <span className="text-4xl font-bold text-blue-600">{logsheets.length}</span>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center">
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Today's Submissions</span>
            <span className="text-4xl font-bold text-green-500">
              {logsheets.filter(log => log.date === new Date().toISOString().split('T')[0]).length}
            </span>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center">
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Data Status</span>
            <div className="flex items-center text-green-600 mt-2">
              <Activity className="w-6 h-6 mr-2" />
              <span className="font-semibold">Secured in Backend</span>
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 text-center text-gray-400 text-sm">
          <p>Detailed recent log data is strictly preserved in the backend storage system and hidden from the dashboard view.</p>
        </div>
      </div>
    </div>
  );
}
