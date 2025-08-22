import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useFeatureFlags } from '../../components/FeatureFlagsContext';
import { useTheme } from '../../components/ThemeContext';
// Removed advanced route computation; simple straight polylines only
import { loadPortsCache, PortEntry, resolvePortByName, searchPortsOnline, upsertCachedPort } from '../../lib/ports';
import { getTrips } from '../../lib/storage';
import type { Trip } from '../../types';

export default function MapScreen() {
  const { themeColors, colorScheme } = useTheme();
  const { flags } = useFeatureFlags();
  const [trips, setTrips] = useState<Trip[]>([]);
  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const REGION_KEY = 'map_last_region_v1';
  const [portCache, setPortCache] = useState<PortEntry[]>([]);
  const [pendingPorts, setPendingPorts] = useState<string[]>([]); // ports needing online lookup

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    map: { flex: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: themeColors.textSecondary },
    overlay: {
      position: 'absolute', top: 10, left: 10, right: 10,
      backgroundColor: themeColors.card, borderColor: themeColors.menuBorder, borderWidth: 1,
      borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
      flexDirection: 'column',
    },
    overlayTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    overlayText: { color: themeColors.text },
    overlayChip: {
      paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999,
      backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder,
    },
    overlayChipActive: { backgroundColor: themeColors.primary + '22', borderColor: themeColors.primary },
    overlayChipText: { color: themeColors.text, fontWeight: '600' },
    calloutBubble: {
      maxWidth: 240,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderWidth: 1,
      backgroundColor: colorScheme === 'dark' ? '#0f1820' : '#FFFFFF',
      borderColor: colorScheme === 'dark' ? '#1e2c36' : '#e2e8f0',
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 5,
    },
    calloutTitle: {
      fontWeight: '700',
      fontSize: 15,
      marginBottom: 2,
      color: colorScheme === 'dark' ? '#FFFFFF' : '#111111',
    },
    calloutSubtitle: {
      fontSize: 13,
      color: colorScheme === 'dark' ? '#b8c5cc' : '#333333',
    },
    calloutAction: {
      fontSize: 13,
      fontWeight: '600',
      marginTop: 8,
      color: themeColors.primary,
    },
  }), [themeColors, colorScheme]);

  const refresh = useCallback(async () => {
    const [t, cache] = await Promise.all([
      getTrips(),
      loadPortsCache(),
    ]);
    setTrips(t);
    setPortCache(cache);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // State/memos used by UI must be declared before any conditional returns
  // Category filter matches Trips screen: in progress, upcoming, completed, all
  const [category, setCategory] = useState<'inprogress' | 'upcoming' | 'completed' | 'all'>('all');
  // Persist/restore category state
  useEffect(() => {
    (async () => {
      try {
        const cat = await AsyncStorage.getItem('map_filter_category_v1');
        if (cat === 'inprogress' || cat === 'upcoming' || cat === 'completed' || cat === 'all') setCategory(cat);
      } catch {}
    })();
  }, []);
  useEffect(() => {
    (async () => { try { await AsyncStorage.setItem('map_filter_category_v1', category); } catch {} })();
  }, [category]);

  // Match logic from Trips screen
  function parseLocalYmd(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
  function startOfToday(): Date { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
  function isTripCompleted(t: Trip) {
    if (t.completed) return true;
    if (!t.endDate) return false;
    const endTs = parseLocalYmd(t.endDate).getTime();
    return endTs < startOfToday().getTime();
  }
  function isTripInProgress(t: Trip) {
    if (t.completed) return false;
    if (!t.startDate) return false;
    const today = startOfToday().getTime();
    const startTs = parseLocalYmd(t.startDate).getTime();
    const hasEnd = !!t.endDate;
    const endTs = hasEnd ? parseLocalYmd(t.endDate as string).getTime() : undefined;
    if (today < startTs) return false;
    if (typeof endTs === 'number' && today > endTs) return false;
    return true;
  }

  const mapDisabled = !flags.maps;

  // Compute initial region (fallback) and restore last camera
  const initial: Region = useMemo(() => ({ latitude: 20, longitude: 0, latitudeDelta: 80, longitudeDelta: 80 }), []);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(REGION_KEY);
        if (!mounted) return;
        if (saved) {
          const r = JSON.parse(saved) as Region;
          setRegion(prev => prev ?? r);
          if (mapRef.current) {
            requestAnimationFrame(() => mapRef.current?.animateToRegion(r, 0));
          }
          return;
        }
      } catch {}
      if (mounted && !region) setRegion(initial);
    })();
    return () => { mounted = false; };
  }, [REGION_KEY, initial, region]);

  let filteredTrips = trips as Trip[];
  if (category === 'completed') filteredTrips = trips.filter(isTripCompleted);
  else if (category === 'inprogress') filteredTrips = trips.filter(isTripInProgress);
  else if (category === 'upcoming') filteredTrips = trips.filter(t => !isTripCompleted(t) && !isTripInProgress(t));

  const markers = useMemo(() => {
    const items: { key: string; lat: number; lng: number; title: string; subtitle?: string; tripId: string; noteId: string }[] = [];
    for (const trip of filteredTrips) {
      for (const d of trip.days) {
        const loc = d.location;
        if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
          const when = d.date ? new Date(d.date).toLocaleDateString() : '';
          items.push({
            key: `${trip.id}_${d.id}`,
            lat: loc.lat,
            lng: loc.lng,
            title: d.title || d.locationName || 'Note',
            subtitle: when,
            tripId: trip.id,
            noteId: d.id,
          });
        }
      }
    }
    return items;
  }, [filteredTrips]);

  // Clustering
  type MarkerPoint = typeof markers[number];
  type Cluster = { key: string; lat: number; lng: number; count: number; children: MarkerPoint[] };
  // Adjust thresholds based on zoom level; smaller buckets when zoomed in
  function computeThresholds(r: Region) {
    // Derive a simple zoom band from latitudeDelta
    const d = r.latitudeDelta;
    let div = 22; // default medium zoom
    if (d > 60) div = 10; // far out
    else if (d > 30) div = 14;
    else if (d > 15) div = 18;
    else if (d > 8) div = 22;
    else if (d > 4) div = 26;
    else div = 32; // very zoomed in
    const latThresh = Math.max(d / div, 0.005);
    // Adjust longitude scale by latitude
    const rad = (r.latitude * Math.PI) / 180;
    const lngScale = Math.max(Math.cos(rad), 0.2);
    const lngThresh = Math.max(r.longitudeDelta / div * lngScale, 0.005);
    return { latThresh, lngThresh };
  }

  const clusters = useMemo(() => {
    if (!region) return markers.map(m => ({ type: 'point' as const, point: m }));
    const { latThresh, lngThresh } = computeThresholds(region);
    const assigned = new Set<string>();
    const out: ({ type: 'point'; point: MarkerPoint } | { type: 'cluster'; cluster: Cluster })[] = [];
    for (let i = 0; i < markers.length; i++) {
      const m = markers[i];
      if (assigned.has(m.key)) continue;
      const bucket: MarkerPoint[] = [m];
      assigned.add(m.key);
      for (let j = i + 1; j < markers.length; j++) {
        const n = markers[j];
        if (assigned.has(n.key)) continue;
        if (Math.abs(m.lat - n.lat) <= latThresh && Math.abs(m.lng - n.lng) <= lngThresh) {
          bucket.push(n);
          assigned.add(n.key);
        }
      }
      if (bucket.length === 1) {
        out.push({ type: 'point', point: m });
      } else {
        const avgLat = bucket.reduce((s, p) => s + p.lat, 0) / bucket.length;
        const avgLng = bucket.reduce((s, p) => s + p.lng, 0) / bucket.length;
        out.push({ type: 'cluster', cluster: { key: `c_${m.key}`, lat: avgLat, lng: avgLng, count: bucket.length, children: bucket } });
      }
    }
    return out;
  }, [markers, region]);

  const zoomIntoCluster = (c: Cluster) => {
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
    { elementType: 'geometry', stylers: [{ color: '#ebe3cd' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#523735' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f1e6' }] },
    { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#b9d3c2' }] },
  ] as any), []);
  const mapStyleDark = useMemo(() => ([
    { elementType: 'geometry', stylers: [{ color: '#1f1f1f' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8f8f8f' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
    { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#0b3d4f' }] },
    { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ] as any), []);

  // We ship with a lightweight manual clustering implementation by default.

  // Planned ports and cruise line paths built from trip.ports matched to note locations
  type PortMarker = { key: string; lat: number; lng: number; title: string; tripId: string };
  type TripPath = { key: string; coords: { latitude: number; longitude: number }[]; tripId: string };
  const { portMarkers, tripPaths, unresolvedPorts } = useMemo(() => {
    const ports: PortMarker[] = [];
    const paths: TripPath[] = [];
    const norm = (s?: string | null) => (s || '').trim().toLowerCase();
    const unresolved: { port: string; tripId: string }[] = [];

    for (const trip of filteredTrips) {
      const list = Array.isArray(trip.ports) ? trip.ports : [];
      const coords: { latitude: number; longitude: number }[] = [];
      list.forEach((p, idx) => {
        const pn = norm(p);
        const primary = norm(p.split(',')[0] || p);
        if (!pn) return;
        // Find a note whose locationName includes the planned port name
        const hit = trip.days.find(d => {
          if (!d.location) return false;
          const ln = norm(d.locationName);
          // match either direction and with primary token to handle inputs like "City, ST, CC"
          return (
            ln.includes(pn) || pn.includes(ln) ||
            (primary ? (ln.includes(primary) || primary.includes(ln)) : false)
          );
        });
        if (hit && hit.location && typeof hit.location.lat === 'number' && typeof hit.location.lng === 'number') {
          ports.push({ key: `port_${trip.id}_${idx}`, lat: hit.location.lat, lng: hit.location.lng, title: p, tripId: trip.id });
          coords.push({ latitude: hit.location.lat, longitude: hit.location.lng });
        } else {
          // Try fuzzy geocode from cache/curated list
          const resolved = resolvePortByName(p, portCache);
          if (resolved) {
            ports.push({ key: `port_${trip.id}_${idx}`, lat: resolved.lat, lng: resolved.lng, title: resolved.name, tripId: trip.id });
            coords.push({ latitude: resolved.lat, longitude: resolved.lng });
          } else {
            unresolved.push({ port: p, tripId: trip.id });
          }
        }
      });
      if (coords.length >= 2) {
        paths.push({ key: `path_${trip.id}`, coords, tripId: trip.id });
      }
    }

    return { portMarkers: ports, tripPaths: paths, unresolvedPorts: unresolved };
  }, [filteredTrips, portCache]);

  // Removed route caching/fetching – paths render directly between recorded/derived port points.

  // Effect: for any unresolved ports, try online geocoding and cache results
  // Normalize helper for names
  const normalizeName = useCallback((s: string) => s.trim().toLowerCase(), []);

  useEffect(() => {
    if (!unresolvedPorts || unresolvedPorts.length === 0) return;
    // Build a unique, normalized list of ports to look up this cycle
    const uniq = Array.from(new Set(unresolvedPorts.map(u => normalizeName(u.port))));
    const toLookup = uniq.filter(n => !pendingPorts.map(normalizeName).includes(n));
    if (toLookup.length === 0) return;
    // Track pending by original names (best effort)
    setPendingPorts(prev => [...prev, ...toLookup]);
    (async () => {
      for (const normName of toLookup) {
        const portName = normName; // already normalized
        try {
          // Try multiple variants; be gentle to avoid rate limits
          let results = await searchPortsOnline(portName, 1);
          if (!results || results.length === 0) {
            results = await searchPortsOnline(`${portName} cruise port`, 1);
          }
          if (!results || results.length === 0) {
            results = await searchPortsOnline(`${portName} port`, 1);
          }
          if (results && results.length > 0) {
            await upsertCachedPort(results[0]);
          }
        } catch {}
        // Small delay between calls to be polite to the API
        try { await new Promise(res => setTimeout(res, 400)); } catch {}
      }
      // After all lookups, refresh the cache and trips to trigger a re-render
      try {
        const [cache, trips] = await Promise.all([
          loadPortsCache(),
          getTrips(),
        ]);
        setPortCache(cache);
        setTrips(trips);
      } catch {}
    })();
  }, [unresolvedPorts, pendingPorts, normalizeName]);

  // Static cluster bubble (no animation to prevent flashing)
  const ClusterBubble = ({ count }: { count: number }) => (
    <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: (themeColors as any).primaryDark || themeColors.primary, borderWidth: 2, borderColor: themeColors.background, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
      <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>{count}</Text>
    </View>
  );

  // NoteMarker removed; using native pin to reduce flicker

  return (
    <View style={styles.container}>
  {!mapDisabled && (
  <MapView
        ref={(ref: MapView | null) => { mapRef.current = ref; }}
        style={styles.map}
        initialRegion={initial}
        provider={PROVIDER_GOOGLE}
        customMapStyle={colorScheme === 'dark' ? mapStyleDark : mapStyleLight}
        onRegionChangeComplete={async (r: Region) => {
          setRegion(r);
          try { await AsyncStorage.setItem(REGION_KEY, JSON.stringify(r)); } catch {}
        }}
      >
    {/* Cruise lines between planned ports per trip */}
  {tripPaths.map(path => (
        <Polyline
          key={path.key}
          coordinates={path.coords}
          strokeColor={themeColors.secondary}
          strokeWidth={4}
          lineCap="round"
          lineJoin="round"
          geodesic
        />
      ))}
    {clusters.map(item => (
      item.type === 'point' ? (
        <Marker
          key={item.point.key}
          coordinate={{ latitude: item.point.lat, longitude: item.point.lng }}
          pinColor={(themeColors as any).primaryDark || themeColors.primary}
          tracksViewChanges={false}
          accessibilityLabel={`Note: ${item.point.title}`}
        >
          <Callout tooltip onPress={() => router.push(`/trips/${item.point.tripId}/note/${item.point.noteId}` as any)}>
            <View style={styles.calloutBubble}>
              <Text style={styles.calloutTitle}>{item.point.title}</Text>
              {!!item.point.subtitle && <Text style={styles.calloutSubtitle}>{item.point.subtitle}</Text>}
              <Text style={styles.calloutAction}>Open note</Text>
            </View>
          </Callout>
        </Marker>
      ) : (
  <Marker key={item.cluster.key} coordinate={{ latitude: item.cluster.lat, longitude: item.cluster.lng }} onPress={() => zoomIntoCluster(item.cluster)} tracksViewChanges={false}>
          <ClusterBubble count={item.cluster.count} />
        </Marker>
      )
    ))}
    {/* Planned ports as minimalist circles (no callouts) */}
    {portMarkers.map(pm => (
      <Marker
        key={pm.key}
        coordinate={{ latitude: pm.lat, longitude: pm.lng }}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
        zIndex={9999}
        accessibilityLabel={`Planned port: ${pm.title}`}
  title={pm.title || 'Planned port'}
  description={'Planned port'}
      >
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: themeColors.accent, borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 }} />
      </Marker>
    ))}
  </MapView>
  )}
      <View style={styles.overlay}>
        <View style={styles.overlayTopRow}>
          <Text style={styles.overlayText}>
            {category === 'inprogress' ? 'Showing: In Progress' : category === 'upcoming' ? 'Showing: Upcoming' : category === 'completed' ? 'Showing: Completed' : 'Showing: All Cruises'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => {
                setCategory(prev => prev === 'inprogress' ? 'upcoming' : prev === 'upcoming' ? 'completed' : prev === 'completed' ? 'all' : 'inprogress');
              }}
              style={[styles.overlayChip, styles.overlayChipActive]}
            >
              <Text style={styles.overlayChipText}>
                {category === 'inprogress' ? 'In Progress' : category === 'upcoming' ? 'Upcoming' : category === 'completed' ? 'Completed' : 'All Cruises'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Legend moved beneath filter controls */}
        <View style={styles.legendRow}>
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: themeColors.accent, marginRight: 6 }} />
          <Text style={[styles.overlayChipText, { marginRight: 10 }]}>Planned ports: {portMarkers.length}</Text>
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: (themeColors as any).primaryDark || themeColors.primary, marginRight: 6 }} />
          <Text style={styles.overlayChipText}>Notes / Clusters</Text>
        </View>
      </View>
  {/* Trip selection dropdown removed; category cycles instead */}
      {mapDisabled && (
        <View style={[styles.container, styles.empty, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }] }>
          <Text style={styles.emptyText}>Map is disabled.</Text>
        </View>
      )}
    </View>
  );
}
