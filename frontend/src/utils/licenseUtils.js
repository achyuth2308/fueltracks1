export const LICENSE_TIER_PREFIXES = {
  'Standard': 'BC',
  'Standard Pro': 'ST',
  'Advanced': 'AD',
  'Premium': 'EN',
  // Backward compatibility aliases
  'Basic': 'BC',
  'Starter': 'ST'
};

/**
 * Returns the license tier ('Standard' | 'Standard Pro' | 'Advanced' | 'Premium' | 'Other') for a vehicle.
 * Seamlessly maps existing production data (BC / Basic -> Standard, ST / Starter -> Standard Pro).
 */
export const getVehicleLicenseTier = (v) => {
  if (!v) return 'Other';
  const meta = v.metadata || {};

  // 1. Explicit licenceType check (case-insensitive)
  const explicitType = (meta.licenceType || v.licenceType || v.licence_type || '').trim().toLowerCase();
  if (
    explicitType === 'standard pro' ||
    explicitType === 'starter' ||
    explicitType.includes('starter') ||
    explicitType.includes('standard pro')
  ) {
    return 'Standard Pro';
  }
  if (
    explicitType === 'standard' ||
    explicitType === 'basic' ||
    explicitType.includes('basic') ||
    explicitType.includes('standard')
  ) {
    return 'Standard';
  }
  if (explicitType === 'advanced' || explicitType.includes('advanced')) {
    return 'Advanced';
  }
  if (explicitType === 'premium' || explicitType.includes('premium') || explicitType.includes('enterprise')) {
    return 'Premium';
  }

  // 2. Licence ID prefix check:
  // BC = Standard (formerly Basic)
  // ST = Standard Pro (formerly Starter)
  // AD = Advanced
  // EN / PR = Premium
  const licId = String(v.licenceId || meta.licenceId || v.licence_no || meta.licenceNo || '').trim().toUpperCase();
  if (licId.startsWith('ST')) return 'Standard Pro';
  if (licId.startsWith('BC')) return 'Standard';
  if (licId.startsWith('AD')) return 'Advanced';
  if (licId.startsWith('EN') || licId.startsWith('PR')) return 'Premium';

  return 'Other';
};

/**
 * Normalizes any tier query / filter parameter ('Basic', 'Standard', 'Starter', 'Standard Pro', etc.)
 * to canonical display name.
 */
export const normalizeTierName = (tier) => {
  if (!tier || tier === 'all') return 'all';
  const t = String(tier).trim().toLowerCase();
  if (t === 'starter' || t === 'standard pro' || t === 'standardpro' || t === 'standard_pro') {
    return 'Standard Pro';
  }
  if (t === 'basic' || t === 'standard') {
    return 'Standard';
  }
  if (t === 'advanced') {
    return 'Advanced';
  }
  if (t === 'premium' || t === 'enterprise') {
    return 'Premium';
  }
  return tier;
};
