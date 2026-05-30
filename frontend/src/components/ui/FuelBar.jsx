import React from 'react';

const FuelBar = ({ fuelPct, className = '' }) => {
  const roundedFuel = Math.min(100, Math.max(0, fuelPct || 0));
  
  let barColor = 'bg-green-500';
  let textColor = 'text-green-400';
  let glow = 'shadow-[0_0_8px_rgba(34,197,94,0.3)]';

  if (roundedFuel < 20) {
    barColor = 'bg-red-500 animate-pulse';
    textColor = 'text-red-400 font-bold';
    glow = 'shadow-[0_0_8px_rgba(239,68,68,0.5)]';
  } else if (roundedFuel < 50) {
    barColor = 'bg-amber-500';
    textColor = 'text-amber-400';
    glow = 'shadow-[0_0_8px_rgba(245,158,11,0.3)]';
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="text-slate-400 font-medium">Fuel Level</span>
        <span className={`${textColor} font-semibold`}>{roundedFuel.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
        <div 
          className={`h-full ${barColor} ${glow} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${roundedFuel}%` }}
        />
      </div>
    </div>
  );
};

export default FuelBar;
