import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import MapView from './MapView';
import { haversineDistance } from './utils';

const SERVER_URL = 'http://localhost:4000';

export default function App() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  const [group, setGroup] = useState('');
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [members, setMembers] = useState({});
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [you, setYou] = useState({ lat: null, lon: null, updatedAt: null });

  const geoWatchId = useRef(null);

  // initialize socket once (not connected until join)
  useEffect(() => {
    socketRef.current = io(SERVER_URL, { autoConnect: false, transports: ['websocket'] });

    const s = socketRef.current;
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    s.on('group_locations', ({ members: incoming = {} } = {}) => {
      setMembers(incoming);
    });

    s.on('group_state', ({ members: incoming = {} } = {}) => {
      setMembers(incoming);
    });

    // optional: handle errors/messages
    s.on('error', (err) => {
      console.warn('socket error', err);
    });

    return () => {
      if (s) {
        s.off();
        s.close();
      }
    };
  }, []);

  // start/stop geolocation when we join/leave
  useEffect(() => {
    const s = socketRef.current;
    if (!s || !s.connected || !group || !userId) return;

    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not available in this environment');
      return;
    }

    // get initial position then watch
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const now = Date.now();
        setYou({ lat, lon, updatedAt: now });
        s.emit('location_update', { group, userId, lat, lon, timestamp: now, sport: 'ski' });
      },
      (err) => {
        console.warn('geolocation getCurrentPosition error', err);
      },
      { enableHighAccuracy: true }
    );

    geoWatchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const now = Date.now();
        setYou({ lat, lon, updatedAt: now });
        s.emit('location_update', { group, userId, lat, lon, timestamp: now, sport: 'ski' });
      },
      (err) => {
        console.warn('geolocation watchPosition error', err);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 5000 }
    );

    return () => {
      if (geoWatchId.current != null) {
        navigator.geolocation.clearWatch(geoWatchId.current);
        geoWatchId.current = null;
      }
    };
  }, [group, userId, connected]);

  function join() {
    const s = socketRef.current;
    if (!s) return;
    const trimmedGroup = String(group || '').trim().toUpperCase();
    if (!trimmedGroup) {
      alert('Please enter a group code');
      return;
    }
    const trimmedName = String(name || '').trim() || 'anon';
    const uid = `${trimmedName}-${Math.random().toString(36).slice(2, 8)}`;
    setUserId(uid);
    s.connect();
    s.emit('join_group', { group: trimmedGroup, userId: uid, name: trimmedName });
    setGroup(trimmedGroup);
  }

  function leave() {
    const s = socketRef.current;
    if (!s) return;
    if (group && userId) {
      s.emit('leave_group', { group, userId });
    }
    s.disconnect();
    setMembers({});
    setUserId('');
    setSelectedFriend(null);
    // clear geolocation watch if any
    if (geoWatchId.current != null) {
      navigator.geolocation.clearWatch(geoWatchId.current);
      geoWatchId.current = null;
    }
  }

  const selected = selectedFriend ? members[selectedFriend] : null;
  const distanceMeters =
    selected && you && you.lat != null && selected.lat != null
      ? haversineDistance(you.lat, you.lon, selected.lat, selected.lon)
      : null;

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, Arial, sans-serif' }}>
      <aside style={{ width: 340, padding: 14, borderRight: '1px solid #eee', boxSizing: 'border-box' }}>
        <h2 style={{ marginTop: 0 }}>Group Tracker MVP</h2>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Nickname</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={{ width: '100%', padding: '8px 10px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Group Code</label>
          <input
            value={group}
            onChange={(e) => setGroup(e.target.value.toUpperCase())}
            placeholder="e.g. RIDE32"
            style={{ width: '100%', padding: '8px 10px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          {!userId ? (
            <button onClick={join} style={{ padding: '8px 12px' }}>
              Join Group
            </button>
          ) : (
            <button onClick={leave} style={{ padding: '8px 12px' }}>
              Leave
            </button>
          )}
        </div>

        <hr style={{ margin: '12px 0' }} />

        <div style={{ marginBottom: 6 }}>
          <strong>Connection:</strong> <span style={{ color: connected ? 'green' : 'red' }}>{connected ? 'online' : 'offline'}</span>
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong>Your last:</strong> {you.updatedAt ? new Date(you.updatedAt).toLocaleTimeString() : '—'}
        </div>

        <h4 style={{ marginBottom: 6 }}>Members</h4>
        <div style={{ maxHeight: '40vh', overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 6 }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 8 }}>
            {Object.entries(members).length === 0 && <li style={{ color: '#666' }}>No members yet</li>}
            {Object.entries(members).map(([uid, m]) => (
              <li
                key={uid}
                style={{
                  padding: 8,
                  borderBottom: '1px solid #fafafa',
                  cursor: 'pointer',
                  background: uid === selectedFriend ? '#f6f9ff' : 'transparent',
                }}
                onClick={() => setSelectedFriend(uid)}
              >
                <div style={{ fontWeight: 600 }}>
                  {m.name || uid} {uid === userId ? '(you)' : ''}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  last: {m.updatedAt ? new Date(m.updatedAt).toLocaleTimeString() : 'never'}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {selected && (
          <div style={{ marginTop: 12, padding: 8, border: '1px solid #eee', borderRadius: 6 }}>
            <div style={{ fontWeight: 700 }}>{selected.name}</div>
            <div style={{ color: '#555', fontSize: 13 }}>
              Last: {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : '—'}
            </div>
            <div style={{ marginTop: 6 }}>
              Distance: <strong>{distanceMeters ? `${distanceMeters.toFixed(0)} m` : '—'}</strong>
            </div>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => setSelectedFriend(null)} style={{ padding: '6px 10px' }}>
                Unselect
              </button>
            </div>
          </div>
        )}
      </aside>

      <main style={{ flex: 1 }}>
        <MapView members={members} you={you} selectedFriend={selectedFriend} setSelectedFriend={setSelectedFriend} />
      </main>
    </div>
  );
}
