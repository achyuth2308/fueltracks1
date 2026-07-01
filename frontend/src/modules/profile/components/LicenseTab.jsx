import React from 'react';
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';

const LicenseTab = ({ license }) => {
  if (!license) return <div className="p-6">Loading license information...</div>;

  const usagePercentage = Math.round((license.used / license.total) * 100);
  const isNearLimit = usagePercentage >= 90;

  return (
    <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200">
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <div className="flex items-center">
          <Shield className="w-6 h-6 text-[#f97316] mr-2" />
          <h3 className="text-xl font-bold" style={{ color: '#000000', margin: 0 }}>License Information</h3>
        </div>
        <span className="px-3 py-1 bg-[#f0f9ff] text-[#f97316] text-sm font-semibold rounded-full border border-[#bae6fd]">
          {license.type} Tier
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5 text-center shadow-sm">
          <p className="text-sm font-bold mb-1" style={{ color: '#000000' }}>Total Allocated</p>
          <p className="text-3xl font-extrabold" style={{ color: '#000000' }}>{license.total}</p>
          <p className="text-xs mt-1" style={{ color: "#000000", margin: 0 }}>Vehicles / Devices</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 text-center shadow-sm">
          <p className="text-sm font-bold mb-1" style={{ color: '#000000' }}>Used</p>
          <p className="text-3xl font-extrabold" style={{ color: '#000000' }}>{license.used}</p>
          <p className="text-xs mt-1" style={{ color: "#000000", margin: 0 }}>Active Vehicles</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 text-center shadow-sm">
          <p className="text-sm font-bold mb-1" style={{ color: '#000000' }}>Available</p>
          <p className={`text-3xl font-extrabold ${license.available > 0 ? 'text-green-600' : 'text-red-600'}`}>{license.available}</p>
          <p className="text-xs mt-1" style={{ color: "#000000", margin: 0 }}>Remaining Slots</p>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-bold" style={{ color: '#000000' }}>Capacity Usage</span>
          <span className="text-sm font-extrabold" style={{ color: '#000000' }}>{usagePercentage}%</span>
        </div>
        <div className="w-full bg-orange-50 rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full ${isNearLimit ? 'bg-red-500' : 'bg-[#f97316]'}`} 
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          ></div>
        </div>
        {isNearLimit && (
          <div className="mt-3 flex items-start text-red-600 text-sm">
            <AlertTriangle className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" />
            <p>You are approaching your license limit. Please contact support to upgrade your plan before adding new vehicles.</p>
          </div>
        )}
      </div>

      <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 flex items-start mt-6">
        <CheckCircle className="w-5 h-5 text-orange-500 mr-3 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold" style={{ color: '#000000' }}>Subscription Active</h4>
          <p className="text-xs font-medium mt-1" style={{ color: '#000000' }}>Your FuelTracks enterprise license is fully active and automatically renewing. Modifications to your tier must be performed by your account manager.</p>
        </div>
      </div>
    </div>
  );
};

export default LicenseTab;
