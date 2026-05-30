import React from 'react';

const StatusBadge = ({ isOnline, className = '' }) => {
  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
      isOnline 
        ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
        : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
    } ${className}`}>
      <span className={`w-2 h-2 rounded-full mr-1.5 ${
        isOnline ? 'bg-green-500 pulse-green' : 'bg-slate-400'
      }`} />
      {isOnline ? 'Online' : 'Offline'}
    </div>
  );
};

export default StatusBadge;
