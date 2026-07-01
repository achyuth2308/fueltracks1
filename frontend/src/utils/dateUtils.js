export const formatLocalTime = (isoString) => {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'N/A';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${d}-${m}-${y} ${h}:${min}:${s}`;
  } catch (err) {
    return 'N/A';
  }
};

export const formatLocalDate = (isoString) => {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'N/A';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  } catch (err) {
    return 'N/A';
  }
};

export const getRelativeTime = (isoString) => {
  if (!isoString) return 'Never';
  try {
    const now = new Date();
    const then = new Date(isoString);
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDays}d ago`;
  } catch (err) {
    return 'N/A';
  }
};

export const getNoDataDuration = (isoString) => {
  if (!isoString) return null;
  try {
    const now = new Date();
    const then = new Date(isoString);
    const diffMs = now - then;
    if (diffMs < 0) return null;
    
    // We consider it offline if > 5 minutes
    if (diffMs < 5 * 60 * 1000) return null;

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60) % 60;
    const diffHr = Math.floor(diffSec / 3600) % 24;
    const diffDays = Math.floor(diffSec / 86400);

    let parts = [];
    if (diffDays > 0) parts.push(`${diffDays}D`);
    if (diffHr > 0 || diffDays > 0) parts.push(`${diffHr.toString().padStart(2, '0')}H`);
    parts.push(`${diffMin.toString().padStart(2, '0')}M`);

    return parts.join(':');
  } catch (err) {
    return null;
  }
};
