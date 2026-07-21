import os
import sys
import subprocess
import http.server
import socketserver
import threading

# Add virtualenv site-packages to sys.path so we can import 'requests'
FLASK_DIR = os.path.join(os.path.dirname(__file__), 'word-to-presentation-converter')
venv_path = os.path.join(FLASK_DIR, '.venv')
if os.path.exists(venv_path):
    lib_dir = os.path.join(venv_path, 'lib')
    if os.path.exists(lib_dir):
        for py_ver in os.listdir(lib_dir):
            site_packages = os.path.join(lib_dir, py_ver, 'site-packages')
            if os.path.exists(site_packages):
                sys.path.insert(0, site_packages)

import requests

FLASK_PORT = 5001
PROXY_PORT = 8080

class HybridProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/citcd'):
            self.proxy_request('GET')
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith('/citcd'):
            self.proxy_request('POST')
        else:
            self.send_error(405, "Method not allowed")

    def proxy_request(self, method):
        # Translate /citcd/path to /path for the local Flask app running on port 5000
        path = self.path[len('/citcd'):] or '/'
        if not path.startswith('/'):
            path = '/' + path
            
        flask_url = f"http://127.0.0.1:{FLASK_PORT}{path}"
        
        # Read headers
        headers = {key: val for key, val in self.headers.items() if key.lower() != 'host'}
        
        # Read body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None
        
        try:
            resp = requests.request(
                method=method,
                url=flask_url,
                headers=headers,
                data=body,
                allow_redirects=False,
                proxies={"http": None, "https": None}
            )
            
            self.send_response(resp.status_code)
            
            # Forward headers (excluding hop-by-hop headers)
            exclude_headers = {
                'connection', 'keep-alive', 'proxy-authenticate', 
                'proxy-authorization', 'te', 'trailers', 
                'transfer-encoding', 'upgrade'
            }
            for key, val in resp.headers.items():
                if key.lower() not in exclude_headers:
                    self.send_header(key, val)
            self.end_headers()
            
            self.wfile.write(resp.content)
            
        except Exception as e:
            self.send_error(502, f"Bad Gateway (Is Flask running?): {str(e)}")

def run_flask():
    print(f"🚀 Starting Flask application on port {FLASK_PORT}...")
    venv_python = os.path.join(venv_path, 'bin', 'python')
    python_exe = venv_python if os.path.exists(venv_python) else sys.executable
    env = os.environ.copy()
    env['APP_PORT'] = str(FLASK_PORT)
    env['FLASK_DEBUG'] = '1'
    env['TEMPLATES_AUTO_RELOAD'] = '1'
    subprocess.run([python_exe, 'app.py'], cwd=FLASK_DIR, env=env)

if __name__ == '__main__':
    # Start Flask in a background thread
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    
    # Start proxy server
    print(f"✨ Starting local development server on http://localhost:{PROXY_PORT}...")
    handler = HybridProxyHandler
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PROXY_PORT), handler) as httpd:
        print(f"👉 Main Portfolio: http://localhost:{PROXY_PORT}/")
        print(f"👉 Word to Presentation: http://localhost:{PROXY_PORT}/citcd/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Shutting down servers...")
