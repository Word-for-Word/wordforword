#!/usr/bin/env python3
"""Local dev server that disables HTTP caching entirely.

Plain `python3 -m http.server` sends Last-Modified but no Cache-Control
header, so browsers apply their own heuristic freshness lifetime and can
silently reuse a stale cached response on reload — even after bumping the
css/js `?v=` query strings, if the query-stringed URL itself was already
cached from a previous edit. That's what caused the intro splash
intermittently showing an old, already-fixed version of the animation:
not a bug in the animation code, just the browser skipping a real fetch.

Usage: python3 scripts/dev_server.py [port]  (defaults to 5511, matching
the port used throughout this project's own dev workflow)
"""

import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5511
    server = HTTPServer(("", port), NoCacheHandler)
    print(f"Serving on http://localhost:{port} (caching disabled)")
    server.serve_forever()
