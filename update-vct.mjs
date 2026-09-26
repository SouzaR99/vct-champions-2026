import fs from 'node:fs/promises';
const EVENT_ID='2766';
const BASES=[process.env.VLR_API_BASE||'https://vlrgg.metehansenyer.tech/api','https://vlrggapi.vercel.app/v2'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(path){let last;for(const base of BASES){try{const u=base.replace(/\/$/,'')+path;const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0 VCT-Champions-Live'}});if(!r.ok)throw new Error(`${r.status} ${u}`);return await r.json()}catch(e){last=e}}throw last}
function unwrap(x){return x?.data?.segments??x?.data??x?.segments??x}
function arr(x){return Array.isArray(x)?x:[]}
function pick(o,...ks){for(const k of ks)if(o&&o[k]!==undefined)return o[k];return null}
function n(x){const v=parseFloat(String(x??'').replace('%',''));return Number.isFinite(v)?v:null}
const old=JSON.parse(await fs.readFile('data.json','utf8'));let out=structuredClone(old);out.updatedAt=new Date().toISOString();out.source='VCT Champions 2026';
const roleFallback={};
try{
 const ev=unwrap(await get(`/v2/event/${EVENT_ID}`));
 const seg=ev?.segments||ev; const ts=arr(seg?.teams);
 if(ts.length){out.teams=ts.map(t=>({name:pick(t,'name','team','title')||'TBD',region:pick(t,'region','country','region_name')||'',group:pick(t,'group','group_name')||'',logo:pick(t,'logo','img')||'',players:arr(pick(t,'players','roster')).map(p=>({name:pick(p,'name','player','alias')||'TBD',role:pick(p,'role','position')||'Função não informada',photo:pick(p,'avatar','img','photo')||''}))}));}
}catch(e){console.log('event fallback',e.message)}
// Enrich team/player media through profile endpoints when IDs are available.
try{
 const current=out.teams||[];
 for(const t of current){
   if(!t.logo||t.players.some(p=>!p.photo)){ // search can provide IDs and images
     for(const p of t.players){
       if(p.photo) continue;
       try{const q=encodeURIComponent(p.name);const s=unwrap(await get(`/v2/search?q=${q}`));const hit=arr(s?.results?.players)[0];if(hit){p.photo=pick(hit,'img','avatar','photo')||p.photo;p.id=pick(hit,'id')||p.id}}catch{}
       await sleep(80);
     }
   }
 }
}catch(e){console.log('media enrichment failed',e.message)}
// Event matches: support both V2 and legacy response shapes.
try{
 let mm;
 for(const path of [`/v2/events/matches?event_id=${EVENT_ID}`,`/events/${EVENT_ID}/matches`,`/event/${EVENT_ID}/matches`]){try{mm=unwrap(await get(path));if(mm)break}catch{}}
 const list=arr(mm?.segments||mm?.matches||mm);
 if(list.length){out.matches=list.map(m=>{const a=m.team1||m.teams?.team1||m.teams?.[0]||{},b=m.team2||m.teams?.team2||m.teams?.[1]||{};const status=String(m.status||m.state||'').toLowerCase();let state=status.includes('live')?'live':status.includes('upcoming')?'upcoming':'completed';if(m.completed===false)state='upcoming';return {id:String(pick(m,'match_id','id')||''),time:pick(m,'date','time','unix_timestamp')||'TBD',a:typeof a==='string'?a:pick(a,'name','team')||'TBD',b:typeof b==='string'?b:pick(b,'name','team')||'TBD',score:pick(m,'score','match_score')||((a.score??'—')+'–'+(b.score??'—')),state,stage:pick(m,'event_series','series','stage','round_info')||'Champions 2026',maps:pick(m,'maps','map_summary')||'',url:pick(m,'url','match_page','match_url')||''}});}
}catch(e){console.log('matches fallback',e.message)}
// Detailed match data for live and recent matches; cached in data.json.
const details=out.matchDetails||{};const candidates=(out.matches||[]).filter(m=>m.id&&(m.state==='live'||m.state==='completed')).slice(-18);
for(const m of candidates){try{let d=null;for(const path of [`/v2/match/details?match_id=${encodeURIComponent(m.id)}`,`/match/${encodeURIComponent(m.id)}`]){try{d=unwrap(await get(path));if(d)break}catch{}}if(d){details[m.id]={maps:d.maps||[],economy:d.economy||[],players:d.players||{},event:d.event||{},performance:d.performance||{},updatedAt:new Date().toISOString()}}}catch(e){}await sleep(80)}
out.matchDetails=details;
// Keep existing stats when the event endpoint does not expose event-specific aggregate stats.
try{const st=unwrap(await get('/v2/stats?region=all&timespan=30'));const list=arr(st?.segments||st?.stats||st);if(list.length){const allowed=new Set((out.teams||[]).flatMap(t=>(t.players||[]).map(p=>p.name)));const mapped=list.filter(p=>allowed.has(p.player||p.name)).map(p=>[pick(p,'player','name')||'',pick(p,'org','team')||'',n(p.maps||p.rounds_played||0),n(p.rating),n(p.average_combat_score||p.acs),n(p.kill_deaths||p.kd),n(p.kill_assists_survived_traded||p.kast),n(p.average_damage_per_round||p.adr),n(p.kills_per_round||p.kpr),n(p.assists_per_round||p.apr),pick(p,'first_kills_per_round','fk_fd')||'—',pick(p,'kda','kills_deaths_assists')||'—']);if(mapped.length)out.stats=mapped}}catch{}
await fs.writeFile('data.json',JSON.stringify(out,null,2));console.log(`sync ${out.updatedAt}: teams=${out.teams?.length||0} matches=${out.matches?.length||0} details=${Object.keys(out.matchDetails||{}).length}`)
