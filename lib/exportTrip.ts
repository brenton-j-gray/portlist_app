import { Platform } from 'react-native';
import { Trip } from '../types';
// Lightweight DOCX creation without external deps: we construct a minimal Office Open XML package.
// This avoids adding heavy libraries (docx, Packer, etc.) and keeps bundle small. Limitations: plain text only.

/**
 * Export a Trip as a JSON file.
 * Native (iOS/Android): writes to cache then opens share sheet.
 */
export async function exportTripJSON(trip: Trip) {
  const fileName = `trip_${trip.id}.json`;
  try {
    // Web fallback: trigger a download directly (no expo-file-system)
    if (Platform.OS === 'web') {
      const blob = new Blob([JSON.stringify(trip, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    const FileSystem: any = await import('expo-file-system');
    const Sharing: any = await import('expo-sharing');
    const fileUri = FileSystem.cacheDirectory + fileName;
    await FileSystem.writeAsStringAsync(
      fileUri,
      JSON.stringify(trip, null, 2),
      { encoding: FileSystem.EncodingType.UTF8 }
    );

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Export Trip Data' });
    } else {
      console.log('File saved at', fileUri);
    }
  } catch (e) {
    console.warn('Export failed', e);
  }
}

/**
 * Export all trips as a single JSON file.
 */
export async function exportAllTripsJSON(getTripsFn?: () => Promise<Trip[]>) {
  const fileName = `trips_bundle_${Date.now()}.json`;
  try {
    let trips: Trip[] = [];
    if (getTripsFn) {
      trips = await getTripsFn();
    } else {
      const mod = await import('./storage');
      trips = await (mod as any).getTrips();
    }
    const bundle = {
      exportedAt: new Date().toISOString(),
      count: trips.length,
      trips,
    };

    if (Platform.OS === 'web') {
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    const FileSystem: any = await import('expo-file-system');
    const Sharing: any = await import('expo-sharing');
    const fileUri = FileSystem.cacheDirectory + fileName;
    await FileSystem.writeAsStringAsync(
      fileUri,
      JSON.stringify(bundle, null, 2),
      { encoding: FileSystem.EncodingType.UTF8 }
    );
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Export All Trips' });
    } else {
      console.log('File saved at', fileUri);
    }
  } catch (e) {
    console.warn('Export all trips failed', e);
  }
}

// ================= PDF Export (default path) =================
function escapeHtml(str: string) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function tripHtml(trip: Trip) {
  const days = trip.days || [] as any[];
  const ports = trip.ports || [];
  const rows = days.map(d => {
    const portOrLoc = d.isSeaDay ? 'Sea Day' : (d.locationName || '');
    const body = d.description || d.notes || '';
    return `<tr><td>${escapeHtml(d.date || '')}</td><td>${escapeHtml(portOrLoc)}</td><td>${escapeHtml(body.slice(0,400))}</td></tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; padding:16px; }
    h1 { font-size:24px; margin:0 0 4px; }
    h2 { font-size:18px; margin:24px 0 8px; }
    table { width:100%; border-collapse: collapse; }
    th, td { border:1px solid #ccc; padding:6px 8px; font-size:12px; vertical-align:top; }
    th { background:#f2f2f2; }
    .meta { font-size:13px; color:#444; margin-bottom:12px; }
    .pill { display:inline-block; background:#eef; padding:2px 8px; border-radius:12px; font-size:11px; margin:2px 4px 0 0; }
  </style></head><body>
  <h1>${escapeHtml(trip.title || 'Untitled Trip')}</h1>
  <div class="meta">Ship: ${escapeHtml(trip.ship || 'TBD')}<br/>
    Start: ${escapeHtml(trip.startDate || '—')} &nbsp; End: ${escapeHtml(trip.endDate || '—')}<br/>
    Ports: ${ports.map(p=>`<span class='pill'>${escapeHtml(p||'')}</span>`).join('')}
  </div>
  <h2>Days / Notes</h2>
  <table><thead><tr><th style="width:90px">Date</th><th style="width:120px">Port</th><th>Note</th></tr></thead><tbody>${rows || ''}</tbody></table>
  <p style="margin-top:32px;font-size:11px;color:#777">Exported ${new Date().toLocaleString()}</p>
  </body></html>`;
}

function allTripsHtml(trips: Trip[]) {
  return `<!DOCTYPE html><html><head><meta charset='utf-8'><style>
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; padding:18px; }
  h1 { margin:0 0 16px; }
  h2 { margin:32px 0 8px; font-size:18px; border-bottom:1px solid #ccc; padding-bottom:4px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  th,td { border:1px solid #ccc; padding:4px 6px; font-size:11px; vertical-align:top; }
  th { background:#f5f5f5; }
  .pill { display:inline-block; background:#eef; padding:2px 8px; border-radius:12px; font-size:10px; margin:2px 4px 2px 0; }
  </style></head><body>
  <h1>Trips Export (${trips.length})</h1>
  ${trips.map(t => `
    <h2>${escapeHtml(t.title || 'Untitled Trip')}</h2>
    <div style='font-size:12px;margin-bottom:4px;'>Ship: ${escapeHtml(t.ship||'TBD')} — ${escapeHtml(t.startDate||'—')} to ${escapeHtml(t.endDate||'—')}</div>
    <div>${(t.ports||[]).map(p=>`<span class='pill'>${escapeHtml(p||'')}</span>`).join('')}</div>
    <table><thead><tr><th style='width:80px'>Date</th><th style='width:110px'>Port</th><th>Note</th></tr></thead><tbody>
      ${(t.days||[]).map((d:any) => `<tr><td>${escapeHtml(d.date||'')}</td><td>${d.isSeaDay?'Sea Day':escapeHtml(d.port||'')}</td><td>${escapeHtml((d.note||'').slice(0,400))}</td></tr>`).join('')}
    </tbody></table>
  `).join('')}
  <p style='margin-top:40px;font-size:11px;color:#666'>Exported ${new Date().toLocaleString()}</p>
  </body></html>`;
}

export async function exportTripPDF(trip: Trip) {
  try {
    if (Platform.OS === 'web') {
  let Print: any; try { Print = (await import('expo-print')); } catch { Print = null; }
      if (Print?.printToFileAsync) {
        const html = tripHtml(trip);
        const { uri } = await Print.printToFileAsync({ html });
        const Sharing: any = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export Trip PDF' });
          return;
        }
        const resp = await fetch(uri); const blob = await resp.blob(); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`trip_${trip.id}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); return;
      }
      await exportTripJSON(trip); return;
    }
  let Print: any; try { Print = (await import('expo-print')); } catch { Print = null; }
  if (!Print?.printToFileAsync) { await exportTripJSON(trip); return; }
    const Sharing: any = await import('expo-sharing');
    const html = tripHtml(trip);
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export Trip PDF' });
    } else {
      console.log('PDF created at', uri);
    }
  } catch (e) {
    console.warn('PDF export failed, falling back to JSON', e);
    await exportTripJSON(trip);
  }
}

export async function exportAllTripsPDF(getTripsFn?: () => Promise<Trip[]>) {
  try {
    let trips: Trip[] = [];
    if (getTripsFn) trips = await getTripsFn(); else { const mod = await import('./storage'); trips = await (mod as any).getTrips(); }
    if (Platform.OS === 'web') {
  let Print: any; try { Print = (await import('expo-print')); } catch { Print = null; }
      if (Print?.printToFileAsync) {
        const html = allTripsHtml(trips);
        const { uri } = await Print.printToFileAsync({ html });
        const Sharing: any = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export Trips PDF' }); return; }
        const resp = await fetch(uri); const blob = await resp.blob(); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='trips_export.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); return;
      }
      await exportAllTripsJSON(getTripsFn); return;
    }
  let Print: any; try { Print = (await import('expo-print')); } catch { Print = null; }
  if (!Print?.printToFileAsync) { await exportAllTripsJSON(getTripsFn); return; }
    const Sharing: any = await import('expo-sharing');
    const html = allTripsHtml(trips);
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export Trips PDF' }); }
    else { console.log('PDF created at', uri); }
  } catch (e) {
    console.warn('All trips PDF export failed, fallback to JSON', e);
    await exportAllTripsJSON(getTripsFn);
  }
}

// ================= TXT Export =================
function tripPlainText(trip: Trip): string {
  const lines: string[] = [];
  lines.push(`# ${trip.title || 'Untitled Trip'}`);
  lines.push(`Ship: ${trip.ship || 'TBD'}`);
  lines.push(`Start: ${trip.startDate || '—'}  End: ${trip.endDate || '—'}`);
  if (trip.ports && trip.ports.length) lines.push(`Ports: ${trip.ports.join(', ')}`);
  lines.push('');
  lines.push('Days / Notes:');
  for (const d of trip.days || []) {
    const date = d.date || '';
    const loc = d.isSeaDay ? 'Sea Day' : (d.locationName || d.title || d.notes || d.description || '');
    const body = d.description || d.notes || '';
    lines.push(`- ${date} | ${loc}`);
    if (body) lines.push(`  ${body.replace(/\s+/g,' ').trim()}`);
  }
  lines.push(`\nExported ${new Date().toLocaleString()}`);
  return lines.join('\n');
}

function allTripsPlainText(trips: Trip[]): string {
  const lines: string[] = [];
  lines.push(`# Trips Export (${trips.length})`);
  for (const t of trips) {
    lines.push('');
    lines.push(`## ${t.title || 'Untitled Trip'}`);
    lines.push(`Ship: ${t.ship || 'TBD'}  Dates: ${t.startDate || '—'} -> ${t.endDate || '—'}`);
    if (t.ports?.length) lines.push(`Ports: ${t.ports.join(', ')}`);
    for (const d of t.days || []) {
      const date = d.date || '';
      const loc = d.isSeaDay ? 'Sea Day' : (d.locationName || d.title || d.notes || d.description || '');
      const body = d.description || d.notes || '';
      lines.push(`- ${date} | ${loc}`);
      if (body) lines.push(`  ${body.replace(/\s+/g,' ').trim()}`);
    }
  }
  lines.push(`\nExported ${new Date().toLocaleString()}`);
  return lines.join('\n');
}

export async function exportTripTXT(trip: Trip) {
  const content = tripPlainText(trip);
  const fileName = `trip_${trip.id}.txt`;
  try {
    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); return;
    }
    const FileSystem: any = await import('expo-file-system');
    const Sharing: any = await import('expo-sharing');
    const uri = FileSystem.cacheDirectory + fileName;
    await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Export Trip Text' });
    else console.log('TXT saved at', uri);
  } catch (e) { console.warn('TXT export failed', e); }
}

export async function exportAllTripsTXT(getTripsFn?: () => Promise<Trip[]>) {
  try {
    let trips: Trip[] = [];
    if (getTripsFn) trips = await getTripsFn(); else { const mod = await import('./storage'); trips = await (mod as any).getTrips(); }
    const content = allTripsPlainText(trips);
    const fileName = `trips_${Date.now()}.txt`;
    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); return;
    }
    const FileSystem: any = await import('expo-file-system');
    const Sharing: any = await import('expo-sharing');
    const uri = FileSystem.cacheDirectory + fileName;
    await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Export Trips Text' });
    else console.log('TXT saved at', uri);
  } catch (e) { console.warn('All trips TXT export failed', e); }
}

// ================= DOCX Export (basic) =================
// Creates a minimal DOCX (ZIP with [Content_Types].xml, _rels/.rels, word/document.xml)
// For simplicity we build a flat paragraph sequence. Styling is minimal.

function xmlEscape(s: string): string { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c] as string)); }

