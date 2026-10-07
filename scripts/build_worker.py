#!/usr/bin/env python3
"""Bundle compressed static files in a dependency-free Cloudflare Worker."""
import base64
import gzip
import hashlib
import json
import mimetypes
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION_META = json.loads((ROOT/'version.json').read_text(encoding='utf-8'))
INSTITUTION = json.loads((ROOT/'public'/'institution.json').read_text(encoding='utf-8'))
SCHEDULE_DATA = json.loads((ROOT/'public'/'schedule.json').read_text(encoding='utf-8'))
APP_VERSION = VERSION_META['version']
FRAME_ANCESTORS = ' '.join(INSTITUTION.get('integration',{}).get('frameAncestors',[])) or "'none'"
APK_FILENAME = f"RgatuLite-{APP_VERSION}.apk"
assets = {}
paths = [(path,'/'+str(path.relative_to(ROOT/'public'))) for path in sorted((ROOT/'public').rglob('*'))]
paths += [(path,'/install/'+str(path.relative_to(ROOT/'docs'))) for path in sorted((ROOT/'docs').rglob('*')) if path.name!='.nojekyll' and 'download' not in path.relative_to(ROOT/'docs').parts]
for path, relative in paths:
    if not path.is_file(): continue
    mime = {'js':'application/javascript; charset=utf-8','json':'application/json; charset=utf-8','webmanifest':'application/manifest+json; charset=utf-8','svg':'image/svg+xml','html':'text/html; charset=utf-8','css':'text/css; charset=utf-8'}.get(path.suffix[1:],mimetypes.guess_type(str(path))[0] or 'application/octet-stream')
    content = path.read_bytes()
    assets[relative] = {'mime':mime,'body':base64.b64encode(gzip.compress(content,mtime=0)).decode(),'hash':hashlib.sha256(content).hexdigest()[:20]}
