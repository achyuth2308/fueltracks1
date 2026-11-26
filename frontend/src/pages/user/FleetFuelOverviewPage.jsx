import React from 'react';
import { Fuel, ArrowLeft, Droplets, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ManualFuelDashboardSection from '../../components/fuel/ManualFuelDashboardSection';

/**
 * FleetFuelOverviewPage
 * Dedicated page for fleet-wide manual fuel monitoring, telemetry estimates, and mileage tracking.
 */
const FleetFuelOverviewPage = () => {
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto min-h-screen">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <button
              onClick={() => navigate('/dashboard')}
              className="hover:text-slate-800 transition-colors cursor-pointer flex items-center gap-1"
            >
              <ArrowLeft size={13} />
              <span>Dashboard</span>
            </button>
            <span>/</span>
            <span className="text-orange-600 font-bold">Non-Sensor Fuel</span>
            <span>/</span>
            <span className="text-slate-800 font-bold">Fuel Overview</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
              <Fuel size={20} />
            </div>
            <span>Non-Sensor Fuel Monitoring & Mileage</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Monitor estimated fuel levels, refills, consumption, and computed vehicle mileage across your entire fleet.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/fuel-report')}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-xs shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <FileText size={14} className="text-orange-600" />
            <span>Fuel Report</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/fuel-entry')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Droplets size={15} />
            <span>+ Log Fuel Entry</span>
          </button>
        </div>
      </div>

      {/* Main Fleet Fuel Overview Section */}
      <ManualFuelDashboardSection />
    </div>
  );
};

export default FleetFuelOverviewPage;
