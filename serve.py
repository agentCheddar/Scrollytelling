"""Serve this folder at http://localhost:8417 with browser caching turned off,
so edits to the HTML, CSS and JS show up on a normal reload.

Usage: python3 serve.py [port]
"""
import functools
import http.server
import pathlib
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8417
    root = pathlib.Path(__file__).resolve().parent
    handler = functools.partial(NoCacheHandler, directory=str(root))
    print(f"Serving {root} at http://localhost:{port}")
    http.server.ThreadingHTTPServer(("", port), handler).serve_forever()
