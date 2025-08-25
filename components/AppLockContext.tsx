import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform, Pressable, Text, View } from 'react-native';
import { useTheme } from './ThemeContext';

type AppLockContextType = {
  enabled: boolean;
  locked: boolean;
  setEnabled: (on: boolean) => Promise<void>;
  lockNow: () => void;
  requestUnlock: () => Promise<boolean>;
};

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { themeColors } = useTheme();
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);

  // hydrate setting
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem('cjp_app_lock_enabled');
        const on = v === '1';
        setEnabledState(on);
        if (on) setLocked(true);
      } catch {}
    })();
  }, []);

  // auto-prompt on foreground when enabled
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && enabled) {
        setLocked(true);
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const setEnabled = useCallback(async (on: boolean) => {
    setEnabledState(on);
    try { await AsyncStorage.setItem('cjp_app_lock_enabled', on ? '1' : '0'); } catch {}
    if (on) {
      setLocked(true);
    } else {
      setLocked(false);
    }
  }, []);

  const lockNow = useCallback(() => { setLocked(true); }, []);

  const requestUnlock = useCallback(async (): Promise<boolean> => {
    if (!enabled) { setLocked(false); return true; }
    // Authenticate with biometrics or device credential
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const result = await LocalAuthentication.authenticateAsync({
  promptMessage: 'Unlock Portlist',
        cancelLabel: Platform.OS === 'ios' ? 'Cancel' : 'CANCEL',
        fallbackLabel: Platform.OS === 'ios' ? 'Use Passcode' : undefined,
        disableDeviceFallback: false,
      });
      if (hasHardware && result.success) {
        setLocked(false);
        return true;
      }
    } catch {}
    return false;
  }, [enabled]);

  const value = useMemo<AppLockContextType>(() => ({ enabled, locked, setEnabled, lockNow, requestUnlock }), [enabled, locked, setEnabled, lockNow, requestUnlock]);

  return (
    <AppLockContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {enabled && locked ? (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: themeColors.background + 'F2', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: themeColors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Locked</Text>
            <Pressable onPress={requestUnlock} style={{ backgroundColor: themeColors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }} accessibilityLabel="Unlock">
              <Text style={{ color: 'white', fontWeight: '700' }}>Unlock</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within AppLockProvider');
  return ctx;
}
