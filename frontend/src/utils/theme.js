// Global Telematics Theme Management System - Concept 1: "Linear Studio"
// Controls synchronous styling across Navbar (Topbar), Sidebar, Tables, and Page Elements

export const SIDEBAR_THEMES = [
  {
    id: 'orange',
    name: 'FuelTracks Amber',
    primary: '#F97316',
    primaryDark: '#EA580C',
    accent: '#FB923C',
    activeBg: '#FFF7ED',
    activeText: '#C2410C',
    activeBorder: '#EA580C',
    activeGlow: 'rgba(234, 88, 12, 0.25)',
    dotColor: '#F97316',
    avatarBg: '#EA580C',
    avatarGlow: 'rgba(234, 88, 12, 0.35)',
  },
  {
    id: 'blue',
    name: 'Royal Blue',
    primary: '#2563EB',
    primaryDark: '#1D4ED8',
    accent: '#3B82F6',
    activeBg: '#EFF6FF',
    activeText: '#1E40AF',
    activeBorder: '#2563EB',
    activeGlow: 'rgba(37, 99, 235, 0.25)',
    dotColor: '#2563EB',
    avatarBg: '#1D4ED8',
    avatarGlow: 'rgba(29, 78, 216, 0.35)',
  },
  {
    id: 'sky',
    name: 'Sky Cyan',
    primary: '#0284C7',
    primaryDark: '#0369A1',
    accent: '#38BDF8',
    activeBg: '#F0F9FF',
    activeText: '#0369A1',
    activeBorder: '#0284C7',
    activeGlow: 'rgba(2, 132, 199, 0.25)',
    dotColor: '#0284C7',
    avatarBg: '#0284C7',
    avatarGlow: 'rgba(2, 132, 199, 0.35)',
  },
  {
    id: 'emerald',
    name: 'Emerald Teal',
    primary: '#10B981',
    primaryDark: '#059669',
    accent: '#34D399',
    activeBg: '#ECFDF5',
    activeText: '#047857',
    activeBorder: '#059669',
    activeGlow: 'rgba(16, 185, 129, 0.25)',
    dotColor: '#10B981',
    avatarBg: '#059669',
    avatarGlow: 'rgba(5, 150, 105, 0.35)',
  },
  {
    id: 'violet',
    name: 'Royal Violet',
    primary: '#7C3AED',
    primaryDark: '#6D28D9',
    accent: '#8B5CF6',
    activeBg: '#F5F3FF',
    activeText: '#5B21B6',
    activeBorder: '#7C3AED',
    activeGlow: 'rgba(124, 58, 237, 0.25)',
    dotColor: '#7C3AED',
    avatarBg: '#6D28D9',
    avatarGlow: 'rgba(109, 40, 217, 0.35)',
  },
  {
    id: 'crimson',
    name: 'Crimson Red',
    primary: '#EF4444',
    primaryDark: '#DC2626',
    accent: '#F87171',
    activeBg: '#FEF2F2',
    activeText: '#B91C1C',
    activeBorder: '#DC2626',
    activeGlow: 'rgba(239, 68, 68, 0.25)',
    dotColor: '#EF4444',
    avatarBg: '#DC2626',
    avatarGlow: 'rgba(220, 38, 38, 0.35)',
  },
  {
    id: 'slate',
    name: 'Obsidian Slate',
    primary: '#334155',
    primaryDark: '#0F172A',
    accent: '#64748B',
    activeBg: '#F1F5F9',
    activeText: '#0F172A',
    activeBorder: '#334155',
    activeGlow: 'rgba(51, 65, 85, 0.25)',
    dotColor: '#334155',
    avatarBg: '#0F172A',
    avatarGlow: 'rgba(15, 23, 42, 0.35)',
  },
];

export function generateCustomTheme(hex) {
  let cleanHex = (hex || '#F97316').trim();
  if (!cleanHex.startsWith('#')) cleanHex = '#' + cleanHex;
  if (!/^#[0-9A-Fa-f]{6}$/.test(cleanHex)) cleanHex = '#F97316';

  const num = parseInt(cleanHex.slice(1), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  const clamp = (val) => Math.min(255, Math.max(0, Math.round(val)));
  const toHex = (cr, cg, cb) =>
    `#${((1 << 24) + (clamp(cr) << 16) + (clamp(cg) << 8) + clamp(cb)).toString(16).slice(1)}`;

  const primaryDark = toHex(r * 0.82, g * 0.82, b * 0.82);
  const activeBg = `rgba(${r}, ${g}, ${b}, 0.08)`;
  const activeGlow = `rgba(${r}, ${g}, ${b}, 0.25)`;

  return {
    id: 'custom',
    name: 'Custom',
    primary: cleanHex,
    primaryDark,
    accent: cleanHex,
    activeBg,
    activeText: primaryDark,
    activeBorder: cleanHex,
    activeGlow,
    dotColor: cleanHex,
    avatarBg: cleanHex,
    avatarGlow: activeGlow,
  };
}

export function getCurrentTheme(brandProfile) {
  const themeId = localStorage.getItem('fueltracks_sidebar_theme') || 'orange';
  const customHex = localStorage.getItem('fueltracks_sidebar_custom_color') || '#F97316';

  if (themeId === 'custom') {
    return generateCustomTheme(customHex);
  }
  const found = SIDEBAR_THEMES.find((t) => t.id === themeId);
  if (found) return found;
  if (brandProfile?.primary_color && /^#[0-9A-Fa-f]{6}$/.test(brandProfile.primary_color)) {
    return generateCustomTheme(brandProfile.primary_color);
  }
  return SIDEBAR_THEMES[0];
}

export function applyGlobalTheme(theme) {
  if (!theme || typeof document === 'undefined') return;

  try {
    localStorage.setItem('fueltracks_sidebar_theme', theme.id);
    if (theme.id === 'custom' && theme.primary) {
      localStorage.setItem('fueltracks_sidebar_custom_color', theme.primary);
    }
  } catch (e) { }

  const root = document.documentElement;
  root.style.setProperty('--brand-primary', theme.primary);
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--brand-primary-dark', theme.primaryDark || theme.primary);
  root.style.setProperty('--brand-active-bg', theme.activeBg || '#FFF7ED');
  root.style.setProperty('--brand-active-text', theme.activeText || theme.primary);
  root.style.setProperty('--brand-active-border', theme.activeBorder || theme.primary);
  root.style.setProperty('--brand-glow', theme.activeGlow || 'rgba(234, 88, 12, 0.25)');
  root.style.setProperty('--brand-header', '#1e1b4b'); // Anchored deep navy table header that keeps tables crisp and legible
  root.style.setProperty('--brand-sidebar-bg', '#F8FAFC'); // Linear Studio sleek light-slate sidebar
  root.style.setProperty('--brand-sidebar', '#F8FAFC');
  root.style.setProperty('--brand-topbar-bg', '#FFFFFF'); // Clean crisp white topbar
  root.style.setProperty('--brand-topbar', '#FFFFFF');
  root.style.setProperty('--brand-border', '#E2E8F0');

  window.dispatchEvent(new CustomEvent('app-theme-changed', { detail: theme }));
  window.dispatchEvent(new CustomEvent('sidebar-theme-changed', { detail: theme }));
}
