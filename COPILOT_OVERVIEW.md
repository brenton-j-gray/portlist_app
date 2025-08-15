# COPILOT\_OVERVIEW\.md

## App Summary

Travel Journal Pro is a universal, offline‑first travel journal built with React Native, Expo Router, and TypeScript. It supports multiple trip categories. Each category maps to a template that controls which fields appear in trip creation and daily entries. The goal is fast note capture, structured data, and simple export.  The app will be available to Apple, Android, and PC users.

## MVP Scope

* Create Trip: choose category, render fields from a template
* Log Day: dynamic entry form from the same template
* Export: JSON and human‑readable text, PDF later
* Offline first: all core features must work without network

## Target Users

Travelers who want a single app for road trips, cruises, city breaks, camping, international travel, business travel, theme parks, or custom trips.

## Non Goals for MVP

* Accounts or cloud sync
* Heavy maps or itinerary scraping

## Technical Notes

* Stack: React Native, Expo Router, TypeScript
* Storage: SQLite for structured data, FileSystem for photos, AsyncStorage for small prefs
* Validation: zod schemas generated from template fields
* Deterministic export. Store `templateVersion` on trips

---

## Data Model (SQLite)

```
trips(
  id, title, category, startDate, endDate, notes, coverPhotoUri,
  createdAt, updatedAt, templateVersion
)
entries(
  id, tripId, date, payloadJson, createdAt, updatedAt
)
media(
  id, entryId, uri, type, caption, createdAt
)
templates(
  id, category, version, tripFieldsJson, entryFieldsJson
)
```

## Category Templates

Templates define both trip fields and entry fields. The UI renders forms from these definitions.

Examples:

* **cruise**

  * tripFields: `cruiseLine, shipName, cabin, portsOfCall[]`
  * entryFields: `port, excursion, onboardActivities[], seaState, weather, notes`
* **roadTrip**

  * tripFields: `vehicle, routePlan[], lodgingType`
  * entryFields: `segmentStart, segmentEnd, milesDriven, fuelCost, stops[], weather, notes`
* **cityBreak**

  * tripFields: `city, country, lodging`
  * entryFields: `neighborhoods[], attractions[], meals[], transitType, spend, notes`
* **business**

  * tripFields: `company, purpose, perDiem, client`
  * entryFields: `meetings[], contacts[], receipts[], spend, notes`
* **camping, international, themePark, custom** also supported

## UI Patterns

* **New Trip**: pick category, render dynamic form from template
* **Trip Detail**: list or calendar of entries
* **New Entry**: dynamic form from template, camera or gallery picker, quick notes
* **Settings**: export or import, storage info, AI privacy toggles once AI is added

## Validation

* Derive zod schemas directly from template fields
* Enforce required fields and date ranges
* Do not bypass validation in any flow

---

## Tasks for Copilot (Core)

1. Create a CategoryTemplate registry with TypeScript types and example templates
2. Build a dynamic form renderer that takes a template and returns React Hook Form inputs with zod validation
3. Implement SQLite tables and CRUD helpers for trips, entries, media, templates
4. Create screens

   * `app/(tabs)/index.tsx` Home: list trips, New Trip button
   * `app/trips/new.tsx` Category picker and dynamic trip form
   * `app/trips/[id].tsx` Trip detail with entries and New Entry
   * `app/trips/[id]/entries/new.tsx` Dynamic entry form
   * `app/settings/index.tsx` Export trip to JSON or text
5. Add an export utility that joins trips, entries, and media, writes to FileSystem, then shares

---

## Minimal Types to Steer Copilot

