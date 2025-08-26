import { searchPorts, unifiedPortSearch } from '../lib/ports';

async function run() {
  try {
    const cache: any[] = [];
    console.log('\n=== searchPorts("Hilo, HI") ===');
    const sp = searchPorts('Hilo, HI', cache, 10);
    console.log(JSON.stringify(sp.map(p => ({ name: p.name, country: p.country, region: p.regionCode, source: p.source })), null, 2));

    console.log('\n=== unifiedPortSearch("Hilo, HI") ===');
    const up = await unifiedPortSearch('Hilo, HI', cache, 10);
    console.log(JSON.stringify(up.map(p => ({ name: p.name, country: p.country, region: p.regionCode, source: p.source })), null, 2));
  } catch (err) {
    console.error('Error running checks:', err);
    process.exitCode = 2;
  }
}

run();
