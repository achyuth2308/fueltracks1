/**
 * Utility to apply dynamic white-label favicon and browser tab title
 */
export function applyBrowserBranding(profile) {
  if (!profile) return;

  // 1. Dynamic Favicon
  const faviconUrl = profile.favicon_url || profile.logo_url;
  if (faviconUrl) {
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    if (existingLinks.length > 0) {
      existingLinks.forEach(link => {
        link.href = faviconUrl;
      });
    } else {
      const link = document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = faviconUrl;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }

  // 2. Dynamic Browser Title
  if (profile.brand_name) {
    document.title = `${profile.brand_name} — Fleet Telematics`;
  }

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