```ts
// lib/templates.ts
export type FieldType =
  | "text" | "textarea" | "number" | "date" | "select" | "multiselect" | "boolean";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];      // for select or multiselect
  placeholder?: string;
}

export interface CategoryTemplate {
  category:
    | "cruise" | "roadTrip" | "cityBreak" | "camping"
    | "international" | "business" | "themePark" | "custom";
  version: number;
  tripFields: FieldDef[];
  entryFields: FieldDef[];
}

export const TEMPLATES: Record<CategoryTemplate["category"], CategoryTemplate> = {
  cruise: {
    category: "cruise",
    version: 1,
    tripFields: [
      { key: "title", label: "Trip Title", type: "text", required: true },
      { key: "cruiseLine", label: "Cruise Line", type: "text" },
      { key: "shipName", label: "Ship Name", type: "text" },
      { key: "portsOfCall", label: "Ports of Call", type: "multiselect", options: [] },
    ],
    entryFields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "port", label: "Port", type: "text" },
      { key: "excursion", label: "Excursion", type: "text" },
      { key: "activities", label: "Onboard Activities", type: "multiselect", options: [] },
      { key: "weather", label: "Weather", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  roadTrip: {
    category: "roadTrip",
    version: 1,
    tripFields: [
      { key: "title", label: "Trip Title", type: "text", required: true },
      { key: "vehicle", label: "Vehicle", type: "text" },
      { key: "lodgingType", label: "Lodging", type: "select", options: ["Hotel","Motel","Camp","Airbnb"] },
    ],
    entryFields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "segmentStart", label: "From", type: "text" },
      { key: "segmentEnd", label: "To", type: "text" },
      { key: "milesDriven", label: "Miles Driven", type: "number" },
      { key: "fuelCost", label: "Fuel Cost", type: "number" },
      { key: "stops", label: "Stops", type: "multiselect", options: [] },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  cityBreak: {
    category: "cityBreak",
    version: 1,
    tripFields: [
      { key: "title", label: "Trip Title", type: "text", required: true },
      { key: "city", label: "City", type: "text" },
      { key: "country", label: "Country", type: "text" },
      { key: "lodging", label: "Lodging", type: "text" },
    ],
    entryFields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "neighborhoods", label: "Neighborhoods", type: "multiselect", options: [] },
      { key: "attractions", label: "Attractions", type: "multiselect", options: [] },
      { key: "meals", label: "Meals", type: "multiselect", options: [] },
      { key: "transitType", label: "Transit", type: "select", options: ["Walk","Metro","Bus","Taxi","Rideshare"] },
      { key: "spend", label: "Spend", type: "number" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  camping: {
    category: "camping",
    version: 1,
    tripFields: [
      { key: "title", label: "Trip Title", type: "text", required: true }
    ],
    entryFields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "campsite", label: "Campsite", type: "text" },
      { key: "hikes", label: "Hikes", type: "multiselect", options: [] },
      { key: "wildlife", label: "Wildlife", type: "multiselect", options: [] },
      { key: "weather", label: "Weather", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  international: {
    category: "international",
    version: 1,
    tripFields: [
      { key: "title", label: "Trip Title", type: "text", required: true },
      { key: "countries", label: "Countries", type: "multiselect", options: [] },
      { key: "visaNotes", label: "Visa Notes", type: "textarea" }
    ],
    entryFields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "city", label: "City", type: "text" },
      { key: "languageNotes", label: "Language Notes", type: "textarea" },
      { key: "currencySpend", label: "Spend", type: "number" },
      { key: "notes", label: "Notes", type: "textarea" }
    ],
  },
  business: {
    category: "business",
    version: 1,
    tripFields: [
      { key: "title", label: "Trip Title", type: "text", required: true },
      { key: "company", label: "Company", type: "text" },
      { key: "purpose", label: "Purpose", type: "text" },
      { key: "perDiem", label: "number", type: "number" }
    ],
    entryFields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "meetings", label: "Meetings", type: "multiselect", options: [] },
      { key: "contacts", label: "Contacts", type: "multiselect", options: [] },
      { key: "receipts", label: "Receipts", type: "multiselect", options: [] },
      { key: "notes", label: "Notes", type: "textarea" }
    ],
  },
  themePark: {
    category: "themePark",
    version: 1,
    tripFields: [
      { key: "title", label: "Trip Title", type: "text", required: true },
      { key: "park", label: "Park", type: "text" }
    ],
    entryFields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "rides", label: "Rides", type: "multiselect", options: [] },
      { key: "shows", label: "Shows", type: "multiselect", options: [] },
      { key: "queueTime", label: "Avg Queue (min)", type: "number" },
      { key: "notes", label: "Notes", type: "textarea" }
    ],
  },
  custom: {
    category: "custom",
    version: 1,
    tripFields: [
      { key: "title", label: "Trip Title", type: "text", required: true }
    ],
    entryFields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "notes", label: "Notes", type: "textarea" }
    ],
  },
};
```

