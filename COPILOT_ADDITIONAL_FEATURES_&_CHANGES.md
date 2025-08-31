```markdown
# COPILOT_ADDITIONAL_FEATURES_&_CHANGES.md
**Objective:** Add free, open-source ship tracking to the app using AISStream (free WebSocket feed) and switch the map from Google Maps to OpenStreetMap tiles. Stack: TypeScript, Node.js (backend), Expo (React Native).

---

## Deliverables
1. **Backend (Node/TS)**: a minimal service that ingests AISStream, filters passenger ships, and serves current positions as GeoJSON via `GET /vessels?bbox=w,s,e,n`.
2. **Frontend (Expo)**: replace Google Maps with OpenStreetMap tiles via `react-native-maps` `UrlTile`; render ships as markers; dim stale positions; show OSM attribution.
3. **Docs/Config**: README updates, `.env.example`, basic scripts.

---

## Repo Structure (create or update)
```

/server
server.ts
package.json
tsconfig.json
.env.example

/app
config.ts            # API base URL
(your screens)
/README.md             # add run instructions

````

---

## Part A — Backend (Node + TypeScript)

> Create a lightweight ingest → cache → bbox API service.

### A1) Dependencies & config
- Create `/server/package.json`:

```json
{
  "name": "ais-backend",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "dev": "ts-node-dev server.ts",
    "build": "tsc -p .",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.21.1",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.6.2"
  }
}
````

* Create `/server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "skipLibCheck": true
  },
  "include": ["server.ts"]
}
```

* Create `/server/.env.example`:

```
AISSTREAM_KEY=
PORT=8787
```

### A2) Implement `/server/server.ts`

* Responsibilities:

  * Connect to `wss://stream.aisstream.io/v0/stream` with `Apikey` from env.
  * Subscribe globally with `FiltersShipType: [60..69]` (Passenger classes).
  * Keep **latest position per MMSI** in memory.
  * Optional heuristic: drop ships with `length < 100` (to exclude most ferries).
  * Expose `GET /vessels?bbox=w,s,e,n` returning GeoJSON FeatureCollection.
  * Mark positions as `stale: true` if older than 30 minutes.

```ts
// server.ts
import express from "express";
import WebSocket from "ws";
import cors from "cors";

type Ship = {
  mmsi: string;
  name?: string;
  lat: number; lon: number;
  sog?: number; cog?: number; hdg?: number;
  ts: number; shiptype?: number; length?: number;
};

const app = express();
app.use(cors({ origin: "*" })); // tighten for prod

const latest = new Map<string, Ship>();

// --- AISStream ingest ---
const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

ws.on("open", () => {
  ws.send(JSON.stringify({
    Apikey: process.env.AISSTREAM_KEY,
    BoundingBoxes: [[[-180, -85], [180, 85]]], // world; tile this later if needed
    FiltersShipType: [60,61,62,63,64,65,66,67,68,69]
  }));
});

ws.on("message", (buf) => {
  try {
    const msg = JSON.parse(buf.toString());
    const p = msg?.Message?.PositionReport;
    if (!p) return;

    const length = msg?.StaticData?.Length ?? 0;
    if (length && length < 100) return; // crude de-ferry

    const ship: Ship = {
      mmsi: String(p.UserID),
      name: msg?.Meta?.ShipName,
      lat: p.Latitude,
      lon: p.Longitude,
      sog: p.Sog,
      cog: p.Cog,
      hdg: p.TrueHeading,
      ts: msg?.Meta?.Timestamp,
      shiptype: msg?.Meta?.ShipType,
      length
    };

    latest.set(ship.mmsi, ship);
  } catch {}
});

ws.on("close", () => {
  // Attempt a simple reconnect after delay
  setTimeout(() => {
    (ws as any).emit("open");
  }, 3000);
});

// --- BBox endpoint ---
app.get("/vessels", (req, res) => {
  const [w, s, e, n] = String(req.query.bbox || "").split(",").map(Number);
  if ([w, s, e, n].some(Number.isNaN)) {
    return res.status(400).send("bbox=w,s,e,n");
  }

  const now = Date.now();
  const features = [...latest.values()]
    .filter(d => d.lon >= w && d.lon <= e && d.lat >= s && d.lat <= n)
    .map(d => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [d.lon, d.lat] as [number, number] },
      properties: {
        ...d,
        stale: (now - d.ts * 1000) > 30 * 60 * 1000
      }
    }));

  res.json({ type: "FeatureCollection", features });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`AIS API listening on :${port}`));
```

### A3) Run instructions (add to top-level README)

