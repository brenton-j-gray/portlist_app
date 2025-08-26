/* Test-only type declarations to help tests avoid `: any` and ts-ignore.
   Placed under __tests__ so it's available to test files via `tsconfig.json`'s include in Jest.
*/

// A minimal, shared shape used across tests for ports stored in the cache.
interface PortEntry {
  name: string;
  lat: number;
  lng: number;
  savedAt?: number; // unix ms
  lastAccessed?: number; // unix ms
  [key: string]: unknown;
}

declare module '@react-native-async-storage/async-storage' {
  type AsyncStorageValue = string | null;
  export function getItem(key: string): Promise<AsyncStorageValue>;
  export function setItem(key: string, value: string): Promise<void>;
  export function removeItem(key: string): Promise<void>;
  export function clear(): Promise<void>;
  export function getAllKeys(): Promise<string[]>;
  export function multiGet(keys: string[]): Promise<[string, string | null][]>;
  export function multiSet(kvPairs: [string, string][]): Promise<void>;
  export function multiRemove(keys: string[]): Promise<void>;
  export const __resetStore: () => void;
  const AsyncStorage: {
    getItem: typeof getItem;
    setItem: typeof setItem;
    removeItem: typeof removeItem;
    clear: typeof clear;
    getAllKeys: typeof getAllKeys;
    multiGet: typeof multiGet;
    multiSet: typeof multiSet;
    multiRemove: typeof multiRemove;
    __resetStore: typeof __resetStore;
  };
  export default AsyncStorage;
}

declare module '../lib/portsCache' {
  export const PortsCache: {
    load: () => Promise<PortEntry[]>;
    save: (entries: PortEntry[]) => Promise<void>;
    clear: () => Promise<void>;
    upsert: (entry: PortEntry) => Promise<void>;
    removeByName: (name: string) => Promise<void>;
  };
}

declare module '../lib/ports' {
  export const makeCachePort: (p: { name: string; lat: number; lng: number }) => PortEntry;
  export const PORTS_CACHE_CONFIG: { MAX_ENTRIES: number };
}
