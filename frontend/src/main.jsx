import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import 'leaflet/dist/leaflet.css'
import './index.css'
import { getCurrentTheme, applyGlobalTheme } from './utils/theme'
import { applyBrowserBranding } from './utils/branding'

// Immediately initialize user-selected theme custom properties on page boot
try {
  applyGlobalTheme(getCurrentTheme());
} catch (e) {}

// Early custom domain branding detection on page boot
try {
  const hostname = window.location.hostname.toLowerCase();
  const isFuelTracks = hostname.includes('fueltracks') || hostname === 'localhost' || hostname === '127.0.0.1';

  // 1. Instant apply from cached profile
  const cached = sessionStorage.getItem('activeBrandProfile') || localStorage.getItem('activeBrandProfile');
  if (cached) {
    try {
      applyBrowserBranding(JSON.parse(cached));
    } catch (e) {}
  }

  // 2. If on custom domain, fetch public branding immediately so tab favicon/title is applied instantly
  if (!isFuelTracks) {
    const parts = hostname.split('.');
    let dealerSlug = parts[0];
    if (parts.length >= 3 && ['gps', 'track', 'fleet', 'portal', 'app', 'www'].includes(parts[0])) {
      dealerSlug = parts[1];
    }
    const apiUrl = import.meta.env.VITE_API_URL || 'https://api.fueltracks.in';
    fetch(`${apiUrl}/api/profile/public/${encodeURIComponent(dealerSlug)}`)
      .then(r => r.json())
      .then(d => {
        if (d?.success && d.data) {
          applyBrowserBranding(d.data);
          try { sessionStorage.setItem('activeBrandProfile', JSON.stringify(d.data)); } catch (e) {}
        }
      })
      .catch(() => {});
  }
} catch (e) {}

// Global safety net: if React fails to mount, show a user-friendly error
// instead of leaving users stuck on the initial HTML loading spinner forever.
const showFallback = (msg) => {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0B0F19;color:#fff;font-family:Inter,sans-serif;gap:16px;padding:24px;text-align:center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div style="font-size:20px;font-weight:700;">FuelTracks</div>
        <div style="font-size:14px;color:#94a3b8;max-width:320px;">Having trouble loading? Please try a hard refresh:</div>
        <kbd style="background:#1e293b;padding:8px 16px;border-radius:8px;font-size:13px;color:#e2e8f0;border:1px solid #334155;">Ctrl + Shift + R</kbd>
        <button onclick="window.location.reload(true)" style="margin-top:8px;background:#f97316;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Reload App</button>
        <div style="font-size:11px;color:#64748b;margin-top:8px;">${msg || ''}</div>
      </div>
    `;
  }
};

window.addEventListener('error', (e) => {
  // Only show fallback if React hasn't mounted yet
  const rootEl = document.getElementById('root');
  if (rootEl && rootEl.querySelector('.initial-loader-wrapper')) {
    showFallback('Error: ' + (e.message || 'Unknown error'));
  }
});

window.addEventListener('unhandledrejection', (e) => {
  const rootEl = document.getElementById('root');
  if (rootEl && rootEl.querySelector('.initial-loader-wrapper')) {
    showFallback('Error: ' + (e.reason?.message || 'Unknown error'));
  }
});

// Globally disable mouse wheel from changing values on number inputs across the entire application
window.addEventListener('wheel', (e) => {
  if (e.target && (e.target.type === 'number' || (e.target.tagName === 'INPUT' && e.target.type === 'number'))) {
    e.target.blur();
  }
  if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'number') {
    document.activeElement.blur();
  }
}, { passive: true });

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} catch (e) {
  console.error('React failed to mount:', e);
  showFallback('Mount failed: ' + e.message);
}
