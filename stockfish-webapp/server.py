#!/usr/bin/env python3
"""Tiny static server for the Stockfish web app (serves .wasm with the right MIME type).

Usage: python3 server.py [port]   ->  http://localhost:8000
"""
import http.server
import os
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
        ".js": "text/javascript",
    }


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
print(f"Stockfish Web Analyse läuft auf http://localhost:{port}")
http.server.ThreadingHTTPServer(("", port), Handler).serve_forever()
