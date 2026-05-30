import React from 'react';

const SpeedGauge = ({ speed, maxSpeed = 120, className = '' }) => {
  const currentSpeed = Math.min(maxSpeed, Math.max(0, speed || 0));
  const percentage = currentSpeed / maxSpeed;
  
  // SVG arc calculations
  const radius = 50;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  // Make it a 3/4 circle gauge (270 degrees)
  const angleRange = 270;
  const strokeDasharray = (circumference * angleRange) / 360;
  const strokeDashoffset = strokeDasharray - (strokeDasharray * percentage);

  let gaugeColor = 'stroke-blue-500';
  let speedTextColor = 'text-slate-100';

  if (currentSpeed > 80) {
    gaugeColor = 'stroke-red-500';
    speedTextColor = 'text-red-400 font-bold';
  } else if (currentSpeed > 50) {
    gaugeColor = 'stroke-amber-500';
    speedTextColor = 'text-amber-400';
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative w-36 h-36">
        <svg className="w-full h-full transform -rotate-225" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            className="stroke-slate-800 fill-none"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
          />
          {/* Active speed track */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            className={`${gaugeColor} fill-none gauge-path`}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        
        {/* Speed Label inside gauge */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center mt-2">
          <span className={`text-3xl font-bold tracking-tight ${speedTextColor}`}>
            {currentSpeed}
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
            km/h
          </span>
        </div>
      </div>
    </div>
  );
};

export default SpeedGauge;
