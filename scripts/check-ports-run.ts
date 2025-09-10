import path from 'path';
import { pathToFileURL } from 'url';

const __dirname = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, process.platform === 'win32' ? '' : '/'));

async function main() {
  const portsPath = path.resolve(__dirname, '..', 'lib', 'ports.ts');
  const mod = await import(pathToFileURL(portsPath).href);
  const { searchPorts, unifiedPortSearch } = mod as any;
  const cache: any[] = [];
  console.log('\n=== searchPorts("Hilo, HI") ===');
  const sp = searchPorts('Hilo, HI', cache, 10);
  console.log(JSON.stringify(sp.map((p: any) => ({ name: p.name, country: p.country, region: p.regionCode, source: p.source })), null, 2));

  console.log('\n=== unifiedPortSearch("Hilo, HI") ===');
  const up = await unifiedPortSearch('Hilo, HI', cache, 10);
  console.log(JSON.stringify(up.map((p: any) => ({ name: p.name, country: p.country, region: p.regionCode, source: p.source })), null, 2));
}

main().catch(err => { console.error(err); process.exitCode = 2; });
