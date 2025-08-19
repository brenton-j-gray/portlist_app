// Helpers for formatting short location labels like "City, ST, CC"

const US_STATE_MAP: Record<string, string> = {
  'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA', 'COLORADO': 'CO',
  'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
  'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA',
  'MAINE': 'ME', 'MARYLAND': 'MD', 'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
  'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
  'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD',
  'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA',
  'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC', 'WASHINGTON, D.C.': 'DC',
  'PUERTO RICO': 'PR', 'AMERICAN SAMOA': 'AS', 'GUAM': 'GU', 'NORTHERN MARIANA ISLANDS': 'MP', 'U.S. VIRGIN ISLANDS': 'VI'
};

const CA_PROVINCE_MAP: Record<string, string> = {
  'ALBERTA': 'AB', 'BRITISH COLUMBIA': 'BC', 'MANITOBA': 'MB', 'NEW BRUNSWICK': 'NB', 'NEWFOUNDLAND AND LABRADOR': 'NL',
  'NORTHWEST TERRITORIES': 'NT', 'NOVA SCOTIA': 'NS', 'NUNAVUT': 'NU', 'ONTARIO': 'ON', 'PRINCE EDWARD ISLAND': 'PE',
  'QUEBEC': 'QC', 'SASKATCHEWAN': 'SK', 'YUKON': 'YT'
};

function normalize(s?: string) { return (s || '').trim(); }

export function regionCodeFor(region?: string, iso?: string): string | undefined {
  const r = normalize(region);
  const cc = normalize(iso).toUpperCase();
  if (!r) return undefined;
  // Already a short code?
  if (/^[A-Za-z]{2,3}$/.test(r)) return r.toUpperCase();
  const upper = r.toUpperCase();
  if (cc === 'US' && US_STATE_MAP[upper]) return US_STATE_MAP[upper];
  if (cc === 'CA' && CA_PROVINCE_MAP[upper]) return CA_PROVINCE_MAP[upper];
  // Heuristic: take first letters of first two words or first 2 chars
  const words = upper.split(/[\s-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return upper.slice(0, 2);
}

export function shortLocationLabel(fields: {
  city?: string | null;
  subregion?: string | null;
  district?: string | null;
  name?: string | null;
  region?: string | null;
  country?: string | null;
  isoCountryCode?: string | null;
}, lat?: number, lng?: number): string {
  const city = normalize((fields.city ?? fields.subregion ?? fields.district ?? fields.name) || undefined);
  const cc = normalize((fields.isoCountryCode ?? undefined)).toUpperCase();
  const st = regionCodeFor(fields.region || undefined, fields.isoCountryCode || undefined);
  if (city && st && cc) return `${city}, ${st}, ${cc}`;
  if (city && cc) return `${city}, ${cc}`;
  if (fields.region && cc) return `${normalize(fields.region)}, ${cc}`;
  if (fields.country) return normalize(fields.country);
  if (typeof lat === 'number' && typeof lng === 'number') return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  return '';
}
