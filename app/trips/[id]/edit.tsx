import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { formatDateWithPrefs, usePreferences } from '../../../components/PreferencesContext';
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
// Replaced by preference-aware formatDateWithPrefs
function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function EditTripScreen() {
  const { themeColors } = useTheme();
  const { prefs } = usePreferences();
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
  const [reorderMode, setReorderMode] = useState(false);
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
  const qLower = q.toLowerCase();
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
  // Enhanced ranking: prefix match > substring match > porty boost > alphabetical
  merged.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aPrefix = aName.startsWith(qLower) ? 1 : 0;
    const bPrefix = bName.startsWith(qLower) ? 1 : 0;
    if (bPrefix !== aPrefix) return bPrefix - aPrefix;
    const aSub = aName.includes(qLower) ? 1 : 0;
    const bSub = bName.includes(qLower) ? 1 : 0;
    if (bSub !== aSub) return bSub - aSub;
    const aPorty = isPorty(a.name) ? 1 : 0;
    const bPorty = isPorty(b.name) ? 1 : 0;
    if (bPorty !== aPorty) return bPorty - aPorty;
    return a.name.localeCompare(b.name);
  });
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
    // Normalize ports but intentionally keep duplicates (repeat visits allowed)
    const normalized = ports
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => {
        const r = resolvePortByName(p, portsCache);
        return r ? `${r.name}${r.regionCode ? `, ${r.regionCode}` : ''}${r.country ? `, ${r.country}` : ''}` : p;
      });
    const updated: Trip = { ...trip, title: title.trim(), ship: ship.trim() || undefined, startDate: startDate || undefined, endDate: endDate || undefined, completed, ports: normalized };
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
  container: { flex: 1, padding: 12, backgroundColor: themeColors.background },
    input: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 8, marginBottom: 8 },
    btn: { backgroundColor: themeColors.primaryDark, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center' },
    btnText: { color: themeColors.badgeText, fontWeight: '700' },
    label: { fontSize: 13, fontWeight: '500', marginBottom: 2, marginLeft: 2, color: themeColors.textSecondary },
  delBtn: { backgroundColor: themeColors.danger, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
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
        padding: 12,
        paddingBottom:
          // Base padding
          32 + (
            // When suggestions are visible, add space so the list clears the keyboard
            portSuggestions.length > 0
              ? (Platform.OS === 'ios' ? 120 : Math.max(120, keyboardHeight + 20))
              : 0
          ),
      }}
      keyboardShouldPersistTaps="handled"
    >
  <View style={{ backgroundColor: themeColors.background }}>
      {/* Completed toggle added */}
      <View style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: themeColors.textSecondary, fontSize: 11, fontWeight: '600', marginRight: 6 }}>Completed?</Text>
        <Pressable
          onPress={() => setCompleted(c => !c)}
          accessibilityLabel={completed ? 'Mark trip as not completed' : 'Mark trip as completed'}
          style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: completed ? themeColors.primary : themeColors.card, borderWidth: 1, borderColor: completed ? themeColors.primaryDark : themeColors.menuBorder }}
        >
          <Ionicons name={completed ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={completed ? themeColors.badgeText : themeColors.textSecondary} />
        </Pressable>
      </View>
  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 4 }}>
    <View style={{ flex: 3 }}>
      <Text style={styles.label}>Title</Text>
      <TextInput style={[styles.input, { marginBottom: 0 }]} placeholder="Trip title" placeholderTextColor={themeColors.textSecondary} value={title} onChangeText={setTitle} accessibilityLabel="Trip title" />
    </View>
    <View style={{ flex: 2 }}>
      <Text style={styles.label}>Ship</Text>
      <TextInput style={[styles.input, { marginBottom: 0 }]} placeholder="Ship (optional)" placeholderTextColor={themeColors.textSecondary} value={ship} onChangeText={setShip} accessibilityLabel="Ship name" />
    </View>
  </View>
  {/* Dates in a compact two-column row */}
  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4, marginBottom: 4 }}>
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>Start</Text>
      <Pressable onPress={() => setShowStartPicker(true)} style={[styles.input, { marginBottom: 4 }]}> 
        <Text style={{ color: startDate ? themeColors.text : themeColors.textSecondary }}>{startDate ? formatDateWithPrefs(startDate, prefs, { day: '2-digit', month: 'short', year: 'numeric' }) : 'Start date'}</Text>
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
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>End</Text>
      <Pressable onPress={() => setShowEndPicker(true)} style={[styles.input, { marginBottom: 4 }]}> 
        <Text style={{ color: endDate ? themeColors.text : themeColors.textSecondary }}>{endDate ? formatDateWithPrefs(endDate, prefs, { day: '2-digit', month: 'short', year: 'numeric' }) : 'End date'}</Text>
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
    </View>
  </View>
  {/* Ports editor */}
  <Text style={styles.label}>Ports</Text>
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
          setPorts(prev => [...prev, formatted]);
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
          setPorts(prev => [...prev, formatted]);
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
  style={[styles.btn, { paddingVertical: 8, paddingHorizontal: 12 }]}
      accessibilityRole="button"
    >
      <Text style={styles.btnText}>Add</Text>
    </Pressable>
  </View>
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, marginLeft: 2 }}>
    <Text style={{ color: themeColors.textSecondary, fontSize: 11, fontStyle: 'italic' }}>Press and hold to delete ports</Text>
    <Pressable
      onPress={() => setReorderMode(m => !m)}
      style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: reorderMode ? themeColors.primaryDark : themeColors.card, borderWidth: 1, borderColor: reorderMode ? themeColors.primaryDark : themeColors.menuBorder }}
      accessibilityRole="button"
      accessibilityLabel={reorderMode ? 'Exit reorder mode' : 'Enter reorder mode'}
    >
      <Text style={{ color: reorderMode ? themeColors.badgeText : themeColors.textSecondary, fontWeight: '600', fontSize: 12 }}>{reorderMode ? 'Done' : 'Reorder'}</Text>
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
            setPorts(prev => [...prev, formatted]);
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
    reorderMode ? (
      <View style={{ marginBottom: 10 }}>
        <DraggableFlatList<PortItem>
          data={ports.map((p, i) => ({ key: `${i}-${p}`, label: p }))}
          keyExtractor={(item: PortItem) => item.key}
          onDragEnd={({ data }: { data: PortItem[] }) => setPorts(data.map((d: PortItem) => d.label))}
          containerStyle={{}}
          activationDistance={8}
          scrollEnabled={false}
          renderItem={({ item, drag, getIndex }: RenderItemParams<PortItem>) => {
            const idx = getIndex?.() ?? 0;
            return (
              <ScaleDecorator activeScale={0.98}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {/* Index number */}
                  <Text style={{ width: 22, textAlign: 'right', color: themeColors.textSecondary }}>{idx + 1}.</Text>
                  {/* Static label (no delete in reorder mode) */}
                  <View style={{ flex: 1, marginBottom: 2, justifyContent: 'center', paddingVertical: 4 }}>
                    <Text style={{ color: themeColors.text }}>{item.label}</Text>
                  </View>
                  {/* Handle on right */}
                  <Pressable onLongPress={drag} delayLongPress={120} hitSlop={8} style={{ padding: 6 }} accessibilityLabel={`Reorder ${item.label}`}>
                    <Ionicons name="reorder-three" size={22} color={themeColors.textSecondary} />
                  </Pressable>
                </View>
              </ScaleDecorator>
            );
          }}
        />
      </View>
    ) : (
      <View style={{ marginBottom: 10 }}>
        {ports.map((p, i) => (
          <View key={`${i}-${p}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text style={{ width: 22, textAlign: 'right', color: themeColors.textSecondary }}>{i + 1}.</Text>
            <Pressable
              style={{ flex: 1, marginBottom: 2, justifyContent: 'center', paddingVertical: 4 }}
              onLongPress={() => {
                Alert.alert('Remove Port', `Delete "${p}" from this trip?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => setPorts(prev => prev.filter((_, idx) => idx !== i)) }
                ]);
              }}
              delayLongPress={500}
              accessibilityRole="button"
              accessibilityLabel={`Port ${p}`}
              accessibilityHint="Long press to confirm deletion of this port"
            >
              <Text style={{ color: themeColors.text }}>{p}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    )
  ) : null}
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
      <Pressable
        onPress={onSave}
        style={[styles.btn, { flex: 4 }, !title.trim() && { opacity: 0.6 }]}
        disabled={!title.trim()}
        accessibilityLabel="Save trip changes"
      >
        <Text style={styles.btnText}>Save Changes</Text>
      </Pressable>
      <Pressable
        onPress={onDelete}
        style={[styles.delBtn, { flex: 1, marginTop: 0, justifyContent: 'center' }]}
        accessibilityLabel="Delete Trip"
      >
        <Text style={styles.delBtnText}>Delete</Text>
      </Pressable>
    </View>

  {/* Reduced spacer */}
  <View style={{ height: 12 }} />

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
