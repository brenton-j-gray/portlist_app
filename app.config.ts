// Minimal dynamic config: return app.json's expo config unchanged.
// Google Maps is not used; no API keys are injected here.
const appJson = require('./app.json');

export default () => {
  return { ...(appJson?.expo ?? {}) };
};
