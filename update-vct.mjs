import fs from 'node:fs/promises';

const EVENT_ID = '2766';
const BASES = [
  process.env.VLR_API_BASE || 'https://vlrgg.metehansenyer.tech/api',
  'https://vlrggapi.vercel.app/v2'
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(path) {
  let last;
  for (const base of BASES) {
    try {
      const url = base.replace(/\/$/,'') + path;
      const r = await fetch(url, {headers:{'User-Agent':'VCT-Champions-Dashboard/1.0'}});
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch(e) { last=e; }
  }
  throw last;
}

function unwrap(x){ return x?.data?.segments ?? x?.data ?? x?.segments ?? x; }
function arr(x){ return Array.isArray(x) ? x : []; }
function num(x){ const n=parseFloat(String(x??'').replace('%','')); return Number.isFinite(n)?n:null; }
function pick(o,...keys){ for(const k of keys) if(o && o[k]!==undefined) return o[k]; return null; }

const old = JSON.parse(await fs.readFile('data.json','utf8'));
let teams=old.teams, stats=old.stats, matches=old.matches, groups=old.groups;
let source='';

try {
  const ev=unwrap(await get(`/events/${EVENT_ID}`));
  const detail=ev?.event ?? ev?.segments?.event ?? ev;
  source = detail?.name || 'VCT Champions 2026';
  const roster = ev?.teams || ev?.segments?.teams || detail?.teams;
  if(Array.isArray(roster) && roster.length){
    teams=roster.map(t=>[
      pick(t,'name','team','title') || 'TBD',
      pick(t,'region','country','region_name') || '',
      pick(t,'group','group_name') || '',
      arr(pick(t,'players','roster')).map(p=>pick(p,'name','player','handle')).filter(Boolean)
    ]);
  }
} catch(e){ source += ' (teams: fallback)'; }

try {
  const mm=unwrap(await get(`/events/${EVENT_ID}/matches`));
  const list=Array.isArray(mm) ? mm : arr(mm?.matches);
  if(list.length){
    matches=list.map(m=>{
      const ts=arr(m.teams);
      const a=ts[0]||{}, b=ts[1]||{};
      const status=(m.status||'').toLowerCase();
      let state=status.includes('live')?'live':status.includes('upcoming')?'upcoming':'completed';
      if(m.completed===false) state='upcoming';
      return [
        pick(m,'date','time','match_time','unix_timestamp')||'TBD',
        pick(a,'name','team')||pick(m,'team1')||'TBD',
        pick(b,'name','team')||pick(m,'team2')||'TBD',
        `${pick(a,'score')??0}–${pick(b,'score')??0}`,
        state,
        pick(m,'event_series','series','stage')||'Champions 2026',
        pick(m,'url','match_url')||''
      ];
    });
  }
} catch(e){ source += ' (matches: fallback)'; }

// Some public VLR APIs expose event statistics directly. Keep the last known stats if not available.
for (const path of [`/events/${EVENT_ID}/stats`,`/event/${EVENT_ID}/stats`]) {
  try {
    const st=unwrap(await get(path));
    const list=arr(st?.stats || st?.players || st);
    if(list.length){
      const mapped=list.map(p=>[
        pick(p,'player','name')||'', pick(p,'org','team')||'', num(p.maps ?? p.rounds_played ?? 0),
        num(p.rating), num(p.average_combat_score ?? p.acs), num(p.kill_deaths ?? p.kd),
        num(p.kill_assists_survived_traded ?? p.kast), num(p.average_damage_per_round ?? p.adr),
        num(p.kills_per_round ?? p.kpr), num(p.assists_per_round ?? p.apr),
        pick(p,'first_kills_per_round','fk_fd')||'—', pick(p,'kda','kills_deaths_assists')||'—'
      ]).filter(r=>r[0]);
      if(mapped.length) { stats=mapped; break; }
    }
  } catch(e) {}
}

// If API supplies no group table, preserve the last known bracket data.
if(!groups || !Object.keys(groups).length) groups=old.groups;

const out={updatedAt:new Date().toISOString(),source:source||'VCT Champions 2026',teams,stats,matches,groups};
await fs.writeFile('data.json',JSON.stringify(out,null,2));
console.log(`Updated: ${out.updatedAt} | teams=${teams.length} matches=${matches.length} stats=${stats.length}`);
