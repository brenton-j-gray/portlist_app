import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

export type ToastKind = 'info' | 'success' | 'error';
export interface ToastItem { id: string; message: string; kind: ToastKind; duration: number; }

interface ToastContextValue {
  show: (message: string, opts?: { kind?: ToastKind; duration?: number }) => void;
  showProgress: (id: string, message: string) => void; // persists until dismiss
  update: (id: string, message: string, kind?: ToastKind, autoHideMs?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const remove = useCallback((id: string) => {
    setToasts(ts => ts.filter(t => t.id !== id));
    const t = timers.current[id]; if (t) { clearTimeout(t); delete timers.current[id]; }
  }, []);

  const scheduleAuto = useCallback((id: string, ms: number) => {
    if (ms <= 0) return;
    if (timers.current[id]) clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => remove(id), ms);
  }, [remove]);

  const show = useCallback((message: string, opts?: { kind?: ToastKind; duration?: number }) => {
    const id = Math.random().toString(36).slice(2);
    const toast: ToastItem = { id, message, kind: opts?.kind || 'info', duration: opts?.duration ?? 3000 };
    setToasts(ts => [...ts, toast]);
    scheduleAuto(id, toast.duration);
  }, [scheduleAuto]);

  const showProgress = useCallback((id: string, message: string) => {
    setToasts(ts => {
      if (ts.some(t => t.id === id)) return ts.map(t => t.id === id ? { ...t, message, kind: 'info', duration: 0 } : t);
      return [...ts, { id, message, kind: 'info', duration: 0 }];
    });
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
  }, []);

  const update = useCallback((id: string, message: string, kind: ToastKind = 'info', autoHideMs: number = 2500) => {
    setToasts(ts => ts.map(t => t.id === id ? { ...t, message, kind, duration: autoHideMs } : t));
    scheduleAuto(id, autoHideMs);
  }, [scheduleAuto]);

  const dismiss = useCallback((id: string) => remove(id), [remove]);

  // Basic slide/fade animation wrapper
  return (
    <ToastContext.Provider value={{ show, showProgress, update, dismiss }}>
      {children}
      <View pointerEvents="none" style={styles.host}>
        {toasts.map(t => <ToastView key={t.id} item={t} onDismiss={remove} />)}
      </View>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ToastView: React.FC<{ item: ToastItem; onDismiss: (id: string) => void }> = ({ item, onDismiss }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [opacity]);
  return (
    <Animated.View style={[styles.toast, { opacity, backgroundColor: colorFor(item.kind) }]}> 
      <Text style={styles.toastText}>{item.message}</Text>
    </Animated.View>
  );
};

function colorFor(kind: ToastKind): string {
  switch (kind) {
    case 'success': return '#2e7d32';
    case 'error': return '#c62828';
    default: return '#37474f';
  }
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center', paddingHorizontal: 16 },
  toast: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, marginTop: 8, minWidth: 140, maxWidth: '90%', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 6 },
  toastText: { color: '#fff', fontWeight: '600' },
});
