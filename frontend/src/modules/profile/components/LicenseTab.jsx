import React from 'react';
import { Shield, CheckCircle, AlertTriangle, CreditCard, Activity, ArrowUpRight } from 'lucide-react';

const SectionHeader = ({ icon: Icon, title, description, extra, tint = 'bg-teal-50', iconColor = 'text-teal-600' }) => (
  <div className={`mb-5 pb-4 border-b border-[#E5E7EB] ${tint} -mx-[24px] px-[24px] -mt-[24px] pt-[24px] rounded-t-[14px] flex items-start justify-between`}>
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

  const usagePercentage = Math.round((license.used / license.total) * 100);
  const isNearLimit = usagePercentage >= 90;

  return (
    <div className="flex flex-col lg:flex-row gap-[20px] items-start w-full relative pb-[100px]">

      {/* Main Content Area (~68% of the remaining 80% page space) */}
      <div className="w-full lg:w-[68%] flex flex-col gap-[20px]">

        {/* License Details Card */}
        <div className="bg-[#FFFFFF] p-[24px] pt-0 rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
          <SectionHeader
            icon={Shield}
            title="License & Usage"
            description="Manage your enterprise subscription limits and allocations."
            extra={
              <span className="px-3.5 py-1.5 bg-white text-teal-700 text-[13px] font-bold rounded-full border border-teal-200 shadow-sm">
                {license.type} Tier
              </span>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px] mb-8 mt-[24px]">
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] p-5 text-center shadow-sm">
              <p className="text-[13px] font-semibold !text-black mb-1">Total Allocated</p>
              <p className="text-[32px] font-bold !text-black">{license.total}</p>
              <p className="text-[12px] font-medium !text-black mt-1">Vehicles / Devices</p>
            </div>
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] p-5 text-center shadow-sm">
              <p className="text-[13px] font-semibold !text-black mb-1">Used Slots</p>
              <p className="text-[32px] font-bold !text-black">{license.used}</p>
              <p className="text-[12px] font-medium !text-black mt-1">Active Vehicles</p>
            </div>
            <div className={`border rounded-[10px] p-5 text-center shadow-sm ${license.available > 0 ? 'bg-[#ECFDF5] border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-[13px] font-semibold mb-1 ${license.available > 0 ? 'text-[#16A34A]' : 'text-red-700'}`}>Available</p>
              <p className={`text-[32px] font-bold ${license.available > 0 ? 'text-[#16A34A]' : 'text-red-600'}`}>{license.available}</p>
              <p className={`text-[12px] font-medium mt-1 ${license.available > 0 ? 'text-[#16A34A]' : 'text-red-700'}`}>Remaining Slots</p>
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

        {/* Subscription Info Card */}
        <div className="bg-[#FFFFFF] p-[24px] pt-0 rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
          <SectionHeader icon={CreditCard} title="Subscription Plan" description="Billing and subscription renewal details." />

          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] p-5 flex items-start gap-4 mt-[24px] shadow-sm">
            <div className="p-2 bg-[#ECFDF5] rounded-xl mt-0.5 shrink-0 border border-green-100">
              <CheckCircle className="w-[20px] h-[20px] text-[#16A34A]" />
            </div>
            <div>
              <h4 className="text-[16px] font-bold !text-black m-0 mb-1">Subscription Active</h4>
              <p className="text-[14px] !text-black font-medium leading-relaxed m-0">
                Your FuelTracks enterprise license is fully active and automatically renewing on the 1st of every month. Modifications to your tier or payment methods must be performed by your dedicated account manager.
              </p>

              <button className="mt-4 flex items-center text-[14px] font-bold text-[#FF6A00] hover:text-[#E65C00] transition-colors group">
                Contact Account Manager <ArrowUpRight className="w-4 h-4 ml-1 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Right Information Panel (~32% of the remaining 80% page space) */}
      <div className="w-full lg:w-[32%] flex-shrink-0">
        <div className="bg-[#FFFFFF] p-[24px] rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow sticky top-[24px]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-teal-50 -mx-[24px] px-[24px] -mt-[24px] pt-[20px] bg-teal-50 rounded-t-[14px]">
            <div className="p-1.5 bg-white rounded-lg shadow-sm">
              <Activity className="w-[18px] h-[18px] text-teal-600" />
            </div>
            <h3 className="text-[16px] font-semibold !text-black m-0">Included Features</h3>
          </div>

          <div className="space-y-3.5 mt-[20px]">
            {[
              'Unlimited Admin Users',
              'Advanced Telematics',
              'API Access (50k req/mo)',
              'Custom Domain',
              'White-label Branding',
              '24/7 Priority Support'
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="p-1 rounded-full bg-[#ECFDF5]">
                  <CheckCircle className="w-[14px] h-[14px] text-[#16A34A]" />
                </div>
                <span className="text-[14px] font-medium !text-black">{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-[#E5E7EB]">
            <p className="text-[13px] font-medium !text-black leading-relaxed">
              Need more capacity? Enterprise agreements can be scaled instantly without downtime.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LicenseTab;