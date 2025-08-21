import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useFeatureFlags } from '../../components/FeatureFlagsContext';
import { useTheme } from '../../components/ThemeContext';
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
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    overlayText: { color: themeColors.text },
    overlayChip: {
      paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999,
      backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder,
    },
    overlayChipActive: { backgroundColor: themeColors.primary + '22', borderColor: themeColors.primary },
    overlayChipText: { color: themeColors.text, fontWeight: '600' },
  }), [themeColors]);

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
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'trip'>('all');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const now = Date.now();
  // Persist/restore filter state
  useEffect(() => {
    (async () => {
      try {
        const fm = await AsyncStorage.getItem('map_filter_mode');
        const st = await AsyncStorage.getItem('map_selected_trip');
        if (fm === 'all' || fm === 'active' || fm === 'trip') setFilterMode(fm);
        if (st) setSelectedTripId(st);
      } catch {}
    })();
  }, []);
  useEffect(() => {
    (async () => {
      try { await AsyncStorage.setItem('map_filter_mode', filterMode); } catch {}
      try {
        if (selectedTripId) await AsyncStorage.setItem('map_selected_trip', selectedTripId);
        else await AsyncStorage.removeItem('map_selected_trip');
      } catch {}
    })();
  }, [filterMode, selectedTripId]);

  // Active trips heuristic
  const activeTrips = useMemo(() => trips.filter(t => !t.completed && (!t.endDate || new Date(t.endDate).getTime() >= now)), [trips, now]);
  const selectedTrip = useMemo(() => trips.find(t => t.id === selectedTripId) || null, [trips, selectedTripId]);

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
  if (filterMode === 'active') filteredTrips = activeTrips;
  else if (filterMode === 'trip' && selectedTrip) filteredTrips = [selectedTrip];

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

  // Animated cluster bubble
  const ClusterBubble = ({ count }: { count: number }) => {
    const scale = useRef(new Animated.Value(0.8)).current;
    useEffect(() => {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }).start();
    }, [scale, count]);
    return (
      <Animated.View style={{ transform: [{ scale }], width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.primary, borderWidth: 2, borderColor: themeColors.background }}>
        <Text style={{ color: 'white', fontWeight: '700' }}>{count}</Text>
      </Animated.View>
    );
  };

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
      />
    ))}
    {clusters.map(item => (
              item.type === 'point' ? (
                <Marker key={item.point.key} coordinate={{ latitude: item.point.lat, longitude: item.point.lng }}>
                  <Callout onPress={() => router.push(`/trips/${item.point.tripId}/note/${item.point.noteId}` as any)}>
                    <View style={{ maxWidth: 240 }}>
                      <Text style={{ fontWeight: '700', color: colorScheme === 'dark' ? '#fff' : '#111' }}>{item.point.title}</Text>
                      {!!item.point.subtitle && <Text style={{ color: colorScheme === 'dark' ? '#eee' : '#333' }}>{item.point.subtitle}</Text>}
                      <Text style={{ color: '#007aff', marginTop: 6 }}>Open note</Text>
                    </View>
                  </Callout>
                </Marker>
              ) : (
                <Marker key={item.cluster.key} coordinate={{ latitude: item.cluster.lat, longitude: item.cluster.lng }} onPress={() => zoomIntoCluster(item.cluster)}>
                  <ClusterBubble count={item.cluster.count} />
                </Marker>
              )
    ))}
    {/* Planned port markers with distinct color (rendered last to sit on top) */}
    {portMarkers.map(pm => (
      <Marker
        key={pm.key}
        coordinate={{ latitude: pm.lat, longitude: pm.lng }}
        pinColor={themeColors.accent}
        title={pm.title}
        zIndex={9999}
      >
        <Callout>
          <View style={{ maxWidth: 240 }}>
            <Text style={{ fontWeight: '700', color: colorScheme === 'dark' ? '#fff' : '#111' }}>Planned port</Text>
            <Text style={{ color: colorScheme === 'dark' ? '#eee' : '#333' }}>{pm.title}</Text>
          </View>
        </Callout>
      </Marker>
    ))}
  </MapView>
  )}
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>
          {filterMode === 'trip' && selectedTrip ? `Showing: ${selectedTrip.title}` : filterMode === 'active' ? 'Showing: Active trips' : 'Showing: All trips'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => {
              setDropdownOpen(false);
              setFilterMode(prev => (prev === 'all' ? 'active' : 'all'));
              if (filterMode !== 'trip') setSelectedTripId(null);
            }}
            style={[styles.overlayChip, (filterMode === 'active') ? styles.overlayChipActive : null]}
          >
            <Text style={styles.overlayChipText}>{filterMode === 'active' ? 'Active only' : 'All trips'}</Text>
          </TouchableOpacity>
          {activeTrips.length > 1 && (
            <TouchableOpacity onPress={() => setDropdownOpen(v => !v)} style={[styles.overlayChip, (filterMode === 'trip') ? styles.overlayChipActive : null]}>
              <Text style={styles.overlayChipText}>{filterMode === 'trip' && selectedTrip ? selectedTrip.title : 'Pick active trip'}</Text>
            </TouchableOpacity>
          )}
          {/* Legend and counts */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: themeColors.accent, marginRight: 4 }} />
            <Text style={[styles.overlayChipText, { marginRight: 8 }]}>Planned ports: {portMarkers.length}</Text>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: themeColors.primary, marginRight: 4 }} />
            <Text style={styles.overlayChipText}>Notes/Clusters</Text>
          </View>
        </View>
      </View>
  {dropdownOpen && activeTrips.length > 1 && (
        <View style={{ position: 'absolute', right: 10, top: 56, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder, borderRadius: 8, overflow: 'hidden' }}>
          <TouchableOpacity
            style={{ paddingHorizontal: 12, paddingVertical: 10 }}
            onPress={() => { setFilterMode('active'); setSelectedTripId(null); setDropdownOpen(false); }}
          >
            <Text style={{ color: themeColors.text }}>All active trips</Text>
          </TouchableOpacity>
          {activeTrips.map(t => (
            <TouchableOpacity key={t.id} style={{ paddingHorizontal: 12, paddingVertical: 10 }} onPress={() => { setFilterMode('trip'); setSelectedTripId(t.id); setDropdownOpen(false); }}>
              <Text style={{ color: themeColors.text }}>{t.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {mapDisabled && (
        <View style={[styles.container, styles.empty, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }] }>
          <Text style={styles.emptyText}>Map is disabled.</Text>
        </View>
      )}
    </View>
  );
}
