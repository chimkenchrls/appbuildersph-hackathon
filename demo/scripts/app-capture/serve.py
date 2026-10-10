import http.server, os, sys
root = sys.argv[1]
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=root, **k)
    def do_GET(self):
        path = self.path.split('?')[0]
        if not os.path.exists(os.path.join(root, path.lstrip('/'))) or path == '/':
            self.path = '/index.html'
        return super().do_GET()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', 8791), H).serve_forever()
