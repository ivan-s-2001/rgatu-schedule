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
APP_VERSION = VERSION_META['version']
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
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
};
export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path === '/health') return Response.json({ok:true,app:'rgatu-pairs',version:'__APP_VERSION__'},{headers:{'Cache-Control':'no-store',...COMMON}});
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:{'Allow':'GET, HEAD',...COMMON}});
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
    const headers = {'Content-Type':asset.mime,'Cache-Control':url.pathname==='/api/schedule'?'no-store':'public, max-age=0, must-revalidate','ETag':etag,'Vary':'Accept-Encoding',...COMMON};
    if (path === '/sw.js') headers['Service-Worker-Allowed'] = '/';
    if (path === '/download/android') headers['Content-Disposition'] = 'attachment; filename="RgatuLite-1.4.7.apk"';
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
worker = template.replace('__ASSETS__',json.dumps(assets,separators=(',',':'))).replace('__APK_URL__',APK_URL).replace('__APP_VERSION__',APP_VERSION).replace('__APK_FILENAME__',APK_FILENAME)
dist = ROOT/'dist'
dist.mkdir(exist_ok=True)
(dist/'worker.mjs').write_text(worker,encoding='utf-8')
(dist/'deployment.json').write_text(json.dumps({'name':'rgatu-lite','url':'https://rgatu-lite.ivan-s-2001.workers.dev','workerBytes':len(worker.encode()),'apkSource':APK_URL,'files':len(assets)},indent=2),encoding='utf-8')
print((dist/'deployment.json').read_text())
