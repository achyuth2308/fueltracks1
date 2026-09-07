import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function GoogleMutantLayer({ apiKey, type = 'roadmap' }) {
  const map = useMap();

  useEffect(() => {
    if (!apiKey) return;
    
    let isMounted = true;
    let layer = null;

    // 1. Ensure Leaflet is globally available BEFORE loading the plugin
    if (typeof window !== 'undefined') {
      window.L = window.L || L;
    }

    // Force the leaflet container to be transparent so Google Maps (which is rendered underneath) is visible
    const container = map.getContainer();
    const originalBg = container.style.backgroundColor || '';
    container.style.backgroundColor = 'transparent';


    // 2. Dynamically import the local patched googlemutant plugin so it doesn't crash on module load
    import('./Leaflet.GoogleMutant.js').then(() => {
      if (!isMounted) return;

      const scriptId = 'google-maps-api-script';
      let script = document.getElementById(scriptId);

      const initMutant = () => {
        if (!window.google || !window.google.maps) {
          setTimeout(initMutant, 100);
          return;
        }
        
        if (!isMounted) return;

        if (layer && map.hasLayer(layer)) {
          map.removeLayer(layer);
        }

        layer = L.gridLayer.googleMutant({
          type: type, // 'roadmap', 'satellite', 'terrain', 'hybrid'
        });
        
        layer.addTo(map);
      };

      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          initMutant();
        };
        document.head.appendChild(script);
      } else {
        if (window.google && window.google.maps) {
          initMutant();
        } else {
          script.addEventListener('load', initMutant);
        }
      }
    }).catch(err => {
      console.error("Failed to load googlemutant plugin:", err);
    });

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
