import React, { useState } from 'react';
import {
  Shield, AlertTriangle, Layers, Cpu, CheckCircle2,
  TrendingUp, Sparkles, Truck, BarChart3
} from 'lucide-react';

const SectionHeader = ({ icon: Icon, title, description, extra }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-100">
    <div className="flex items-center gap-3.5">
      <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
        <Icon className="w-5 h-5 stroke-[2.2]" />
      </div>
      <div>
        <h3 className="text-base font-black uppercase tracking-wide m-0" style={{ color: '#0F172A' }}>{title}</h3>
        <p className="text-xs text-slate-600 font-semibold m-0 mt-0.5">{description}</p>
      </div>
    </div>
    {extra && <div>{extra}</div>}
  </div>
);

const LicenseTab = ({ license, profile }) => {
  const primaryColor = profile?.primary_color || '#0284C7';

  if (!license) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
        <span className="text-xs font-bold text-slate-500">Loading organization license and capacity allocations...</span>
      </div>
    );
  }

  const defaultTier = license.type || 'Basic';
  const [selectedTier, setSelectedTier] = useState(defaultTier);

  const total = parseInt(license.limits?.[selectedTier] || 0, 10);
  const used = parseInt(license.usedTiers?.[selectedTier] || 0, 10);
  const available = Math.max(0, total - used);
  const usagePercentage = total > 0 ? Math.round((used / total) * 100) : 0;
  const isNearLimit = usagePercentage >= 90;

  const tiers = [
    { key: 'Starter', label: 'Starter Tier (OBD / Basic GPS)', color: 'bg-emerald-500' },
    { key: 'Basic', label: 'Basic Telematics & Fleet Tracking', color: 'bg-sky-500' },
    { key: 'Advanced', label: 'Advanced Fuel Level & Ultrasonic Sensors', color: 'bg-purple-500' },
    { key: 'Premium', label: 'Enterprise Mining & Heavy Telemetry', color: 'bg-indigo-500' }
  ];

  return (
    <div className="flex flex-col gap-6 w-full pb-28">
      {/* License Overview & Interactive Tier Capacity */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
        <SectionHeader
          icon={Shield}
          title="License Tier Capacity & Hardware Allocations"
          description="Hardware limits and telemetry device allowances provisioned by your partner dealership"
          extra={
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inspect Tier:</span>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="h-10 px-3.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:bg-white cursor-pointer"
              >
                <option value="Starter">Starter Tier ({license.limits?.Starter || 0})</option>
                <option value="Basic">Basic Tier ({license.limits?.Basic || 0})</option>
                <option value="Advanced">Advanced Tier ({license.limits?.Advanced || 0})</option>
                <option value="Premium">Premium Tier ({license.limits?.Premium || 0})</option>
              </select>
            </div>
          }
        />

        {/* 3 Metric Summary Cards for Selected Tier */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-7">
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 block mb-1">Total Allocated</span>
            <div className="text-3xl font-black text-slate-900">{total}</div>
            <span className="text-xs text-slate-500 font-semibold mt-1 block">Vehicles / Hardware slots</span>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 block mb-1">Used Slots</span>
            <div className="text-3xl font-black" style={{ color: primaryColor }}>{used}</div>
            <span className="text-xs text-slate-500 font-semibold mt-1 block">Active provisioned units</span>
          </div>

          <div className={`border rounded-2xl p-5 shadow-2xs ${available > 0 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-red-50/60 border-red-200'}`}>
            <span className={`text-[10.5px] font-black uppercase tracking-wider block mb-1 ${available > 0 ? 'text-emerald-700' : 'text-red-700'}`}>Available</span>
            <div className={`text-3xl font-black ${available > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{available}</div>
            <span className="text-xs text-slate-600 font-semibold mt-1 block">Remaining device quota</span>
          </div>
        </div>

        {/* Capacity Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
              {selectedTier} Tier Utilization Rate
            </span>
            <span className="text-xs font-black text-slate-900">{usagePercentage}%</span>
          </div>

          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200/70">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isNearLimit
                  ? 'bg-red-500'
                  : 'bg-emerald-500'
              }`}
              style={!isNearLimit ? { backgroundColor: primaryColor, width: `${Math.min(usagePercentage, 100)}%` } : { width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>

          {isNearLimit && (
            <div className="mt-4 flex items-start text-red-700 text-xs bg-red-50 p-4 rounded-2xl border border-red-200 font-semibold gap-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>You are approaching your allocated vehicle quota. Please reach out to your partner dealership to provision additional slots.</span>
            </div>
          )}
        </div>
      </div>

      {/* All License Tiers Breakdown */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
        <SectionHeader
          icon={Layers}
          title="Complete License Tier Portfolio"
          description="Summary breakdown of active hardware quotas across all subscription categories"
        />

        <div className="space-y-4">
          {tiers.map(tier => {
            const tLimit = parseInt(license.limits?.[tier.key] || 0, 10);
            const tUsed = parseInt(license.usedTiers?.[tier.key] || 0, 10);
            const tPercent = tLimit > 0 ? Math.min(100, Math.round((tUsed / tLimit) * 100)) : 0;

            return (
              <div key={tier.key} className="p-4.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-3.5 h-3.5 rounded-full ${tier.color} shadow-xs`} />
                    <span className="text-xs font-black text-slate-900">{tier.label}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                    <span>Used: <strong className="text-slate-900 font-bold">{tUsed}</strong></span>
                    <span>/</span>
                    <span>Limit: <strong className="text-slate-900 font-bold">{tLimit > 0 ? tLimit : '0'}</strong></span>
                  </div>
                </div>

                <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${tier.color} transition-all duration-700`}
                    style={{ width: `${tLimit > 0 ? tPercent : (tUsed > 0 ? 100 : 0)}%` }}
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

export default LicenseTab;