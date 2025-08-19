# 🚢 Cruise Journal Pro (WORKING TITLE) – Copilot Features Guide

This file explains **why** each feature exists, so Copilot can generate code with the right intent.

---

## 🎯 MVP Features – Purpose

- **Trip Management**  
  Travelers need to organize cruises by ship, dates, and itinerary. Ports/sea days must be logged since cruise passengers structure memories around each day’s location.

- **Daily Log / Journal**  
  The heart of the app: lets users record thoughts, highlights, and upload photos/videos. This mimics the popular physical cruise journals but in digital form.

- **Excursion Tracking**  
  Cruisers book excursions in advance. Tracking them digitally (planned vs. completed) prevents forgetting details and helps memory-keeping.

- **Offline Support**  
  Internet at sea is expensive or unavailable. Journaling must work offline and sync later.

- **Export (PDF)**  
  Users want a tangible keepsake after the trip. A simple PDF export is the minimum step toward physical memory preservation.

Implementation notes:
- Data shapes
  - Trip{id, title, ship, startDate, endDate, ports: Array<{id, name, date?, isSeaDay?}>}
  - Note{id, tripId, date, title?, notes?, photos: Array<{uri, width?, height?, caption?}>}
- Edge cases
  - Timezones: store dates as YYYY-MM-DD and treat as local for display.
  - Offline first: write-through to local store; queue sync for later phases.
  - Media: compress/resample on import; guard against 100+ photos per trip.
  - Permissions denied: allow manual entry without media/location.
- UI contracts
  - Date pickers constrained to trip range.
  - Recent highlights show latest 3 notes, navigable to detail.
  - Pill components for weather/location with accessible contrast in light/dark.

---

## 🛠️ Phase 2 Features – Purpose

- **Weather Integration**  
  Travelers often log weather in physical journals. Auto-logging removes manual effort and adds realism to memory preservation.

- **Checklists**  
  Packing lists, bucket lists, and port trackers are practical tools for travelers. They also reinforce the “cruise-specific” identity.

- **Visuals (Maps & Stamps)**  
  Cruise travelers love maps of their routes and collectible-style stamps. This gamifies memory-keeping and adds uniqueness.

- **Basic Collaboration**  
  Families or groups often travel together. Allowing multiple contributors makes the journal more engaging and inclusive.

Implementation notes:
- Weather: Open-Meteo current conditions + temp; reverse geocode for short labels.
- Maps: react-native-maps optional; cluster pins; cache tiles when feasible.
- Checklists: generic list model {id, title, items[{id, text, done}]}, reusable across packing/bucket/ports.
- Collaboration (later): start with invite-by-link; roles: owner, editor, viewer; conflict policy LWW with per-field stamps.

---

## 🌍 Phase 3 Features – Purpose

- **Advanced Export Options**  
  Beautifully formatted PDFs and print-on-demand books differentiate the app from general journaling apps. A natural upsell.

- **Gamification (Badges)**  
  Adds fun for repeat cruisers. Encourages continued use between trips.

- **Sharing**  
  Some want to privately share journals with friends/family. Optional public feeds create a lightweight social element without competing with Instagram.

- **Customization**  
  Prompts, stickers, and themes let users personalize the app. This matches the scrapbook-like appeal of physical cruise journals.

Implementation notes:
- Advanced export: template-driven (HTML/CSS to PDF) with presets; defer image grids/per-day galleries to v2.
- Badges: compute from derived stats (#trips, #ports, #excursions); cache and recalc on changes.
- Sharing: signed, read-only links; respect media privacy and expiring URLs.
- Customization: prompt packs, theme tokens; avoid heavy runtime theming cost.

---

## 💰 Monetization Strategy – Purpose

- **Free Tier** ensures adoption by providing the essential journaling experience.
- **Pro Tier** monetizes the features cruise travelers value most: exporting, printing, collaboration, and weather tracking.

---

✅ Use this file as design intent context when generating or suggesting code. It explains **why** features exist, not just *what* to build.

---

## 🧩 Developer Guardrails
- No extra NavigationContainer (Expo Router wraps it).
- Use StyleSheet.create; avoid inline-only styles for shared components.
- Centralize colors in `components/constants/` and prefer tokens from ThemeContext.
- Keep media manipulations in a single utility to control size/quality.
- Write minimal unit tests for utilities (date formatting, duration, export transforms).

## 🧪 Mini Test Matrix (MVP)
- Create trip with only sea days.
- Add note with no title but with photos.
- Add note outside trip range → coerced to nearest valid date.
- Export a 10-day trip with 1–3 photos per day.
- Deny photo permission and still add text notes.

