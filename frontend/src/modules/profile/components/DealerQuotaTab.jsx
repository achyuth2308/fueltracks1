import React from 'react';
import {
  Layers, ShieldCheck, Truck, Sparkles, ArrowUpRight, AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';

const DealerQuotaTab = ({ license, dealerStats, profile }) => {
  const limits = license?.limits || { Starter: 0, Basic: 0, Advanced: 0, Premium: 0 };
  const usedTiers = license?.usedTiers || { Starter: 0, Basic: 0, Advanced: 0, Premium: 0 };

  const totalAllocated = Object.values(limits).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
  const totalUsed = Object.values(usedTiers).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0) || (parseInt(dealerStats?.total_vehicles_count, 10) || 0);
  const totalAvailable = Math.max(0, totalAllocated - totalUsed);
  const utilizationPercent = totalAllocated > 0 ? Math.min(100, Math.round((totalUsed / totalAllocated) * 100)) : 0;

  const tiers = [
    { key: 'Starter', label: 'Starter Tier (OBD / Basic GPS Trackers)', color: 'bg-emerald-500', barColor: 'from-emerald-400 to-emerald-600' },
    { key: 'Basic', label: 'Basic Telematics & Fleet Monitoring Tier', color: 'bg-sky-500', barColor: 'from-sky-400 to-sky-600' },
    { key: 'Advanced', label: 'Advanced Fuel Level & Ultrasonic Sensor Tier', color: 'bg-purple-500', barColor: 'from-purple-400 to-purple-600' },
    { key: 'Premium', label: 'Enterprise Mining & Heavy Telematics Tier', color: 'bg-indigo-500', barColor: 'from-indigo-400 to-indigo-600' }
  ];

  return (
    <div className="flex flex-col gap-6 w-full pb-20">
      {/* 3 Core License Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-black uppercase tracking-wider block" style={{ color: '#0F172A' }}>Total Licenses Issued</span>
            <div className="text-3xl font-black mt-1" style={{ color: '#0F172A' }}>{totalAllocated}</div>
            <span className="text-xs font-bold mt-0.5 inline-block" style={{ color: '#475569' }}>Combined Hardware Quota</span>
          </div>
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-black uppercase tracking-wider block" style={{ color: '#0F172A' }}>Licenses In Use</span>
            <div className="text-3xl font-black mt-1" style={{ color: '#0F172A' }}>{totalUsed}</div>
            <span className="text-xs text-emerald-700 font-extrabold mt-0.5 inline-block">Active Tracked Vehicles</span>
          </div>
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xs">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-black uppercase tracking-wider block" style={{ color: '#0F172A' }}>Available Balance</span>
            <div className={`text-3xl font-black mt-1 ${totalAvailable > 0 ? 'text-emerald-700' : 'text-slate-900'}`}>{totalAvailable}</div>
            <span className="text-xs font-bold mt-0.5 inline-block" style={{ color: '#475569' }}>{utilizationPercent}% Quota Consumed</span>
          </div>
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xs">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* License Tier Capacity & Quota Breakdown */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
              <Layers className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wide m-0" style={{ color: '#0F172A' }}>License Tier Allocations</h3>
              <p className="text-xs text-slate-600 font-semibold m-0 mt-0.5">Hardware slot limits provisioned across subscription categories</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to="/admin/devices"
              className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded-2xl flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <span>Manage Devices</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
            </Link>
            <Link
              to="/admin/organizations"
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <span>View Customer Fleets</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300" />
            </Link>
          </div>
        </div>

        {/* Quota Progress Rows */}
        <div className="space-y-4">
          {tiers.map(tier => {
            const limit = parseInt(limits[tier.key] || 0, 10);
            const used = parseInt(usedTiers[tier.key] || 0, 10);
            const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : (used > 0 ? 100 : 0);
            const isNearLimit = limit > 0 && (used / limit) >= 0.9;

            return (
              <div key={tier.key} className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex flex-col gap-3 hover:border-slate-300 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-3.5 h-3.5 rounded-full ${tier.color} shadow-xs`} />
                    <span className="text-xs font-black text-slate-900" style={{ color: '#0F172A' }}>{tier.label}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                    <span>Used: <strong className="text-slate-900 font-bold" style={{ color: '#0F172A' }}>{used}</strong></span>
                    <span>/</span>
                    <span>Quota: <strong className="text-slate-900 font-bold" style={{ color: '#0F172A' }}>{limit > 0 ? limit : '0'}</strong></span>
                    <span>•</span>
                    <span className={`font-extrabold ${limit > 0 && limit - used > 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {limit > 0 ? `${Math.max(0, limit - used)} Available` : 'No Quota'}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${tier.barColor} transition-all duration-700`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DealerQuotaTab;