```bash
cd server
cp .env.example .env  # put your AISSTREAM_KEY here
npm i
npm run dev
# API: http://localhost:8787/vessels?bbox=-80,24,-70,32
```

**Acceptance for Part A**

* `GET /vessels?bbox=...` returns valid GeoJSON.
* No crash on transient WS drops.
* `properties.stale` exists and is `true` for >30min-old positions.

---

## Part B — Frontend (Expo, switch to OpenStreetMap)

> Keep `react-native-maps`, replace Google provider usage with an **OSM UrlTile**, and render vessel markers.

### B1) Config

* Create `/app/config.ts`:

```ts
export const API_BASE = "http://localhost:8787"; // change for device/tunnel/prod
```

### B2) Update Map screen (example `app/MapScreen.tsx`)

* Requirements:

  * Use `UrlTile` pointing to `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
  * Render markers from `GET /vessels?bbox=...`.
  * Dim stale markers (opacity \~0.4).
  * Show **OSM attribution** overlay (tap to open copyright page).
  * Remove any `provider="google"` prop(s).

```tsx
import MapView, { Marker, Region, UrlTile } from "react-native-maps";
import { useState } from "react";
import { View, Text, Linking, TouchableOpacity, StyleSheet } from "react-native";
import { API_BASE } from "./config";

type Feature = {
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { mmsi: string; name?: string; cog?: number; stale?: boolean };
};

export default function MapScreen() {
  const [ships, setShips] = useState<Feature[]>([]);

  async function fetchShips(r: Region) {
    const bbox = [
      r.longitude - r.longitudeDelta/2,
      r.latitude  - r.latitudeDelta/2,
      r.longitude + r.longitudeDelta/2,
      r.latitude  + r.latitudeDelta/2
    ].join(",");
    const resp = await fetch(`${API_BASE}/vessels?bbox=${bbox}`);
    const geo = await resp.json();
    setShips(geo.features);
  }

  return (
    <View style={{flex:1}}>
      <MapView
        style={{flex:1}}
        initialRegion={{ latitude: 20, longitude: 0, latitudeDelta: 80, longitudeDelta: 180 }}
        onRegionChangeComplete={fetchShips}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
          zIndex={-1}
        />

        {ships.map((f) => {
          const [lon, lat] = f.geometry.coordinates;
          return (
            <Marker
              key={f.properties.mmsi}
              coordinate={{ latitude: lat, longitude: lon }}
              title={f.properties.name || f.properties.mmsi}
              rotation={f.properties.cog || 0}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
              opacity={f.properties.stale ? 0.4 : 1}
            />
          );
        })}
      </MapView>

      {/* Required OpenStreetMap attribution */}
      <TouchableOpacity
        style={styles.attribution}
        onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")}
      >
        <Text style={styles.attrText}>© OpenStreetMap contributors</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  attribution: {
    position: "absolute",
    right: 8, bottom: 8,
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6
  },
  attrText: { fontSize: 12 }
});
```

### B3) Notes

* **OSM tile usage:** `tile.openstreetmap.org` is for light usage. For production or higher traffic, switch to your own tile server or a third-party OSM tile provider. Always keep the attribution visible.
* **Expo/Android/iOS:** `UrlTile` works on both platforms with `react-native-maps`. No Google Maps API key required.

**Acceptance for Part B**

* Panning triggers fetch and updates markers within \~1s on LAN.
* OSM attribution is visible and tappable.
* No remaining `provider="google"` usage.

---

## Part C — Integration / QA checklist

* [ ] Backend runs via `npm run dev` and serves GeoJSON.
* [ ] Frontend reads `API_BASE` from `/app/config.ts`.
* [ ] Map renders OSM tiles reliably on Android and iOS simulators/devices.
* [ ] Stale ships appear semi-transparent.
* [ ] Bad `bbox` returns HTTP 400.
* [ ] README includes run steps and attribution note.

---

## Part D — Follow-ups (stub or ticket)

* Add `/vessel/:mmsi` endpoint that returns last known point + last N track points.
* Add simple server-side **bbox cache** (2–5s) to reduce fetch spam while panning.
* Add basic rate limiting (e.g., 4 req/s/IP).
* Switch to **vector tiles** or server-side clustering if marker counts get large.

---

## Environment & Legal

* **AISStream**: requires an API key; respect the provider’s TOS. Expect coverage gaps offshore (no satellite on free tiers).
* **OpenStreetMap**: always display `© OpenStreetMap contributors`. For production traffic, use your own tiles or a tile CDN that permits your usage.

```
```
