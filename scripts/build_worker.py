#!/usr/bin/env python3
"""Bundle compressed static files in a dependency-free Cloudflare Worker."""
import base64
import gzip
import hashlib
import json
import mimetypes
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
assets = {}
paths = [(path,'/'+str(path.relative_to(ROOT/'public'))) for path in sorted((ROOT/'public').rglob('*'))]
paths += [(path,'/install/'+str(path.relative_to(ROOT/'docs'))) for path in sorted((ROOT/'docs').rglob('*')) if path.name!='.nojekyll' and 'download' not in path.relative_to(ROOT/'docs').parts]
for path, relative in paths:
    if not path.is_file(): continue
    mime = {'js':'application/javascript; charset=utf-8','json':'application/json; charset=utf-8','webmanifest':'application/manifest+json; charset=utf-8','svg':'image/svg+xml','html':'text/html; charset=utf-8','css':'text/css; charset=utf-8'}.get(path.suffix[1:],mimetypes.guess_type(str(path))[0] or 'application/octet-stream')
    content = path.read_bytes()
    assets[relative] = {'mime':mime,'body':base64.b64encode(gzip.compress(content,mtime=0)).decode(),'hash':hashlib.sha256(content).hexdigest()[:20]}
apk = ROOT/'dist/RgatuLite-1.3.4.apk'
if not apk.exists(): raise SystemExit('Build the Android APK before the Worker')
content = apk.read_bytes()
assets['/download/android'] = {'mime':'application/vnd.android.package-archive','body':base64.b64encode(content).decode(),'raw':True,'hash':hashlib.sha256(content).hexdigest()[:20]}
template = r'''
const ASSETS = __ASSETS__;
const DECODED = new Map();
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
    if (path === '/health') return Response.json({ok:true,app:'rgatu-pairs',version:'1.3.4'},{headers:{'Cache-Control':'no-store',...COMMON}});
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:{'Allow':'GET, HEAD',...COMMON}});
    if (path === '/') path = '/index.html';
    if (path === '/install' || path === '/install/') path = '/install/index.html';
    if (path === '/install/download/RgatuLite.apk') path = '/download/android';
    if (path === '/api/schedule') path = '/schedule.json';
    const asset = ASSETS[path];
    if (!asset) return new Response('Страница не найдена',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8',...COMMON}});
    const etag = '"m1-'+asset.hash+'"';
    const headers = {'Content-Type':asset.mime,'Cache-Control':url.pathname==='/api/schedule'?'no-store':'public, max-age=0, must-revalidate','ETag':etag,'Vary':'Accept-Encoding',...COMMON};
    if (path === '/sw.js') headers['Service-Worker-Allowed'] = '/';
    if (path === '/download/android') headers['Content-Disposition'] = 'attachment; filename="RgatuLite-1.3.4.apk"';
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
worker = template.replace('__ASSETS__',json.dumps(assets,separators=(',',':')))
dist = ROOT/'dist'
dist.mkdir(exist_ok=True)
(dist/'worker.mjs').write_text(worker,encoding='utf-8')
(dist/'deployment.json').write_text(json.dumps({'name':'rgatu-lite','url':'https://rgatu-lite.ivan-s-2001.workers.dev','workerBytes':len(worker.encode()),'apkBytes':apk.stat().st_size,'files':len(assets)},indent=2),encoding='utf-8')
print((dist/'deployment.json').read_text())