APK_URL = 'https://ivan-s-2001.github.io/rgatu-schedule/download/RgatuLite.apk'
template = r'''
const ASSETS = __ASSETS__;
const DECODED = new Map();
const APK_URL = '__APK_URL__';
const INSTITUTION = __INSTITUTION__;
const SCHEDULE = __SCHEDULE__;
function assetBytes(asset) {
  const existing = DECODED.get(asset.hash);
  if (existing) return existing;
  const binary = atob(asset.body);
  const bytes = new Uint8Array(binary.length);
  for (let index=0; index<binary.length; index++) bytes[index]=binary.charCodeAt(index);
  DECODED.set(asset.hash,bytes);
  return bytes;
}
const COMMON = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors __FRAME_ANCESTORS__"
};
const API_HEADERS = {'Access-Control-Allow-Origin':INSTITUTION.integration?.cors || '*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','Access-Control-Allow-Headers':'Content-Type','X-API-Version':'1',...COMMON};
const apiJson = (value,{status=200,cache='public, max-age=60'}={}) => new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':cache,...API_HEADERS}});
const apiError = (status,code,message) => apiJson({error:{code,message}},{status,cache:'no-store'});
const groupById = id => SCHEDULE.groups.find(group => group.id === id);
const lessonGroups = lessonId => SCHEDULE.groups.filter(group => group.lessons.includes(lessonId)).map(group => group.id);
const publicLesson = (lesson,group) => ({...lesson,groups:lessonGroups(lesson.id),subgroup:group ? Number(group.subgroups?.[String(lesson.id)] || 0) || null : null});
function integrationApi(url) {
  const path=url.pathname;
  if(path==='/api/v1/meta') return apiJson({api:'v1',institution:INSTITUTION.institution,unit:INSTITUTION.unit,official:INSTITUTION.official,branding:INSTITUTION.branding,capabilities:INSTITUTION.capabilities,integration:INSTITUTION.integration,schedule:{schema:SCHEDULE.schema,version:SCHEDULE.version,updated:SCHEDULE.updated,title:SCHEDULE.title,timezone:SCHEDULE.timezone},bells:INSTITUTION.schedule?.bells || null},{cache:'public, max-age=300'});
  if(path==='/api/v1/groups') return apiJson({data:SCHEDULE.groups.map(group=>({id:group.id,course:group.course,dates:group.dates,lessonCount:group.lessons.length}))},{cache:'public, max-age=300'});
  if(path==='/api/v1/teachers') return apiJson({data:[...new Set(SCHEDULE.lessons.map(item=>String(item.teacher||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'))},{cache:'public, max-age=300'});
  if(path==='/api/v1/openapi.json') return null;
  if(path==='/api/v1/schedule') {
    const groupId=(url.searchParams.get('group')||'').trim();
    const teacher=(url.searchParams.get('teacher')||'').trim();
    const date=(url.searchParams.get('date')||'').trim();
    if(!groupId&&!teacher) return apiError(400,'missing_filter','Передай параметр group или teacher.');
    let selectedGroup=null, lessons=[];
    if(groupId){
      selectedGroup=groupById(groupId);
      if(!selectedGroup) return apiError(404,'group_not_found','Группа не найдена.');
      lessons=selectedGroup.lessons.map(index=>SCHEDULE.lessons[index]).filter(Boolean);
    } else {
      lessons=SCHEDULE.lessons.filter(item=>item.teacher===teacher);
      if(!lessons.length) return apiError(404,'teacher_not_found','Преподаватель не найден.');
    }
    if(date) lessons=lessons.filter(item=>item.date===date);
    lessons=lessons.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.slot-b.slot).map(item=>publicLesson(item,selectedGroup));
    return apiJson({query:{group:groupId||null,teacher:teacher||null,date:date||null},schedule:{version:SCHEDULE.version,updated:SCHEDULE.updated,timezone:SCHEDULE.timezone},data:lessons},{cache:'public, max-age=60'});
  }
  return undefined;
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = url.pathname;
    const isApi = path==='/api/schedule' || path.startsWith('/api/v1/');
    if (request.method==='OPTIONS' && isApi) return new Response(null,{status:204,headers:API_HEADERS});
    if (path === '/health') return apiJson({ok:true,app:'rgatu-pairs',platform:'university-schedule',version:'__APP_VERSION__',institution:INSTITUTION.institution.id,unit:INSTITUTION.unit.id},{cache:'no-store'});
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:{'Allow':'GET, HEAD, OPTIONS',...COMMON}});
    if (path.startsWith('/api/v1/')) {
      const response=integrationApi(url);
      if(response) return request.method==='HEAD' ? new Response(null,{status:response.status,headers:response.headers}) : response;
      if(path==='/api/v1/openapi.json') path='/openapi.json';
      else return apiError(404,'endpoint_not_found','API endpoint не найден.');
    }
    if (path === '/') path = '/index.html';
    if (path === '/install' || path === '/install/') path = '/install/index.html';
    if (path === '/install/download/RgatuLite.apk') path = '/download/android';
    if (path === '/download/android') {
      try {
        const upstream = await fetch(APK_URL,{redirect:'follow',headers:{'Accept-Encoding':'identity','Cache-Control':'no-cache'}});
        if (!upstream.ok) throw new Error('APK upstream '+upstream.status);
        const headers = {'Content-Type':'application/vnd.android.package-archive','Content-Disposition':'attachment; filename="__APK_FILENAME__"','Cache-Control':'no-store',...COMMON};
        const length = upstream.headers.get('Content-Length');
        if (length) headers['Content-Length'] = length;
        return new Response(request.method === 'HEAD' ? null : upstream.body,{status:200,headers});
      } catch (error) {
        return new Response('Обновление временно недоступно',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store',...COMMON}});
      }
    }
    if (path === '/api/schedule') path = '/schedule.json';
    const asset = ASSETS[path];
    if (!asset) return new Response('Страница не найдена',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8',...COMMON}});
    const etag = '"m1-'+asset.hash+'"';
    const apiAsset = url.pathname==='/api/schedule' || url.pathname.startsWith('/api/v1/');
    const headers = {'Content-Type':asset.mime,'Cache-Control':url.pathname==='/api/schedule'?'no-store':'public, max-age=0, must-revalidate','ETag':etag,'Vary':'Accept-Encoding',...(apiAsset?API_HEADERS:COMMON)};
    if (path === '/sw.js') headers['Service-Worker-Allowed'] = '/';
    if (path === '/download/android') headers['Content-Disposition'] = 'attachment; filename="__APK_FILENAME__"';
    if (request.headers.get('If-None-Match') === etag && url.pathname !== '/api/schedule') return new Response(null,{status:304,headers});
    const compressed = assetBytes(asset);
    let body;
    if (asset.raw) {
      body = compressed;
    } else if (/\bgzip\b/.test(request.headers.get('Accept-Encoding') || '')) {
      headers['Content-Encoding'] = 'gzip';
      body = compressed;
    } else {
      body = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    }
    return new Response(request.method === 'HEAD' ? null : body,{headers,encodeBody:'manual'});
  }
};
'''
worker = template.replace('__ASSETS__',json.dumps(assets,separators=(',',':'))).replace('__INSTITUTION__',json.dumps(INSTITUTION,ensure_ascii=False,separators=(',',':'))).replace('__SCHEDULE__',json.dumps(SCHEDULE_DATA,ensure_ascii=False,separators=(',',':'))).replace('__FRAME_ANCESTORS__',FRAME_ANCESTORS).replace('__APK_URL__',APK_URL).replace('__APP_VERSION__',APP_VERSION).replace('__APK_FILENAME__',APK_FILENAME)
dist = ROOT/'dist'
dist.mkdir(exist_ok=True)
(dist/'worker.mjs').write_text(worker,encoding='utf-8')
(dist/'deployment.json').write_text(json.dumps({'name':'rgatu-lite','url':'https://rgatu-lite.ivan-s-2001.workers.dev','workerBytes':len(worker.encode()),'apkSource':APK_URL,'files':len(assets)},indent=2),encoding='utf-8')
print((dist/'deployment.json').read_text())
