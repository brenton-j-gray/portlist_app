import { normalize, sanitizePortQuery, scoreName } from '../lib/ports';
import { withFreshModules } from './utils/withFreshModules';

describe('ports core logic', () => {
  test('scoreName: exact and fuzzy', () => {
    expect(scoreName('Juneau', 'Juneau')).toBe(1);
    expect(scoreName('Juneau', 'juneau')).toBe(1);
    expect(scoreName('Juneau', 'Juneau, AK')).toBeGreaterThan(0.7);
    expect(scoreName('Cozumel', 'Cozuml')).toBeGreaterThan(0.65);
    expect(scoreName('Seattle', 'Port of Seattle')).toBeGreaterThan(0.5);
  });

  test('sanitizePortQuery strips noisy descriptors', () => {
    expect(sanitizePortQuery('History of the Port of Tianjin')).toBe('Tianjin');
    expect(sanitizePortQuery('Port: Hilo')).toBe('Hilo');
    expect(sanitizePortQuery('Kona (history)')).toBe('Kona');
    expect(sanitizePortQuery('Sitka')).toBe('Sitka');
  });

  test('normalize strips diacritics and lowercases', () => {
    expect(normalize('Cozumél')).toBe('cozumel');
    expect(normalize('  Seattle  ')).toBe('seattle');
  });
});

describe('PortsCache', () => {
  test('evicts oldest entries when exceeding max', async () => {
    await withFreshModules(async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      const { PortsCache } = require('../lib/portsCache');
      const { makeCachePort, PORTS_CACHE_CONFIG } = require('../lib/ports');

      await AsyncStorage.clear();
      if (typeof AsyncStorage.__resetStore === 'function') {
        AsyncStorage.__resetStore();
      }

      const N = PORTS_CACHE_CONFIG.MAX_ENTRIES + 5;
      const entries = Array.from({ length: N }, (_, i) =>
        makeCachePort({ name: `Port${i}`, lat: 0, lng: 0 })
      );

      await PortsCache.save(entries);
  const loaded = await PortsCache.load();
  expect(loaded.length).toBe(PORTS_CACHE_CONFIG.MAX_ENTRIES);
  // Oldest entries should be evicted
  expect(loaded.some((e: PortEntry) => e.name === 'Port0')).toBe(false);
  expect(loaded.some((e: PortEntry) => e.name === `Port${N - 1}`)).toBe(true);
    });
  });
});
