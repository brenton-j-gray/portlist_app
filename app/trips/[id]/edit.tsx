import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { useTheme } from '../../../components/ThemeContext';
import { loadPortsCache, PortEntry, resolvePortByName, searchPorts, searchPortsOnline, upsertCachedPort } from '../../../lib/ports';
import { deleteTrip, getTripById, upsertTrip } from '../../../lib/storage';
import { Trip } from '../../../types';
function parseLocal(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const ymd = String(dateStr).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}
function formatDate(dateStr: string) {
  const d = parseLocal(dateStr);
  if (!d) return dateStr || '';
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function EditTripScreen() {
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | undefined>();
  const [title, setTitle] = useState('');
  const [ship, setShip] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [completed, setCompleted] = useState(false);
  const [ports, setPorts] = useState<string[]>([]);
  const [newPort, setNewPort] = useState('');
  const [portsCache, setPortsCache] = useState<PortEntry[]>([]);
  const [portSuggestions, setPortSuggestions] = useState<PortEntry[]>([]);
  const newPortInputRef = useRef<TextInput | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const [isNewPortFocused, setIsNewPortFocused] = useState(false);
  const [portsRowY, setPortsRowY] = useState(0);
  type PortItem = { key: string; label: string };

  const scrollPortsToTop = useCallback(() => {
    if (scrollRef.current) {
      const y = Math.max(0, portsRowY - 16); // account for content padding
      scrollRef.current.scrollTo({ y, animated: true });
    }
  }, [portsRowY]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const t = await getTripById(id);
      if (t) {
        setTrip(t);
        setTitle(t.title);
        setShip(t.ship || '');
  setStartDate(t.startDate || '');
  setEndDate(t.endDate || '');
  setCompleted(!!t.completed);
  setPorts([...(t.ports || [])]);
      }
      // Load cached ports for autocomplete
      try {
        const cache = await loadPortsCache();
        setPortsCache(cache);
      } catch {}
    })();
  }, [id]);

  // Debounced fuzzy suggestions from local curated+cache + online fallback
  useEffect(() => {
    const q = newPort.trim();
    if (q.length < 2) {
      setPortSuggestions([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
  const localHits = searchPorts(q, portsCache, 6);
  // If local hits are few, fetch online fallback
  let merged = localHits.slice();
        if (localHits.length < 6) {
          const online = await searchPortsOnline(q, 5);
          // Merge by name+country, prefer local first
          const seen = new Set(localHits.map(p => `${p.name.toLowerCase()}|${(p.country||'').toLowerCase()}`));
          for (const o of online) {
            const key = `${o.name.toLowerCase()}|${(o.country||'').toLowerCase()}`;
            if (!seen.has(key)) { merged.push(o); seen.add(key); }
          }
        }
  // Re-rank merged: prefer port/harbor-like names
  const isPorty = (s: string) => /\b(port|harbour|harbor|seaport|ferry|terminal|cruise|pier)\b/i.test(s);
  merged.sort((a, b) => (Number(isPorty(b.name)) - Number(isPorty(a.name))));
        if (!cancelled) setPortSuggestions(merged.slice(0, 10));
      } catch {
        if (!cancelled) setPortSuggestions([]);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [newPort, portsCache]);

  // helper removed: hasQuery

  // Track keyboard height for dynamic bottom padding (to keep suggestions visible)
  useEffect(() => {
    const onShow = (e: any) => setKeyboardHeight(e?.endCoordinates?.height ?? 0);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener('keyboardDidShow', onShow);
    const hideSub = Keyboard.addListener('keyboardDidHide', onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // When suggestions or keyboard changes while input is focused, keep Ports at top
  useEffect(() => {
    if (isNewPortFocused) {
      requestAnimationFrame(scrollPortsToTop);
    }
  }, [isNewPortFocused, portSuggestions.length, keyboardHeight, scrollPortsToTop]);

  async function onSave() {
    if (!trip) return;
    if (!title.trim()) {
      Alert.alert('Title required');
      return;
    }
    // Validate end >= start when both provided
    if (startDate && endDate) {
      const s = (parseLocal(startDate) as Date).getTime();
      const e = (parseLocal(endDate) as Date).getTime();
      if (e < s) {
        Alert.alert('Invalid dates', 'End date cannot be before start date.');
        return;
      }
    }
    // Normalize and deduplicate ports on save to formatted "Name, ST, CC" when available
    const normalized = ports
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => {
        const r = resolvePortByName(p, portsCache);
        return r ? `${r.name}${r.regionCode ? `, ${r.regionCode}` : ''}${r.country ? `, ${r.country}` : ''}` : p;
      });
    const dedup: string[] = [];
    for (const p of normalized) {
      const key = p.trim().toLowerCase();
      if (!dedup.some(x => x.trim().toLowerCase() === key)) dedup.push(p);
    }
    const updated: Trip = { ...trip, title: title.trim(), ship: ship.trim() || undefined, startDate: startDate || undefined, endDate: endDate || undefined, completed, ports: dedup };
    await upsertTrip(updated);
    // Refresh cache so formatting reflects any newly cached ports from selections
    try { const cache = await loadPortsCache(); setPortsCache(cache); } catch {}
    router.replace(`/trips/${trip.id}`);
  }

  async function performDelete() {
    if (!trip) return;
    await deleteTrip(trip.id);
    router.replace('/trips');
  }

  function onDelete() {
    setConfirmText('');
    setShowDeleteModal(true);
  }

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
    title: { fontSize: 22, fontWeight: '600', marginBottom: 12, color: themeColors.text },
    input: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 10, marginBottom: 10 },
    btn: { backgroundColor: themeColors.primaryDark, padding: 12, borderRadius: 10, alignItems: 'center' },
    btnText: { color: themeColors.badgeText, fontWeight: '700' },
    label: { fontSize: 14, fontWeight: '500', marginBottom: 2, marginLeft: 2, color: themeColors.textSecondary },
  delBtn: { backgroundColor: themeColors.danger, padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  delBtnText: { color: themeColors.badgeText, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: themeColors.card, borderRadius: 14, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: themeColors.primary },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6, color: themeColors.text },
  modalMessage: { fontSize: 14, color: themeColors.textSecondary, marginBottom: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card },
  modalBtnCancelText: { color: themeColors.text, fontWeight: '600' },
  modalInput: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.background, color: themeColors.text, borderRadius: 8, padding: 10, marginBottom: 14 },
  modalBtnDelete: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: themeColors.danger },
  modalBtnDeleteText: { color: themeColors.badgeText, fontWeight: '700' },
  }), [themeColors]);

  if (!trip) {
    return <View style={styles.container}><Text style={{ color: themeColors.textSecondary }}>Loading...</Text></View>;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: 'height' }) as any}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
    <ScrollView
      ref={scrollRef as any}
      style={{ flex: 1 }}
      contentContainerStyle={{
        padding: 16,
        paddingBottom:
          // Base padding
          40 + (
            // When suggestions are visible, add space so the list clears the keyboard
            portSuggestions.length > 0
              ? (Platform.OS === 'ios' ? 120 : Math.max(120, keyboardHeight + 20))
              : 0
          ),
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ backgroundColor: themeColors.background }}>
      <Text style={styles.title}>Edit Trip</Text>
  <Text style={styles.label}>Trip Title</Text>
  <TextInput style={styles.input} placeholder="Trip title" placeholderTextColor={themeColors.textSecondary} value={title} onChangeText={setTitle} />
  <Text style={styles.label}>Ship (optional)</Text>
  <TextInput style={styles.input} placeholder="Ship (optional)" placeholderTextColor={themeColors.textSecondary} value={ship} onChangeText={setShip} />
  <Text style={styles.label}>Start Date</Text>
      <>
        <Pressable onPress={() => setShowStartPicker(true)} style={styles.input}>
          <Text style={{ color: startDate ? themeColors.text : themeColors.textSecondary }}>{startDate ? formatDate(startDate) : 'Start date (YYYY-MM-DD)'}</Text>
        </Pressable>
        {showStartPicker && (
          <DateTimePicker
            value={startDate ? (parseLocal(startDate) as Date) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, date) => {
              setShowStartPicker(Platform.OS === 'ios');
              if (date) setStartDate(toISODate(date));
            }}
          />
        )}
      </>
  <Text style={styles.label}>End Date</Text>
      <>
        <Pressable onPress={() => setShowEndPicker(true)} style={styles.input}>
          <Text style={{ color: endDate ? themeColors.text : themeColors.textSecondary }}>{endDate ? formatDate(endDate) : 'End date (YYYY-MM-DD)'}</Text>
        </Pressable>
        {showEndPicker && (
          <DateTimePicker
            value={endDate ? (parseLocal(endDate) as Date) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, date) => {
              setShowEndPicker(Platform.OS === 'ios');
              if (date) setEndDate(toISODate(date));
            }}
          />
        )}
      </>
  {/* Ports editor */}
  <Text style={styles.label}>Ports</Text>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
    {/* Capture layout to know where to pin on focus */}
  </View>
  <View onLayout={(e) => setPortsRowY(e.nativeEvent.layout.y)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
    <TextInput
      ref={newPortInputRef as any}
      style={[styles.input, { flex: 1, marginBottom: 0 }]}
      placeholder="Add a port (e.g., Juneau, AK)"
      placeholderTextColor={themeColors.textSecondary}
      value={newPort}
      onChangeText={setNewPort}
      accessibilityLabel="New port"
      returnKeyType="done"
      onFocus={() => { setIsNewPortFocused(true); requestAnimationFrame(scrollPortsToTop); }}
  onBlur={() => setIsNewPortFocused(false)}
      onSubmitEditing={async () => {
        const q = newPort.trim();
        if (q) {
          const r = resolvePortByName(q, portsCache);
          const formatted = r ? `${r.name}${r.regionCode ? `, ${r.regionCode}` : ''}${r.country ? `, ${r.country}` : ''}` : q;
          setPorts(prev => {
            const exists = prev.some(v => v.trim().toLowerCase() === formatted.trim().toLowerCase());
            return exists ? prev : [...prev, formatted];
          });
          if (r) {
            try {
              await upsertCachedPort({ name: r.name, country: r.country, regionCode: r.regionCode, lat: r.lat, lng: r.lng, aliases: r.aliases, source: 'cache' });
              const cache = await loadPortsCache();
              setPortsCache(cache);
            } catch {}
          }
          setNewPort('');
          setPortSuggestions([]);
        }
      }}
    />
    <Pressable
      onPress={async () => {
        const q = newPort.trim();
        if (q) {
          const r = resolvePortByName(q, portsCache);
          const formatted = r ? `${r.name}${r.regionCode ? `, ${r.regionCode}` : ''}${r.country ? `, ${r.country}` : ''}` : q;
          setPorts(prev => {
            const exists = prev.some(v => v.trim().toLowerCase() === formatted.trim().toLowerCase());
            return exists ? prev : [...prev, formatted];
          });
          if (r) {
            try {
              await upsertCachedPort({ name: r.name, country: r.country, regionCode: r.regionCode, lat: r.lat, lng: r.lng, aliases: r.aliases, source: 'cache' });
              const cache = await loadPortsCache();
              setPortsCache(cache);
            } catch {}
          }
          setNewPort('');
          setPortSuggestions([]);
        }
      }}
      style={[styles.btn, { paddingVertical: 10, paddingHorizontal: 14 }]}
      accessibilityRole="button"
    >
      <Text style={styles.btnText}>Add</Text>
    </Pressable>
  </View>
  {/* Suggestions list for Ports */}
  {portSuggestions.length > 0 ? (
    <View style={{
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: themeColors.menuBorder,
      backgroundColor: themeColors.card,
      borderRadius: 8,
      marginBottom: 10,
      overflow: 'hidden',
    }}>
      {portSuggestions.map((s, idx) => (
        <Pressable
          key={idx}
          onPress={() => {
            // Add selected suggestion formatted, save coords to cache, and clear input
            const formatted = `${s.name}${s.regionCode ? `, ${s.regionCode}` : ''}${s.country ? `, ${s.country}` : ''}`;
            setPorts(prev => {
              const exists = prev.some(p => p.trim().toLowerCase() === formatted.trim().toLowerCase());
              return exists ? prev : [...prev, formatted];
            });
            setNewPort('');
            setPortSuggestions([]);
            // Persist coordinates to local cache for map usage
            upsertCachedPort({ name: s.name, country: s.country, regionCode: s.regionCode, lat: s.lat, lng: s.lng, aliases: s.aliases, source: 'cache' }).then(async () => {
              // refresh local cache state so future searches include this entry as cached
              try { const cache = await loadPortsCache(); setPortsCache(cache); } catch {}
            }).catch(() => {});
          }}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderBottomWidth: idx === portSuggestions.length - 1 ? 0 : StyleSheet.hairlineWidth,
            borderBottomColor: themeColors.menuBorder,
            backgroundColor: themeColors.card,
          }}
          accessibilityRole="button"
          accessibilityLabel={`Use ${s.name}`}
        >
          <Text numberOfLines={2} style={{ color: themeColors.text }}>
            {s.name}
            {s.regionCode || s.country ? `, ` : ''}
            {s.regionCode ? `${s.regionCode}` : ''}
            {s.regionCode && s.country ? `, ` : ''}
            {s.country ? `${s.country}` : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  ) : null}
  {ports.length > 0 ? (
    <View style={{ marginBottom: 10 }}>
      <DraggableFlatList<PortItem>
        data={ports.map((p, i) => ({ key: `${i}-${p}`, label: p }))}
        keyExtractor={(item: PortItem) => item.key}
        onDragEnd={({ data }: { data: PortItem[] }) => setPorts(data.map((d: PortItem) => d.label))}
        containerStyle={{}}
        activationDistance={8}
        scrollEnabled={false}
        renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<PortItem>) => {
          const idx = getIndex?.() ?? 0;
          return (
            <ScaleDecorator activeScale={0.98}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {/* Handle */}
                <Pressable onLongPress={drag} delayLongPress={120} hitSlop={8} style={{ padding: 6 }} accessibilityLabel={`Reorder ${item.label}`}>
                  <Ionicons name="reorder-three" size={22} color={themeColors.textSecondary} />
                </Pressable>
                {/* Index number */}
                <Text style={{ width: 22, textAlign: 'right', color: themeColors.textSecondary }}>{idx + 1}.</Text>
                {/* Editable input */}
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[styles.input, { marginBottom: 4 }]}
                    value={item.label}
                    onChangeText={(txt) => setPorts(prev => prev.map((v, i) => i === idx ? txt : v))}
                  />
                </View>
                {/* Remove */}
                <Pressable onPress={() => setPorts(prev => prev.filter((_, i) => i !== idx))} style={[styles.delBtn, { paddingVertical: 8, paddingHorizontal: 10 }]} accessibilityLabel={`Remove port ${item.label}`}>
                  <Text style={styles.delBtnText}>Remove</Text>
                </Pressable>
              </View>
            </ScaleDecorator>
          );
        }}
      />
    </View>
  ) : null}
      <Pressable onPress={onSave} style={[styles.btn, !title.trim() && { opacity: 0.6 }, { marginTop: 8 }]} disabled={!title.trim()}>
        <Text style={styles.btnText}>Save Changes</Text>
      </Pressable>
      <Pressable onPress={onDelete} style={styles.delBtn} accessibilityLabel="Delete Trip">
        <Text style={styles.delBtnText}>Delete Trip</Text>
      </Pressable>

  {/* Spacer so last inputs are not covered by submit/delete buttons */}
  <View style={{ height: 24 }} />

  <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowDeleteModal(false); setConfirmText(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Trip?</Text>
            <Text style={styles.modalMessage}>This cannot be undone. Type the trip title below to confirm:</Text>
            <Text style={[styles.modalMessage, { fontWeight: '700', color: themeColors.text }]}>
              {trip?.title}
            </Text>
            <TextInput
              autoFocus
              style={styles.modalInput}
              placeholder={`Type "${trip?.title}"`}
              placeholderTextColor={themeColors.textSecondary}
              value={confirmText}
              onChangeText={setConfirmText}
              accessibilityLabel="Confirmation input"
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => { setShowDeleteModal(false); setConfirmText(''); }} style={styles.modalBtnCancel} accessibilityRole="button">
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={performDelete}
                style={[styles.modalBtnDelete, (confirmText.trim() !== (trip?.title ?? '').trim()) && { opacity: 0.5 }]}
                accessibilityRole="button"
                disabled={confirmText.trim() !== (trip?.title ?? '').trim()}
              >
                <Text style={styles.modalBtnDeleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

// styles created via useMemo above
