// Trip Detail screen (refactored: removed FAB, added inline New Note, export button, compact Completed toggle + edit button)
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, LayoutChangeEvent, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NoteCard } from '../../../components/NoteCard';
import { formatDateRangeWithPrefs, usePreferences } from '../../../components/PreferencesContext';
import { useTheme } from '../../../components/ThemeContext';
import { useToast } from '../../../components/ToastContext';
import { ExportFormat, exportTrip } from '../../../lib/exportTrip';
import { getTripById } from '../../../lib/storage';
import * as Widget from '../../../lib/widget';
import { Note, Trip } from '../../../types';

/**
 * React component parseLocalFromString: TODO describe purpose and where it’s used.
 * @param {any} dateStr - TODO: describe
 * @returns {any} TODO: describe
 */
function parseLocalFromString(dateStr: string | undefined): Date | null { if (!dateStr) return null; const ymd=String(dateStr).slice(0,10); if(/^\d{4}-\d{2}-\d{2}$/.test(ymd)){ const [y,m,d]=ymd.split('-').map(Number); return new Date(y,(m||1)-1,d||1);} const d=new Date(dateStr); return isNaN(d.getTime())?null:d; }
/**
 * React component computeDurationDays: TODO describe purpose and where it’s used.
 * @param {any} start - TODO: describe
 * @param {any} end - TODO: describe
 * @returns {any} TODO: describe
 */
function computeDurationDays(start?: string, end?: string): number | null { if(!start||!end) return null; const s=parseLocalFromString(start); const e=parseLocalFromString(end); if(!s||!e) return null; const MS=86400000; const days=Math.floor((e.getTime()-s.getTime())/MS)+1; return days>0?days:null; }