function tripDocxXml(trip: Trip): string {
  const paras: string[] = [];
  const push = (text: string) => { paras.push(`<w:p><w:r><w:t>${xmlEscape(text)}</w:t></w:r></w:p>`); };
  push(trip.title || 'Untitled Trip');
  push(`Ship: ${trip.ship || 'TBD'}`);
  push(`Dates: ${trip.startDate || '—'} -> ${trip.endDate || '—'}`);
  if (trip.ports?.length) push(`Ports: ${trip.ports.join(', ')}`);
  push('');
  push('Days / Notes:');
  for (const d of trip.days || []) {
    const date = d.date || '';
    const loc = d.isSeaDay ? 'Sea Day' : (d.locationName || d.title || d.notes || d.description || '');
    const body = (d.description || d.notes || '').replace(/\s+/g,' ').trim();
    push(`- ${date} | ${loc}`);
    if (body) push(`  ${body}`);
  }
  push(`Exported ${new Date().toLocaleString()}`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">\n<w:body>\n${paras.join('\n')}\n<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

function buildDocx(trip: Trip): { fileName: string; blobBuilder: () => Promise<Blob | Uint8Array>; } {
  const fileName = `trip_${trip.id}.docx`;
  // Minimal files
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n<Default Extension="xml" ContentType="application/xml"/>\n<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  const documentXml = tripDocxXml(trip);
  const files: { name: string; data: string }[] = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: documentXml },
  ];
  return {
    fileName,
    blobBuilder: async () => {
      // Build simple ZIP (store) manually: implement minimal ZIP writer.
      // Simplicity: we implement uncompressed entries (method 0). DOCX readers accept this.
      function crc32(buf: Uint8Array): number { const table = (()=>{ const t:number[]=[]; for (let i=0;i<256;i++){ let c=i; for (let k=0;k<8;k++) c = ((c & 1)? (0xEDB88320 ^ (c>>>1)) : (c>>>1)); t[i]=c>>>0;} return t; })(); let crc=-1; for (let i=0;i<buf.length;i++){ crc = (crc>>>8) ^ table[(crc ^ buf[i]) & 0xFF]; } return (~crc)>>>0; }
      const encoder = new TextEncoder();
      let offset = 0;
      const fileRecords: { header: Uint8Array; data: Uint8Array; descriptor: Uint8Array; name: string; crc:number; size:number; offset:number }[] = [];
      for (const f of files) {
        const data = encoder.encode(f.data);
        const crc = crc32(data);
        const size = data.length;
        const nameBytes = encoder.encode(f.name);
        const h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); // local file header signature
        h.setUint16(4, 20, true); // version needed
        h.setUint16(6, 0, true); // flags
        h.setUint16(8, 0, true); // compression method 0 (store)
        h.setUint16(10, 0, true); h.setUint16(12,0,true); // mod time/date (zero)
        h.setUint32(14, crc, true);
        h.setUint32(18, size, true); // compressed size
        h.setUint32(22, size, true); // uncompressed size
        h.setUint16(26, nameBytes.length, true);
        h.setUint16(28, 0, true); // extra len
        const header = new Uint8Array(h.buffer);
        fileRecords.push({ header, data, descriptor: new Uint8Array(0), name: f.name, crc, size, offset });
        offset += header.length + nameBytes.length + size; // store sequentially
      }
      // Central directory
      const centralParts: Uint8Array[] = [];
      let centralSize = 0;
      for (const fr of fileRecords) {
        const nameBytes = encoder.encode(fr.name);
        const dv = new DataView(new ArrayBuffer(46));
        dv.setUint32(0, 0x02014b50, true); // central header
        dv.setUint16(4, 20, true); // version made by
        dv.setUint16(6, 20, true); // version needed
        dv.setUint16(8, 0, true); // flags
        dv.setUint16(10, 0, true); // method
        dv.setUint16(12, 0, true); dv.setUint16(14,0,true); // time/date
        dv.setUint32(16, fr.crc, true);
        dv.setUint32(20, fr.size, true); dv.setUint32(24, fr.size, true);
        dv.setUint16(28, nameBytes.length, true);
        dv.setUint16(30, 0, true); dv.setUint16(32,0,true); dv.setUint16(34,0,true); dv.setUint16(36,0,true); dv.setUint16(38,0,true);
        dv.setUint32(42, fr.offset, true);
        const cent = new Uint8Array(dv.buffer);
        centralParts.push(cent, nameBytes);
        centralSize += cent.length + nameBytes.length;
      }
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); // end of central dir
      end.setUint16(4, 0, true); end.setUint16(6,0,true);
      end.setUint16(8, fileRecords.length, true); end.setUint16(10, fileRecords.length, true);
      end.setUint32(12, centralSize, true);
      end.setUint32(16, offset, true); // central directory offset
      end.setUint16(20, 0, true); // comment length
      // Assemble final buffer
      const chunks: Uint8Array[] = [];
      for (const fr of fileRecords) { chunks.push(fr.header, encoder.encode(fr.name), fr.data); }
      for (const cp of centralParts) chunks.push(cp);
      chunks.push(new Uint8Array(end.buffer));
      let total = 0; for (const c of chunks) total += c.length;
      const out = new Uint8Array(total); let pos=0; for (const c of chunks) { out.set(c, pos); pos+=c.length; }
      if (Platform.OS === 'web') return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      return out; // native: we'll write bytes directly
    }
  };
}

