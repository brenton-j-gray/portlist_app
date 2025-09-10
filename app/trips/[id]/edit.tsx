// CLEAN REWRITE STARTS HERE
// Implements: long-press anywhere on a port row to enter reorder (jiggle) mode.
// In normal mode: scroll + swipe-right to delete (with undo). Reorder disabled.
// In reorder mode: swipe disabled; drag any row to reorder via neighbor swaps.

import Ionicons from '@expo/vector-icons/Ionicons';
import DraggableFlatList from 'react-native-draggable-flatlist';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Keyboard, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { formatDateWithPrefs, usePreferences } from '../../../components/PreferencesContext';
import { useTheme } from '../../../components/ThemeContext';
import { searchPlaces } from '../../../lib/places';
import { PortEntry, resolvePortByName, searchPorts, upsertCachedPort } from '../../../lib/ports';
import { PortsCache } from '../../../lib/portsCache';
import { deleteTrip, getTripById, upsertTrip } from '../../../lib/storage';
import { Trip } from '../../../types';

/**
 * React component parseLocal: TODO describe purpose and where it’s used.
 * @param {any} dateStr - TODO: describe
 * @returns {any} TODO: describe
 */
function parseLocal(dateStr: string | undefined): Date | null { if (!dateStr) return null; const ymd=String(dateStr).slice(0,10); if(/^\d{4}-\d{2}-\d{2}$/.test(ymd)){ const [y,m,d]=ymd.split('-').map(Number); return new Date(y,(m||1)-1,d||1);} const d=new Date(dateStr); return isNaN(d.getTime())?null:d; }
/**
 * React component toISODate: TODO describe purpose and where it’s used.
 * @param {any} d - TODO: describe
 * @returns {any} TODO: describe
 */
function toISODate(d: Date){ const y=d.getFullYear(); const m=`${d.getMonth()+1}`.padStart(2,'0'); const day=`${d.getDate()}`.padStart(2,'0'); return `${y}-${m}-${day}`; }

