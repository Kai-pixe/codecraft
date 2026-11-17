#!/usr/bin/env python3
"""CodeCraft bridge: lets the CodeCraft terminal run REAL commands (git, npm, wrangler, python...)
in the Linux terminal (Crostini) of your Chromebook. No dependencies. Only listens on 127.0.0.1.

Use:   python3 cc-bridge.py [project-folder]
Then in CodeCraft's terminal:   bridge connect TOKEN
"""
import json, os, secrets, signal, subprocess, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get('CC_PORT', '7878'))
START = os.path.abspath(os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else '.'))
TOKEN_FILE = os.path.expanduser('~/.codecraft-bridge-token')
try:
    TOKEN = open(TOKEN_FILE).read().strip()
except OSError:
    TOKEN = ''
if len(TOKEN) < 16:
    TOKEN = secrets.token_urlsafe(18)
    with open(TOKEN_FILE, 'w') as f:
        f.write(TOKEN)
    os.chmod(TOKEN_FILE, 0o600)

state = {'cwd': START, 'proc': None}
WRAP = 'cd "$CC_CWD" 2>/dev/null || cd ~; eval "$CC_CMD"; rc=$?; printf "\\n\\000CC:%s:%s\\n" "$rc" "$PWD"'


class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.0'

    def log_message(self, *a):
        pass

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-CC-Token')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Private-Network', 'true')

    def _ok(self):
        return secrets.compare_digest(self.headers.get('X-CC-Token', ''), TOKEN)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self._ok():
            return self._json(401, {'error': 'token'})
        self._json(200, {'ok': True, 'cwd': state['cwd']})

    def do_POST(self):
        if not self._ok():
            return self._json(401, {'error': 'token'})
        n = int(self.headers.get('Content-Length') or 0)
        try:
            data = json.loads(self.rfile.read(n) or b'{}')
        except ValueError:
            data = {}
        if self.path == '/stop':
            p = state['proc']
            if p and p.poll() is None:
                try:
                    os.killpg(p.pid, signal.SIGTERM)
                except OSError:
                    pass
            return self._json(200, {'ok': True})
        if self.path != '/run':
            return self._json(404, {'error': 'not found'})
        cmd = str(data.get('cmd', ''))[:8000]
        env = dict(os.environ, CC_CWD=state['cwd'], CC_CMD=cmd, TERM='dumb', NO_COLOR='1',
                   GIT_TERMINAL_PROMPT='0', CI='1', FORCE_COLOR='0')
        self.send_response(200)
        self._cors()
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        p = subprocess.Popen(['bash', '-lc', WRAP], env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, start_new_session=True)
        state['proc'] = p
        tail = b''
        try:
            for chunk in iter(lambda: os.read(p.stdout.fileno(), 4096), b''):
                tail = (tail + chunk)[-4000:]
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            try:
                os.killpg(p.pid, signal.SIGTERM)
            except OSError:
                pass
        p.wait()
        # recuerda la carpeta final (cd persiste entre comandos)
        i = tail.rfind(b'\x00CC:')
        if i != -1:
            parts = tail[i:].split(b'\n')[0].split(b':', 2)
            if len(parts) == 3 and os.path.isdir(parts[2].decode(errors='replace')):
                state['cwd'] = parts[2].decode(errors='replace')


class S(ThreadingHTTPServer):
    daemon_threads = True


if __name__ == '__main__':
    print('CodeCraft bridge on http://127.0.0.1:%d   folder: %s' % (PORT, START))
    print('Token (paste in CodeCraft):  bridge connect %s' % TOKEN)
    print('Ctrl+C to stop. Only this computer can reach it.')
    S(('127.0.0.1', PORT), H).serve_forever()
