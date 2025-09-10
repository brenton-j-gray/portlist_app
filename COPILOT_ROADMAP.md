# 🚢 Portlist – Feature Roadmap

## 🎯 MVP (Minimum Viable Product)

Focus: Let users log a cruise trip day by day with basic memory capture.

- [ ] **Trip Management**

  - [x] Create and manage trips (name, dates, ship, itinerary)
  - [ ] Add/edit ports of call and sea days

- [ ] **Daily Log / Journal**

  - [x] Add text entry for each day (notes, highlights, reflections)
  - [x] Add photos/videos to each day

- [ ] **Excursion Tracking**

  - [ ] Add excursions/activities per day
  - [ ] Mark excursions as "planned" or "completed"

- [ ] **Offline Support**

  - [ ] Journaling works offline and syncs later

- [x] **Export**
  - [x] Generate simple PDF of trip logs + photos

---

## 🛠️ Phase 2 – Core Enhancements

Focus: Make it feel like a **true cruise-specific journal.**

- [ ] **Weather Integration**

  - [ ] Auto-log weather per port/day

- [ ] **Checklists**

  - [ ] Packing list
  - [ ] Bucket list
  - [ ] Ports visited tracker

- [ ] **Visuals**

  - [ ] Cruise route map with pins
  - [ ] Virtual "passport stamps" for ports

- [ ] **Basic Collaboration**
  - [ ] Allow family/friends on the same trip to add entries/photos

---

## 🌍 Phase 3 – Growth Features

Focus: Differentiate from competitors + monetize.

- [ ] **Advanced Export Options**

  - [ ] Polished PDF layouts
  - [ ] Print-on-demand keepsake book

- [ ] **Gamification**

  - [ ] Badges for number of cruises
  - [ ] Badges for ports visited
  - [ ] Badges for excursions completed

- [ ] **Sharing**

  - [ ] Private share link (read-only journal for friends/family)
  - [ ] Optional public feed/social element

- [ ] **Customization**
  - [ ] Custom journaling prompts (e.g., “Best meal today?”)
  - [ ] Stickers, themed backgrounds
  - [ ] Cruise line logos

---

## 💰 Monetization Strategy

- **Free Tier (MVP features):**

  - Create trips, journal, add photos

- **Pro Tier (one-time purchase or subscription):**
  - Export/print features
  - Weather auto-log
  - Badges/stamps
  - Collaboration

---

## 🧭 Guiding Principles

- Mobile-first, offline-first. Data entry must be instant and resilient without network.
- Delight > density. Favor clear, joyful UI for quick journaling on the go.
- Opinionated cruise focus (ships, ports, sea days) vs general journaling.
- Progressive enhancement: start local-only; layer cloud, sharing, and pro later.

## ✅ MVP Definition of Done

- Create/edit/delete trips with dates, ship, ports/sea days.
- Add/edit notes per day with photos; works offline (no lost input when toggling airplane mode).
- Basic export to single-PDF with text and first photo per day.
- Zero crashes on cold start and after permission denials (camera/photos/location).
- Basic analytics event flow: app_open, create_trip, add_note, export_pdf.

## 📌 Prioritization Framework

- Score features by Impact (1–5) × Effort (1–5). Build highest score per lowest effort first.
- Unblockers first (shared components, storage abstractions, media pipeline).

## 🔗 Dependencies by Phase

- MVP
  - Local storage abstraction (ready for future sync layer).
  - Media pipeline: pick, compress, store URI + metadata.
  - Export service: HTML→PDF or RN PDF lib; file-save/share.
- Phase 2
  - Location + weather providers (Open-Meteo + reverse geocode).
  - Map component (react-native-maps) behind feature flag.
  - Checklists module (reusable list model).
- Phase 3
  - Cloud backend (auth, sync, sharing). Start with hosted DB + storage.
  - Print vendor integration (API webhook or export upload).

## 🧱 Tech Foundations (recommended early)

- Data model v1: Trip{id, title, ship, startDate, endDate, ports[]}, Note{id, tripId, date, title?, notes?, photos[]}, Photo{uri, width, height, caption?}.
- Storage: AsyncStorage + file URIs; keep an index for fast lists; reserve extIds for future sync.
- Media: resize/compress to sensible max (e.g., 1600px) to keep exports fast.
- Theming: light/dark via ThemeContext; shared Pill component for tags.
- Feature flags: simple in-app gate keyed by tier.

## 📈 KPIs & Success Metrics

- Activation: % users who create a trip in first session (>50%).
- Engagement: median notes per trip (target ≥5 by Phase 2).
- Retention: D7 ≥25% for created-trip cohort.
- Monetization: Pro conversion ≥3–5% of active creators by Phase 3.
- Export adoption: ≥30% of completed trips exported in any format.

## ⚠️ Risks & Mitigations

- Large media bloat → compress/resample; lazy-load images; warn on very large exports.
- Permission friction (camera/photos/location) → graceful fallbacks and education copy.
- Export complexity → start with simple single-column PDF; iterate layouts later.
- Sync conflicts (Phase 3) → last-write-wins + per-field timestamps; conflict UI later if needed.

## 🚀 Release Plan (high-level)

- Alpha (internal): MVP vertical slice with 1–2 trips, export working.
- Beta: Add weather + checklists; limited TestFlight/Play testing; collect telemetry.
- 1.0: Polish, performance pass, store assets, onboarding, simple pro paywall (export+weather).

## 🧪 Acceptance Criteria Samples

- Create Trip: saving persists across restarts; date range validates; ports editable.
- Add Note: photo added appears in Recent highlights; offline add survives relaunch; date constrained to trip range.
- Export: produces a shareable file; includes text + first photo per day; <10s for 10-day trip on mid device.
