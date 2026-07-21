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

export const getVehicleExpiryStatus = (expireDateStr, issuedDateStr = null, metadata = null) => {
  if (!expireDateStr) {
    return { type: 'unknown', text: 'Unknown', isExpiring: false, isExpired: false, diffDays: null, durationMonths: 12, thresholdDays: 30 };
  }

  try {
    const exp = new Date(expireDateStr);
    const now = new Date();
    exp.setHours(0, 0, 0, 0);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((exp - today) / (1000 * 60 * 60 * 24));

    let durationMonths = 12;
    if (metadata && metadata.plan_duration_months) {
      durationMonths = parseInt(metadata.plan_duration_months, 10) || 12;
    } else if (issuedDateStr && expireDateStr) {
      const iss = new Date(issuedDateStr);
      const totalDays = Math.round((exp - iss) / (1000 * 60 * 60 * 24));
      durationMonths = totalDays >= 180 ? 12 : 1;
    }

    const thresholdDays = durationMonths >= 6 ? 30 : 7;

    if (diffDays < 0) {
      return {
        type: 'expired',
        text: 'Expired',
        isExpired: true,
        isExpiring: true,
        diffDays,
        durationMonths,
        thresholdDays
      };
    } else if (diffDays <= thresholdDays) {
      return {
        type: 'expiring',
        text: `Expiring in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
        isExpired: false,
        isExpiring: true,
        diffDays,
        durationMonths,
        thresholdDays
      };
    } else {
      return {
        type: 'active',
        text: 'Active',
        isExpired: false,
        isExpiring: false,
        diffDays,
        durationMonths,
        thresholdDays
      };
    }
  } catch (err) {
    return { type: 'unknown', text: 'Unknown', isExpiring: false, isExpired: false, diffDays: null, durationMonths: 12, thresholdDays: 30 };
  }
};

