export const formatLocalTime = (isoString) => {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch (err) {
    return 'N/A';
  }
};

export const formatLocalDate = (isoString) => {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString();
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
