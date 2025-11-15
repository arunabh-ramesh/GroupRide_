import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * MapView
 *
 * Props:
 * - members: { [userId]: { name, lat, lon, updatedAt } }
 * - you: { lat, lon, updatedAt }
 * - selectedFriend: userId | null
 * - setSelectedFriend: (userId|null) => void
 *
 * This component renders a Leaflet map centered on `you` when available,
 * otherwise a default resort location. It draws markers for all members and
 * highlights the selected friend. It also renders the user's marker + small
 * accuracy circle.
 */

// Fix leaflet's default icon paths when using bundlers/CDNs
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png',
});

export default function MapView({ members = {}, you = {}, selectedFriend, setSelectedFriend }) {
  // default center: a generic mountain (replace with your resort coords)
  const defaultCenter = [45.331, -121.713];
  const mapRef = useRef(null);

  // compute center: prefer user's last known position
  const center = you && you.lat != null ? [you.lat, you.lon] : defaultCenter;

  // when map is created, keep reference
  function handleMapCreated(map) {
    mapRef.current = map;
  }

  // If selectedFriend changes, attempt to fly to their position
  useEffect(() => {
    if (!selectedFriend || !mapRef.current) return;
    const m = members[selectedFriend];
    if (!m || m.lat == null || m.lon == null) return;
    try {
      mapRef.current.flyTo([m.lat, m.lon], Math.max(mapRef.current.getZoom(), 15), {
        duration: 0.8,
      });
    } catch (err) {
      // ignore flyTo errors
      // eslint-disable-next-line no-console
      console.warn('flyTo failed', err);
    }
  }, [selectedFriend, members]);

  // When the user's position updates, recenter the map (gentle pan)
  useEffect(() => {
    if (!you || you.lat == null || you.lon == null) return;
    if (!mapRef.current) return;
    try {
      mapRef.current.setView([you.lat, you.lon], mapRef.current.getZoom());
    } catch (err) {
      // ignore
    }
  }, [you]);

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '100vh', width: '100%' }}
      whenCreated={handleMapCreated}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution="© OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Render members */}
      {Object.entries(members || {}).map(([uid, m]) => {
        if (m == null || m.lat == null || m.lon == null) return null;
        const isSelected = selectedFriend === uid;
        return (
          <Marker key={uid} position={[m.lat, m.lon]}>
            <Popup>
              <div style={{ minWidth: 140 }}>
                <div style={{ fontWeight: 700 }}>{m.name || uid}</div>
                <div style={{ fontSize: 12, color: '#444' }}>
                  Last: {m.updatedAt ? new Date(m.updatedAt).toLocaleTimeString() : 'never'}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setSelectedFriend(uid)}
                    style={{ padding: '6px 8px' }}
                  >
                    Select
                  </button>
                  {isSelected && (
                    <button
                      onClick={() => setSelectedFriend(null)}
                      style={{ padding: '6px 8px' }}
                    >
                      Unselect
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Render the current user's marker + small circle */}
      {you && you.lat != null && you.lon != null && (
        <>
          <Marker position={[you.lat, you.lon]}>
            <Popup>
              <div>
                <strong>You</strong>
                <div style={{ fontSize: 12 }}>
                  {you.updatedAt ? new Date(you.updatedAt).toLocaleTimeString() : 'just now'}
                </div>
              </div>
            </Popup>
          </Marker>
          <Circle
            center={[you.lat, you.lon]}
            radius={15}
            pathOptions={{ color: 'blue', fillOpacity: 0.15 }}
          />
        </>
      )}
    </MapContainer>
  );
}
