export type TileConfig = {
  urlTemplate: string;
  provider: string;
  attribution: string;
  creditLink?: string;
  // Optional vector style JSON URL for MapLibre
  styleURL?: string;
};

export function getTileConfig(): TileConfig {
  const tpl = process.env.EXPO_PUBLIC_TILE_URL_TEMPLATE;
  const mapTilerKey = process.env.EXPO_PUBLIC_MAPTILER_KEY;
  const styleOverride = process.env.EXPO_PUBLIC_MAP_STYLE_URL;

  if (tpl && tpl.includes('{z}') && tpl.includes('{x}') && tpl.includes('{y}')) {
    const provider = inferProviderName(tpl);
    return {
      urlTemplate: tpl,
      provider,
      attribution: provider === 'OpenStreetMap'
        ? '© OpenStreetMap contributors'
        : `Tiles © ${provider} • Data © OpenStreetMap contributors`,
      creditLink: provider === 'OpenStreetMap'
        ? 'https://www.openstreetmap.org/copyright'
        : undefined,
      styleURL: styleOverride || undefined,
    };
  }

  if (mapTilerKey) {
    const url = `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${mapTilerKey}`;
    const styleURL = `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapTilerKey}`;
    return {
      urlTemplate: url,
      provider: 'MapTiler',
      attribution: 'Tiles © MapTiler • Data © OpenStreetMap contributors',
      creditLink: 'https://www.maptiler.com/copyright/',
      styleURL,
    };
  }

  // Fallback to OSM (development only). May be blocked in production per usage policy.
  return {
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    provider: 'OpenStreetMap',
    attribution: '© OpenStreetMap contributors',
    creditLink: 'https://www.openstreetmap.org/copyright',
    styleURL: styleOverride || undefined,
  };
}

function inferProviderName(url: string): string {
  try {
    const u = new URL(url.replace('{z}', '0').replace('{x}', '0').replace('{y}', '0'));
    const host = u.host.toLowerCase();
    if (host.includes('maptiler')) return 'MapTiler';
    if (host.includes('stadiamaps')) return 'Stadia Maps';
    if (host.includes('mapbox')) return 'Mapbox';
    if (host.includes('thunderforest')) return 'Thunderforest';
    if (host.includes('openstreetmap')) return 'OpenStreetMap';
    return u.host;
  } catch {
    return 'Custom';
  }
}