// Multi-trip DOCX builder (concatenate trip sections)
function buildDocxMulti(trips: Trip[]): { fileName: string; blobBuilder: () => Promise<Blob | Uint8Array>; } {
  const fileName = `trips_${Date.now()}.docx`;
  function tripsDocumentXml(trips: Trip[]): string {
    const paras: string[] = [];
    const push = (text: string) => { paras.push(`<w:p><w:r><w:t>${xmlEscape(text)}</w:t></w:r></w:p>`); };
    push(`Trips Export (${trips.length})`);
    for (const t of trips) {
      push('');
      push(t.title || 'Untitled Trip');
      push(`Ship: ${t.ship || 'TBD'}`);
      push(`Dates: ${t.startDate || '—'} -> ${t.endDate || '—'}`);
      if (t.ports?.length) push(`Ports: ${t.ports.join(', ')}`);
      push('Days / Notes:');
      for (const d of t.days || []) {
        const date = d.date || '';
        const loc = d.isSeaDay ? 'Sea Day' : (d.locationName || d.title || d.notes || d.description || '');
        const body = (d.description || d.notes || '').replace(/\s+/g,' ').trim();
        push(`- ${date} | ${loc}`);
        if (body) push(`  ${body}`);
      }
    }
    push(`Exported ${new Date().toLocaleString()}`);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">\n<w:body>\n${paras.join('\n')}\n<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  }
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n<Default Extension="xml" ContentType="application/xml"/>\n<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  const documentXml = tripsDocumentXml(trips);
  const files = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: documentXml },
  ];
  return {
    fileName,
    blobBuilder: async () => {
      // reuse zip code by creating pseudo-trip and calling minimal writer (duplicated for clarity)
      function crc32(buf: Uint8Array): number { const table = (()=>{ const t:number[]=[]; for (let i=0;i<256;i++){ let c=i; for (let k=0;k<8;k++) c = ((c & 1)? (0xEDB88320 ^ (c>>>1)) : (c>>>1)); t[i]=c>>>0;} return t; })(); let crc=-1; for (let i=0;i<buf.length;i++){ crc = (crc>>>8) ^ table[(crc ^ buf[i]) & 0xFF]; } return (~crc)>>>0; }
      const encoder = new TextEncoder();
      let offset = 0;
      const fileRecords: { header: Uint8Array; data: Uint8Array; name: string; crc:number; size:number; offset:number }[] = [];
      for (const f of files) {
        const data = encoder.encode(f.data); const crc = crc32(data); const size = data.length; const nameBytes = encoder.encode(f.name);
        const h = new DataView(new ArrayBuffer(30)); h.setUint32(0,0x04034b50,true); h.setUint16(4,20,true); h.setUint16(6,0,true); h.setUint16(8,0,true); h.setUint16(10,0,true); h.setUint16(12,0,true); h.setUint32(14,crc,true); h.setUint32(18,size,true); h.setUint32(22,size,true); h.setUint16(26,nameBytes.length,true); h.setUint16(28,0,true);
        fileRecords.push({ header:new Uint8Array(h.buffer), data, name:f.name, crc, size, offset });
        offset += 30 + nameBytes.length + size;
      }
      const centralParts: Uint8Array[] = []; let centralSize=0;
      for (const fr of fileRecords) { const nameBytes = encoder.encode(fr.name); const dv=new DataView(new ArrayBuffer(46)); dv.setUint32(0,0x02014b50,true); dv.setUint16(4,20,true); dv.setUint16(6,20,true); dv.setUint16(8,0,true); dv.setUint16(10,0,true); dv.setUint16(12,0,true); dv.setUint16(14,0,true); dv.setUint32(16,fr.crc,true); dv.setUint32(20,fr.size,true); dv.setUint32(24,fr.size,true); dv.setUint16(28,nameBytes.length,true); dv.setUint16(30,0,true); dv.setUint16(32,0,true); dv.setUint16(34,0,true); dv.setUint16(36,0,true); dv.setUint16(38,0,true); dv.setUint32(42,fr.offset,true); const cent=new Uint8Array(dv.buffer); centralParts.push(cent,nameBytes); centralSize += cent.length + nameBytes.length; }
      const end = new DataView(new ArrayBuffer(22)); end.setUint32(0,0x06054b50,true); end.setUint16(4,0,true); end.setUint16(6,0,true); end.setUint16(8,fileRecords.length,true); end.setUint16(10,fileRecords.length,true); end.setUint32(12,centralSize,true); end.setUint32(16,offset,true); end.setUint16(20,0,true);
      const chunks: Uint8Array[] = []; for (const fr of fileRecords) { chunks.push(fr.header, new TextEncoder().encode(fr.name), fr.data); } for (const cp of centralParts) chunks.push(cp); chunks.push(new Uint8Array(end.buffer)); let total=0; for (const c of chunks) total+=c.length; const out=new Uint8Array(total); let pos=0; for (const c of chunks){ out.set(c,pos); pos+=c.length; }
      if (Platform.OS==='web') return new Blob([out],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
      return out;
    }
  };
}

