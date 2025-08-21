#!/usr/bin/env node
/**
 * Fetch curated cruise ports/terminals from Wikidata + Overpass and write assets/data/ports.curated.json
 * - Wikidata: instances of cruise terminals or ports with cruise hints
 * - Overpass: features tagged as cruise terminals/ports (pier/harbor with cruise keywords)
 *
 * Output schema per entry:
 * { name, country, regionCode, lat, lng, aliases[], kind, isCruise }
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), 'assets', 'data', 'ports.curated.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'cruise-journal-pro/curator (+https://example.com)'.slice(0, 200),
      'Accept': 'application/json'
    },
    ...opts
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function toRegionCode(countryCode, adminName) {
  if (!countryCode || !adminName) return undefined;
  const cc = String(countryCode).toUpperCase();
  const name = String(adminName).toLowerCase();
  if (cc === 'US') {
    const us = { 'alaska': 'AK','washington': 'WA','florida': 'FL','california': 'CA','new york': 'NY','texas': 'TX','massachusetts': 'MA','louisiana': 'LA','alabama':'AL','maryland':'MD' };
    return us[name];
  }
  if (cc === 'CA') {
    const ca = { 'british columbia': 'BC','alberta': 'AB','ontario': 'ON','quebec': 'QC','nova scotia': 'NS','new brunswick':'NB','newfoundland and labrador':'NL' };
    return ca[name];
  }
  return undefined;
}

function cleanName(s) {
  return s?.replace(/\s+/g, ' ').trim();
}

function isCruisey(str) {
  return /\b(cruise|terminal|pier|port|harbour|harbor|seaport)\b/i.test(str || '');
}

async function queryWikidata() {
  // Ports and cruise terminals with coordinates. Cruise terminals: Q2746656; also ports (Q44782) with cruise hints
  const sparql = `
SELECT ?item ?itemLabel ?countryCode ?adminLabel ?lat ?lng ?alias WHERE {
  VALUES ?classes { wd:Q2746656 wd:Q44782 }
  ?item wdt:P31/wdt:P279* ?classes.
  ?item wdt:P625 ?coord.
  BIND(geof:latitude(?coord) AS ?lat)
  BIND(geof:longitude(?coord) AS ?lng)
  OPTIONAL { ?item wdt:P297 ?countryCode }
  OPTIONAL { ?item wdt:P300 ?adminLabel }
  OPTIONAL { ?item skos:altLabel ?alias FILTER (LANG(?alias) = 'en') }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  const json = await fetchJson(url);
  const rows = json?.results?.bindings || [];
  const byId = new Map();
  for (const r of rows) {
    const name = cleanName(r?.itemLabel?.value);
    const lat = parseFloat(r?.lat?.value);
    const lng = parseFloat(r?.lng?.value);
    const cc = r?.countryCode?.value || undefined;
    const admin = r?.adminLabel?.value || undefined;
    const regionCode = toRegionCode(cc, admin);
    if (!name || !isFinite(lat) || !isFinite(lng)) continue;
    const id = r?.item?.value;
    const kind = /Q2746656/.test(String(r?.classes || '')) ? 'cruise-terminal' : 'port';
    const entry = byId.get(id) || { name, country: cc, regionCode, lat, lng, aliases: [], kind, isCruise: kind === 'cruise-terminal' || isCruisey(name) };
    const alias = cleanName(r?.alias?.value);
    if (alias && !entry.aliases.includes(alias)) entry.aliases.push(alias);
    byId.set(id, entry);
  }
  return Array.from(byId.values());
}

async function queryOverpass() {
  // Cruise-related features near water: ferry terminals, piers, harbor/port with cruise hints
  const q = `
[out:json][timeout:60];
(
  node["amenity"="ferry_terminal"]; way["amenity"="ferry_terminal"]; rel["amenity"="ferry_terminal"]; 
  node["man_made"="pier"]; way["man_made"="pier"]; rel["man_made"="pier"]; 
  node["harbour"]; way["harbour"]; rel["harbour"]; 
  node["seaport"]; way["seaport"]; rel["seaport"]; 
);
out body; >; out skel qt;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`;
  const json = await fetchJson(url);
  const els = json?.elements || [];
  const out = [];
  for (const e of els) {
    const tags = e.tags || {};
    const name = cleanName(tags.name);
    if (!name || !isCruisey(name)) continue; // cruise-ish only
    let lat, lng;
    if (e.type === 'node') { lat = e.lat; lng = e.lon; }
    if (!isFinite(lat) || !isFinite(lng)) continue;
    const cc = (tags['addr:country'] || tags['ISO3166-1:alpha2'] || '').toUpperCase() || undefined;
    const admin = tags['addr:state'] || tags['addr:province'] || undefined;
    const regionCode = toRegionCode(cc, admin);
    const kind = tags.amenity === 'ferry_terminal' ? 'ferry-terminal' : (tags.man_made === 'pier' ? 'pier' : (tags.harbour ? 'harbor' : (tags.seaport ? 'port' : 'other')));
    out.push({ name, country: cc, regionCode, lat, lng, aliases: [], kind, isCruise: true });
  }
  return out;
}

function dedupeMerge(list) {
  const seen = new Map();
  for (const e of list) {
    const key = `${e.name.toLowerCase()}|${e.country||''}|${e.regionCode||''}`;
    const existing = seen.get(key);
    if (!existing) { seen.set(key, e); continue; }
    // Prefer entries flagged isCruise, then with regionCode, then with aliases length
    const score = (x) => (x.isCruise?2:0) + (x.regionCode?1:0) + (Array.isArray(x.aliases)?Math.min(1,x.aliases.length):0);
    if (score(e) > score(existing)) seen.set(key, e);
  }
  return Array.from(seen.values());
}

async function main() {
  console.log('Fetching Wikidata…');
  const wikidata = await queryWikidata().catch(err => { console.warn('Wikidata failed', err.message); return []; });
  await sleep(500);
  console.log('Fetching Overpass…');
  const overpass = await queryOverpass().catch(err => { console.warn('Overpass failed', err.message); return []; });
  const merged = dedupeMerge([...wikidata, ...overpass]);
  // Ensure only cruise-ish
  const filtered = merged.filter(e => e.isCruise || isCruisey(e.name));
  // Sort by country, then name
  filtered.sort((a,b) => (String(a.country).localeCompare(String(b.country))) || a.name.localeCompare(b.name));
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(filtered, null, 2));
  console.log(`Wrote ${filtered.length} ports to ${OUT}`);
}

main().catch(err => { console.error(err); process.exit(1); });
