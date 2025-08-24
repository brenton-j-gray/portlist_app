import { Platform } from 'react-native';
import { Trip } from '../types';

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
