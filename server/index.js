/**
 * Simple Express + Socket.IO server for Group Tracker MVP
 *
 * Usage:
 *   npm install
 *   npm start
 *
 * The server keeps an in-memory store of groups and members. This is intentionally
 * simple for a local hackathon MVP. For production you'd swap this for a
 * persistence layer (Firestore, Redis, Postgres, etc) and add auth + validation.
 */

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

// Optional: serve a built client if you produce one in ../client/dist
// Uncomment and adjust if needed:
// const path = require('path');
// app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// In-memory store: groups -> { members: { userId: { userId, name, lat, lon, updatedAt, sport, socketId } } }
const groups = Object.create(null);

/**
 * Helper: normalize group code
 */
function normalizeGroup(group) {
  if (!group) return '';
  return String(group).trim().toUpperCase();
}

/**
 * Helper: sanitize group for sending to clients (removes socketId)
 */
function sanitizeGroup(groupObj) {
  const out = {};
  if (!groupObj || !groupObj.members) return { members: out };
  for (const [uid, m] of Object.entries(groupObj.members)) {
    out[uid] = {
      userId: m.userId,
      name: m.name,
      lat: m.lat,
      lon: m.lon,
      sport: m.sport,
      updatedAt: m.updatedAt,
    };
  }
  return { members: out };
}

/**
 * Socket.IO handlers
 */
io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on('join_group', (payload = {}) => {
    try {
      const group = normalizeGroup(payload.group);
      const userId = String(payload.userId || '').trim();
      const name = payload.name || 'Anonymous';

      if (!group || !userId) {
        socket.emit('error', { message: 'group and userId are required to join' });
        return;
      }

      if (!groups[group]) groups[group] = { members: {} };

      groups[group].members[userId] = groups[group].members[userId] || { userId };
      groups[group].members[userId].name = name;
      groups[group].members[userId].socketId = socket.id;

      socket.join(group);

      // send full sanitized state to joining client
      socket.emit('group_state', sanitizeGroup(groups[group]));

      // notify everyone in the group that a member joined (including the new member)
      io.to(group).emit('member_joined', { userId, name });

      console.log(`[group] ${name} (${userId}) joined ${group}`);
    } catch (err) {
      console.error('join_group error', err);
    }
  });

  socket.on('location_update', (payload = {}) => {
    try {
      const group = normalizeGroup(payload.group);
      const userId = String(payload.userId || '').trim();
      const lat = typeof payload.lat === 'number' ? payload.lat : Number(payload.lat);
      const lon = typeof payload.lon === 'number' ? payload.lon : Number(payload.lon);
      const sport = payload.sport || 'unknown';
      const timestamp = payload.timestamp || Date.now();

      if (!group || !userId || Number.isNaN(lat) || Number.isNaN(lon)) {
        // ignore invalid location updates
        return;
      }

      if (!groups[group]) {
        // if the group doesn't exist we can create it or ignore; we create to be permissive
        groups[group] = { members: {} };
      }

      const member = (groups[group].members[userId] = groups[group].members[userId] || { userId });
      member.lat = lat;
      member.lon = lon;
      member.sport = sport;
      member.updatedAt = timestamp;
      member.socketId = socket.id;

      // Broadcast updated locations to everyone in the group
      io.to(group).emit('group_locations', { members: groups[group].members });
    } catch (err) {
      console.error('location_update error', err);
    }
  });

  socket.on('leave_group', (payload = {}) => {
    try {
      const group = normalizeGroup(payload.group);
      const userId = String(payload.userId || '').trim();
      if (!group || !userId) return;

      if (groups[group] && groups[group].members[userId]) {
        delete groups[group].members[userId];
        io.to(group).emit('group_locations', { members: groups[group].members });
        console.log(`[group] ${userId} left ${group}`);
      }
      socket.leave(group);
    } catch (err) {
      console.error('leave_group error', err);
    }
  });

  socket.on('disconnect', () => {
    try {
      // mark members that used this socket as offline by removing socketId,
      // but keep last-known positions so other members can see them
      for (const [groupName, g] of Object.entries(groups)) {
        let changed = false;
        for (const [uid, m] of Object.entries(g.members)) {
          if (m.socketId === socket.id) {
            // remove socketId to indicate offline; keep lat/lon/updatedAt
            delete m.socketId;
            changed = true;
            console.log(`[socket] marked offline: ${uid} in ${groupName}`);
          }
        }
        if (changed) {
          io.to(groupName).emit('group_locations', { members: g.members });
        }
      }
      console.log(`[socket] disconnected: ${socket.id}`);
    } catch (err) {
      console.error('disconnect handler error', err);
    }
  });
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ ok: true, groups: Object.keys(groups).length });
});

/**
 * Start server
 */
const PORT = Number(process.env.PORT) || 4000;
server.listen(PORT, () => {
  console.log(`Group Tracker server listening on port ${PORT}`);
});