export async function exportTripDOCX(trip: Trip) {
  try {
    const { fileName, blobBuilder } = buildDocx(trip);
    if (Platform.OS === 'web') {
      const blob = await blobBuilder();
      const url = URL.createObjectURL(blob as Blob); const a=document.createElement('a'); a.href=url; a.download=fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); return;
    }
    const FileSystem: any = await import('expo-file-system');
    const Sharing: any = await import('expo-sharing');
    const bytes = await blobBuilder();
    const fileUri = FileSystem.cacheDirectory + fileName;
    // Convert Uint8Array to base64
    // Manual base64 (avoid Node Buffer)
    function uint8ToBase64(u8: Uint8Array): string {
      if (typeof btoa === 'function') {
        let bin=''; for (let i=0;i<u8.length;i++) bin += String.fromCharCode(u8[i]);
        return btoa(bin);
      }
      // Fallback slow path
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let output=''; let i=0;
      while (i < u8.length) {
        const a = u8[i++]; const b = i<u8.length ? u8[i++] : NaN; const c = i<u8.length ? u8[i++] : NaN;
        const triplet = (a << 16) | ((b||0) << 8) | (c||0);
        const enc1 = (triplet >> 18) & 0x3F; const enc2 = (triplet >> 12) & 0x3F; const enc3 = (triplet >> 6) & 0x3F; const enc4 = triplet & 0x3F;
        output += alphabet[enc1] + alphabet[enc2] + (isNaN(b)?'=':alphabet[enc3]) + (isNaN(c)?'=':alphabet[enc4]);
      }
      return output;
    }
    const b64 = uint8ToBase64(bytes as Uint8Array);
    await FileSystem.writeAsStringAsync(fileUri, b64, { encoding: FileSystem.EncodingType.Base64 });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', dialogTitle: 'Export Trip DOCX' });
    else console.log('DOCX saved at', fileUri);
  } catch (e) { console.warn('DOCX export failed', e); }
}