/**
 * React component EditTripScreen: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export default function EditTripScreen(){
  const { themeColors } = useTheme();
  const { prefs } = usePreferences();
  const { id } = useLocalSearchParams<{id:string}>();
  const [trip,setTrip] = useState<Trip|undefined>();
  const [title,setTitle] = useState('');
  const [ship,setShip] = useState('');
  const [startDate,setStartDate] = useState('');
  const [endDate,setEndDate] = useState('');
  const [showStartPicker,setShowStartPicker] = useState(false);
  const [showEndPicker,setShowEndPicker] = useState(false);
  const [showDeleteModal,setShowDeleteModal] = useState(false);
  const [confirmText,setConfirmText] = useState('');
  const [completed,setCompleted] = useState(false);
  const [ports,setPorts] = useState<string[]>([]);
  const [newPort,setNewPort] = useState('');
  const [portsCache,setPortsCache] = useState<PortEntry[]>([]);
  const [portSuggestions,setPortSuggestions] = useState<PortEntry[]>([]);
  const [isNewPortFocused,setIsNewPortFocused] = useState(false);
  const scrollRef = useRef<ScrollView|null>(null);
  const [keyboardHeight,setKeyboardHeight] = useState(0);
  const [portsRowY,setPortsRowY] = useState(0);
  const newPortInputRef = useRef<TextInput|null>(null);
  const CONTENT_PADDING = 12; // matches ScrollView contentContainerStyle paddingTop
  const [reorderItems, setReorderItems] = useState<{key:string; label:string}[]>([]);

  // Reorder mode (library-backed overlay)
  const [reorderMode,setReorderMode] = useState(false);
  const [scrollEnabled,setScrollEnabled] = useState(true);
  // Keep minimal refs needed by existing scroll
  const scrollOffsetRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const scrollViewTopRef = useRef(0);

  // Swipe delete (disabled in reorderMode)
  const [swipingIndex,setSwipingIndex] = useState<number|null>(null);
  // Per-row swipe X values (so re-renders / reorder don't break animation)
  const swipeXsRef = useRef<Animated.Value[]>([]);
  const swipeStartXRef = useRef(0); const swipeStartYRef = useRef(0);
  // Long press detection (custom so it isn't blocked by responder claiming for swipe)
  const longPressTimerRef = useRef<any>(null);
  const longPressTriggeredRef = useRef(false);
  // Pending drag start info when entering reorder mode from long press
  const pendingDragIndexRef = useRef<number|null>(null);
  const pendingDragStartYRef = useRef(0);

  // Undo
  const [undoInfo,setUndoInfo] = useState<{port:string; index:number}|null>(null);
  const undoTimerRef = useRef<any>(null);

  useEffect(()=>{ if(Platform.OS==='android' && (UIManager as any)?.setLayoutAnimationEnabledExperimental){ try{ (UIManager as any).setLayoutAnimationEnabledExperimental(true);}catch{} } },[]);

  // Load trip + cache
  useEffect(()=>{ (async()=>{ if(!id) return; const t= await getTripById(id); if(t){ setTrip(t); setTitle(t.title); setShip(t.ship||''); setStartDate(t.startDate||''); setEndDate(t.endDate||''); setCompleted(!!t.completed); setPorts([...(t.ports||[])]);} try{ const cache=await PortsCache.load(); setPortsCache(cache);}catch{} })(); },[id]);

  // Debounced suggestions (cache + online)
  useEffect(()=>{
    const q=newPort.trim();
    if(q.length<2){ setPortSuggestions([]); return; }
    let cancelled=false;
    const handle=setTimeout(async()=>{
      try {
        let out:PortEntry[] = [];
        try { out.push(...searchPorts(q,portsCache,12)); } catch {}
        if(out.length < 7){
          const need=10 - out.length;
            try {
              const places = await searchPlaces(q, need*3);
              const norm=/**
               * React component norm: TODO describe purpose and where it’s used.
               * @param {string} s - TODO: describe
               * @returns {string} TODO: describe
               */
              (s:string)=> (s? s.normalize('NFD').replace(/[^\x00-\x7F]/g,'').toLowerCase(): '');
              const nq=norm(q);
              const seen=new Set(out.map(p=>p.name.toLowerCase()));
              let filtered = places
                .filter(ph=>ph && ph.label && !/(airport|airfield|heliport)/i.test(ph.label))
                .map(ph=>({ph,label:String(ph.label).trim(),nl:norm(ph.label||'')}))
                .filter(x=>x.nl.includes(nq))
                .sort((a,b)=> (Number(b.nl.startsWith(nq)) - Number(a.nl.startsWith(nq))) || a.label.localeCompare(b.label))
                .map(x=>x.ph);
              if(!filtered.length){
                filtered = places.filter(ph=>ph && ph.label && !/(airport|airfield|heliport)/i.test(ph.label)).slice(0, need*2);
              }
              for(const ph of filtered){
                const label=String(ph.label||'').trim();
                const key=label.toLowerCase();
                if(seen.has(key)) continue;
                out.push({name:label,lat:ph.lat,lng:ph.lng,source:'online',kind:'port'} as PortEntry);
                seen.add(key);
                if(out.length>=10) break;
              }
            } catch {}
        }
        if(!out.length){ try { out = searchPorts(q,portsCache,10) || []; } catch {} }
        if(!cancelled) setPortSuggestions(out.slice(0,10));
      } catch {
        if(!cancelled) setPortSuggestions([]);
      }
    },170);
    return ()=>{ cancelled=true; clearTimeout(handle); };
  },[newPort,portsCache]);

  // Keyboard adjustments
  useEffect(()=>{ const onShow=/**
   * React component onShow: TODO describe purpose and where it’s used.
   * @param {any} e - TODO: describe
   * @returns {void} TODO: describe
   */
  (e:any)=> setKeyboardHeight(e?.endCoordinates?.height??0); const onHide=/**
   * React component onHide: TODO describe purpose and where it’s used.
   * @returns {void} TODO: describe
   */
  ()=> setKeyboardHeight(0); const s1=Keyboard.addListener('keyboardDidShow',onShow); const s2=Keyboard.addListener('keyboardDidHide',onHide); return()=>{ s1.remove(); s2.remove();}; },[]);
  useEffect(()=>{ if(isNewPortFocused){ requestAnimationFrame(()=>{ if(scrollRef.current){ const y=Math.max(0,portsRowY-16); scrollRef.current.scrollTo({y,animated:true}); } }); } },[isNewPortFocused,portSuggestions.length,keyboardHeight,portsRowY]);

  // No jiggle animation; cleaner drag visuals

  const exitReorderMode = useCallback(()=>{ setReorderMode(false); setScrollEnabled(true); setReorderItems([]); },[]);
  const startReorderMode = useCallback(()=>{ if(!reorderMode){ setReorderMode(true); try{ Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);}catch{} } },[reorderMode]);
  // When reorder mode toggles on, disable scroll
  useEffect(()=>{ if(reorderMode){ setScrollEnabled(false); } else { setScrollEnabled(true);} },[reorderMode]);
  // Seed stable keys once when entering reorder mode
  useEffect(()=>{ if(reorderMode){ setReorderItems(ports.map((label, idx)=>({ key: `${idx}:${label}`, label }))); } },[reorderMode]);
  // When entering reorder mode, ensure any active swipe resets
  useEffect(()=>{ if(reorderMode){ if(swipingIndex!=null){ const val=swipeXsRef.current[swipingIndex]; if(val){ Animated.timing(val,{toValue:0,duration:120,useNativeDriver:true}).start(); } } setSwipingIndex(null);} },[reorderMode,swipingIndex]);
  // Cleanup long press timers on unmount
  useEffect(()=>()=>{ if(longPressTimerRef.current) clearTimeout(longPressTimerRef.current); },[]);
  // No custom auto-scroll; library handles drag nicely

  /**
     * React component onSave: TODO describe purpose and where it’s used.
     * @returns {Promise<void>} TODO: describe
     */
    async function onSave(){ if(!trip) return; if(!title.trim()){ Alert.alert('Title required'); return;} if(startDate && endDate){ const s=(parseLocal(startDate) as Date).getTime(); const e=(parseLocal(endDate) as Date).getTime(); if(e<s){ Alert.alert('Invalid dates','End date cannot be before start date.'); return;} } const kept=ports.map(p=>p.trim()).filter(Boolean); const updated:Trip={...trip,title:title.trim(),ship:ship.trim()||undefined,startDate:startDate||undefined,endDate:endDate||undefined,completed,ports:kept}; await upsertTrip(updated); router.replace(`/trips/${trip.id}`); }
  /**
     * React component performDelete: TODO describe purpose and where it’s used.
     * @returns {Promise<void>} TODO: describe
     */
    async function performDelete(){ if(!trip) return; await deleteTrip(trip.id); router.replace('/trips'); }
  /**
     * React component onDelete: TODO describe purpose and where it’s used.
     * @returns {void} TODO: describe
     */
    function onDelete(){ setConfirmText(''); setShowDeleteModal(true);} 

  // Add port (enter or button)
  const addPort = useCallback(async(qRaw?:string)=>{
    const q=(qRaw??newPort).trim(); if(!q) return;
    let formatted=q;
    const r=resolvePortByName(q,portsCache);
    if(r){
      formatted=`${r.name}${r.regionCode?`, ${r.regionCode}`:''}${r.country?`, ${r.country}`:''}`;
      try{ await upsertCachedPort({ name:r.name,country:r.country,regionCode:r.regionCode,lat:r.lat,lng:r.lng,aliases:r.aliases,source:'cache'} as any); const cache=await PortsCache.load(); setPortsCache(cache);}catch{}
    } else {
      try{
        const raw = await searchPlaces(q,8);
        // Filter out airports/airfields/heliports explicitly
        const places = raw.filter(ph => ph && ph.label && !/(airport|air field|airfield|heliport)/i.test(ph.label));
        if(places.length){
          const ph=places[0];
          formatted=String(ph.label||q).trim();
          await upsertCachedPort({ name:formatted, lat:ph.lat,lng:ph.lng, source:'cache', kind:'port'} as any);
          const cache=await PortsCache.load(); setPortsCache(cache);
        }
      }catch{}
    }
    setPorts(prev=>[...prev,formatted]);
    setNewPort('');
    setPortSuggestions([]);
  },[newPort,portsCache]);

  const styles = useMemo(()=> StyleSheet.create({
    container:{flex:1,padding:12,backgroundColor:themeColors.background},
    input:{borderWidth:1,borderColor:themeColors.menuBorder,backgroundColor:themeColors.card,color:themeColors.text,borderRadius:8,padding:8,marginBottom:8},
    btn:{backgroundColor:themeColors.primaryDark,paddingVertical:10,paddingHorizontal:12,borderRadius:10,alignItems:'center'},
    btnText:{color:themeColors.badgeText,fontWeight:'700'},
    label:{fontSize:13,fontWeight:'500',marginBottom:2,marginLeft:2,color:themeColors.textSecondary},
    delBtn:{backgroundColor:themeColors.danger,paddingVertical:10,paddingHorizontal:12,borderRadius:10,alignItems:'center',marginTop:10},
    delBtnText:{color:themeColors.badgeText,fontWeight:'700'},
    modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.4)',justifyContent:'center',alignItems:'center',padding:24},
    modalCard:{width:'100%',maxWidth:420,backgroundColor:themeColors.card,borderRadius:14,padding:18,borderWidth:StyleSheet.hairlineWidth,borderColor:themeColors.primary},
    modalTitle:{fontSize:18,fontWeight:'700',marginBottom:6,color:themeColors.text},
    modalMessage:{fontSize:14,color:themeColors.textSecondary,marginBottom:14},
    modalActions:{flexDirection:'row',justifyContent:'flex-end',gap:10},
    modalBtnCancel:{paddingVertical:10,paddingHorizontal:14,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:themeColors.menuBorder,backgroundColor:themeColors.card},
    modalBtnCancelText:{color:themeColors.text,fontWeight:'600'},
    modalInput:{borderWidth:1,borderColor:themeColors.menuBorder,backgroundColor:themeColors.background,color:themeColors.text,borderRadius:8,padding:10,marginBottom:14},
    modalBtnDelete:{paddingVertical:10,paddingHorizontal:14,borderRadius:10,backgroundColor:themeColors.danger},
    modalBtnDeleteText:{color:themeColors.badgeText,fontWeight:'700'}
  }),[themeColors]);

  if(!trip){ return <View style={styles.container}><Text style={{color:themeColors.textSecondary}}>Loading...</Text></View>; }

  // Row renderer (normal mode with optional swipe to delete)
  const renderPortRow = /**
   * React component renderPortRow: TODO describe purpose and where it’s used.
   * @param {string} p - TODO: describe
   * @param {number} i - TODO: describe
   * @returns {React.JSX.Element} TODO: describe
   */
  (p:string,i:number)=>{
    const isSwiping = swipingIndex===i;
    if(!swipeXsRef.current[i]) swipeXsRef.current[i]=new Animated.Value(0);
    const rowX = swipeXsRef.current[i];

    const commonTransforms = [] as any[];
    if(isSwiping){
      commonTransforms.push({translateX: rowX});
    } else {
      commonTransforms.push({translateX: rowX}); // default zero
    }

  const handleStart = /**
   * React component handleStart: TODO describe purpose and where it’s used.
   * @param {any} e - TODO: describe
   * @returns {boolean} TODO: describe
   */
  (e:any)=>{
      if(reorderMode){
        // In overlay mode, underlying rows do not handle drag
        return false;
      } else {
        swipeStartXRef.current=e.nativeEvent.pageX; swipeStartYRef.current=e.nativeEvent.pageY; setSwipingIndex(i); rowX.setValue(0); longPressTriggeredRef.current=false; if(longPressTimerRef.current) clearTimeout(longPressTimerRef.current); longPressTimerRef.current=setTimeout(()=>{ if(!reorderMode && !longPressTriggeredRef.current){ longPressTriggeredRef.current=true; pendingDragIndexRef.current=i; pendingDragStartYRef.current= swipeStartYRef.current; startReorderMode(); try{ Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);}catch{}; setSwipingIndex(null); rowX.setValue(0);} },380); return true;
      }
    };

    const handleMove = /**
     * React component handleMove: TODO describe purpose and where it’s used.
     * @param {any} e - TODO: describe
     * @returns {void} TODO: describe
     */
    (e:any)=>{
      if(reorderMode){
        return;
      } else {
        if(swipingIndex!==i) return; const dx=e.nativeEvent.pageX - swipeStartXRef.current; const dy=e.nativeEvent.pageY - swipeStartYRef.current; if(!longPressTriggeredRef.current && (Math.abs(dx)>10 || Math.abs(dy)>10)){ if(longPressTimerRef.current){ clearTimeout(longPressTimerRef.current); longPressTimerRef.current=null; } }
        if(longPressTriggeredRef.current){ return; }
        if(dx<0){ rowX.setValue(0); return;} if(Math.abs(dy)>24 && dx<12){ setSwipingIndex(null); rowX.setValue(0); return;} rowX.setValue(Math.min(dx,160));
      }
    };

    const handleRelease = /**
     * React component handleRelease: TODO describe purpose and where it’s used.
     * @returns {void} TODO: describe
     */
    ()=>{
      if(reorderMode){ return; }
      if(longPressTimerRef.current){ clearTimeout(longPressTimerRef.current); longPressTimerRef.current=null; }
      if(reorderMode || longPressTriggeredRef.current){ return; }
      if(swipingIndex!==i) return; const threshold=100; rowX.stopAnimation((val:any)=>{ if(val>threshold){ Animated.spring(rowX,{toValue:220,useNativeDriver:true,speed:26,bounciness:0}).start(()=>{ try{ LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);}catch{} setPorts(prev=>{ const removed=prev[i]; const copy=prev.filter((_,idx)=>idx!==i); if(undoTimerRef.current) clearTimeout(undoTimerRef.current); setUndoInfo({port:removed,index:i}); undoTimerRef.current=setTimeout(()=>setUndoInfo(null),4000); try{ Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);}catch{} return copy; }); setSwipingIndex(null); rowX.setValue(0); }); } else { Animated.spring(rowX,{toValue:0,useNativeDriver:true,bounciness:6,speed:20}).start(()=> setSwipingIndex(null)); } }); };

    const handleTerminate = /**
     * React component handleTerminate: TODO describe purpose and where it’s used.
     * @returns {void} TODO: describe
     */
    ()=>{
      if(longPressTimerRef.current){ clearTimeout(longPressTimerRef.current); longPressTimerRef.current=null; }
      if(swipingIndex===i){ Animated.spring(rowX,{toValue:0,useNativeDriver:true,bounciness:6}).start(()=> setSwipingIndex(null)); }
    };

    const isDraggingRowHidden = false;
    return (
  <View key={i+':'+p} style={{marginBottom:8}}>
        <View style={{position:'relative'}}>
          {!reorderMode && isSwiping && (
            <View pointerEvents='none' style={{position:'absolute',top:0,bottom:0,left:0,right:0,borderRadius:12,backgroundColor:themeColors.danger,justifyContent:'center',paddingLeft:18}}>
              <Text style={{color:themeColors.badgeText,fontWeight:'700'}}>Release to delete</Text>
            </View>
          )}
          <Animated.View
            style={{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:4,paddingHorizontal:8,minHeight:50,borderWidth:1,borderColor:themeColors.menuBorder,borderRadius:12,backgroundColor: themeColors.card,transform:commonTransforms}}
            onStartShouldSetResponder={()=>true}
            onResponderGrant={handleStart}
            onResponderMove={handleMove}
            onResponderRelease={handleRelease}
            onResponderTerminationRequest={()=>false}
            onResponderTerminate={handleTerminate}
          >
            <Text style={{width:24,textAlign:'right',color:themeColors.textSecondary}}>{i+1}.</Text>
            <View style={{flex:1,justifyContent:'center',paddingVertical:6,paddingHorizontal:6}}>
              <Text style={{color:themeColors.text}}>{p}</Text>
            </View>
          </Animated.View>
        </View>
      </View>
    );
  };

  // Build rows with placeholder
  const renderRowsWithPlaceholder = /**
   * React component renderRowsWithPlaceholder: TODO describe purpose and where it’s used.
   * @returns {React.JSX.Element[]} TODO: describe
   */
  () => ports.map(renderPortRow);

  return (
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.select({ios:'padding',android:'height'}) as any} keyboardVerticalOffset={Platform.OS==='ios'?80:0}>
      <ScrollView
        ref={scrollRef as any}
        style={{flex:1}}
        keyboardShouldPersistTaps='handled'
        scrollEnabled={scrollEnabled && !reorderMode}
        onScroll={e=>{ scrollOffsetRef.current = e.nativeEvent.contentOffset.y; contentHeightRef.current = e.nativeEvent.contentSize.height; }}
        scrollEventThrottle={16}
        onLayout={e=>{ scrollViewHeightRef.current = e.nativeEvent.layout.height; /* y is layout within parent; treat as top offset */ scrollViewTopRef.current = e.nativeEvent.layout.y; }}
        contentContainerStyle={{padding:12,paddingBottom: 32 + (portSuggestions.length>0 ? (Platform.OS==='ios'?120: Math.max(120, keyboardHeight+20)) : 0)}}>
        <View style={{backgroundColor:themeColors.background}}>
          <View style={{alignSelf:'flex-end',flexDirection:'row',alignItems:'center',marginBottom:8}}>
            <Text style={{color:themeColors.textSecondary,fontSize:11,fontWeight:'600',marginRight:6}}>Completed?</Text>
            <Pressable onPress={()=>setCompleted(c=>!c)} accessibilityLabel={completed? 'Mark trip as not completed':'Mark trip as completed'} style={{width:32,height:32,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:completed?themeColors.primary:themeColors.card,borderWidth:1,borderColor:completed?themeColors.primaryDark:themeColors.menuBorder}}>
              <Ionicons name={completed? 'checkmark-circle':'ellipse-outline'} size={18} color={completed? themeColors.badgeText: themeColors.textSecondary} />
            </Pressable>
          </View>
          <View style={{flexDirection:'row',gap:12,marginBottom:4}}>
            <View style={{flex:3}}>
              <Text style={styles.label}>Title</Text>
              <TextInput style={[styles.input,{marginBottom:0}]} placeholder='Trip title' placeholderTextColor={themeColors.textSecondary} value={title} onChangeText={setTitle} accessibilityLabel='Trip title' />
            </View>
            <View style={{flex:2}}>
              <Text style={styles.label}>Ship</Text>
              <TextInput style={[styles.input,{marginBottom:0}]} placeholder='Ship (optional)' placeholderTextColor={themeColors.textSecondary} value={ship} onChangeText={setShip} accessibilityLabel='Ship name' />
            </View>
          </View>
          <View style={{flexDirection:'row',gap:12,marginTop:4,marginBottom:4}}>
            <View style={{flex:1}}>
              <Text style={styles.label}>Start</Text>
              <Pressable onPress={()=>setShowStartPicker(true)} style={[styles.input,{marginBottom:4}]}> 
                <Text style={{color:startDate? themeColors.text: themeColors.textSecondary}}>{startDate? formatDateWithPrefs(startDate,prefs,{day:'2-digit',month:'short',year:'numeric'}): 'Start date'}</Text>
              </Pressable>
              {showStartPicker && (
                <DateTimePicker value={startDate? (parseLocal(startDate) as Date): new Date()} mode='date' display={Platform.OS==='ios'? 'inline':'default'} onChange={(e,date)=>{ setShowStartPicker(Platform.OS==='ios'); if(date) setStartDate(toISODate(date)); }} />
              )}
            </View>
            <View style={{flex:1}}>
              <Text style={styles.label}>End</Text>
              <Pressable onPress={()=>setShowEndPicker(true)} style={[styles.input,{marginBottom:4}]}> 
                <Text style={{color:endDate? themeColors.text: themeColors.textSecondary}}>{endDate? formatDateWithPrefs(endDate,prefs,{day:'2-digit',month:'short',year:'numeric'}): 'End date'}</Text>
              </Pressable>
              {showEndPicker && (
                <DateTimePicker value={endDate? (parseLocal(endDate) as Date): new Date()} mode='date' display={Platform.OS==='ios'? 'inline':'default'} onChange={(e,date)=>{ setShowEndPicker(Platform.OS==='ios'); if(date) setEndDate(toISODate(date)); }} />
              )}
            </View>
          </View>

          <Text style={styles.label}>Ports</Text>
            <View onLayout={e=>setPortsRowY(e.nativeEvent.layout.y)} style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:8}}>
              <TextInput ref={newPortInputRef as any} style={[styles.input,{flex:1,marginBottom:0}]} placeholder='Add a port (e.g., Juneau, AK)' placeholderTextColor={themeColors.textSecondary} value={newPort} onChangeText={setNewPort} accessibilityLabel='New port' returnKeyType='done' onFocus={()=>{ setIsNewPortFocused(true);} } onBlur={()=>setIsNewPortFocused(false)} onSubmitEditing={()=>addPort()} />
              <Pressable onPress={()=>addPort()} style={[styles.btn,{paddingVertical:8,paddingHorizontal:12}]} accessibilityRole='button'>
                <Text style={styles.btnText}>Add</Text>
              </Pressable>
            </View>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'flex-start',marginBottom:6,marginLeft:2}}>
              <Text style={{color:themeColors.textSecondary,fontSize:11,fontStyle:'italic'}}>{reorderMode? 'Reordering (drag items) - tap Done when finished':'Long press a port to reorder'}</Text>
            </View>

          {portSuggestions.length>0 && (
            <View style={{borderWidth:StyleSheet.hairlineWidth,borderColor:themeColors.menuBorder,backgroundColor:themeColors.card,borderRadius:8,marginBottom:10,overflow:'hidden'}}>
              {portSuggestions.map((s,idx)=>(
                <Pressable key={idx} onPress={()=>{ const formatted=s.name; setPorts(prev=>[...prev,formatted]); setNewPort(''); setPortSuggestions([]); upsertCachedPort({ name:s.name,country:s.country,regionCode:s.regionCode,lat:s.lat,lng:s.lng,aliases:s.aliases,source:'cache'}).then(async()=>{ try{ const cache=await PortsCache.load(); setPortsCache(cache);}catch{} }).catch(()=>{}); }} style={{paddingVertical:10,paddingHorizontal:12,borderBottomWidth: idx===portSuggestions.length-1?0:StyleSheet.hairlineWidth,borderBottomColor:themeColors.menuBorder}} accessibilityRole='button' accessibilityLabel={`Use ${s.name}`}>
                  <Text numberOfLines={2} style={{color:themeColors.text}}>{s.name}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {ports.length>0 && (
            <View style={{marginBottom:10}}>
              {reorderMode && (
                <View style={{flexDirection:'row',justifyContent:'flex-end',marginBottom:6}}>
                  <Pressable onPress={exitReorderMode} accessibilityLabel='Done reordering' style={{backgroundColor:themeColors.primary,paddingVertical:6,paddingHorizontal:12,borderRadius:8}}>
                    <Text style={{color:themeColors.badgeText,fontWeight:'700'}}>Done</Text>
                  </Pressable>
                </View>
              )}
              {renderRowsWithPlaceholder()}
            </View>
          )}

          <View style={{flexDirection:'row',gap:8,marginTop:6}}>
            <Pressable onPress={onSave} style={[styles.btn,{flex:4},!title.trim() && {opacity:0.6}]} disabled={!title.trim()} accessibilityLabel='Save trip changes'>
              <Text style={styles.btnText}>Save Changes</Text>
            </Pressable>
            <Pressable onPress={onDelete} style={[styles.delBtn,{flex:1,marginTop:0,justifyContent:'center'}]} accessibilityLabel='Delete Trip'>
              <Text style={styles.delBtnText}>Delete</Text>
            </Pressable>
          </View>
          <View style={{height:12}} />
        </View>

        <Modal visible={showDeleteModal} transparent animationType='fade' onRequestClose={()=>{ setShowDeleteModal(false); setConfirmText(''); }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Delete Trip?</Text>
              <Text style={styles.modalMessage}>This cannot be undone. Type the trip title below to confirm:</Text>
              <Text style={[styles.modalMessage,{fontWeight:'700',color:themeColors.text}]}>{trip?.title}</Text>
              <TextInput autoFocus style={styles.modalInput} placeholder={`Type "${trip?.title}"`} placeholderTextColor={themeColors.textSecondary} value={confirmText} onChangeText={setConfirmText} accessibilityLabel='Confirmation input' />
              <View style={styles.modalActions}>
                <Pressable onPress={()=>{ setShowDeleteModal(false); setConfirmText(''); }} style={styles.modalBtnCancel} accessibilityRole='button'>
                  <Text style={styles.modalBtnCancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={performDelete} style={[styles.modalBtnDelete,(confirmText.trim() !== (trip?.title??'').trim()) && {opacity:0.5}]} accessibilityRole='button' disabled={confirmText.trim() !== (trip?.title??'').trim()}>
                  <Text style={styles.modalBtnDeleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {undoInfo && (
          <View style={{position:'absolute',left:12,right:12,bottom:20,backgroundColor:themeColors.card,borderRadius:12,paddingVertical:10,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderColor:themeColors.menuBorder,shadowColor:'#000',shadowOpacity:0.15,shadowRadius:6,elevation:4}}>
            <Text style={{flex:1,marginRight:12,color:themeColors.textSecondary}} numberOfLines={2}>Deleted {undoInfo.port}</Text>
            <Pressable accessibilityLabel='Undo delete' onPress={()=>{ if(!undoInfo) return; if(undoTimerRef.current) clearTimeout(undoTimerRef.current); setPorts(prev=>{ const copy=[...prev]; const idx=Math.min(undoInfo.index,copy.length); copy.splice(idx,0,undoInfo.port); return copy; }); setUndoInfo(null); try{ Haptics.selectionAsync(); }catch{} }} style={{paddingHorizontal:14,paddingVertical:8,backgroundColor:themeColors.primary,borderRadius:8}}>
              <Text style={{color:themeColors.badgeText,fontWeight:'700'}}>Undo</Text>
            </Pressable>
          </View>
        )}
        {/* Reorder overlay in a centered popup card */}
        <Modal visible={reorderMode} transparent animationType='fade' onRequestClose={exitReorderMode}>
          <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', alignItems:'center', padding:16}}>
            <GestureHandlerRootView style={{width:'100%', maxWidth:520}}>
              <View style={{backgroundColor:themeColors.card, borderRadius:16, borderWidth:StyleSheet.hairlineWidth, borderColor:themeColors.menuBorder, overflow:'hidden'}}>
                <View style={{paddingHorizontal:12, paddingVertical:10, flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:themeColors.menuBorder}}>
                  <Text style={{color:themeColors.textSecondary, fontSize:16, fontWeight:'700'}}>Reorder Ports</Text>
                  <Pressable onPress={exitReorderMode} accessibilityLabel='Done reordering' style={{backgroundColor:themeColors.primary,paddingVertical:6,paddingHorizontal:12,borderRadius:8}}>
                    <Text style={{color:themeColors.badgeText,fontWeight:'700'}}>Done</Text>
                  </Pressable>
                </View>
                <DraggableFlatList
                  style={{maxHeight: Math.floor(Dimensions.get('window').height*0.7)}}
                  contentContainerStyle={{padding:12, paddingBottom:12}}
                  data={reorderItems}
                  keyExtractor={(item)=>item.key}
                  activationDistance={0}
                  autoscrollThreshold={80}
                  dragItemOverflow
                  onDragBegin={()=>{ try{ Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);}catch{} }}
                  onDragEnd={({data})=>{ setReorderItems(data); setPorts(data.map(d=>d.label)); try{ Haptics.selectionAsync(); } catch {} }}
                  renderItem={(params: any)=>{
                    const { item, index, drag, isActive } = params;
                    return (
                      <View style={{ marginBottom:8 }}>
                        <View style={{
                          flexDirection:'row',alignItems:'center',gap:6,
                          paddingVertical:4,paddingHorizontal:8,minHeight:50,
                          borderWidth:1,borderColor:themeColors.menuBorder,borderRadius:12,
                          backgroundColor: themeColors.card,
                          shadowColor:'#000', shadowOpacity: isActive? 0.3 : 0, shadowRadius: isActive? 10 : 0, elevation: isActive? 10 : 0,
                        }}>
                          <Text style={{width:24,textAlign:'right',color:themeColors.textSecondary}}>{index+1}.</Text>
                          <View style={{flex:1,justifyContent:'center',paddingVertical:6,paddingHorizontal:6}}>
                            <Text style={{color:themeColors.text}} numberOfLines={2}>{item.label}</Text>
                          </View>
                          <Pressable onPressIn={drag} accessibilityLabel={`Drag handle for ${item.label}`} hitSlop={10} style={{padding:6, marginRight:-4}}>
                            <Ionicons name='reorder-three-outline' size={22} color={themeColors.textSecondary} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  }}
                />
              </View>
            </GestureHandlerRootView>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
