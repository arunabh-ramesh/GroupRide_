// Utility functions for the client app

/**
 * haversineDistance
 * Calculate great-circle distance between two points (in meters)
 * Accepts latitude/longitude in decimal degrees.
 *
 * Returns null if any input is null/undefined/NaN.
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || Number.isNaN(Number(v)))) {
    return null;
  }
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * formatDistance
 * Pretty-print a distance in meters.
 * - < 1000m -> "123 m"
 * - >= 1000m -> "1.2 km"
 */
export function formatDistance(meters) {
  if (meters == null || Number.isNaN(Number(meters))) return '—';
  const m = Number(meters);
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/**
 * formatTimestamp
 * Convert a timestamp (ms since epoch or Date) to a human-friendly string.
 * If `short` is true, returns only time (e.g., "14:23:05" or "14:23").
 */
export function formatTimestamp(ts, { short = false } = {}) {
  if (!ts) return '—';
  const d = ts instanceof Date ? ts : new Date(Number(ts));
  if (Number.isNaN(d.getTime())) return '—';
  if (short) {
    return d.toLocaleTimeString();
  }
  return d.toLocaleString();
}

/**
 * timeSince
 * Returns a compact relative time like "3m", "2h", "1d", or "just now".
 * Expects `ts` in milliseconds since epoch (Date.now() style).
 */
export function timeSince(ts) {
  if (!ts) return '—';
  const now = Date.now();
  const then = typeof ts === 'number' ? ts : new Date(ts).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
