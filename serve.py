"""
Local dev server with SPA fallback.
Usage:  python serve.py
Opens:  http://localhost:8000/mortgage-toolkit.html
"""
import http.server, os, sys

PORT = 8000
ROOT = os.path.dirname(os.path.abspath(__file__))

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        # Strip query string to check if the file exists
        path = self.path.split("?")[0].split("#")[0].lstrip("/")
        full = os.path.join(ROOT, path)
        if path and not os.path.exists(full):
            # Unknown path → serve the app (SPA fallback)
            self.path = "/mortgage-toolkit.html"
        super().do_GET()

    def log_message(self, fmt, *args):
        pass  # silence request noise

if __name__ == "__main__":
    os.chdir(ROOT)
    with http.server.HTTPServer(("", PORT), SPAHandler) as srv:
        print(f"Serving at http://localhost:{PORT}/mortgage-toolkit.html")
        print("Press Ctrl+C to stop.")
        srv.serve_forever()