// Dispatcher helpers
export type ExportFormat = 'pdf' | 'json' | 'txt' | 'docx';

export async function exportTrip(trip: Trip, format: ExportFormat = 'pdf') {
  switch (format) {
    case 'pdf': return exportTripPDF(trip);
    case 'json': return exportTripJSON(trip);
    case 'txt': return exportTripTXT(trip);
    case 'docx': return exportTripDOCX(trip);
    default: return exportTripPDF(trip);
  }
}

export async function exportAllTrips(format: ExportFormat = 'pdf', getTripsFn?: () => Promise<Trip[]>) {
  switch (format) {
    case 'pdf': return exportAllTripsPDF(getTripsFn);
    case 'json': return exportAllTripsJSON(getTripsFn);
    case 'txt': return exportAllTripsTXT(getTripsFn);
    case 'docx': {
      let trips: Trip[] = [];
      if (getTripsFn) trips = await getTripsFn(); else { const mod = await import('./storage'); trips = await (mod as any).getTrips(); }
      try {
        const { fileName, blobBuilder } = buildDocxMulti(trips);
        if (Platform.OS === 'web') {
          const blob = await blobBuilder();
            const url = URL.createObjectURL(blob as Blob); const a=document.createElement('a'); a.href=url; a.download=fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); return;
        }
        const FileSystem: any = await import('expo-file-system');
        const Sharing: any = await import('expo-sharing');
        const bytes = await blobBuilder();
        function uint8ToBase64(u8: Uint8Array): string { let bin=''; for (let i=0;i<u8.length;i++) bin += String.fromCharCode(u8[i]); if (typeof btoa==='function') return btoa(bin); return ''; }
        const b64 = uint8ToBase64(bytes as Uint8Array);
        const fileUri = FileSystem.cacheDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, b64, { encoding: FileSystem.EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', dialogTitle: 'Export Trips DOCX' });
        else console.log('DOCX saved at', fileUri);
      } catch (e) {
        console.warn('DOCX all-trips export failed, falling back to PDF', e);
        return exportAllTripsPDF(getTripsFn);
      }
      return;
    }
    default: return exportAllTripsPDF(getTripsFn);
  }
}
