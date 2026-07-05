import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Property {
  id: string;
  title: string;
  type: string;
  rent: number;
  latitude: number;
  longitude: number;
  address: string;
}

interface MapSearchProps {
  center: [number, number];
  radiusKm: number;
  properties: Property[];
  onLocationChange: (lat: number, lng: number) => void;
  onRadiusChange?: (radius: number) => void;
  interactive?: boolean; // If true, allows clicking to change center. If false, just shows property pin.
}

export const MapSearch: React.FC<MapSearchProps> = ({
  center,
  radiusKm,
  properties,
  onLocationChange,
  onRadiusChange,
  interactive = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const currentUserMarkerRef = useRef<L.Marker | null>(null);

  // User Actual Geolocation position state
  const [currentUserLocation, setCurrentUserLocation] = useState<[number, number] | null>(null);

  // Map Tile Style State
  const [mapStyle, setMapStyle] = useState<'dark' | 'light'>('light'); // default to standard colored map
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Geolocation Loading State
  const [locating, setLocating] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create Leaflet map instance
    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: 12,
      zoomControl: true,
    });

    mapRef.current = map;

    // Create markers layer group
    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    // Handle map click for search centering
    if (interactive) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        onLocationChange(lat, lng);
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      currentUserMarkerRef.current = null;
    };
  }, []);

  // Handle tile layer rendering based on selected style or environment variables
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove active tile layer first
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl = mapStyle === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const attribution = mapStyle === 'dark'
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    // If env config exists, prioritize that for production custom tiles (MapTiler/Stadia)
    const envTileUrl = import.meta.env.VITE_MAP_TILE_URL;
    const envAttribution = import.meta.env.VITE_MAP_ATTRIBUTION;
    const apiKey = import.meta.env.VITE_MAP_API_KEY || '';

    const finalUrl = envTileUrl ? envTileUrl.replace('{apiKey}', apiKey) : tileUrl;
    const finalAttribution = envAttribution || attribution;

    const newTileLayer = L.tileLayer(finalUrl, {
      attribution: finalAttribution,
      maxZoom: 20,
    });

    newTileLayer.addTo(map);
    tileLayerRef.current = newTileLayer;
  }, [mapStyle]);

  // Request browser geolocation coordinates
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentUserLocation([latitude, longitude]);
        onLocationChange(latitude, longitude);

        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 13);
        }
        setLocating(false);
      },
      (error) => {
        console.error('Error fetching location:', error);
        alert('Could not determine current location. Please verify browser location permissions are enabled.');
        setLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  // Update Center Marker & Circle Radius
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 1. Position or create Center Marker
    const searchCenterIcon = L.divIcon({
      className: 'search-center-icon',
      html: `<div style="background-color: #06b6d4; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px #06b6d4;"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    if (centerMarkerRef.current) {
      centerMarkerRef.current.setLatLng(center);
    } else {
      centerMarkerRef.current = L.marker(center, { icon: searchCenterIcon }).addTo(map);
    }

    // 2. Position or create Radius Circle
    if (circleRef.current) {
      circleRef.current.setLatLng(center);
      circleRef.current.setRadius(radiusKm * 1000);
    } else {
      circleRef.current = L.circle(center, {
        radius: radiusKm * 1000,
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.1,
        weight: 1.5,
      }).addTo(map);
    }

    // Pan map to new center
    map.setView(center, map.getZoom());
  }, [center, radiusKm]);

  // Update User actual geolocated Position Marker (Purple pulsing dot like Google Maps)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentUserLocation) return;

    const purpleDotIcon = L.divIcon({
      className: 'user-location-pulse-icon',
      html: `
        <div style="background-color: #7c66ff; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 14px #7c66ff; position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="
            position: absolute; 
            width: 16px; 
            height: 16px; 
            border-radius: 50%; 
            background-color: #7c66ff; 
            opacity: 0.4; 
            transform: scale(1); 
            animation: pingDot 2s infinite ease-in-out;
          "></div>
        </div>
      `,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    if (currentUserMarkerRef.current) {
      currentUserMarkerRef.current.setLatLng(currentUserLocation);
    } else {
      currentUserMarkerRef.current = L.marker(currentUserLocation, { icon: purpleDotIcon }).addTo(map);
    }
  }, [currentUserLocation]);

  // Update Property Markers
  useEffect(() => {
    const map = mapRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    // Clear old property markers
    markersGroup.clearLayers();

    // Custom icon for property listings
    const propertyIcon = L.divIcon({
      className: 'property-pin-icon',
      html: `<div style="background-color: #10b981; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    properties.forEach((property) => {
      const marker = L.marker([property.latitude, property.longitude], {
        icon: propertyIcon,
      });

      // Bind detailed popup
      const popupHtml = `
        <div style="color: #0f162a; font-family: sans-serif; min-width: 150px; padding: 0.2rem;">
          <h4 style="margin: 0 0 0.3rem 0; font-size: 0.9rem;">${property.title}</h4>
          <p style="margin: 0 0 0.5rem 0; font-size: 0.75rem; color: #64748b;">${property.address}</p>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; color: #10b981; font-size: 0.85rem;">₹${property.rent}/mo</span>
            <a href="/listings/${property.id}" style="font-size: 0.75rem; text-decoration: none; color: #6366f1; font-weight: 600;">Details &rarr;</a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      markersGroup.addLayer(marker);
    });
  }, [properties]);

  return (
    <div className="map-container-wrapper" style={{ width: '100%', height: '100%' }}>
      <style>{`
        @keyframes pingDot {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.8); opacity: 0; }
        }
      `}</style>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      {interactive && (
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            left: '1rem',
            zIndex: 1000,
            background: 'rgba(7, 10, 19, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(8px)',
            padding: '0.5rem 0.8rem',
            borderRadius: '8px',
            fontSize: '0.75rem',
            color: '#cbd5e1',
            pointerEvents: 'none',
          }}
        >
          📍 Click on map to change search center coordinates
        </div>
      )}

      {/* Floating control buttons inside map container */}
      {interactive && (
        <>
          {/* Top-Left: Search Radius Pill */}
          {onRadiusChange && (
            <div
              className="map-radius-container"
              style={{
                position: 'absolute',
                top: '1rem',
                left: '1rem',
                zIndex: 1000,
              }}
            >
              <select
                value={radiusKm}
                onChange={(e) => onRadiusChange(parseInt(e.target.value))}
                style={{
                  background: 'rgba(16, 20, 21, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#00fbfb',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.75rem',
                  borderRadius: '9999px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                }}
              >
                <option value={5} style={{ background: '#101415', color: '#e0e3e5' }}>📍 5km Radius</option>
                <option value={10} style={{ background: '#101415', color: '#e0e3e5' }}>📍 10km Radius</option>
                <option value={20} style={{ background: '#101415', color: '#e0e3e5' }}>📍 20km Radius</option>
              </select>
            </div>
          )}

          {/* Top-Right: Map Style Toggle Circle */}
          <button
            type="button"
            className="map-style-toggle-circle"
            title="Toggle Map Style"
            onClick={() => setMapStyle((prev) => (prev === 'light' ? 'dark' : 'light'))}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(16, 20, 21, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#e0e3e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              zIndex: 1000,
            }}
          >
            {mapStyle === 'light' ? '🕶️' : '🎨'}
          </button>

          {/* Bottom-Right: Locate Me Pill */}
          <button
            type="button"
            className="map-locate-pill"
            onClick={handleLocateUser}
            disabled={locating}
            style={{
              position: 'absolute',
              bottom: '1rem',
              right: '1rem',
              zIndex: 1000,
              padding: '0.5rem 1rem',
              fontSize: '0.75rem',
              background: 'rgba(16, 20, 21, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#e0e3e5',
              borderRadius: '9999px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>🧭</span>
            <span>{locating ? 'Scanning...' : 'Locate Me'}</span>
          </button>
        </>
      )}
    </div>
  );
};
