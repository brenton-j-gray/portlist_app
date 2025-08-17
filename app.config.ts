// Dynamic Expo config to inject Google Maps API keys from env and keep existing app.json settings.
// EAS will provide env via Secrets; local builds read from .env/.env.local.

const appJson = require('./app.json');

export default ({ config }: any = {}) => {
  const base = { ...(appJson?.expo ?? {}) };

  // Ensure objects exist
  base.ios = base.ios || {};
  base.android = base.android || {};

  // Inject Google Maps keys (do not hardcode secrets here)
  const ANDROID_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
  const IOS_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY_IOS || process.env.GOOGLE_MAPS_API_KEY || '';

  base.ios.config = {
    ...(base.ios.config || {}),
    googleMapsApiKey: IOS_MAPS_KEY,
  };

  base.android.config = {
    ...(base.android.config || {}),
    googleMaps: {
      apiKey: ANDROID_MAPS_KEY,
    },
  } as any;

  // Surface keys at runtime if useful (non-sensitive; avoid exposing server keys)
  base.extra = {
    ...(base.extra || {}),
    GOOGLE_MAPS_API_KEY: ANDROID_MAPS_KEY ? 'set' : undefined,
    GOOGLE_MAPS_API_KEY_IOS: IOS_MAPS_KEY ? 'set' : undefined,
  };

  return base;
};
