import AsyncStorage from '@react-native-async-storage/async-storage';
import { PORTS_CACHE_CONFIG, PortEntry, normalize } from './ports';

/** Class PortsCache: TODO describe responsibility, props/state (if React), and main collaborators. */
export class PortsCache {
  /**
     * Method PortsCache.load: TODO describe behavior and when it's called.
     * @returns {Promise<import("D:/Code/portlist_app/lib/ports").PortEntry[]>} TODO: describe
     */
    static async load(): Promise<PortEntry[]> {
    try {
      const raw = await AsyncStorage.getItem(PORTS_CACHE_CONFIG.CACHE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw) as PortEntry[];
      if (!Array.isArray(arr)) return [];
      const now = Date.now();
      const filtered = arr.filter(p => {
        if (!p.savedAt) return true;
        return (now - p.savedAt) <= PORTS_CACHE_CONFIG.TTL_MS;
      });
      for (const p of filtered) { if (!p.lastAccessed) p.lastAccessed = p.savedAt || Date.now(); }
      return filtered;
    } catch {
      return [];
    }
  }

  /**
     * Method PortsCache.save: TODO describe behavior and when it's called.
     * @param {import("D:/Code/portlist_app/lib/ports").PortEntry[]} entries - TODO: describe
     * @returns {Promise<void>} TODO: describe
     */
    static async save(entries: PortEntry[]): Promise<void> {
    try {
      const now = Date.now();
      // Ensure savedAt/lastAccessed exist
      const normalized = (entries || []).map(e => ({
        ...e,
        savedAt: e.savedAt || now,
        lastAccessed: e.lastAccessed || e.savedAt || now,
      }));
      // Enforce LRU cap
      if (normalized.length > PORTS_CACHE_CONFIG.MAX_ENTRIES) {
        normalized.sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
        normalized.splice(0, normalized.length - PORTS_CACHE_CONFIG.MAX_ENTRIES);
      }
      await AsyncStorage.setItem(PORTS_CACHE_CONFIG.CACHE_KEY, JSON.stringify(normalized));
    } catch {}
  }

  /**
     * Method PortsCache.clear: TODO describe behavior and when it's called.
     * @returns {Promise<void>} TODO: describe
     */
    static async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PORTS_CACHE_CONFIG.CACHE_KEY);
    } catch {}
  }

  /**
     * Method PortsCache.upsert: TODO describe behavior and when it's called.
     * @param {import("D:/Code/portlist_app/lib/ports").PortEntry} entry - TODO: describe
     * @returns {Promise<void>} TODO: describe
     */
    static async upsert(entry: PortEntry): Promise<void> {
    const list = await PortsCache.load();
    const now = Date.now();
    const idx = list.findIndex(p => normalize(p.name) === normalize(entry.name));
    if (idx >= 0) list[idx] = { ...entry, source: 'cache', savedAt: now, lastAccessed: now, originalQuery: entry.originalQuery || undefined };
    else list.push({ ...entry, source: 'cache', savedAt: now, lastAccessed: now, originalQuery: entry.originalQuery || undefined });
    // enforce LRU cap
    if (list.length > PORTS_CACHE_CONFIG.MAX_ENTRIES) {
      list.sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
      list.splice(0, list.length - PORTS_CACHE_CONFIG.MAX_ENTRIES);
    }
    await PortsCache.save(list);
  }

  /**
     * Method PortsCache.removeByName: TODO describe behavior and when it's called.
     * @param {string} name - TODO: describe
     * @returns {Promise<boolean>} TODO: describe
     */
    static async removeByName(name: string): Promise<boolean> {
    try {
      const key = normalize(name);
      const list = await PortsCache.load();
      const filtered = list.filter(p => normalize(p.name) !== key);
      if (filtered.length === list.length) return false;
      await PortsCache.save(filtered);
      return true;
    } catch {
      return false;
    }
  }
}
