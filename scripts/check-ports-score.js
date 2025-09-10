const fs = require('fs');
const path = require('path');
// Provide a safe fallback for environments where __dirname is not defined
const scriptDir = (typeof globalThis !== 'undefined' && typeof globalThis.__dirname !== 'undefined')
  ? globalThis.__dirname
  : path.dirname(path.resolve(process.argv[1] || process.cwd()));
function stripDiacritics(s) { try { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch { return s; } }
function normalize(s) { return stripDiacritics(String(s || '')).trim().toLowerCase(); }
function levenshtein(a, b) { const m=a.length,n=b.length; if(!m) return n; if(!n) return m; const dp=new Array(n+1); for(let j=0;j<=n;j++) dp[j]=j; for(let i=1;i<=m;i++){ let prev=i-1; dp[0]=i; for(let j=1;j<=n;j++){ const temp=dp[j]; const cost = a[i-1]===b[j-1]?0:1; dp[j]=Math.min(dp[j]+1, dp[j-1]+1, prev+cost); prev=temp; } } return dp[n]; }
function jaroWinkler(a,b){ if(a===b) return 1; const al=a.length, bl=b.length; if(!al||!bl) return 0; const matchDistance=Math.floor(Math.max(al,bl)/2)-1; const aMatches=new Array(al).fill(false); const bMatches=new Array(bl).fill(false); let matches=0; for(let i=0;i<al;i++){ const start=Math.max(0,i-matchDistance); const end=Math.min(i+matchDistance+1,bl); for(let j=start;j<end;j++){ if(bMatches[j]) continue; if(a[i]!==b[j]) continue; aMatches[i]=true; bMatches[j]=true; matches++; break; } } if(!matches) return 0; let t=0,k=0; for(let i=0;i<al;i++){ if(!aMatches[i]) continue; while(!bMatches[k]) k++; if(a[i]!==b[k]) t++; k++; } t/=2; const m=matches; let jaro=(m/al + m/bl + (m-t)/m)/3; let prefix=0; for(let i=0;i<Math.min(4,al,bl);i++){ if(a[i]===b[i]) prefix++; else break; } if(jaro>0.7 && prefix) jaro=jaro + 0.1*prefix*(1-jaro); return jaro; }
function scoreName(query,candidate){ const qRaw=normalize(query); const c=normalize(candidate); if(!qRaw||!c) return 0; if(c===qRaw) return 1; const tokens=qRaw.split(/[^a-z0-9]+/).filter(Boolean); if(tokens.length===0) return 0; let total=0; for(const t of tokens){ if(!t) continue; if(c===t){ total+=1; continue; } if(c.startsWith(t)){ total+=0.95; continue; } if(t.length>=3 && c.includes(t)){ total+=0.85; continue; } const dist=levenshtein(t,c); const maxLen=Math.max(t.length,c.length)||1; let sim=1 - dist/maxLen; if(sim<0.75){ const jw=jaroWinkler(t,c); sim = Math.max(sim, jw*0.9); } total += Math.max(0, sim*0.8); } let score = total / tokens.length; return Math.min(1, score); }
function loadJson(p){ try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){return [];} }
const curatedPath = path.join(scriptDir, '..', 'assets', 'data', 'ports.curated.json');
const masterPath = path.join(scriptDir, '..', 'cruise_ports_master.json');
const curated = loadJson(curatedPath) || [];
const masterRaw = loadJson(masterPath) || [];
const master = masterRaw.filter(r=>r && (r.port_name||r.city)).map(r=>({ name: r.port_name||r.city||'', country: r.country_or_territory||undefined, regionCode: r.region||undefined, lat: parseFloat(r.latitude)||0, lng: parseFloat(r.longitude)||0, source: 'master' }));
const curatedMapped = curated.map(p=>({ name: p.name, country: p.country, regionCode: p.regionCode, lat: p.lat, lng: p.lng, aliases: p.aliases||[], source: 'curated', isCruise: p.isCruise }));
const pool = [...curatedMapped, ...master];

function topMatches(query,n=10){ const scored = pool.map(p=>({ p, s: scoreName(query, p.name) })); scored.sort((a,b)=>b.s-a.s); return scored.slice(0,n); }

console.log('\nTop matches for "Hilo, HI":');
console.log(topMatches('Hilo, HI', 12).map(x=>({name:x.p.name, score:x.s, country:x.p.country, region:x.p.regionCode, source:x.p.source}))); 
console.log('\nTop matches for "Nawiliwili, HI":');
console.log(topMatches('Nawiliwili, HI', 12).map(x=>({name:x.p.name, score:x.s, country:x.p.country, region:x.p.regionCode, source:x.p.source}))); 

// Debug: check direct scores for exact curated entries
const hilo = curatedMapped.find(p => p.name === 'Hilo');
if (hilo) {
	console.log('\nDebug score for candidate Hilo vs query "Hilo, HI":', scoreName('Hilo, HI', hilo.name));
	console.log('Aliases for Hilo:', hilo.aliases);
	// Detailed breakdown
	const q = 'Hilo, HI';
	const qRaw = normalize(q);
	const tokens = qRaw.split(/[^a-z0-9]+/).filter(Boolean);
	console.log('qRaw:', qRaw, 'tokens:', tokens);
	tokens.forEach((t) => {
		const c = normalize(hilo.name);
		let contrib = 0;
		if (c === t) contrib = 1;
		else if (c.startsWith(t)) contrib = 0.95;
		else if (t.length >= 3 && c.includes(t)) contrib = 0.85;
		else {
			const dist = levenshtein(t, c);
			const maxLen = Math.max(t.length, c.length) || 1;
			let sim = 1 - dist / maxLen;
			if (sim < 0.75) {
				const jw = jaroWinkler(t, c);
				sim = Math.max(sim, jw * 0.9);
			}
			contrib = Math.max(0, sim * 0.8);
		}
		console.log(' token', t, 'contrib', contrib);
	});
}
