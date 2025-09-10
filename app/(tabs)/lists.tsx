import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ThemeContext';
import { deleteList, getLists, uid, upsertList } from '../../lib/storage';
import { List, ListItem } from '../../types';

// Simple inline create + manage lists (bucket, packing, custom). Future enhancement: dedicated edit screen.
/**
 * React component ListsScreen: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export default function ListsScreen() {
  const { themeColors, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'bucket' | 'packing' | 'custom'>('custom');
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const palette = [
    themeColors.primary,
    themeColors.secondary,
    themeColors.accent,
    themeColors.success,
    themeColors.highlight,
    '#FF8A65', // custom accent
    '#7E57C2',
  ];

  const styles = useMemo(() => {
  const isDark = colorScheme === 'dark';
    // No text shadow in dark mode per request; keep subtle shadow in light mode only.
    const textShadow = isDark
      ? {}
      : { textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 };
    return StyleSheet.create({
  container: { flex: 1, backgroundColor: themeColors.background, padding: 16, paddingBottom: Math.max(24, (insets?.bottom || 0) + 16) },
      listCard: { borderWidth: 1, borderColor: themeColors.primary, borderRadius: 12, padding: 12, marginBottom: 14, backgroundColor: themeColors.card },
      listTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
      listTitle: { fontSize: 18, fontWeight: '700', color: themeColors.text, flex: 1, marginRight: 8, ...textShadow },
      listSubtitle: { fontSize: 12, color: themeColors.textSecondary, marginTop: -4, marginBottom: 6, ...textShadow },
      emptyText: { color: themeColors.textSecondary },
      input: { borderWidth: 1, borderColor: themeColors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: themeColors.text, marginBottom: 12 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: (themeColors as any).btnBg || themeColors.primary },
  buttonText: { color: (themeColors as any).btnText || '#FFFFFF', fontWeight: '700' },
      itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
      checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
      itemText: { flex: 1, fontSize: 15, color: themeColors.text, ...textShadow },
      addItemRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
      // Add item input: intentionally more neutral/desaturated than list card background
      // Using a soft neutral surface derived from overall theme (light: near slate wash, dark: subtle elevated layer)
      addItemInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: themeColors.menuBorder,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginRight: 8,
        color: themeColors.text,
  backgroundColor: isDark ? '#1F2529' : '#F1F5F9'
      },
      chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
      chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: themeColors.menuBorder, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
      chipText: { color: themeColors.textSecondary, fontSize: 12 },
      dragHandle: { padding: 4, marginRight: 6 },
      divider: { height: 1, backgroundColor: themeColors.menuBorder, marginVertical: 4 },
    });
  }, [themeColors, insets?.bottom, colorScheme]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setLists(await getLists()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
     * React component createList: TODO describe purpose and where it’s used.
     * @returns {void} TODO: describe
     */
    function createList() {
    if (!newTitle.trim()) return;
    setCreating(true);
    const now = Date.now();
    const list: List = { id: uid(), title: newTitle.trim(), type: newType, items: [], createdAt: now, updatedAt: now, color: palette[0] };
    upsertList(list).then(load).finally(() => { setNewTitle(''); setCreating(false); setShowModal(false); setNewType('custom'); });
  }

  /**
     * React component toggleItem: TODO describe purpose and where it’s used.
     * @param {string} listId - TODO: describe
     * @param {string} itemId - TODO: describe
     * @returns {void} TODO: describe
     */
    function toggleItem(listId: string, itemId: string) {
    setLists(curr => curr.map(l => l.id === listId ? { ...l, items: l.items.map(it => it.id === itemId ? { ...it, done: !it.done } : it), updatedAt: Date.now() } : l));
  }

  /**
     * React component persist: TODO describe purpose and where it’s used.
     * @param {import("D:/Code/portlist_app/types").List} list - TODO: describe
     * @returns {void} TODO: describe
     */
    function persist(list: List) { upsertList(list).catch(() => {}); }

  /**
     * React component addItem: TODO describe purpose and where it’s used.
     * @param {string} listId - TODO: describe
     * @param {string} text - TODO: describe
     * @returns {void} TODO: describe
     */
    function addItem(listId: string, text: string) {
    if (!text.trim()) return;
    setLists(curr => curr.map(l => {
      if (l.id !== listId) return l;
      const next: ListItem = { id: uid(), text: text.trim(), done: false, notes: '', order: (l.items[l.items.length - 1]?.order || 0) + 1, createdAt: Date.now() };
      const updated = { ...l, items: [...l.items, next], updatedAt: Date.now() };
      persist(updated);
      return updated;
    }));
  }

  const ListItems: React.FC<{ list: List; textColor?: string; fadedColor?: string; accentColor?: string }> = /**
   * React component ListItems: TODO describe purpose and where it’s used.
   * @param {any} { list, textColor, fadedColor, accentColor } - TODO: describe
   * @returns {React.JSX.Element} TODO: describe
   */
  ({ list, textColor, fadedColor, accentColor }) => {
    const [draft, setDraft] = useState('');
    const data = useMemo(() => [...list.items].sort((a,b)=>a.order-b.order), [list.items]);
    const handleAdd = /**
     * React component handleAdd: TODO describe purpose and where it’s used.
     * @returns {void} TODO: describe
     */
    () => { addItem(list.id, draft); setDraft(''); };
    const renderItem = /**
     * React component renderItem: TODO describe purpose and where it’s used.
     * @param {any} { item, drag, isActive } - TODO: describe
     * @returns {React.JSX.Element} TODO: describe
     */
    ({ item, drag, isActive }: RenderItemParams<ListItem>) => (
      <View style={[styles.itemRow, { opacity: isActive ? 0.7 : 1 }]}>    
        <Pressable onLongPress={drag} style={styles.dragHandle} accessibilityLabel="Drag handle">
          <Ionicons name="reorder-three-outline" size={20} color={themeColors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => { toggleItem(list.id, item.id); persist(lists.find(l=>l.id===list.id)!); }}
          style={[styles.checkbox, { borderColor: accentColor || themeColors.primary, backgroundColor: item.done ? (accentColor || themeColors.primary) : 'transparent' }]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!item.done }}
        >
          {item.done ? <Ionicons name="checkmark" size={16} color={themeColors.background} /> : null}
        </Pressable>
        <Text
          style={[
            styles.itemText,
            { color: textColor || themeColors.text },
            item.done && { textDecorationLine: 'line-through', color: fadedColor || themeColors.textSecondary }
          ]}
        >
          {item.text}
        </Text>
      </View>
    );
    return (
      <View>
        <DraggableFlatList
          data={data}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          onDragEnd={({ data: newData }) => {
            const reOrdered = newData.map((it, idx) => ({ ...it, order: idx + 1 }));
            const updated = { ...list, items: reOrdered, updatedAt: Date.now() };
            setLists(curr => curr.map(l => l.id === list.id ? updated : l));
            persist(updated);
          }}
          activationDistance={6}
          scrollEnabled={false}
        />
        <View style={styles.addItemRow}>
          <TextInput
            placeholder="Add item"
            placeholderTextColor={themeColors.textSecondary}
            value={draft}
            onChangeText={setDraft}
            style={styles.addItemInput}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <Pressable onPress={handleAdd} style={[styles.button, { paddingHorizontal: 14 }]} disabled={!draft.trim()}>
            <Ionicons name="add" size={18} color={(themeColors as any).btnText || themeColors.badgeText} />
          </Pressable>
        </View>
      </View>
    );
  };

  const EditableListCard: React.FC<{ item: List }> = /**
   * React component EditableListCard: TODO describe purpose and where it’s used.
   * @param {{ item: import("D:/Code/portlist_app/types").List; }} { item } - TODO: describe
   * @returns {React.JSX.Element} TODO: describe
   */
  ({ item }) => {
    const baseColor = item.color || themeColors.primary;
    // Utility: clamp and mix helpers
    const mix = /**
     * React component mix: TODO describe purpose and where it’s used.
     * @param {string} a - TODO: describe
     * @param {string} b - TODO: describe
     * @param {number} ratio - TODO: describe
     * @returns {string} TODO: describe
     */
    (a:string,b:string,ratio:number) => {
      if(!/^#?[0-9a-fA-F]{6}$/.test(a) || !/^#?[0-9a-fA-F]{6}$/.test(b)) return a;
      const ah=a.replace('#',''); const bh=b.replace('#','');
      const ar=parseInt(ah.slice(0,2),16), ag=parseInt(ah.slice(2,4),16), ab=parseInt(ah.slice(4,6),16);
      const br=parseInt(bh.slice(0,2),16), bg=parseInt(bh.slice(2,4),16), bb=parseInt(bh.slice(4,6),16);
      const rr=Math.round(ar+(br-ar)*ratio), rg=Math.round(ag+(bg-ag)*ratio), rb=Math.round(ab+(bb-ab)*ratio);
      const hx=/**
       * React component hx: TODO describe purpose and where it’s used.
       * @param {number} n - TODO: describe
       * @returns {string} TODO: describe
       */
      (n:number)=>n.toString(16).padStart(2,'0');
      return `#${hx(rr)}${hx(rg)}${hx(rb)}`;
    };
    const elevate = /**
     * React component elevate: TODO describe purpose and where it’s used.
     * @param {string} hex - TODO: describe
     * @param {number} amount - TODO: describe
     * @returns {string} TODO: describe
     */
    (hex:string, amount=0.06) => mix(hex,'#ffffff',amount);
    // New strategy:
    // Light mode: a softly elevated tinted surface (card mixed toward baseColor a bit, then slightly lightened).
    // Dark mode: start from card surface, blend in small amount of baseColor (gives identity) then very slight lighten; no translucency to avoid glow.
    const bgColor = (() => {
      if (colorScheme === 'dark') {
        const tinted = mix(themeColors.card, baseColor, 0.18); // subtle tint
        return elevate(tinted, 0.04); // tiny lift for separation
      }
      // light mode
      const tintOnLight = mix('#ffffff', baseColor, 0.08); // gentle wash
      return elevate(tintOnLight, 0.10);
    })();
    const contrastColor = (() => {
      // Compute luminance of resolved background (remove alpha if present)
      const parseRgb = /**
       * React component parseRgb: TODO describe purpose and where it’s used.
       * @param {string} val - TODO: describe
       * @returns {number[]} TODO: describe
       */
      (val: string) => {
        if (val.startsWith('rgba') || val.startsWith('rgb')) {
          const m = val.match(/rgba?\((\d+),(\d+),(\d+)/);
          if (m) return [parseInt(m[1],10), parseInt(m[2],10), parseInt(m[3],10)];
        }
        if (val.startsWith('#') && (val.length === 7)) {
          return [parseInt(val.slice(1,3),16), parseInt(val.slice(3,5),16), parseInt(val.slice(5,7),16)];
        }
        return [0,0,0];
      };
      const [cr,cg,cb] = parseRgb(bgColor as string);
      const lin = /**
       * React component lin: TODO describe purpose and where it’s used.
       * @param {number} c - TODO: describe
       * @returns {number} TODO: describe
       */
      (c:number)=>{ const n=c/255; return n<=0.03928? n/12.92 : Math.pow((n+0.055)/1.055,2.4); };
      const L = 0.2126*lin(cr)+0.7152*lin(cg)+0.0722*lin(cb);
  // Threshold tuned for semi-translucent dark surfaces
  if (L < 0.55) return themeColors.text; // use provided theme text color for darker surfaces
  return '#111';
    })();
    const [editing, setEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState(item.title);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const saveTitle = /**
     * React component saveTitle: TODO describe purpose and where it’s used.
     * @returns {void} TODO: describe
     */
    () => {
      if (!draftTitle.trim()) return;
      const next = { ...item, title: draftTitle.trim(), updatedAt: Date.now() };
      setLists(curr => curr.map(l => l.id === item.id ? next : l));
      upsertList(next);
      setEditing(false);
    };
    const changeColor = /**
     * React component changeColor: TODO describe purpose and where it’s used.
     * @param {string} c - TODO: describe
     * @returns {void} TODO: describe
     */
    (c: string) => {
      const next = { ...item, color: c, updatedAt: Date.now() };
      setLists(curr => curr.map(l => l.id === item.id ? next : l));
      upsertList(next);
      setShowColorPicker(false);
    };
    const remove = /**
     * React component remove: TODO describe purpose and where it’s used.
     * @returns {void} TODO: describe
     */
    () => {
      Alert.alert('Delete list?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { setLists(curr => curr.filter(l => l.id !== item.id)); deleteList(item.id).catch(()=>{}); } },
      ]);
    };
    return (
      <View style={[{ borderWidth:1, borderColor: baseColor, borderRadius:12, padding:12, marginBottom:14, backgroundColor: bgColor }]}>      
        <View style={{ flexDirection:'row', alignItems:'center', marginBottom:4 }}>
          {editing ? (
            <TextInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              onSubmitEditing={saveTitle}
              style={{ flex:1, borderWidth:1, borderColor: themeColors.primary, borderRadius:8, paddingHorizontal:8, paddingVertical:6, color: themeColors.text, fontWeight:'700' }}
              returnKeyType="done"
              autoFocus
            />
          ) : (
            <Text style={{ flex:1, fontSize:18, fontWeight:'700', color: contrastColor }}>{item.title}</Text>
          )}
          <Pressable onPress={() => setShowColorPicker(p => !p)} accessibilityLabel="Change color" style={{ padding:6 }}>
            <Ionicons name="color-palette-outline" size={20} color={themeColors.textSecondary} />
          </Pressable>
          <Pressable onPress={() => setEditing(e=>!e)} accessibilityLabel={editing? 'Finish editing title':'Edit title'} style={{ padding:6 }}>
            <Ionicons name={editing? 'checkmark-outline':'pencil-outline'} size={20} color={themeColors.textSecondary} />
          </Pressable>
          <Pressable onPress={remove} accessibilityLabel={`Delete list ${item.title}`} hitSlop={8} style={{ padding:6 }}>
            <Ionicons name="trash-outline" size={20} color={themeColors.textSecondary} />
          </Pressable>
        </View>
  <Text style={{ fontSize:12, color: contrastColor+'CC', marginBottom:6 }}>{item.type.charAt(0).toUpperCase()+item.type.slice(1)} list</Text>
        {showColorPicker && (
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:8 }}>
            {palette.map(c => (
              <Pressable key={c} onPress={() => changeColor(c)} style={{ width:28, height:28, borderRadius:14, backgroundColor:c, borderWidth: c===item.color? 3:1, borderColor: c===item.color? themeColors.text : themeColors.menuBorder }} />
            ))}
          </View>
        )}
        <ListItems
          list={item}
          textColor={contrastColor}
          fadedColor={contrastColor === '#111' ? '#585d63' : 'rgba(255,255,255,0.7)'}
          accentColor={baseColor}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setShowModal(true)} style={[styles.button, { marginBottom: 16 }]} accessibilityLabel="Create new list">
        <Ionicons name="add" size={18} color={(themeColors as any).btnText || themeColors.badgeText} style={{ marginRight: 6 }} />
        <Text style={styles.buttonText}>New List</Text>
      </Pressable>
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={{ flex:1, backgroundColor: '#0009', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor: themeColors.card, borderRadius:16, padding:20, borderWidth:1, borderColor: themeColors.primary }}>
            <Text style={{ fontSize:18, fontWeight:'700', color: themeColors.text, marginBottom:12 }}>Create List</Text>
            <TextInput
              placeholder="List title"
              placeholderTextColor={themeColors.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
              style={styles.input}
              onSubmitEditing={createList}
              returnKeyType="done"
              autoFocus
            />
            <View style={{ flexDirection:'row', marginBottom:16, gap:8 }}>
              {(['bucket','packing','custom'] as const).map(t => (
                <Pressable
                  key={t}
                  onPress={() => setNewType(t)}
                  style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:999, borderWidth:1, borderColor: newType===t? themeColors.primary : themeColors.menuBorder, backgroundColor: newType===t? themeColors.primary : 'transparent' }}
                >
                  <Text style={{ color: newType===t? themeColors.background : themeColors.textSecondary, fontWeight:'600', fontSize:12 }}>{t.charAt(0).toUpperCase()+t.slice(1)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ fontSize:12, fontWeight:'600', color: themeColors.textSecondary, marginBottom:6 }}>Color</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:16 }}>
              {palette.map(c => (
                <Pressable key={c} onPress={() => {/* color chosen on creation only via palette[0]; user can edit later */}} style={{ width:32, height:32, borderRadius:16, backgroundColor:c, borderWidth:2, borderColor: c===palette[0]? themeColors.text : 'transparent' }} />
              ))}
              <Text style={{ fontSize:11, color: themeColors.textSecondary, width:'100%' }}>* Initial color fixed to first for now; can change after creation.</Text>
            </View>
            <View style={{ flexDirection:'row', justifyContent:'flex-end', gap:12 }}>
              <Pressable onPress={() => { if(!creating) { setShowModal(false); setNewTitle(''); setNewType('custom'); } }} style={{ paddingVertical:8, paddingHorizontal:14 }}>
                <Text style={{ color: themeColors.textSecondary, fontWeight:'600' }}>Cancel</Text>
              </Pressable>
              <Pressable disabled={creating || !newTitle.trim()} onPress={createList} style={[styles.button, { flexDirection:'row', paddingHorizontal:18, opacity: creating || !newTitle.trim()? 0.6:1 }]}>
                {creating ? <ActivityIndicator color={(themeColors as any).btnText || themeColors.badgeText} /> : <Text style={styles.buttonText}>Create</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {loading ? <ActivityIndicator color={themeColors.primary} /> : lists.length === 0 ? <Text style={styles.emptyText}>No lists yet. Create your first above.</Text> : (
        <FlatList
          data={lists.sort((a,b)=>b.updatedAt-a.updatedAt)}
          keyExtractor={l => l.id}
          renderItem={({ item }) => (
            <EditableListCard item={item} />
          )}
          contentContainerStyle={{ paddingBottom: Math.max(40, (insets?.bottom || 0) + 24) }}
        />
      )}
    </View>
  );
}