---

## AI Roadmap

Goals: speed up journaling through voice to structured logs, provide smart suggestions, and offer port or city recommendations that adapt to preferences.

### Phase 1

1. AI Entry Assistant

* Input: free text or voice transcript
* Output: JSON that fills the entry template, validated with zod
* UX: AI Fill button on New Entry, preview and accept or merge or edit

2. Smart Autocomplete

* Suggest chips for weather, activities, neighborhoods, mileage
* Learn from prior entries on device

3. Privacy Guardrails

* Settings toggle: Use cloud AI for assistance
* If off, only local transforms with no network calls

### Phase 2

4. City or Port Guide

* Recommend 6 to 10 items like attractions, excursions, local food
* Personalize from feedback and trip category
* Works offline with cached guides, enhances online with fresh data

5. Budget and Time Planner

* Convert planned items into time blocks with travel estimates and conflict flags

### Architecture

* Adapter pattern: `AIProvider = { summarizeEntry, recommend, classify }`
* Providers: Local rules and keyword extraction, Cloud LLM behind a single `callLLM(prompt, schema)`
* Optional RAG cache: `guides` table with short descriptions, SQLite FTS5 or a vector store

### AI Data Model Additions (SQLite)

```
ai_prefs(
  id, useCloud boolean, recsStyle TEXT, likedTags JSON, dislikedTags JSON
)
guides(
  id, city, country, tags JSON, summary, hours, priceTier, lat, lon, lastUpdated
)
rec_feedback(
  id, guideId, decision, tripId, entryId, createdAt
)
```

---

## AI Types and Prompts

```ts
// lib/ai/types.ts
export interface AISummarizeParams {
  rawText: string;                 // or speech to text result
  template: FieldDef[];            // from active CategoryTemplate.entryFields
  tripContext: { category: string; city?: string; country?: string; date: string; };
}
export interface AISummarizeResult {
  fields: Record<string, unknown>; // must match template keys
  notes?: string;
  warnings?: string[];
}

export interface RecommendParams {
  location: { city?: string; country?: string; lat?: number; lon?: number };
  tripCategory: string;
  prefs: { likedTags?: string[]; dislikedTags?: string[]; style?: "budget"|"family"|"adventure"|"relaxed" };
  offlineOnly?: boolean;
}
export interface Recommendation {
  id: string;
  title: string;
  tags: string[];
  summary: string;
  estTimeMins?: number;
  priceTier?: "$" | "$$" | "$$$";
  lat?: number; lon?: number;
  source: "local" | "cloud";
}

export interface AIProvider {
  summarizeEntry(p: AISummarizeParams): Promise<AISummarizeResult>;
  recommend(p: RecommendParams): Promise<Recommendation[]>;
}
```

```ts
// lib/ai/prompts.ts
export const SYSTEM_SUMMARIZE = `
You convert informal travel notes into a strict JSON object for a mobile journaling app.
Return only JSON matching the provided JSON Schema. Do not add fields.
Dates must be ISO (YYYY-MM-DD). Numbers only for numeric fields.
`;

export const USER_SUMMARIZE = (raw: string, schema: string, examples?: string) => `
Notes:
${raw}

JSON Schema (for this entry):
${schema}

${examples ? `Examples:\n${examples}` : ""}

Return only the JSON object. No commentary.
`;

export const SYSTEM_RECOMMEND = `
You are a travel recommender that outputs a ranked JSON array of attractions or activities.
Tailor suggestions to the user's style and avoid items they dislike.
Prefer items reachable within the day. Keep summaries under 160 characters.
Return only JSON matching the provided schema.
`;
```

---

## Zod Schema Builder

```ts
// lib/ai/zodFromTemplate.ts
import { z } from "zod";
import { FieldDef } from "../templates";

export const zodFromTemplate = (fields: FieldDef[]) => {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    let base: z.ZodTypeAny =
      f.type === "text" || f.type === "textarea" ? z.string().trim() :
      f.type === "number" ? z.number() :
      f.type === "date" ? z.string().regex(/^\d{4}-\d{2}-\d{2}$/) :
      f.type === "select" ? z.string() :
      f.type === "multiselect" ? z.array(z.string()) :
      f.type === "boolean" ? z.boolean() : z.any();

    shape[f.key] = f.required ? base : base.optional();
  }
  return z.object(shape);
};
```

