import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function GoogleMutantLayer({ apiKey, type = 'roadmap' }) {
  const map = useMap();

  useEffect(() => {
    if (!apiKey) return;
    
    let isMounted = true;
    let layer = null;

    // Ensure Leaflet is globally available for the GoogleMutant script
    if (typeof window !== 'undefined') {
      window.L = window.L || L;
    }

    // Force the leaflet container to be transparent so Google Maps is visible underneath
    const container = map.getContainer();
    const originalBg = container.style.backgroundColor || '';
    container.style.backgroundColor = 'transparent';

    const loadScript = (id, src) => {
      return new Promise((resolve) => {
        let script = document.getElementById(id);
        if (script) {
          if (script.getAttribute('data-loaded') === 'true') {
            resolve();
          } else {
            script.addEventListener('load', resolve);
          }
          return;
        }
        script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          script.setAttribute('data-loaded', 'true');
          resolve();
        };
        document.head.appendChild(script);
      });
    };

    const initMap = async () => {
      // 1. Load Google Maps SDK
      await loadScript('google-maps-api-script', `https://maps.googleapis.com/maps/api/js?key=${apiKey}`);
      
      // 2. Load GoogleMutant plugin from CDN
      await loadScript('google-mutant-script', 'https://unpkg.com/leaflet.gridlayer.googlemutant@0.13.5/Leaflet.GoogleMutant.js');

      if (!isMounted) return;

      const initMutant = () => {
        if (!window.google || !window.google.maps || !window.L || !window.L.gridLayer || !window.L.gridLayer.googleMutant) {
          setTimeout(initMutant, 100);
          return;
        }
        
        if (!isMounted) return;

        if (layer && map.hasLayer(layer)) {
          map.removeLayer(layer);
        }

        // Use window.L to guarantee we use the globally injected plugin
        layer = window.L.gridLayer.googleMutant({
          type: type, // 'roadmap', 'satellite', 'terrain', 'hybrid'
        });
        
        layer.addTo(map);
      };

      initMutant();
    };

    initMap();

    return () => {
      isMounted = false;
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
      container.style.backgroundColor = originalBg;
    };
  }, [map, apiKey, type]);

  return null;
}
