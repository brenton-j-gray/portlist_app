import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useTheme } from '../../components/ThemeContext';
import { deleteList, getLists, uid, upsertList } from '../../lib/storage';
import { List, ListItem } from '../../types';

// Simple inline create + manage lists (bucket, packing, custom). Future enhancement: dedicated edit screen.
export default function ListsScreen() {
  const { themeColors } = useTheme();
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
    const isDark = themeColors.background === '#0E1113';
    // No text shadow in dark mode per request; keep subtle shadow in light mode only.
    const textShadow = isDark
      ? {}
      : { textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 };
    return StyleSheet.create({
      container: { flex: 1, backgroundColor: themeColors.background, padding: 16 },
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
        backgroundColor: themeColors.background === '#0E1113' ? '#1F2529' : '#F1F5F9'
      },
      chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
      chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: themeColors.menuBorder, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
      chipText: { color: themeColors.textSecondary, fontSize: 12 },
      dragHandle: { padding: 4, marginRight: 6 },
      divider: { height: 1, backgroundColor: themeColors.menuBorder, marginVertical: 4 },
    });
  }, [themeColors]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setLists(await getLists()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function createList() {
    if (!newTitle.trim()) return;
    setCreating(true);
    const now = Date.now();
    const list: List = { id: uid(), title: newTitle.trim(), type: newType, items: [], createdAt: now, updatedAt: now, color: palette[0] };
    upsertList(list).then(load).finally(() => { setNewTitle(''); setCreating(false); setShowModal(false); setNewType('custom'); });
  }

  function toggleItem(listId: string, itemId: string) {
    setLists(curr => curr.map(l => l.id === listId ? { ...l, items: l.items.map(it => it.id === itemId ? { ...it, done: !it.done } : it), updatedAt: Date.now() } : l));
  }

  function persist(list: List) { upsertList(list).catch(() => {}); }

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

  const ListItems: React.FC<{ list: List }> = ({ list }) => {
    const [draft, setDraft] = useState('');
    const data = useMemo(() => [...list.items].sort((a,b)=>a.order-b.order), [list.items]);
    const handleAdd = () => { addItem(list.id, draft); setDraft(''); };
    const renderItem = ({ item, drag, isActive }: RenderItemParams<ListItem>) => (
      <View style={[styles.itemRow, { opacity: isActive ? 0.7 : 1 }]}>    
        <Pressable onLongPress={drag} style={styles.dragHandle} accessibilityLabel="Drag handle">
          <Ionicons name="reorder-three-outline" size={20} color={themeColors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => { toggleItem(list.id, item.id); persist(lists.find(l=>l.id===list.id)!); }}
          style={[styles.checkbox, { borderColor: themeColors.primary, backgroundColor: item.done ? themeColors.primary : 'transparent' }]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!item.done }}
        >
          {item.done ? <Ionicons name="checkmark" size={16} color={themeColors.background} /> : null}
  </Pressable>
  <Text style={[styles.itemText, item.done && { textDecorationLine: 'line-through', color: themeColors.textSecondary }]}>{item.text}</Text>
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

  const EditableListCard: React.FC<{ item: List }> = ({ item }) => {
    const baseColor = item.color || themeColors.primary;
    const lighten = (hex: string, amount = 0.9) => {
      // hex like #RRGGBB
      if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) return themeColors.card;
      const h = hex.replace('#','');
      const r = parseInt(h.slice(0,2),16);
      const g = parseInt(h.slice(2,4),16);
      const b = parseInt(h.slice(4,6),16);
      const lr = Math.round(r + (255 - r) * amount);
      const lg = Math.round(g + (255 - g) * amount);
      const lb = Math.round(b + (255 - b) * amount);
      const toHex = (n:number)=> n.toString(16).padStart(2,'0');
      return `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
    };
    // Derive background: lightened solid in light mode; semi-transparent in dark mode so base darkness shows through
    const bgColor = (() => {
      const lightened = lighten(baseColor, 0.9);
      // Subtle saturation boost: mix a small portion of the original base color back into the lightened value
      const boost = (lightHex: string, baseHex: string, factor = 0.12) => {
        if (!/^#?[0-9a-fA-F]{6}$/.test(lightHex) || !/^#?[0-9a-fA-F]{6}$/.test(baseHex)) return lightHex;
        const lh = lightHex.replace('#','');
        const bh = baseHex.replace('#','');
        const lr = parseInt(lh.slice(0,2),16), lg = parseInt(lh.slice(2,4),16), lb = parseInt(lh.slice(4,6),16);
        const br = parseInt(bh.slice(0,2),16), bg = parseInt(bh.slice(2,4),16), bb = parseInt(bh.slice(4,6),16);
        const nr = Math.round(lr + (br - lr) * factor);
        const ng = Math.round(lg + (bg - lg) * factor);
        const nb = Math.round(lb + (bb - lb) * factor);
        const hx = (n:number)=> n.toString(16).padStart(2,'0');
        return `#${hx(nr)}${hx(ng)}${hx(nb)}`;
      };
      const boosted = boost(lightened, baseColor, 0.14); // slightly stronger than default for visibility
      if (themeColors.background === '#0E1113') { // dark mode key
        const h = boosted.replace('#','');
        const r = parseInt(h.slice(0,2),16);
        const g = parseInt(h.slice(2,4),16);
        const b = parseInt(h.slice(4,6),16);
        return `rgba(${r},${g},${b},0.82)`; // maintain transparency while using boosted tint
      }
      return boosted;
    })();
    const contrastColor = (() => {
      // Dark mode: keep black (requested) since card bg is translucent & lightened -> ensures maximal perceived sharpness.
      if (themeColors.background === '#0E1113') return '#000000';
      // Use the actual lightened/boosted background (without alpha) to decide contrast rather than original base hue.
      const solidBg = (() => {
        if (typeof bgColor === 'string' && bgColor.startsWith('rgba')) {
          // extract rgb components
          const m = bgColor.match(/rgba?\((\d+),(\d+),(\d+)/);
          if (m) {
            const [r,g,b] = m.slice(1,4).map(Number);
            const toHex = (n:number)=> n.toString(16).padStart(2,'0');
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
          }
        }
        return typeof bgColor === 'string' ? bgColor : baseColor;
      })();
      const h = solidBg.replace('#','');
      if (h.length !== 6) return themeColors.text;
      const r = parseInt(h.slice(0,2),16)/255;
      const g = parseInt(h.slice(2,4),16)/255;
      const b = parseInt(h.slice(4,6),16)/255;
      const lin = (c:number)=> c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
      const Lbg = 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
      // Lower threshold -> keep dark text longer; only switch to white on truly dark backgrounds.
      return Lbg < 0.20 ? '#FFFFFF' : '#000000';
    })();
    const [editing, setEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState(item.title);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const saveTitle = () => {
      if (!draftTitle.trim()) return;
      const next = { ...item, title: draftTitle.trim(), updatedAt: Date.now() };
      setLists(curr => curr.map(l => l.id === item.id ? next : l));
      upsertList(next);
      setEditing(false);
    };
    const changeColor = (c: string) => {
      const next = { ...item, color: c, updatedAt: Date.now() };
      setLists(curr => curr.map(l => l.id === item.id ? next : l));
      upsertList(next);
      setShowColorPicker(false);
    };
    const remove = () => {
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
            <Text style={{ flex:1, fontSize:18, fontWeight:'700', color: contrastColor, ...(themeColors.background === '#0E1113' ? {} : { textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset:{width:0,height:1}, textShadowRadius:1.5 }) }}>{item.title}</Text>
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
  <Text style={{ fontSize:12, color: contrastColor+'CC', marginBottom:6, ...(themeColors.background === '#0E1113' ? {} : { textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset:{width:0,height:1}, textShadowRadius:1.5 }) }}>{item.type.charAt(0).toUpperCase()+item.type.slice(1)} list</Text>
        {showColorPicker && (
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:8 }}>
            {palette.map(c => (
              <Pressable key={c} onPress={() => changeColor(c)} style={{ width:28, height:28, borderRadius:14, backgroundColor:c, borderWidth: c===item.color? 3:1, borderColor: c===item.color? themeColors.text : themeColors.menuBorder }} />
            ))}
          </View>
        )}
        <ListItems list={item} />
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
        />
      )}
    </View>
  );
}
