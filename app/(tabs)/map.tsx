import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import type { Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateWithPrefs, usePreferences } from '../../components/PreferencesContext';
import { useTheme } from '../../components/ThemeContext';
import { useToast } from '../../components/ToastContext';
import { clearPortsCache, fuzzyMatch, PortEntry, resolvePortByName, searchPortsOnline, upsertCachedPort, searchPorts } from '../../lib/ports';
import { PortsCache } from '../../lib/portsCache';
import { getTrips, upsertTrip } from '../../lib/storage';
import { shortLocationLabel } from '../../lib/location';
import { getTileConfig } from '../../lib/tiles';
import type { Trip } from '../../types';

/**
 * MapScreen renders the trips map with planned ports and note locations.
 * - iOS: react-native-maps with OSM tiles; Android: MapLibre if available.
 * - Shows clustered note markers, planned port markers, and great‑circle path lines between ports.
 * - Supports long‑press add: drop a point and append it to a selected trip.
 */
export default function MapScreen() {
  const { themeColors, colorScheme } = useTheme();
  const { prefs } = usePreferences();
  const insets = useSafeAreaInsets();
  // maps feature flag removed; map should always be enabled
  const routeColor = useMemo(() => (colorScheme === 'dark' ? themeColors.highlight : themeColors.accent), [colorScheme, themeColors]);
  const ROUTE_STROKE_WIDTH = 3;
  const ARROW_HEIGHT = 13;
  const [trips, setTrips] = useState<Trip[]>([]);
  const mapRef = useRef<any>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const REGION_KEY = 'map_last_region_v1';
  const [portCache, setPortCache] = useState<PortEntry[]>([]);
  const [pendingPorts, setPendingPorts] = useState<string[]>([]);
  const [routesVisible, setRoutesVisible] = useState(true);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>(prefs.defaultMapType);
  useEffect(() => { setMapType(prefs.defaultMapType); }, [prefs.defaultMapType]);
  const [addLocationModalVisible, setAddLocationModalVisible] = useState(false);
  const [pendingCoord, setPendingCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pendingPlaceName, setPendingPlaceName] = useState<string | null>(null);
  const [addingTripId, setAddingTripId] = useState<string | null>(null);
  const didRestoreInitialRegion = useRef(false);
  const toast = useToast();

  // Android: dynamically load MapLibre (@maplibre/maplibre-react-native) to avoid Google base map/watermark
  const [MapLibre, setMapLibre] = useState<any>(null);
  const cameraRef = useRef<any>(null);
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'android') return;
      try {
        const mod = await import('@maplibre/maplibre-react-native');
        setMapLibre((mod as any).default || (mod as any));
      } catch { setMapLibre(null); }
    })();
  }, []);

  // Reduce noisy MapLibre native logs in dev (filter out transient 'Canceled' tile requests)
  useEffect(() => {
    try {
      if (Platform.OS === 'android' && MapLibre?.Logger) {
        // MapLibre RN expects a string level like 'error' | 'warning' | 'info'
        MapLibre.Logger.setLogLevel?.('error');
        MapLibre.Logger.setLogCallback?.((log: any) => {
          const msg = String(log?.message || '');
          const tag = String(log?.tag || '');
          if (tag.includes('Mbgl-HttpRequest') && /Canceled/i.test(msg)) {
            return true; // swallow
          }
          return false; // let others through
        });
      }
    } catch {}
  }, [MapLibre]);

  // Dynamically load map components only when available (dev client/standalone with AIRMap)
  const [MapComponents, setMapComponents] = useState<null | { MapView: any; Marker: any; Polyline: any; UrlTile?: any; Callout: any }>(null);
  useEffect(() => {
    (async () => {
      try {
        const inExpoGo = Constants.appOwnership === 'expo';
        // Do not load react-native-maps on Android to avoid Google SDK/API key requirements
        if (Platform.OS === 'android') { setMapComponents(null); return; }
        const hasAirMap = Platform.OS !== 'web' && !!UIManager.getViewManagerConfig?.('AIRMap');
        if (!inExpoGo && hasAirMap) {
          const mod = await import('react-native-maps');
          setMapComponents({
            MapView: mod.default,
            Marker: (mod as any).Marker,
            Polyline: (mod as any).Polyline,
            UrlTile: (mod as any).UrlTile,
            Callout: (mod as any).Callout,
          });
        } else {
          setMapComponents(null);
        }
      } catch {
        setMapComponents(null);
      }
    })();
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background, paddingBottom: Math.max(12, insets?.bottom || 0) },
    map: { flex: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: themeColors.textSecondary },
    overlay: { position: 'absolute', top: 8, left: 8, backgroundColor: themeColors.card, borderColor: themeColors.menuBorder, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'column', maxWidth: 300 },
    overlayTopRow: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' },
    overlayFilterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    legendCard: { position: 'absolute', top: 8, right: 8, backgroundColor: themeColors.card, borderColor: themeColors.menuBorder, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'column', alignItems: 'flex-start' },
    legendText: { color: themeColors.text, fontWeight: '600', fontSize: 12 },
    overlayChip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder },
    overlayChipActive: { backgroundColor: themeColors.primary + '22', borderColor: themeColors.primary },
    overlayChipText: { color: themeColors.text, fontWeight: '600', fontSize: 12 },
    calloutBubble: { maxWidth: 240, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, backgroundColor: colorScheme === 'dark' ? '#0f1820' : '#FFFFFF', borderColor: colorScheme === 'dark' ? '#1e2c36' : '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
    calloutTitle: { fontWeight: '700', fontSize: 15, marginBottom: 2, color: colorScheme === 'dark' ? '#FFFFFF' : '#111111' },
    calloutSubtitle: { fontSize: 13, color: colorScheme === 'dark' ? '#b8c5cc' : '#333333' },
    calloutAction: { fontSize: 13, fontWeight: '600', marginTop: 8, color: themeColors.primary },
  }), [themeColors, colorScheme, insets?.bottom]);

  const refresh = useCallback(async () => {
  const [t, cache] = await Promise.all([getTrips(), PortsCache.load()]);
    setTrips(t); setPortCache(cache);
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const [category, setCategory] = useState<'inprogress' | 'upcoming' | 'completed' | 'all'>('all');
  useEffect(() => { (async () => { try { const cat = await AsyncStorage.getItem('map_filter_category_v1'); if (cat === 'inprogress' || cat === 'upcoming' || cat === 'completed' || cat === 'all') setCategory(cat); } catch {} })(); }, []);
  useEffect(() => { (async () => { try { await AsyncStorage.setItem('map_filter_category_v1', category); } catch {} })(); }, [category]);

  /**
     * React component parseLocalYmd: TODO describe purpose and where it’s used.
     * @param {string} s - TODO: describe
     * @returns {Date} TODO: describe
     */
    function parseLocalYmd(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
  /**
     * React component startOfToday: TODO describe purpose and where it’s used.
     * @returns {Date} TODO: describe
     */
    function startOfToday(): Date { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
  /**
     * React component isTripCompleted: TODO describe purpose and where it’s used.
     * @param {import("D:/Code/portlist_app/types").Trip} t - TODO: describe
     * @returns {boolean} TODO: describe
     */
    function isTripCompleted(t: Trip) { if (t.completed) return true; if (!t.endDate) return false; return parseLocalYmd(t.endDate).getTime() < startOfToday().getTime(); }
  /**
     * React component isTripInProgress: TODO describe purpose and where it’s used.
     * @param {import("D:/Code/portlist_app/types").Trip} t - TODO: describe
     * @returns {boolean} TODO: describe
     */
    function isTripInProgress(t: Trip) { if (t.completed || !t.startDate) return false; const today = startOfToday().getTime(); const startTs = parseLocalYmd(t.startDate).getTime(); const endTs = t.endDate ? parseLocalYmd(t.endDate).getTime() : undefined; if (today < startTs) return false; if (typeof endTs === 'number' && today > endTs) return false; return true; }

  // map always enabled

  const initial: Region = useMemo(() => ({ latitude: 20, longitude: 0, latitudeDelta: 80, longitudeDelta: 80 }), []);
  useEffect(() => { let mounted = true; (async () => { if (didRestoreInitialRegion.current) return; try { const saved = await AsyncStorage.getItem(REGION_KEY); if (!mounted) return; if (saved) { const r = JSON.parse(saved) as Region; setRegion(prev => prev ?? r); setTimeout(() => { if (!didRestoreInitialRegion.current) { mapRef.current?.animateToRegion(r, 0); didRestoreInitialRegion.current = true; } }, 0); } else { if (mounted && !region) { setRegion(initial); didRestoreInitialRegion.current = true; } } } catch {} })(); return () => { mounted = false; }; }, [REGION_KEY, initial, region]);

  let filteredTrips = trips as Trip[];
  if (category === 'completed') filteredTrips = trips.filter(isTripCompleted);
  else if (category === 'inprogress') filteredTrips = trips.filter(isTripInProgress);
  else if (category === 'upcoming') filteredTrips = trips.filter(t => !isTripCompleted(t) && !isTripInProgress(t));

  const markers = useMemo(() => {
    const items: { key: string; lat: number; lng: number; title: string; subtitle?: string; tripId: string; noteId: string }[] = [];
    for (const trip of filteredTrips) {
      for (const d of trip.days) {
        const loc = d.location; if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
          const when = d.date ? formatDateWithPrefs(d.date, prefs, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
          items.push({ key: `${trip.id}_${d.id}`, lat: loc.lat, lng: loc.lng, title: d.title || d.locationName || 'Note', subtitle: when, tripId: trip.id, noteId: d.id });
        }
      }
    }
    return items;
  }, [filteredTrips, prefs]);

  type MarkerPoint = typeof markers[number];
  type Cluster = { key: string; lat: number; lng: number; count: number; children: MarkerPoint[] };
  /**
     * React component computeThresholds: TODO describe purpose and where it’s used.
     * @param {any} r - TODO: describe
     * @returns {{ latThresh: number; lngThresh: number; }} TODO: describe
     */
    function computeThresholds(r: Region) { const d = r.latitudeDelta; let div = 22; if (d > 60) div = 10; else if (d > 30) div = 14; else if (d > 15) div = 18; else if (d > 8) div = 22; else if (d > 4) div = 26; else div = 32; const latThresh = Math.max(d / div, 0.005); const rad = (r.latitude * Math.PI) / 180; const lngScale = Math.max(Math.cos(rad), 0.2); const lngThresh = Math.max(r.longitudeDelta / div * lngScale, 0.005); return { latThresh, lngThresh }; }

  const clusters = useMemo(() => {
    if (!region) return markers.map(m => ({ type: 'point' as const, point: m }));
    const { latThresh, lngThresh } = computeThresholds(region);
    const assigned = new Set<string>();
    const out: ({ type: 'point'; point: MarkerPoint } | { type: 'cluster'; cluster: Cluster })[] = [];
    for (let i = 0; i < markers.length; i++) {
      const m = markers[i]; if (assigned.has(m.key)) continue; const bucket: MarkerPoint[] = [m]; assigned.add(m.key);
      for (let j = i + 1; j < markers.length; j++) { const n = markers[j]; if (assigned.has(n.key)) continue; if (Math.abs(m.lat - n.lat) <= latThresh && Math.abs(m.lng - n.lng) <= lngThresh) { bucket.push(n); assigned.add(n.key); } }
      if (bucket.length === 1) out.push({ type: 'point', point: m });
      else { const avgLat = bucket.reduce((s, p) => s + p.lat, 0) / bucket.length; const avgLng = bucket.reduce((s, p) => s + p.lng, 0) / bucket.length; out.push({ type: 'cluster', cluster: { key: `c_${m.key}`, lat: avgLat, lng: avgLng, count: bucket.length, children: bucket } }); }
    }
    return out;
  }, [markers, region]);

  const zoomIntoCluster = /**
   * React component zoomIntoCluster: TODO describe purpose and where it’s used.
   * @param {Cluster} c - TODO: describe
   * @returns {void} TODO: describe
   */
  (c: Cluster) => {
    if (!mapRef.current) return;
    const minLat = Math.min(...c.children.map(p => p.lat));
    const maxLat = Math.max(...c.children.map(p => p.lat));
    const minLng = Math.min(...c.children.map(p => p.lng));
    const maxLng = Math.max(...c.children.map(p => p.lng));
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latDelta = Math.max((maxLat - minLat) * 1.5, 0.02);
    const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.02);
    mapRef.current.animateToRegion({ latitude: centerLat, longitude: centerLng, latitudeDelta: latDelta, longitudeDelta: lngDelta }, 350);
  };

  const mapStyleLight = useMemo(() => ([
    { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#8fc9ff' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5b5b5b' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d9f2d9' }] },
    { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#f3f5f7' }] },
    { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#646464' }] },
  ] as any), []);
  const mapStyleDark = useMemo(() => ([
    { elementType: 'labels.text.stroke', stylers: [{ color: '#000000' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#c7d2d7' }] },
    { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#082d3b' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#1c2224' }] },
    { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#242a2d' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e402d' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#303437' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3e41' }] },
    { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#b3bcc1' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#b0b9be' }] },
  ] as any), []);

  type PortMarker = { key: string; lat: number; lng: number; title: string; tripId: string };
  type TripPath = { key: string; coords: { latitude: number; longitude: number }[]; tripId: string };
  type ArrowMarker = { key: string; lat: number; lng: number; angle: number; tripId: string };
  const portsFingerprint = useMemo(() => filteredTrips.map(t => `${t.id}:${(Array.isArray(t.ports) ? t.ports.join('|') : '')}`).join(';'), [filteredTrips]);

  // include portsFingerprint to force recompute when trip.ports order/content changes
  const { portMarkers, tripPaths, arrowMarkers, unresolvedPorts } = useMemo(() => {
    // ensure portsFingerprint is treated as a used dependency so the memo invalidates when it changes
    void portsFingerprint;
    const ports: PortMarker[] = []; const paths: TripPath[] = []; const arrows: ArrowMarker[] = []; const unresolved: { port: string; tripId: string }[] = [];
    const norm = /**
     * React component norm: TODO describe purpose and where it’s used.
     * @param {string | null | undefined} s - TODO: describe
     * @returns {string} TODO: describe
     */
    (s?: string | null) => (s || '').trim().toLowerCase();
    const toRad = /**
     * React component toRad: TODO describe purpose and where it’s used.
     * @param {number} d - TODO: describe
     * @returns {number} TODO: describe
     */
    (d: number) => d * Math.PI / 180; const toDeg = /**
     * React component toDeg: TODO describe purpose and where it’s used.
     * @param {number} r - TODO: describe
     * @returns {number} TODO: describe
     */
    (r: number) => r * 180 / Math.PI;
    const bearing = /**
     * React component bearing: TODO describe purpose and where it’s used.
     * @param {number} lat1 - TODO: describe
     * @param {number} lon1 - TODO: describe
     * @param {number} lat2 - TODO: describe
     * @param {number} lon2 - TODO: describe
     * @returns {number} TODO: describe
     */
    (lat1: number, lon1: number, lat2: number, lon2: number) => { const φ1 = toRad(lat1); const φ2 = toRad(lat2); const Δλ = toRad(lon2 - lon1); const y = Math.sin(Δλ) * Math.cos(φ2); const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ); return (toDeg(Math.atan2(y, x)) + 360) % 360; };
    const havDistanceKm = /**
     * React component havDistanceKm: TODO describe purpose and where it’s used.
     * @param {number} lat1 - TODO: describe
     * @param {number} lon1 - TODO: describe
     * @param {number} lat2 - TODO: describe
     * @param {number} lon2 - TODO: describe
     * @returns {number} TODO: describe
     */
    (lat1: number, lon1: number, lat2: number, lon2: number) => { const R = 6371; const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1); const φ1 = toRad(lat1); const φ2 = toRad(lat2); const a = Math.sin(dLat/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(dLon/2)**2; const c = 2 * Math.asin(Math.min(1, Math.sqrt(a))); return R * c; };
    const interpolateGC = /**
     * React component interpolateGC: TODO describe purpose and where it’s used.
     * @param {number} lat1 - TODO: describe
     * @param {number} lon1 - TODO: describe
     * @param {number} lat2 - TODO: describe
     * @param {number} lon2 - TODO: describe
     * @param {number} f - TODO: describe
     * @returns {{ lat: number; lng: number; }} TODO: describe
     */
    (lat1: number, lon1: number, lat2: number, lon2: number, f: number) => { const φ1 = toRad(lat1), λ1 = toRad(lon1), φ2 = toRad(lat2), λ2 = toRad(lon2); const Δ = 2 * Math.asin(Math.sqrt(Math.sin((φ2-φ1)/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin((λ2-λ1)/2)**2)); if (Δ === 0) return { lat: lat1, lng: lon1 }; const A = Math.sin((1 - f) * Δ) / Math.sin(Δ); const B = Math.sin(f * Δ) / Math.sin(Δ); const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2); const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2); const z = A * Math.sin(φ1) + B * Math.sin(φ2); const φi = Math.atan2(z, Math.sqrt(x * x + y * y)); const λi = Math.atan2(y, x); return { lat: toDeg(φi), lng: ((toDeg(λi) + 540) % 360) - 180 }; };

    for (const trip of filteredTrips) {
      const list = Array.isArray(trip.ports) ? trip.ports : [];
      const pathCoords: { latitude: number; longitude: number }[] = []; const segmentEndpoints: { latitude: number; longitude: number }[] = [];
      list.forEach((p, idx) => {
        const pn = norm(p); const primary = norm(p.split(',')[0] || p); if (!pn) return;
        // 0) Direct lat,lng in the port string (e.g., "58.3019, -134.4197")
        const coordMatch = /(-?\d{1,3}(?:\.\d+)?)[\s,]+(-?\d{1,3}(?:\.\d+)?)/.exec(p);
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);
          if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            ports.push({ key: `port_${trip.id}_${idx}`, lat, lng, title: p, tripId: trip.id });
            segmentEndpoints.push({ latitude: lat, longitude: lng });
            return;
          }
        }
        // 1) Prefer explicit trip day locations, using fuzzy match between the port label and locationName
        const hit = trip.days.find(d => {
          if (!d.location) return false; const ln = (d.locationName || '').trim();
          if (!ln) return false;
          const lnNorm = norm(ln);
          if (lnNorm.includes(pn) || pn.includes(lnNorm) || (primary ? (lnNorm.includes(primary) || primary.includes(lnNorm)) : false)) return true;
          try { return fuzzyMatch(ln, p, 0.6); } catch { return false; }
        });
        if (hit && hit.location && typeof hit.location.lat === 'number' && typeof hit.location.lng === 'number') {
          // Use explicit note location
          ports.push({ key: `port_${trip.id}_${idx}`, lat: hit.location.lat, lng: hit.location.lng, title: p, tripId: trip.id });
          segmentEndpoints.push({ latitude: hit.location.lat, longitude: hit.location.lng });
          console.debug && console.debug(`[map] trip ${trip.id} port[${idx}] '${p}' -> using trip day location ${hit.location.lat},${hit.location.lng}`);
        } else {
          // 2) Try local resolution using curated + cache + master datasets
          const resolved = (searchPorts(p, portCache, 1, undefined, true, true) || [])[0] || resolvePortByName(p, portCache);
          if (resolved) {
            ports.push({ key: `port_${trip.id}_${idx}`, lat: resolved.lat, lng: resolved.lng, title: p, tripId: trip.id });
            segmentEndpoints.push({ latitude: resolved.lat, longitude: resolved.lng });
            console.debug && console.debug(`[map] trip ${trip.id} port[${idx}] '${p}' -> resolved '${resolved.name}' @ ${resolved.lat},${resolved.lng} (source=${resolved.source || 'unknown'})`);
          } else {
            unresolved.push({ port: p, tripId: trip.id });
            console.debug && console.debug(`[map] trip ${trip.id} port[${idx}] '${p}' -> unresolved`);
          }
        }
      });
      if (segmentEndpoints.length >= 2) {
        segmentEndpoints.forEach((c, i) => { if (i === 0) { pathCoords.push(c); return; } const prev = segmentEndpoints[i - 1]; const dist = havDistanceKm(prev.latitude, prev.longitude, c.latitude, c.longitude); const steps = Math.min(64, Math.max(1, Math.ceil(dist / 250))); for (let s = 1; s <= steps; s++) { const f = s / (steps + 1); const pt = interpolateGC(prev.latitude, prev.longitude, c.latitude, c.longitude, f); pathCoords.push({ latitude: pt.lat, longitude: pt.lng }); } pathCoords.push(c); });
        const segStarts: number[] = [0]; let totalDist = 0; for (let i = 1; i < pathCoords.length; i++) { totalDist += havDistanceKm(pathCoords[i-1].latitude, pathCoords[i-1].longitude, pathCoords[i].latitude, pathCoords[i].longitude); segStarts.push(totalDist); }
        const arrowCount = totalDist < 400 ? 1 : totalDist < 900 ? 2 : Math.min(6, Math.round(totalDist / 600));
        const arrowPoints: { lat: number; lng: number; angle: number; dist: number }[] = [];
        if (arrowCount > 0 && totalDist > 0) {
          for (let a = 1; a <= arrowCount; a++) {
            const target = (a / (arrowCount + 1)) * totalDist;
            let lo = 0, hi = segStarts.length - 1, idx = segStarts.length - 1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (segStarts[mid] >= target) { idx = mid; hi = mid - 1; } else { lo = mid + 1; } }
            if (idx === 0) idx = 1; const prevIdx = idx - 1; const prevDist = segStarts[prevIdx]; const segLen = segStarts[idx] - prevDist; const frac = segLen === 0 ? 0 : (target - prevDist) / segLen; const p0 = pathCoords[prevIdx]; const p1 = pathCoords[idx]; const lat = p0.latitude + (p1.latitude - p0.latitude) * frac; const lng = p0.longitude + (p1.longitude - p0.longitude) * frac; const ahead = idx < pathCoords.length - 1 ? pathCoords[idx + 1] : p1; const ang = bearing(lat, lng, ahead.latitude, ahead.longitude); arrowPoints.push({ lat, lng, angle: ang, dist: target });
          }
        }
        if (arrowPoints.length) {
          const merged: { latitude: number; longitude: number }[] = [];
          for (let i = 0; i < pathCoords.length; i++) {
            const pt = pathCoords[i]; const curDist = i === 0 ? 0 : segStarts[i]; const prevDist = i === 0 ? 0 : segStarts[i - 1]; const segSpanStart = i === 0 ? 0 : prevDist; const segSpanEnd = curDist;
            if (i > 0) arrowPoints.forEach(ap => { if (ap.dist > segSpanStart && ap.dist <= segSpanEnd) { merged.push({ latitude: ap.lat, longitude: ap.lng }); } });
            merged.push(pt);
          }
          pathCoords.splice(0, pathCoords.length, ...merged);
        }
        arrowPoints.forEach((ap, idx) => { arrows.push({ key: `arrow_${trip.id}_${idx}`, lat: ap.lat, lng: ap.lng, angle: ap.angle, tripId: trip.id }); });
        paths.push({ key: `path_${trip.id}`, coords: pathCoords, tripId: trip.id });
      }
    }
    return { portMarkers: ports, tripPaths: paths, arrowMarkers: arrows, unresolvedPorts: unresolved };
  }, [filteredTrips, portCache, portsFingerprint]);


  const normalizeName = useCallback((s: string) => s.trim().toLowerCase(), []);
  useEffect(() => {
    if (!unresolvedPorts || unresolvedPorts.length === 0) return;
    // Use original port strings (not normalized) so online lookup gets the user's input and we can
    // validate results before persisting them.
    const uniqOriginal = Array.from(new Set(unresolvedPorts.map(u => u.port)));
    const toLookup = uniqOriginal.filter(orig => !pendingPorts.map(normalizeName).includes(normalizeName(orig)));
    if (toLookup.length === 0) return;
    setPendingPorts(prev => [...prev, ...toLookup.map(normalizeName)]);
    (async () => {
      for (const origPort of toLookup) {
        try {
          let results = await searchPortsOnline(origPort, 1);
          if (!results || results.length === 0) results = await searchPortsOnline(`${origPort} cruise port`, 1);
          if (!results || results.length === 0) results = await searchPortsOnline(`${origPort} port`, 1);
          // Only persist if the returned candidate reasonably matches the original query
          if (results && results.length > 0 && fuzzyMatch(origPort, results[0].name, 0.6)) {
            await upsertCachedPort(results[0]);
            console.debug && console.debug(`[ports] persisted online result for '${origPort}' -> '${results[0].name}'`);
          } else {
            console.debug && console.debug(`[ports] skipping persist for '${origPort}' - no confident match (${results && results[0] ? results[0].name : 'no result'})`);
          }
        } catch (e) {
          console.debug && console.debug('[ports] online lookup error for', origPort, e);
        }
        try { await new Promise(res => setTimeout(res, 400)); } catch {}
      }
      try {
  const [cache, trips] = await Promise.all([PortsCache.load(), getTrips()]);
        setPortCache(cache);
        setTrips(trips);
      } catch {}
    })();
  }, [unresolvedPorts, pendingPorts, normalizeName]);

  const ClusterBubble = /**
   * React component ClusterBubble: TODO describe purpose and where it’s used.
   * @param {{ count: number; }} { count } - TODO: describe
   * @returns {React.JSX.Element} TODO: describe
   */
  ({ count }: { count: number }) => (
  <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: (themeColors as any).primaryDark || themeColors.primary, borderWidth: 2, borderColor: themeColors.background, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
      <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>{count}</Text>
    </View>
  );

  // Tile provider configuration (defaults to OSM; recommend setting EXPO_PUBLIC_MAPTILER_KEY or EXPO_PUBLIC_TILE_URL_TEMPLATE)
  const tile = useMemo(() => getTileConfig(), []);

  // Helper: mapRef wrapper for MapLibre to support animateToRegion / fitToCoordinates API
  useEffect(() => {
    if (Platform.OS === 'android' && MapLibre) {
      mapRef.current = {
        animateToRegion: (r: Region, duration = 300) => {
          try {
            const zoom = Math.max(1, Math.min(16, Math.log2(360 / Math.max(r.latitudeDelta || 0.02, 0.00001))));
            cameraRef.current?.setCamera?.({ centerCoordinate: [r.longitude, r.latitude], zoomLevel: zoom, duration });
          } catch {}
        },
        fitToCoordinates: (coords: { latitude: number; longitude: number }[], opts?: any) => {
          try {
            const lats = coords.map(c => c.latitude);
            const lngs = coords.map(c => c.longitude);
            const ne = [Math.max(...lngs), Math.max(...lats)];
            const sw = [Math.min(...lngs), Math.min(...lats)];
            const pad = (opts?.edgePadding?.top || 40) as number;
            cameraRef.current?.fitBounds?.(ne, sw, pad, 300);
          } catch {}
        },
      };
    }
  }, [MapLibre]);

  /**
     * React component handleLongPressAtCoord: TODO describe purpose and where it’s used.
     * @param {{ latitude: number; longitude: number; }} coord - TODO: describe
     * @returns {Promise<void>} TODO: describe
     */
    async function handleLongPressAtCoord(coord: { latitude: number; longitude: number }) {
    setPendingCoord(coord);
    setPendingPlaceName(null);
    setAddLocationModalVisible(true);
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) await Location.requestForegroundPermissionsAsync();
      const res = await Location.reverseGeocodeAsync({ latitude: coord.latitude, longitude: coord.longitude });
      if (res && res.length) {
        const r: any = res[0];
        const zoomedIn = typeof region?.latitudeDelta === 'number' && (region as any).latitudeDelta < 0.05;
        const coarse = shortLocationLabel(r, coord.latitude, coord.longitude);
        const name = (r.name || r.street || '').trim();
        const city = (r.city || r.district || r.subregion || '').trim();
        const st = (r.region || '').trim();
        const specific = zoomedIn && name ? [name, city || undefined, st || undefined].filter(Boolean).join(', ') : '';
        setPendingPlaceName((specific || coarse) || null);
      } else {
        setPendingPlaceName(`${coord.latitude.toFixed(4)}, ${coord.longitude.toFixed(4)}`);
      }
    } catch {
      setPendingPlaceName(`${coord.latitude.toFixed(4)}, ${coord.longitude.toFixed(4)}`);
    }
  }

  /**
     * React component renderMap: TODO describe purpose and where it’s used.
     * @returns {React.JSX.Element} TODO: describe
     */
    function renderMap() {
    if (Platform.OS === 'android' && MapLibre) {
      return (
        <MapLibre.MapView style={styles.map} styleURL={tile.styleURL || undefined}
          onLongPress={(e: any) => { try { const coords = (e as any)?.geometry?.coordinates || (e as any)?.coordinates; if (coords && coords.length >= 2) handleLongPressAtCoord({ latitude: coords[1], longitude: coords[0] }); } catch {} }}
        >
          <MapLibre.Camera ref={cameraRef}
            centerCoordinate={[ (region?.longitude ?? 0), (region?.latitude ?? 20) ]}
            zoomLevel={Math.log2(360 / Math.max(region?.latitudeDelta || 80, 0.00001))}
          />
          {routesVisible && tripPaths.length > 0 && (
            <MapLibre.ShapeSource id="trip_paths" shape={{ type: 'FeatureCollection', features: tripPaths.map(p => ({ type:'Feature', properties:{ key: p.key }, geometry:{ type:'LineString', coordinates: p.coords.map(c => [c.longitude, c.latitude]) } })) }}>
              <MapLibre.LineLayer id="trip_paths_layer" style={{ lineColor: routeColor, lineWidth: ROUTE_STROKE_WIDTH }} />
            </MapLibre.ShapeSource>
          )}
          {routesVisible && arrowMarkers.map(am => (
            <MapLibre.PointAnnotation key={am.key} id={am.key} coordinate={[am.lng, am.lat]}>
              <View style={{ width: ARROW_HEIGHT + 6, height: ARROW_HEIGHT + 6, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ transform: [{ rotate: `${am.angle}deg` }], alignItems: 'center', justifyContent: 'center', width: ARROW_HEIGHT + 6, height: ARROW_HEIGHT + 6 }}>
                  <Ionicons name="arrow-up" size={ARROW_HEIGHT + 4} color={routeColor} style={{ marginTop: -2 }} />
                </View>
              </View>
            </MapLibre.PointAnnotation>
          ))}
          {clusters.map(item => (
            item.type === 'point' ? (
              <MapLibre.PointAnnotation key={item.point.key} id={item.point.key} coordinate={[item.point.lng, item.point.lat]}>
                <Pressable onPress={() => router.push(`/trips/${item.point.tripId}/note/${item.point.noteId}` as any)} accessibilityLabel={`Note: ${item.point.title}`}>
                  <View style={{ backgroundColor: themeColors.card, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: themeColors.menuBorder }}>
                    <Text style={{ color: themeColors.text, fontWeight: '700', fontSize: 12 }}>{item.point.title}</Text>
                    {!!item.point.subtitle && <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>{item.point.subtitle}</Text>}
                  </View>
                </Pressable>
              </MapLibre.PointAnnotation>
            ) : (
              <MapLibre.PointAnnotation key={item.cluster.key} id={item.cluster.key} coordinate={[item.cluster.lng, item.cluster.lat]}>
                <Pressable onPress={() => zoomIntoCluster(item.cluster)} accessibilityLabel={`Cluster count ${item.cluster.count}`}>
                  <ClusterBubble count={item.cluster.count} />
                </Pressable>
              </MapLibre.PointAnnotation>
            )
          ))}
          {portMarkers.map(pm => (
            <MapLibre.PointAnnotation key={pm.key} id={pm.key} coordinate={[pm.lng, pm.lat]}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: themeColors.accent, borderWidth: 2, borderColor: '#fff' }} />
            </MapLibre.PointAnnotation>
          ))}
        </MapLibre.MapView>
      );
    }
    if (MapComponents) {
      return (
        <MapComponents.MapView
          ref={(ref: any) => { mapRef.current = ref; }}
          style={styles.map}
          initialRegion={initial}
            customMapStyle={colorScheme === 'dark' ? mapStyleDark : mapStyleLight}
            mapType={Platform.OS === 'android' ? ('none' as any) : mapType}
            onLongPress={async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => { try { const coord = e.nativeEvent.coordinate; if (coord) await handleLongPressAtCoord(coord); } catch {} }}
          >
                {MapComponents && MapComponents.UrlTile ? (
                <MapComponents.UrlTile urlTemplate={tile.urlTemplate} maximumZ={19} flipY={false} />
                ) : null}
                {routesVisible && tripPaths.map((path: TripPath) => (
                <MapComponents.Polyline key={path.key} coordinates={path.coords} strokeColor={routeColor} strokeWidth={ROUTE_STROKE_WIDTH} lineCap="round" lineJoin="round" />
                ))}
                {routesVisible && arrowMarkers.map((am: ArrowMarker) => (
            <MapComponents.Marker key={am.key} coordinate={{ latitude: am.lat, longitude: am.lng }} anchor={{ x: 0.5, y: 0.5 }} flat tracksViewChanges={false} zIndex={5000} accessibilityLabel="Direction arrow">
              <View style={{ width: ARROW_HEIGHT + 6, height: ARROW_HEIGHT + 6, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ transform: [{ rotate: `${am.angle}deg` }], alignItems: 'center', justifyContent: 'center', width: ARROW_HEIGHT + 6, height: ARROW_HEIGHT + 6 }}>
                  <Ionicons name="arrow-up" size={ARROW_HEIGHT + 4} color={routeColor} style={{ marginTop: -2, textShadowColor: '#00000055', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }} />
                </View>
              </View>
            </MapComponents.Marker>
          ))}
          {clusters.map(item => (
            item.type === 'point' ? (
              <MapComponents.Marker key={item.point.key} coordinate={{ latitude: item.point.lat, longitude: item.point.lng }} pinColor={(themeColors as any).primaryDark || themeColors.primary} tracksViewChanges={false} accessibilityLabel={`Note: ${item.point.title}`}>
                <MapComponents.Callout tooltip onPress={() => router.push(`/trips/${item.point.tripId}/note/${item.point.noteId}` as any)}>
                  <View style={styles.calloutBubble}>
                    <Text style={styles.calloutTitle}>{item.point.title}</Text>
                    {!!item.point.subtitle && <Text style={styles.calloutSubtitle}>{item.point.subtitle}</Text>}
                    <Text style={styles.calloutAction}>Open note</Text>
                  </View>
                </MapComponents.Callout>
              </MapComponents.Marker>
            ) : (
              <MapComponents.Marker key={item.cluster.key} coordinate={{ latitude: item.cluster.lat, longitude: item.cluster.lng }} onPress={() => zoomIntoCluster(item.cluster)} tracksViewChanges={false}>
                <ClusterBubble count={item.cluster.count} />
              </MapComponents.Marker>
            )
          ))}
          {portMarkers.map(pm => (
            <MapComponents.Marker key={pm.key} coordinate={{ latitude: pm.lat, longitude: pm.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={9999} title={pm.title || 'Planned port'} description={'Planned port'} accessibilityLabel={`Planned port: ${pm.title}`}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: themeColors.accent, borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 }} />
            </MapComponents.Marker>
          ))}
        </MapComponents.MapView>
      );
    }
    return (
      <View style={[styles.map, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: themeColors.textSecondary, textAlign: 'center', paddingHorizontal: 16 }}>
          Map preview unavailable in this environment. Build and run a dev client to enable maps.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <>
          {/* Render map (MapLibre or fallback handled in renderMap) */}
          {renderMap()}
          <View style={{ position: 'absolute', bottom: 16, right: 16, alignItems: 'flex-end' }}>
              <Pressable
                onPress={async () => {
                  try {
                    await clearPortsCache();
                    await refresh();
                    toast.show('Ports cache cleared', { kind: 'success' });
                    console.debug('[debug] cleared ports cache via UI');
                  } catch (err) {
                    toast.show('Failed to clear ports cache', { kind: 'error' });
                    console.debug('[debug] clearPortsCache failed', err);
                  }
                }}
                style={{ marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder }}
                accessibilityLabel="Debug: clear ports cache"
              >
                <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>Clear ports cache</Text>
              </Pressable>
          </View>
        </>

      <View style={styles.overlay}>
        <View style={styles.overlayTopRow}>
          <View style={styles.overlayFilterRow}>
            <Text style={[styles.overlayChipText, { marginRight: 6 }]}>Filter:</Text>
            <TouchableOpacity
              onPress={() => { setCategory(prev => prev === 'inprogress' ? 'upcoming' : prev === 'upcoming' ? 'completed' : prev === 'completed' ? 'all' : 'inprogress'); }}
              style={[styles.overlayChip, styles.overlayChipActive]}
              accessibilityLabel={`Cycle trip filter. Current: ${category}`}
            >
              <Text style={styles.overlayChipText}>{category === 'inprogress' ? 'In Progress' : category === 'upcoming' ? 'Upcoming' : category === 'completed' ? 'Completed' : 'All'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.overlayFilterRow}>
            <Text style={[styles.overlayChipText, { marginRight: 6 }]}>Routes:</Text>
            <TouchableOpacity
              onPress={() => setRoutesVisible(v => !v)}
              style={[styles.overlayChip, styles.overlayChipActive, !routesVisible && { backgroundColor: themeColors.menuBorder }]}
              accessibilityLabel={routesVisible ? 'Hide route lines' : 'Show route lines'}
            >
              <Text style={styles.overlayChipText}>{routesVisible ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.legendCard} pointerEvents="none">
        <View style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
          <View style={{ width:12, height:12, borderRadius:6, backgroundColor: themeColors.accent, marginRight:6 }} />
          <Text style={styles.legendText}>Ports</Text>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          <View style={{ width:12, height:12, borderRadius:6, backgroundColor: (themeColors as any).primaryDark || themeColors.primary, marginRight:6 }} />
          <Text style={styles.legendText}>Notes</Text>
        </View>
      </View>

      {/* Map attribution */}
      <View style={{ position: 'absolute', bottom: 6, left: 8, backgroundColor: 'transparent' }}>
        <Text
          style={{ color: themeColors.textSecondary, fontSize: 10 }}
          onPress={() => { if (tile.creditLink) Linking.openURL(tile.creditLink); }}
        >
          {tile.attribution}
        </Text>
      </View>

  {/* map always enabled */}

      <Modal
        visible={addLocationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setAddLocationModalVisible(false); setPendingCoord(null); setAddingTripId(null); }}
      >
        <Pressable style={{ flex:1, backgroundColor:'rgba(0,0,0,0.4)' }} onPress={() => { setAddLocationModalVisible(false); setPendingCoord(null); setAddingTripId(null); }} />
        <View style={{ position:'absolute', left:0, right:0, bottom:0, padding:18 }} pointerEvents="box-none">
          <View style={{ backgroundColor: themeColors.card, borderRadius:16, padding:16, borderWidth:1, borderColor: themeColors.menuBorder }}>
            <Text style={{ fontSize:16, fontWeight:'700', marginBottom:10, color: themeColors.text }}>Add Port to Trip</Text>
            {!!pendingCoord && (
              <Text style={{ fontSize:12, color: themeColors.textSecondary, marginBottom:12 }}>
                {pendingPlaceName ? pendingPlaceName : `${pendingCoord.latitude.toFixed(4)}, ${pendingCoord.longitude.toFixed(4)}${pendingPlaceName===null ? ' (resolving...)' : ''}`}
              </Text>
            )}
            {trips.length === 0 ? (
              <Text style={{ color: themeColors.textSecondary, marginBottom: 12 }}>No trips available. Create a Trip first!</Text>
            ) : (
              <FlatList
                data={trips}
                keyExtractor={t => t.id}
                style={{ maxHeight: 260 }}
                renderItem={({ item }) => {
                const active = addingTripId === item.id;
                return (
                  <TouchableOpacity
                    style={{ paddingVertical:10, paddingHorizontal:12, borderRadius:10, backgroundColor: active ? themeColors.primary + '33' : themeColors.background, marginBottom:8, borderWidth:1, borderColor: active ? themeColors.primary : themeColors.menuBorder }}
                    onPress={async () => {
                      if (!pendingCoord) return;
                      setAddingTripId(item.id);
                      const label = (pendingPlaceName && pendingPlaceName.trim()) || `${pendingCoord.latitude.toFixed(4)}, ${pendingCoord.longitude.toFixed(4)}`;
                      // Persist a cache entry so name resolves to the exact pressed coordinates
                      try {
                        await upsertCachedPort({ name: label, lat: pendingCoord.latitude, lng: pendingCoord.longitude, isCruise: true, kind: 'port' } as any);
                      } catch {}
                      const prevPorts = Array.isArray(item.ports) ? item.ports : [];
                      // avoid duplicates (case-insensitive)
                      const exists = prevPorts.some(p => (p || '').trim().toLowerCase() === label.trim().toLowerCase());
                      const nextPorts = exists ? prevPorts : [...prevPorts, label];
                      const updated: Trip = { ...item, ports: nextPorts } as Trip;
                      await upsertTrip(updated);
                      await refresh(); // reload trips + ports cache so marker appears immediately
                      setAddLocationModalVisible(false);
                      setPendingCoord(null);
                      setAddingTripId(null);
                    }}
                  >
                    <Text style={{ fontWeight:'600', color: themeColors.text }}>{item.title}</Text>
                    {item.startDate && <Text style={{ fontSize:11, color: themeColors.textSecondary }}>{item.startDate}{item.endDate ? ' → ' + item.endDate : ''}</Text>}
                  </TouchableOpacity>
                );
              }}
              />
            )}
            <TouchableOpacity onPress={() => { setAddLocationModalVisible(false); setPendingCoord(null); setAddingTripId(null); }} style={{ alignSelf:'flex-end', marginTop:6, paddingVertical:8, paddingHorizontal:14 }}>
              <Text style={{ color: themeColors.primary, fontWeight:'600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
