import { geoContains } from 'd3-geo';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import fs from 'fs';
import { createRequire } from 'module';
import { feature as topoToFeature } from 'topojson-client';
const require = createRequire(import.meta.url);
const landPath = require.resolve('world-atlas/land-110m.json');
const worldData = JSON.parse(fs.readFileSync(landPath, 'utf-8'));

// Router for route computations. Placeholder implementation returns the input points
// as-is so the app can render them. Later, swap this to compute water-only paths.
const router = Router();

// Light per-route rate limit to avoid hammering from a single client
router.use(rateLimit({ windowMs: 10_000, max: 12 })); // max 12 requests / 10s per IP

// Simple in-memory cache for recent routes. Keyed by a hash of input points.
// TTL ensures we don't serve stale routes indefinitely if implementation changes.
const cache = new Map(); // key -> { polyline, ts }
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function pointsKey(points) {
	// Round to 4 decimals to normalize tiny jitter
	const norm = points.map(p => ({
		lat: Math.round(Number(p.latitude) * 1e4) / 1e4,
		lng: Math.round(Number(p.longitude) * 1e4) / 1e4,
	}));
	return JSON.stringify(norm);
}

// Health check for this sub-router
router.get('/health', (_req, res) => res.json({ ok: true }));

// ----- Water-avoiding routing PoC -----
// Build a coarse global grid and mark land cells using Natural Earth via world-atlas (TopoJSON)
// We keep resolution modest to be fast; this is for visualization, not navigation.
const GRID_DEG = 1.0; // 1° grid; tradeoff between performance/quality
const landPolygons = topoToFeature(worldData, worldData.objects.land);
// Quick cell classifier with small land buffer (approx ~10-20km latitude dependent)
function isLand(lat, lng) {
	try {
		return geoContains(landPolygons, [lng, lat]);
	} catch {
		return false;
	}
}

function toCell(lat, lng) {
	const rLat = Math.max(-89.5, Math.min(89.5, lat));
	let rLng = lng;
	if (rLng < -180) rLng += 360;
	if (rLng > 180) rLng -= 360;
	const i = Math.round(rLat / GRID_DEG);
	const j = Math.round(rLng / GRID_DEG);
	return { i, j };
}
function cellCenter(i, j) {
	return { latitude: i * GRID_DEG, longitude: j * GRID_DEG };
}
function neighbors(i, j) {
	const dirs = [
		[1, 0], [-1, 0], [0, 1], [0, -1],
		[1, 1], [1, -1], [-1, 1], [-1, -1],
	];
	return dirs.map(([di, dj]) => ({ i: i + di, j: j + dj }));
}
function haversine(a, b) {
	const R = 6371e3;
	const toRad = (d) => d * Math.PI / 180;
	const dLat = toRad(b.latitude - a.latitude);
	const dLng = toRad(b.longitude - a.longitude);
	const la1 = toRad(a.latitude);
	const la2 = toRad(b.latitude);
	const s = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
	return 2*R*Math.asin(Math.min(1, Math.sqrt(s)));
}
function aStar(start, goal) {
	const key = (i,j)=>`${i},${j}`;
	const open = new Set([key(start.i,start.j)]);
	const came = new Map();
	const g = new Map([[key(start.i,start.j), 0]]);
	const f = new Map([[key(start.i,start.j), haversine(cellCenter(start.i,start.j), cellCenter(goal.i,goal.j))]]);
	while (open.size) {
		// pick node with min f
		let currentKey = null; let bestF = Infinity;
		for (const k of open) { const val = f.get(k) ?? Infinity; if (val < bestF) { bestF = val; currentKey = k; } }
		if (!currentKey) break;
		const [ci,cj] = currentKey.split(',').map(Number);
		if (ci === goal.i && cj === goal.j) {
			// reconstruct
			const path = [{ i: ci, j: cj }];
			let ck = currentKey;
			while (came.has(ck)) { ck = came.get(ck); const [pi,pj] = ck.split(',').map(Number); path.push({ i: pi, j: pj }); }
			path.reverse();
			return path;
		}
		open.delete(currentKey);
		for (const n of neighbors(ci, cj)) {
			const c = cellCenter(n.i, n.j);
			if (isLand(c.latitude, c.longitude)) continue; // avoid land
			const nk = key(n.i, n.j);
			const tentativeG = (g.get(currentKey) ?? Infinity) + haversine(cellCenter(ci,cj), c);
			if (tentativeG < (g.get(nk) ?? Infinity)) {
				came.set(nk, currentKey);
				g.set(nk, tentativeG);
				f.set(nk, tentativeG + haversine(c, cellCenter(goal.i, goal.j)));
				open.add(nk);
			}
		}
	}
	return null; // no path
}
function routeBetween(a, b) {
	// snap to grid and ensure endpoints are on water by walking outward if needed
	let sa = toCell(a.latitude, a.longitude);
	let sb = toCell(b.latitude, b.longitude);
	const ca = cellCenter(sa.i, sa.j);
	const cb = cellCenter(sb.i, sb.j);
	if (isLand(ca.latitude, ca.longitude)) {
		// shift one step toward b
		const di = Math.sign(sb.i - sa.i) || 1; const dj = Math.sign(sb.j - sa.j) || 1;
		sa = { i: sa.i + di, j: sa.j + dj };
	}
	if (isLand(cb.latitude, cb.longitude)) {
		const di = Math.sign(sa.i - sb.i) || -1; const dj = Math.sign(sa.j - sb.j) || -1;
		sb = { i: sb.i + di, j: sb.j + dj };
	}
	const cells = aStar(sa, sb);
	if (!cells) return [a, b];
	const pts = cells.map(c => cellCenter(c.i, c.j));
	// insert real endpoints at start/end for fidelity
	pts[0] = a; pts[pts.length - 1] = b;
	return pts;
}
function waterRoute(points) {
	const out = [];
	for (let i = 0; i < points.length - 1; i++) {
		const seg = routeBetween(points[i], points[i+1]);
		if (i > 0) seg.shift(); // avoid duplicating waypoint
		out.push(...seg);
	}
	return out;
}

// Compute a route polyline between waypoints
// Body: { points: [{ latitude: number, longitude: number }] }
function handleRoute(req, res) {
	const body = req.body || {};
	const points = Array.isArray(body.points) ? body.points : [];
	const valid = points.every(p => typeof p?.latitude === 'number' && typeof p?.longitude === 'number');
	if (!valid || points.length < 2) {
		return res.status(400).json({ error: 'points must be an array of at least two items with latitude/longitude' });
	}
	// Cache lookup
	try {
		const key = pointsKey(points);
		const now = Date.now();
			const entry = cache.get(key);
			if (entry && (now - entry.ts) < TTL_MS) {
				return res.json({ polyline: entry.polyline, cached: true });
			}
			// Compute water-avoiding visualization path
			const polyline = waterRoute(points);
			cache.set(key, { polyline, ts: now });
			return res.json({ polyline, cached: false });
		} catch (_e) {
			// Fallback to echo
			return res.json({ polyline: points });
	}
}

router.post('/', handleRoute);
router.post('/marine', handleRoute);

export default router;

