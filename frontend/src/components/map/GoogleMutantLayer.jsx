import { createLayerComponent } from '@react-leaflet/core';
import L from 'leaflet';

// NOTE: 'leaflet.gridlayer.googlemutant' is loaded dynamically at runtime
// to avoid top-level import errors that could crash the entire app bundle.
// The plugin registers itself on window.L and the imported L instance.

let mutantLoaded = false;

// Ensure window.L is available for the plugin to register itself
window.L = window.L || L;

async function loadGoogleMutant() {
  if (mutantLoaded || L.GridLayer?.GoogleMutant) {
    mutantLoaded = true;
    return;
  }
  try {
    await import('leaflet.gridlayer.googlemutant');
    mutantLoaded = true;
  } catch (e) {
    console.warn('[GoogleMutantLayer] Failed to load googlemutant plugin:', e);
  }
}

const createGoogleLayer = (props, context) => {
  const group = L.layerGroup();

  const initMutant = () => {
    loadGoogleMutant().then(() => {
      try {
        const type = props.type || 'roadmap';
        if (L.gridLayer && L.gridLayer.googleMutant) {
          const mutant = L.gridLayer.googleMutant({ type });
          group.clearLayers();
          group.addLayer(mutant);
        }
      } catch (e) {
        console.warn('[GoogleMutantLayer] Could not init Google mutant layer:', e);
      }
    });
  };

  if (!window.google || !window.google.maps) {
    if (!document.getElementById('google-maps-script') && props.apiKey) {
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${props.apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Double check just in case
        if (window.google) initMutant();
      };
      document.head.appendChild(script);
    } else {
      // Script is already loading, poll for it
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkInterval);
          initMutant();
        }
      }, 200);
      setTimeout(() => clearInterval(checkInterval), 15000);
    }
  } else {
    initMutant();
  }

  return { instance: group, context };
};

const updateGoogleLayer = (instance, props, prevProps) => {
  if (props.type !== prevProps.type && window.google) {
    instance.clearLayers();
    try {
      if (L.gridLayer && L.gridLayer.googleMutant) {
        const mutant = L.gridLayer.googleMutant({ type: props.type || 'roadmap' });
        instance.addLayer(mutant);
      }
    } catch (e) {
      console.warn('[GoogleMutantLayer] Could not update Google mutant layer:', e);
    }
  }
};

export default createLayerComponent(createGoogleLayer, updateGoogleLayer);