/**
 * React component TripDetail: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export default function TripDetail(){
  const { themeColors } = useTheme();
  const { prefs, setPref } = usePreferences();
  const { showProgress, update } = useToast();
  const { id } = useLocalSearchParams<{id:string}>();
  const [trip,setTrip]=useState<Trip|undefined>();
  const [loading,setLoading]=useState(true);
  // completed toggle moved back to edit screen
  const [showPortsModal,setShowPortsModal]=useState(false);
  const [pendingDelete,setPendingDelete]=useState<Note|null>(null);
  const [showUndo,setShowUndo]=useState(false);
  const [rowHeights,setRowHeights]=useState<Record<string,number>>({});
  const undoTimerRef=useRef<number|null>(null);
  const insets=useSafeAreaInsets();
  const [sortDesc,setSortDesc]=useState(false);
  const [showExportMenu,setShowExportMenu]=useState(false);
  const handleExport = useCallback(async () => {
    if (!trip) return;
    const id = 'export_trip_'+trip.id;
    showProgress(id, 'Preparing export…');
    try {
      await exportTrip(trip, (prefs.exportFormat as ExportFormat)||'pdf');
      update(id, 'Export complete', 'success', 2500);
    } catch {
      update(id, 'Export failed', 'error', 4000);
    }
  }, [trip, prefs.exportFormat, showProgress, update]);

  const sortedDays = useMemo(()=>{
    if(!trip) return [] as Note[];
    const copy=[...trip.days];
    copy.sort((a,b)=> sortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
    return copy;
  },[trip,sortDesc]);

  const refresh=useCallback(async()=>{ if(!id) return; setLoading(true); const t=await getTripById(id); setTrip(t||undefined); setLoading(false); },[id]);
  useEffect(()=>{refresh();},[refresh]);

  // (toggleCompleted removed – completion now edited only in edit screen)

  const styles=useMemo(()=>StyleSheet.create({
    container:{flex:1,backgroundColor:themeColors.background,paddingBottom:Math.max(12,insets.bottom)},
    gradientHeader:{paddingTop:48,paddingBottom:28,paddingHorizontal:24,borderBottomLeftRadius:32,borderBottomRightRadius:32,alignItems:'flex-start',marginBottom:12,shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:0.12,shadowRadius:8,elevation:4},
  headerTitle:{color:'#fff',fontSize:28,fontWeight:'700',marginBottom:0,letterSpacing:0.2},
    headerToggleBtn:{width:40,height:40,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.15)',borderWidth:1,borderColor:'rgba(255,255,255,0.35)'},
    headerSmallBtn:{marginTop:6,width:34,height:34,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.15)',borderWidth:1,borderColor:'rgba(255,255,255,0.35)'},
    summaryCard:{backgroundColor:themeColors.card,borderRadius:18,marginHorizontal:16,marginTop:-34,marginBottom:8,padding:14,borderWidth:2,borderColor:themeColors.primary,shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:0.1,shadowRadius:6,elevation:8},
    summaryRow:{flexDirection:'row',alignItems:'center',marginBottom:6},
    summaryIcon:{marginRight:10},
    summaryText:{fontSize:16,color:themeColors.text,fontWeight:'500'},
    listContent:{paddingTop:0,paddingBottom:104+insets.bottom,paddingHorizontal:16},
    emptyText:{marginTop:24,textAlign:'center',color:themeColors.textSecondary},
  }),[themeColors,insets.bottom]);

  const finalizeDelete=useCallback((note:Note)=>{ setTrip(prev=>prev?{...prev,days:prev.days.filter(d=>d.id!==note.id)}:prev); import('../../../lib/storage').then(m=>{ if(trip) m.upsertTrip({...trip,days:trip.days.filter(d=>d.id!==note.id)}); }).catch(()=>{}); },[trip]);
  const handleDelete=useCallback((note:Note)=>{ if(undoTimerRef.current){clearTimeout(undoTimerRef.current);undoTimerRef.current=null;} setPendingDelete(note); finalizeDelete(note); setShowUndo(true); undoTimerRef.current=setTimeout(()=>{ setPendingDelete(null); setShowUndo(false); undoTimerRef.current=null; },5000); },[finalizeDelete]);
  const handleUndo=useCallback(()=>{ if(!pendingDelete) return; if(undoTimerRef.current){clearTimeout(undoTimerRef.current);undoTimerRef.current=null;} const note=pendingDelete; setPendingDelete(null); setShowUndo(false); setTrip(prev=>prev?{...prev,days:[...prev.days,note].sort((a,b)=>a.date.localeCompare(b.date))}:prev); import('../../../lib/storage').then(m=>{ if(trip) m.upsertTrip({...trip,days:[...trip.days,note].sort((a,b)=>a.date.localeCompare(b.date))}); }).catch(()=>{}); },[pendingDelete,trip]);

  if(loading && !trip){
    return <View style={{flex:1,backgroundColor:themeColors.background,padding:18}}><View style={{height:140,borderRadius:32,backgroundColor:themeColors.card,marginBottom:16}}/><View style={{height:120,borderRadius:18,backgroundColor:themeColors.card,marginBottom:20}}/>{[0,1,2].map(i=> <View key={i} style={{height:100,borderRadius:12,backgroundColor:themeColors.card,marginBottom:14}}/> )}</View>;
  }
  if(!trip){ return <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:themeColors.background}}><Text style={{color:themeColors.textSecondary}}>Trip not found.</Text></View>; }

  return (
    <View style={styles.container}>
      <LinearGradient colors={themeColors.cardAccentGradient as any} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.gradientHeader}>
        <View style={{flexDirection:'row',alignItems:'center',width:'100%'}}>
          <Text style={[styles.headerTitle,{flex:1,marginRight:12}]} numberOfLines={2}>{trip.title}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
            <Pressable style={[styles.headerSmallBtn,{marginTop:0}]} accessibilityLabel="Export trip" onPress={handleExport}>
              <Ionicons name="download-outline" size={18} color="#fff" />
            </Pressable>
            <Pressable style={[styles.headerSmallBtn,{marginTop:0}]} accessibilityLabel="Choose export format" onPress={()=>setShowExportMenu(true)}>
              <Ionicons name="document-text-outline" size={18} color="#fff" />
            </Pressable>
            {/* Set countdown widget (Android) */}
            <Pressable style={[styles.headerSmallBtn,{marginTop:0}]} accessibilityLabel="Set countdown widget" onPress={async()=>{
              try { if (trip.startDate) await Widget.setCountdownTrip(trip); else await Widget.clearCountdownTrip(); } catch {/* ignore */}
            }}>
              <Ionicons name="hourglass-outline" size={18} color="#fff" />
            </Pressable>
            <Pressable style={[styles.headerSmallBtn,{marginTop:0}]} accessibilityLabel="Edit trip" onPress={()=>router.push({pathname:'/(tabs)/trips/[id]/edit' as any, params:{id:trip.id}} as any)}>
              <Ionicons name="create-outline" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </LinearGradient>
      <View style={styles.summaryCard}>
        <View style={[styles.summaryRow,{marginBottom:2}]}>          
          <Ionicons name="calendar-outline" size={18} color={themeColors.primaryDark} style={[styles.summaryIcon,{marginRight:6}]} />
          <Text style={[styles.summaryText,{fontSize:15}]}>{formatDateRangeWithPrefs(trip.startDate,trip.endDate,prefs)}</Text>
        </View>
        {(()=>{ const d=computeDurationDays(trip.startDate,trip.endDate); const seaCount=trip.days.filter(day=>(day as any).isSeaDay).length; const cells: {key:string;icon:string;color:string;text:string;onPress?:()=>void;underline?:boolean}[]=[]; if(trip.ship) cells.push({key:'ship',icon:'boat-outline',color:themeColors.primary,text:trip.ship}); if(d) cells.push({key:'dur',icon:'time-outline',color:themeColors.primaryDark,text:`${d} day${d===1?'':'s'}`}); if(trip.ports?.length) cells.push({key:'ports',icon:'location-outline',color:themeColors.accent,text:`${trip.ports.length} port${trip.ports.length>1?'s':''}`,onPress:()=>setShowPortsModal(true),underline:true}); cells.push({key:'notes',icon:'document-text-outline',color:themeColors.highlight,text:`${trip.days.length} note${trip.days.length!==1?'s':''}`}); if(seaCount) cells.push({key:'sea',icon:'boat-outline',color:themeColors.primary,text:`${seaCount} sea day${seaCount!==1?'s':''}`}); if(cells.length>4){ const shipIdx=cells.findIndex(c=>c.key==='ship'); if(shipIdx!==-1) cells.splice(shipIdx,1);} const grid=cells.slice(0,4); if(!grid.length) return null; return <View style={{flexDirection:'row',flexWrap:'wrap',marginTop:2}}>{grid.map(it=> <Pressable key={it.key} onPress={it.onPress} disabled={!it.onPress} style={{width:'50%',flexDirection:'row',alignItems:'center',paddingVertical:4}} accessibilityLabel={it.text}><Ionicons name={it.icon as any} size={16} color={it.color} style={{marginRight:5}} /><Text style={[styles.summaryText,{fontSize:14,fontWeight:'600',color:themeColors.text,textDecorationLine:it.underline?'underline':'none'}]} numberOfLines={2}>{it.text}</Text></Pressable> )}</View>; })()}
      </View>
      <View style={{marginHorizontal:16,marginBottom:8,flexDirection:'row',alignItems:'center'}}>
        <Text accessibilityRole="header" style={{fontSize:20,fontWeight:'700',color:themeColors.text}}>Notes</Text>
        <View style={{flex:1,alignItems:'center'}}>
          <Pressable accessibilityLabel="Add new note" onPress={()=>router.push({pathname:'/(tabs)/trips/[id]/note-new' as any, params:{id:String(id)}} as any)} style={{flexDirection:'row',alignItems:'center',backgroundColor:themeColors.primary,paddingVertical:8,paddingHorizontal:18,borderRadius:999,shadowColor:'#000',shadowOpacity:0.15,shadowRadius:4,shadowOffset:{width:0,height:2},elevation:2}}>
            <Ionicons name="add" size={18} color={themeColors.badgeText} />
            <Text style={{marginLeft:6,fontSize:14,fontWeight:'700',color:themeColors.badgeText}}>New Note</Text>
          </Pressable>
        </View>
        <Pressable accessibilityLabel={sortDesc? 'Sort ascending' : 'Sort descending'} onPress={()=>setSortDesc(d=>!d)} style={{flexDirection:'row',alignItems:'center',backgroundColor:themeColors.card,paddingVertical:8,paddingHorizontal:14,borderRadius:999,borderWidth:1,borderColor:themeColors.menuBorder}}>
          <Ionicons name={sortDesc ? 'arrow-down' : 'arrow-up'} size={16} color={themeColors.text} />
          <Text style={{marginLeft:6,fontSize:12,fontWeight:'600',color:themeColors.text}}>{sortDesc ? 'Newest' : 'Oldest'}</Text>
        </Pressable>
      </View>
      <View style={{marginHorizontal:16, marginTop:-4, marginBottom:6, alignItems:'center'}}>
        <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>Swipe right to edit • left to delete</Text>
      </View>
    {trip.days.length===0 ? <Text style={styles.emptyText}>No notes yet. Add your first one.</Text> : (
        <FlatList
      data={sortedDays}
          keyExtractor={d=>d.id}
          renderItem={({item})=> (
            <Swipeable
              overshootRight={false}
              overshootLeft={false}
              renderLeftActions={(progress)=>{ const opacity=progress.interpolate({inputRange:[0,0.05,0.4,1],outputRange:[0,0.15,0.85,1],extrapolate:'clamp'}); const scale=progress.interpolate({inputRange:[0,1],outputRange:[0.9,1],extrapolate:'clamp'}); return <Animated.View style={{flexDirection:'row',alignItems:'center',opacity}}><Animated.View style={{transform:[{scale}]}}><Pressable onPress={()=>router.push({pathname:'/(tabs)/trips/[id]/note/[noteId]/edit' as any, params:{id:String(id),noteId:item.id}} as any)} accessibilityLabel={`Edit note ${item.date}`} style={{width:84,marginTop:10,height:rowHeights[item.id]||undefined,justifyContent:'center',alignItems:'center',backgroundColor:themeColors.primary,borderRadius:12,marginRight:8,shadowColor:'#000',shadowOpacity:0.15,shadowRadius:4,shadowOffset:{width:0,height:2},elevation:2}}><Ionicons name="create-outline" size={26} color={themeColors.badgeText} /><Text style={{color:themeColors.badgeText,fontSize:12,fontWeight:'700',marginTop:4}}>Edit</Text></Pressable></Animated.View></Animated.View>; }}
              renderRightActions={(progress)=>{ const opacity=progress.interpolate({inputRange:[0,0.05,0.4,1],outputRange:[0,0.15,0.85,1],extrapolate:'clamp'}); const scale=progress.interpolate({inputRange:[0,1],outputRange:[0.9,1],extrapolate:'clamp'}); return <Animated.View style={{flexDirection:'row',alignItems:'center',opacity}}><Animated.View style={{transform:[{scale}]}}><Pressable onPress={()=>handleDelete(item)} accessibilityLabel={`Delete note ${item.date}`} style={{width:84,marginTop:10,height:rowHeights[item.id]||undefined,justifyContent:'center',alignItems:'center',backgroundColor:themeColors.danger,borderRadius:12,marginLeft:8,shadowColor:'#000',shadowOpacity:0.15,shadowRadius:4,shadowOffset:{width:0,height:2},elevation:2}}><Ionicons name="trash-outline" size={26} color={themeColors.badgeText} /><Text style={{color:themeColors.badgeText,fontSize:12,fontWeight:'700',marginTop:4}}>Delete</Text></Pressable></Animated.View></Animated.View>; }}
            >
              <DayItem item={item} tripId={String(id)} onLayout={(e:LayoutChangeEvent)=>{ const h=e.nativeEvent.layout.height; setRowHeights(prev=>prev[item.id]===h?prev:{...prev,[item.id]:h}); }} />
            </Swipeable>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
      <Modal visible={showPortsModal} transparent animationType="fade" onRequestClose={()=>setShowPortsModal(false)}>
        <Pressable style={{flex:1,backgroundColor:'rgba(0,0,0,0.4)'}} onPress={()=>setShowPortsModal(false)} />
        <View style={{position:'absolute',left:0,right:0,top:'30%',marginHorizontal:24,backgroundColor:themeColors.card,borderRadius:16,padding:20,alignSelf:'center',elevation:8,borderWidth:1,borderColor:themeColors.primary}}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <Text style={{fontSize:18,fontWeight:'700',color:themeColors.text}}>Ports</Text>
            <Pressable accessibilityLabel="Edit ports" onPress={()=>{ setShowPortsModal(false); router.push({pathname:'/(tabs)/trips/[id]/edit' as any, params:{id:trip.id}} as any); }} style={{paddingVertical:6,paddingHorizontal:14,borderRadius:999,backgroundColor:themeColors.primary,flexDirection:'row',alignItems:'center',gap:6}}>
              <Ionicons name="create-outline" size={16} color={themeColors.badgeText} />
              <Text style={{fontSize:14,fontWeight:'700',color:themeColors.badgeText}}>Edit</Text>
            </Pressable>
          </View>
          {trip.ports && trip.ports.map((port,idx)=> <Text key={idx} style={{fontSize:16,color:themeColors.text,marginBottom:6}}>{port}</Text>)}
          <View style={{flexDirection:'row',justifyContent:'flex-end',gap:16,marginTop:10}}>
            <Pressable accessibilityLabel="Close ports list" onPress={()=>setShowPortsModal(false)} style={{paddingVertical:8,paddingHorizontal:14}}>
              <Text style={{color:themeColors.primary,fontWeight:'700',fontSize:16}}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={showExportMenu} transparent animationType='fade' onRequestClose={()=>setShowExportMenu(false)}>
        <Pressable style={{flex:1,backgroundColor:'rgba(0,0,0,0.4)'}} onPress={()=>setShowExportMenu(false)} />
        <View style={{position:'absolute',left:0,right:0,top:'35%',marginHorizontal:40,backgroundColor:themeColors.card,borderRadius:18,padding:20,borderWidth:1,borderColor:themeColors.primary}}>
          <Text style={{fontSize:18,fontWeight:'700',color:themeColors.text,marginBottom:12}}>Export Format</Text>
          {(['pdf','json','txt','docx'] as ExportFormat[]).map(fmt=> (
            <Pressable key={fmt} onPress={()=>{ setPref('exportFormat', fmt as any); setShowExportMenu(false); }} accessibilityLabel={`Select ${fmt.toUpperCase()} format`} style={{paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <Text style={{fontSize:15,fontWeight:'600',color:themeColors.text}}>{fmt.toUpperCase()}</Text>
              {prefs.exportFormat===fmt && <Ionicons name='checkmark' size={18} color={themeColors.primary} />}
            </Pressable>
          ))}
          <View style={{flexDirection:'row',justifyContent:'flex-end',marginTop:4}}>
            <Pressable onPress={()=>setShowExportMenu(false)} style={{paddingVertical:8,paddingHorizontal:14}}>
              <Text style={{fontSize:15,fontWeight:'700',color:themeColors.primary}}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {showUndo && (
        <View style={{position:'absolute',left:20,right:20,bottom:Math.max(20,insets.bottom+20),backgroundColor:themeColors.card,borderRadius:16,paddingHorizontal:18,paddingVertical:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderColor:themeColors.menuBorder,shadowColor:'#000',shadowOpacity:0.25,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:6}}>
          <Text style={{color:themeColors.text,fontSize:14,fontWeight:'600'}}>Note deleted</Text>
          <Pressable accessibilityLabel="Undo delete" onPress={handleUndo} style={{paddingHorizontal:8,paddingVertical:6}}>
            <Text style={{color:themeColors.primaryDark,fontWeight:'700',fontSize:14}}>UNDO</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/**
 * React component DayItem: TODO describe purpose and where it’s used.
 * @param {any} {item,tripId,onLayout} - TODO: describe
 * @returns {any} TODO: describe
 */
function DayItem({item,tripId,onLayout}:{item:Note;tripId:string;onLayout?:(e:any)=>void}){ return <NoteCard note={item} onLayout={onLayout} onPress={()=>router.push({pathname:'/(tabs)/trips/[id]/note/[noteId]' as any, params:{id:tripId,noteId:item.id}} as any)} thumbSize={64} compact />; }
