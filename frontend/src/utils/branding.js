/**
 * Utility to get full image URL from a relative path
 */
export const getFullImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const baseUrl = import.meta.env.VITE_API_URL || 'https://api.fueltracks.in';
  return `${baseUrl}${url}`;
};

/**
 * Generate a dynamic SVG favicon from initials and brand primary color
 */
export const generateInitialsFavicon = (name, primaryColor = '#0284C7') => {
  if (!name) return null;
  const cleanName = String(name).trim();
  const initials = cleanName
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || cleanName.slice(0, 2).toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="14" fill="${primaryColor}"/>
    <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="28" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/**
 * Utility to apply dynamic white-label favicon and browser tab title
 */
export function applyBrowserBranding(profile) {
  if (!profile) return;

  // 1. Dynamic Favicon
  const rawFavicon = profile.favicon_url || profile.logo_url;
  let faviconUrl = rawFavicon ? getFullImageUrl(rawFavicon) : null;

  const brandName = (profile.brand_name || profile.org_name || '').trim();
  const isFuelTracksBrand = !brandName || 
    ['FUELTRACKS', 'FUELTRACKS PLATFORM'].includes(brandName.toUpperCase());

  // If dealer profile but no uploaded image, fallback to generated initials icon instead of FuelTracks fueldrop
  if (!faviconUrl && !isFuelTracksBrand) {
    faviconUrl = generateInitialsFavicon(brandName, profile.primary_color || '#0284C7');
  } else if (!faviconUrl && isFuelTracksBrand) {
    faviconUrl = '/fuelimage.png';
  }

  if (faviconUrl) {
    // Remove existing favicon links to force browser re-fetch in Chrome
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach(el => el.parentNode && el.parentNode.removeChild(el));

    // Fresh <link rel="icon">
    const link = document.createElement('link');
    link.rel = 'icon';
    if (faviconUrl.startsWith('data:image/svg') || faviconUrl.endsWith('.svg')) {
      link.type = 'image/svg+xml';
    } else if (faviconUrl.endsWith('.ico')) {
      link.type = 'image/x-icon';
    } else {
      link.type = 'image/png';
    }
    link.href = faviconUrl;
    document.head.appendChild(link);

    // Fresh <link rel="shortcut icon">
    const shortcutLink = document.createElement('link');
    shortcutLink.rel = 'shortcut icon';
    shortcutLink.href = faviconUrl;
    document.head.appendChild(shortcutLink);
  }

  // 2. Dynamic Browser Title
  document.title = brandName
    ? `${brandName} — Fleet Telematics`
    : 'Fleet Management Portal';

  // 3. Dynamic Root Theme Colors
  if (profile.primary_color) {
    document.documentElement.style.setProperty('--brand-primary', profile.primary_color);
    document.documentElement.style.setProperty('--primary', profile.primary_color);
  }
  if (profile.secondary_color) {
    document.documentElement.style.setProperty('--brand-secondary', profile.secondary_color);
    document.documentElement.style.setProperty('--brand-topbar', profile.secondary_color);
  }
}