---

## Provider Shims

```ts
// lib/ai/index.ts
import type { AIProvider } from "./types";
import { localProvider } from "./localProvider";
import { cloudProvider } from "./cloudProvider";
import { getAIPrefs } from "../storage/prefs";

let provider: AIProvider | null = null;

export const getProvider = async (): Promise<AIProvider> => {
  if (provider) return provider;
  const prefs = await getAIPrefs();
  provider = prefs.useCloud ? cloudProvider : localProvider;
  return provider;
};
```

```ts
// lib/ai/localProvider.ts
import type { AIProvider, AISummarizeParams, AISummarizeResult, RecommendParams, Recommendation } from "./types";

export const localProvider: AIProvider = {
  async summarizeEntry(p: AISummarizeParams): Promise<AISummarizeResult> {
    const lower = p.rawText.toLowerCase();
    const fields: Record<string, unknown> = {};
    if (p.template.find(f => f.key === "milesDriven")) {
      const m = lower.match(/(\d+)\s*miles?/);
      if (m) fields["milesDriven"] = Number(m[1]);
    }
    fields["notes"] = p.rawText.trim();
    return { fields, warnings: [] };
  },

  async recommend(p: RecommendParams): Promise<Recommendation[]> {
    // offline: rank cached guides by tag overlap. Copilot can implement FTS or vectors.
    return [];
  }
};
```

```ts
// lib/ai/cloudProvider.ts
import { z } from "zod";
import type { AIProvider, AISummarizeParams, AISummarizeResult, RecommendParams, Recommendation } from "./types";
import { zodFromTemplate } from "./zodFromTemplate";

export const cloudProvider: AIProvider = {
  async summarizeEntry(p: AISummarizeParams): Promise<AISummarizeResult> {
    const schema = zodFromTemplate(p.template);
    // 1) build prompt with SYSTEM_SUMMARIZE + USER_SUMMARIZE
    // 2) call LLM endpoint
    // 3) JSON.parse, then schema.parse to validate
    // 4) return fields with warnings on parse errors
    return { fields: {}, warnings: [] };
  },

  async recommend(p: RecommendParams): Promise<Recommendation[]> {
    // Similar flow with SYSTEM_RECOMMEND and city context
    return [];
  }
};
```

---

## Tasks for Copilot (AI Features)

1. Create `lib/ai/` files: `types.ts`, `prompts.ts`, `zodFromTemplate.ts`, `index.ts`, `localProvider.ts`, `cloudProvider.ts`
2. Build Settings toggle for Use cloud AI and a prefs store (SQLite or AsyncStorage)
3. In `app/trips/[id]/entries/new.tsx` add an AI Fill button that

   * pulls textarea content
   * calls `getProvider().summarizeEntry({ rawText, template })`
   * validates with zod
   * shows a diff panel with per field accept switches
   * merges accepted fields into the form
4. Create a `guides` table and a small seed set (Skagway, Tokyo, Orlando)

   * add a simple search that returns top 10 by tag overlap
   * wire a recommendations panel that calls `provider.recommend()` and records feedback
5. Implement caching and idempotence

   * hash of rawText plus templateVersion to cache summarize results
   * do not re call provider if hash is unchanged

---

## Privacy and Consent

* Settings screen explains what data is sent to the cloud when enabled
* First time users tap AI Fill, show a clear on or off choice
* Export includes `ai_prefs` and `rec_feedback` so users can audit their data

---

## Micro Prompts for Copilot

* Generate a zod schema builder that converts `FieldDef[]` into a zod object with default values
* Create a `<DynamicForm />` that maps `FieldDef` to React Hook Form inputs, include select and multiselect
* Write SQLite creation and CRUD for trips, entries, media, templates
* Implement `exportTrip(tripId)` that stitches trips plus entries plus media into JSON, writes to FileSystem, then shares
* Add recommendations panel and feedback logging

---

## Working Tips

* Keep this overview comment near `app/_layout.tsx` or `app/index.tsx` so Copilot always sees it
* Create `lib/templates.ts` first, then open it while prompting Copilot, so it infers the shapes and generates proper forms and SQL
* Nudge with small, specific asks. Keep prompts short and concrete
