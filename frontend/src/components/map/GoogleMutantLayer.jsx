import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.gridlayer.googlemutant';

export default function GoogleMutantLayer({ apiKey, type = 'roadmap' }) {
  const map = useMap();

  useEffect(() => {
    if (!apiKey) return;

    // Inject Google Maps API script if it doesn't exist
    const scriptId = 'google-maps-api-script';
    let script = document.getElementById(scriptId);
    let layer = null;

    const initMutant = () => {
      // Ensure google maps is fully loaded
      if (!window.google || !window.google.maps) {
        setTimeout(initMutant, 100);
        return;
      }
      
      // Remove previous layer if re-initializing
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
      // Script already loaded or loading
      if (window.google && window.google.maps) {
        initMutant();
      } else {
        script.addEventListener('load', initMutant);
      }
    }

    return () => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
      if (script && !window.google) {
        script.removeEventListener('load', initMutant);
      }
    };
  }, [map, apiKey, type]);

  return null;
}
