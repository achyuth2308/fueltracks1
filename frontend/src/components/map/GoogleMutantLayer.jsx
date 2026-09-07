import { TileLayer } from 'react-leaflet';

export default function GoogleMutantLayer({ type = 'roadmap' }) {
  // Map Google Maps types to their unofficial tile endpoints
  // m = roadmap, s = satellite, y = hybrid, p = terrain
  let lyrs = 'm';
  if (type === 'satellite') lyrs = 's';
  else if (type === 'hybrid') lyrs = 'y';
  else if (type === 'terrain') lyrs = 'p';

  return (
    <TileLayer
      url={`https://mt1.google.com/vt/lyrs=${lyrs}&x={x}&y={y}&z={z}`}
      attribution="&copy; Google Maps"
      maxZoom={20}
      subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
    />
  );
}
