import { createLayerComponent } from '@react-leaflet/core';
import L from 'leaflet';
import 'leaflet.gridlayer.googlemutant';

const createGoogleLayer = (props, context) => {
  const group = L.layerGroup();
  
  const initMutant = () => {
    // Determine type: 'roadmap', 'satellite', 'terrain' or 'hybrid'
    const type = props.type || 'roadmap';
    const mutant = L.gridLayer.googleMutant({ type });
    group.addLayer(mutant);
  };

  if (!window.google) {
    if (!document.getElementById('google-maps-script') && props.apiKey) {
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${props.apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = initMutant;
      document.head.appendChild(script);
    } else {
      // Script is loading or no API key, wait for google
      const checkInterval = setInterval(() => {
        if (window.google) {
          clearInterval(checkInterval);
          initMutant();
        }
      }, 100);
      
      // Stop checking after 10 seconds to avoid infinite loop if it fails
      setTimeout(() => clearInterval(checkInterval), 10000);
    }
  } else {
    initMutant();
  }
  
  return { instance: group, context };
};

const updateGoogleLayer = (instance, props, prevProps) => {
  // Handle type changes if necessary (clearing layers and re-adding)
  if (props.type !== prevProps.type && window.google) {
    instance.clearLayers();
    const mutant = L.gridLayer.googleMutant({ type: props.type || 'roadmap' });
    instance.addLayer(mutant);
  }
};

export default createLayerComponent(createGoogleLayer, updateGoogleLayer);
