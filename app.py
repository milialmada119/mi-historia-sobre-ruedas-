#!/usr/bin/env python3
"""Servidor HTTP de Mi Historia sobre Ruedas (sin dependencias externas).

Uso:
    python3 app.py                # http://127.0.0.1:8000
    python3 app.py --port 9000 --host 0.0.0.0
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
import posixpath
import sys
import traceback
import urllib.parse
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from mhsr import api, auth, db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
COOKIE_NAME = "mhsr_session"
MAX_BODY = 24 * 1024 * 1024  # 24 MB (imágenes ya redimensionadas en el navegador)

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("application/manifest+json", ".webmanifest")


class Handler(BaseHTTPRequestHandler):
    server_version = "MHSR/1.0"
    protocol_version = "HTTP/1.1"

    # ---------------------------- utilidades ---------------------------- #
    def log_message(self, fmt, *args):  # noqa: D102 - silencio selectivo
        if os.environ.get("MHSR_QUIET"):
            return
        sys.stderr.write("  %s - %s\n" % (self.address_string(), fmt % args))

    def _cookies(self) -> dict:
        raw = self.headers.get("Cookie", "")
        out = {}
        for part in raw.split(";"):
            if "=" in part:
                key, _, value = part.partition("=")
                out[key.strip()] = value.strip()
        return out

    def _send_json(self, status: int, payload) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, status: int, body: bytes, content_type: str, cache: str = "no-cache") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        if length > MAX_BODY:
            raise api.HttpError(413, "El contenido enviado es demasiado grande.")
        raw = self.rfile.read(length)
        if not raw:
            return {}
        ctype = (self.headers.get("Content-Type") or "").lower()
        if "application/json" in ctype or raw.lstrip()[:1] in (b"{", b"["):
            try:
                return json.loads(raw.decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                raise api.HttpError(400, "El cuerpo de la petición no es JSON válido.")
        return {}

    def _serve_file(self, path: str) -> None:
        # Normaliza y evita salir del directorio permitido.
        safe = posixpath.normpath("/" + path).lstrip("/")
        if ".." in safe.split("/"):
            return self._send_json(404, {"error": "No encontrado."})

        if safe.startswith("uploads/"):
            base = db.UPLOAD_DIR
            relative = safe[len("uploads/"):]
            cache = "public, max-age=31536000, immutable"
        else:
            base = PUBLIC_DIR
            relative = safe or "index.html"
            cache = "no-cache"

        target = os.path.join(base, *relative.split("/"))
        if os.path.isdir(target):
            target = os.path.join(target, "index.html")
        if not os.path.isfile(target):
            if "." not in relative:
                target = os.path.join(PUBLIC_DIR, "index.html")
                if os.path.isfile(target):
                    return self._send_bytes(200, open(target, "rb").read(),
                                            "text/html; charset=utf-8", "no-cache")
            return self._send_json(404, {"error": "No encontramos ese archivo."})

        ctype = mimetypes.guess_type(target)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        try:
            with open(target, "rb") as fh:
                body = fh.read()
        except OSError:
            return self._send_json(500, {"error": "No pudimos leer el archivo."})
        self._send_bytes(200, body, ctype, cache)

    # ------------------------------ verbos ------------------------------ #
    def _handle(self, method: str) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = urllib.parse.unquote(parsed.path)
        query = {k: v[0] for k, v in urllib.parse.parse_qs(parsed.query).items()}

        if not path.startswith("/api/"):
            if method == "GET":
                return self._serve_file(path.lstrip("/"))
            return self._send_json(405, {"error": "Método no permitido."})

        conn = db.connect()
        try:
            token = self._cookies().get(COOKIE_NAME)
            user = auth.user_for_token(conn, token)

            if method == "OPTIONS":
                return self._send_json(200, {"ok": True})

            body = self._read_body() if method in {"POST", "PATCH", "PUT"} else {}
            result = api.dispatch(conn, token, user, method, path, query, body)

            # Alta/baja de sesión -> cookie
            if path == "/api/auth/register" or path == "/api/auth/login":
                self.send_response(200)
                payload = json.dumps(result, ensure_ascii=False).encode("utf-8")
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.send_header(
                    "Set-Cookie",
                    f"{COOKIE_NAME}={result['token']}; Path=/; HttpOnly; SameSite=Lax; Max-Age={60*60*24*30}",
                )
                self.end_headers()
                self.wfile.write(payload)
                return

            self._send_json(200, result)
        except api.HttpError as err:
            self._send_json(err.status, {"error": err.message})
        except Exception:  # noqa: BLE001 - nunca exponer el stack al cliente
            traceback.print_exc()
            self._send_json(500, {"error": "Algo salió mal de nuestro lado. Probá de nuevo."})
        finally:
            conn.close()

    def do_GET(self):  # noqa: N802
        self._handle("GET")

    def do_POST(self):  # noqa: N802
        self._handle("POST")

    def do_PATCH(self):  # noqa: N802
        self._handle("PATCH")

    def do_PUT(self):  # noqa: N802
        self._handle("PUT")

    def do_DELETE(self):  # noqa: N802
        self._handle("DELETE")

    def do_OPTIONS(self):  # noqa: N802
        self._handle("OPTIONS")


def main() -> None:
    parser = argparse.ArgumentParser(description="Mi Historia sobre Ruedas")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    db.init()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.daemon_threads = True
    shown = "localhost" if args.host in ("127.0.0.1", "0.0.0.0") else args.host
    print("\n  🚗  Mi Historia sobre Ruedas")
    print(f"      Abrí http://{shown}:{args.port} en tu navegador.")
    print(f"      Datos en: {db.DATA_DIR}\n      (Ctrl+C para detener)\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Hasta la próxima vuelta. 👋\n")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
