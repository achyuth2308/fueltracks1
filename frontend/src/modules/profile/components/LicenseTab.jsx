import React, { useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';

const SectionHeader = ({ icon: Icon, title, description, extra, tint = 'bg-teal-50', iconColor = 'text-teal-600' }) => (
  <div className={`mb-5 pb-4 border-b border-[#E5E7EB] ${tint} -mx-[24px] px-[24px] -mt-[24px] pt-[24px] rounded-t-[14px] flex items-center justify-between`}>
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2.5 bg-white rounded-xl shadow-sm flex items-center justify-center">
          <Icon className={`w-[22px] h-[22px] ${iconColor}`} />
        </div>
        <h3 className="text-[20px] font-semibold !text-black m-0">{title}</h3>
      </div>
      <p className="text-[14px] !text-black m-0 pl-[52px]">{description}</p>
    </div>
    {extra && <div className="mt-1">{extra}</div>}
  </div>
);

const LicenseTab = ({ license }) => {
  if (!license) return <div className="p-6 !text-black">Loading license information...</div>;

  // Determine default selected tier (the active tier, or the first one with a non-zero limit, or 'Basic')
  const defaultTier = license.type || 'Basic';
  const [selectedTier, setSelectedTier] = useState(defaultTier);

  // Compute stats dynamically based on the selected tier
  const total = parseInt(license.limits?.[selectedTier] || 0, 10);
  const used = parseInt(license.usedTiers?.[selectedTier] || 0, 10);
  const available = Math.max(0, total - used);
  const usagePercentage = total > 0 ? Math.round((used / total) * 100) : 0;
  const isNearLimit = usagePercentage >= 90;

  return (
    <div className="w-full relative pb-[100px]">
      <div className="w-full flex flex-col gap-[20px]">

        {/* License Details Card */}
        <div className="bg-[#FFFFFF] p-[24px] pt-0 rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
          <SectionHeader
            icon={Shield}
            title="License & Usage"
            description="Manage your enterprise subscription limits and allocations."
            extra={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>License Tier:</span>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0F766E',
                    background: '#FFFFFF',
                    border: '1px solid #99F6E4',
                    borderRadius: '8px',
                    outline: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <option value="Starter">Starter Tier ({license.limits?.Starter || 0})</option>
                  <option value="Basic">Basic Tier ({license.limits?.Basic || 0})</option>
                  <option value="Advanced">Advanced Tier ({license.limits?.Advanced || 0})</option>
                  <option value="Premium">Premium Tier ({license.limits?.Premium || 0})</option>
                </select>
              </div>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px] mb-8 mt-[24px]">
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] p-5 text-center shadow-sm">
              <p className="text-[13px] font-semibold !text-black mb-1">Total Allocated</p>
              <p className="text-[32px] font-bold !text-black">{total}</p>
              <p className="text-[12px] font-medium !text-black mt-1">Vehicles / Devices</p>
            </div>
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] p-5 text-center shadow-sm">
              <p className="text-[13px] font-semibold !text-black mb-1">Used Slots</p>
              <p className="text-[32px] font-bold !text-black">{used}</p>
              <p className="text-[12px] font-medium !text-black mt-1">Active Vehicles</p>
            </div>
            <div className={`border rounded-[10px] p-5 text-center shadow-sm ${available > 0 ? 'bg-[#ECFDF5] border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-[13px] font-semibold mb-1 ${available > 0 ? 'text-[#16A34A]' : 'text-red-700'}`}>Available</p>
              <p className={`text-[32px] font-bold ${available > 0 ? 'text-[#16A34A]' : 'text-red-600'}`}>{available}</p>
              <p className={`text-[12px] font-medium mt-1 ${available > 0 ? 'text-[#16A34A]' : 'text-red-700'}`}>Remaining Slots</p>
            </div>
          </div>

          <div className="mb-2">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[15px] font-semibold !text-black">Capacity Usage</span>
              <span className="text-[15px] font-bold !text-black">{usagePercentage}%</span>
            </div>
            <div className="w-full bg-[#E5E7EB] rounded-full h-[12px] shadow-inner overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ease-out ${isNearLimit ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-teal-500 to-teal-400'}`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              ></div>
            </div>
            {isNearLimit && (
              <div className="mt-4 flex items-start text-red-700 text-[14px] bg-red-50 p-4 rounded-[10px] border border-red-100 shadow-sm font-medium">
                <AlertTriangle className="w-[18px] h-[18px] mr-2.5 mt-0.5 flex-shrink-0" />
                <p className="m-0 leading-relaxed">You are approaching your license limit. Please contact support to upgrade your plan before adding new vehicles to the system.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default LicenseTab;