#!/usr/bin/env python3
"""Tiny static server for the 3D ULPIN prototype.

The app is an ES-module project, so it must be served over HTTP rather than
opened from the filesystem. Cache headers are disabled so edits show up on a
plain reload.

    python3 serve.py            # http://localhost:8123
    python3 serve.py 9000       # a different port
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    print(f"3D ULPIN → http://localhost:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
