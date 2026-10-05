#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import os

ROOT = Path(__file__).resolve().parents[1]

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0] == '/api/schedule': self.path = '/schedule.json'
        if self.path.split('?')[0] == '/download/android':
            path = ROOT/'dist/RgatuLite-1.3.3.apk'
            if not path.exists(): self.send_error(404);return
            content = path.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type','application/vnd.android.package-archive')
            self.send_header('Content-Length',str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control','no-cache')
        super().end_headers()
    def log_message(self,*args): pass

parser = argparse.ArgumentParser()
parser.add_argument('--port',type=int,default=4173)
args = parser.parse_args()
os.chdir(ROOT/'public')
print(f'http://127.0.0.1:{args.port}',flush=True)
ThreadingHTTPServer(('0.0.0.0',args.port),Handler).serve_forever()
