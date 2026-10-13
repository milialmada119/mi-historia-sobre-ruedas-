"""API REST de Mi Historia sobre Ruedas."""
from __future__ import annotations

import base64
import binascii
import os
import re
import secrets
from datetime import date, datetime, timezone

from . import auth, db

# --------------------------------------------------------------------------- #
#  Errores y utilidades
# --------------------------------------------------------------------------- #


class HttpError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


DATA_URL_RE = re.compile(r"^data:image/(png|jpe?g|webp|gif);base64,(.+)$", re.S | re.I)
EXT_MAP = {"png": "png", "jpg": "jpg", "jpeg": "jpg", "webp": "webp", "gif": "gif"}
MAX_IMAGE_BYTES = 14 * 1024 * 1024

MOD_CATEGORIES = [
    "llantas", "pintura", "motor", "suspension", "escape",
    "interior", "audio", "accesorios", "performance", "otras",
]
STORY_SECTIONS = [
    "origen", "primera_modificacion", "mejores_recuerdos",
    "significado", "despedida", "libre",
]


def save_image(data_url: str | None) -> str | None:
    """Guarda una imagen base64 (data URL) y devuelve su ruta pública."""
    if not data_url:
        return None
    m = DATA_URL_RE.match(data_url.strip())
    if not m:
        raise HttpError(400, "El archivo enviado no es una imagen válida.")
    ext = EXT_MAP[m.group(1).lower()]
    try:
        raw = base64.b64decode(m.group(2), validate=False)
    except (binascii.Error, ValueError):
        raise HttpError(400, "No se pudo leer la imagen enviada.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HttpError(413, "La imagen supera el tamaño máximo permitido (14 MB).")
    name = f"{secrets.token_hex(16)}.{ext}"
    with open(os.path.join(db.UPLOAD_DIR, name), "wb") as fh:
        fh.write(raw)
    return f"/uploads/{name}"


def delete_image(path: str | None) -> None:
    if not path or not path.startswith("/uploads/"):
        return
    target = os.path.join(db.UPLOAD_DIR, os.path.basename(path))
    try:
        os.remove(target)
    except OSError:
        pass


def clean(value, limit: int | None = None):
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text[:limit] if limit else text


def as_int(value, default=None):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def as_bool(value) -> int:
    if isinstance(value, bool):
        return 1 if value else 0
    return 1 if str(value).strip().lower() in {"1", "true", "yes", "si", "sí"} else 0


def as_date(value) -> str | None:
    """Normaliza a YYYY-MM-DD. Acepta YYYY o YYYY-MM."""
    text = clean(value)
    if not text:
        return None
    text = text[:10]
    if re.fullmatch(r"\d{4}", text):
        return f"{text}-01-01"
    if re.fullmatch(r"\d{4}-\d{2}", text):
        return f"{text}-01"
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return text
    return text[:10]


def year_of(value) -> int | None:
    if not value:
        return None
    m = re.match(r"(\d{4})", str(value))
    return int(m.group(1)) if m else None


def period_label(start, end, status: str) -> str:
    start_y = year_of(start)
    end_y = year_of(end)
    if not start_y:
        return "Fecha desconocida"
    return f"{start_y} — {'hoy' if status == 'current' else (end_y or '')}".rstrip()


# --------------------------------------------------------------------------- #
#  Serialización
# --------------------------------------------------------------------------- #


def car_card(c: dict, mod_count: int = 0, memory_count: int = 0, photo_count: int = 0) -> dict:
    return {
        "id": c["id"],
        "brand": c["brand"],
        "model": c["model"],
        "year": c["year"],
        "nickname": c["nickname"],
        "color": c["color"],
        "status": c["status"],
        "photo": c["photo"],
        "favorite": bool(c["favorite"]),
        "purchase_date": c["purchase_date"],
        "sold_date": c["sold_date"],
        "period": period_label(c["purchase_date"], c["sold_date"], c["status"]),
        "modifications": mod_count,
        "memories": memory_count,
        "photos": photo_count,
    }


def car_full(conn, car_id: int) -> dict:
    car = db.row(conn.execute("SELECT * FROM cars WHERE id = ?", (car_id,)))
    if not car:
        raise HttpError(404, "Ese auto no está en tu colección.")

    photos = db.rows(
        conn.execute(
            "SELECT * FROM car_photos WHERE car_id = ? ORDER BY favorite DESC, COALESCE(taken_at, created_at) ASC, id ASC",
            (car_id,),
        )
    )
    mods = db.rows(
        conn.execute(
            "SELECT * FROM modifications WHERE car_id = ? ORDER BY COALESCE(date, created_at) ASC, id ASC",
            (car_id,),
        )
    )
    mod_photos = db.rows(
        conn.execute(
            """SELECT p.* FROM modification_photos p
               JOIN modifications m ON m.id = p.modification_id
               WHERE m.car_id = ? ORDER BY p.id ASC""",
            (car_id,),
        )
    )
    entries = db.rows(
        conn.execute(
            "SELECT * FROM story_entries WHERE car_id = ? ORDER BY COALESCE(date, created_at) ASC, id ASC",
            (car_id,),
        )
    )
    entry_photos = db.rows(
        conn.execute(
            """SELECT p.* FROM story_photos p
               JOIN story_entries e ON e.id = p.entry_id
               WHERE e.car_id = ? ORDER BY p.id ASC""",
            (car_id,),
        )
    )

    by_mod: dict[int, list] = {}
    for p in mod_photos:
        by_mod.setdefault(p["modification_id"], []).append(
            {"id": p["id"], "path": p["path"], "kind": p["kind"]}
        )
    by_entry: dict[int, list] = {}
    for p in entry_photos:
        by_entry.setdefault(p["entry_id"], []).append(
            {"id": p["id"], "path": p["path"], "favorite": bool(p["favorite"])}
        )

    for m in mods:
        m["photos"] = by_mod.get(m["id"], [])
        m["before"] = [p for p in m["photos"] if p["kind"] == "before"]
        m["after"] = [p for p in m["photos"] if p["kind"] == "after"]
    for e in entries:
        e["photos"] = by_entry.get(e["id"], [])
        e["featured"] = bool(e["featured"])

    car["favorite"] = bool(car["favorite"])
    car["period"] = period_label(car["purchase_date"], car["sold_date"], car["status"])
    car["photos"] = photos
    car["modifications"] = mods
    car["story"] = entries
    car["counts"] = {
        "photos": len(photos) + (1 if car["photo"] else 0),
        "modifications": len(mods),
        "memories": len(entries),
        "featured": sum(1 for e in entries if e["featured"]) + sum(1 for p in photos if p["favorite"]),
    }
    return car


# --------------------------------------------------------------------------- #
#  Router
# --------------------------------------------------------------------------- #

ROUTES: list[tuple[str, re.Pattern, str]] = []


def route(method: str, pattern: str, public: bool = False):
    compiled = re.compile(f"^{pattern}$")

    def decorator(fn):
        ROUTES.append((method, compiled, fn.__name__))
        fn.public = public
        fn.pattern = compiled
        return fn

    return decorator


def find_route(method: str, path: str):
    for m, pattern, name in ROUTES:
        if m != method:
            continue
        match = pattern.match(path)
        if match:
            return globals()[name], match.groupdict()
    return None, None


# ------------------------------- Autenticación ------------------------------ #


@route("POST", r"/api/auth/register", public=True)
def register(ctx):
    name = clean(ctx.body.get("name"), 80)
    email = (clean(ctx.body.get("email"), 160) or "").lower()
    password = str(ctx.body.get("password") or "")

    if not name:
        raise HttpError(400, "Contanos cómo te llamás.")
    if not auth.valid_email(email):
        raise HttpError(400, "Ese correo no parece válido.")
    if len(password) < 6:
        raise HttpError(400, "La contraseña necesita al menos 6 caracteres.")
    if ctx.conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        raise HttpError(409, "Ya existe una cuenta con ese correo.")

    pw_hash, salt = auth.hash_password(password)
    cur = ctx.conn.execute(
        "INSERT INTO users (name, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)",
        (name, email, pw_hash, salt, db.now_iso()),
    )
    ctx.conn.commit()
    user_id = cur.lastrowid
    token = auth.create_session(ctx.conn, user_id)
    return {"token": token, "user": {"id": user_id, "name": name, "email": email, "avatar": None}}


@route("POST", r"/api/auth/login", public=True)
def login(ctx):
    email = (clean(ctx.body.get("email"), 160) or "").lower()
    password = str(ctx.body.get("password") or "")
    user = db.row(ctx.conn.execute("SELECT * FROM users WHERE email = ?", (email,)))
    if not user or not auth.verify_password(password, user["password_hash"], user["salt"]):
        raise HttpError(401, "Correo o contraseña incorrectos.")
    token = auth.create_session(ctx.conn, user["id"])
    return {
        "token": token,
        "user": {"id": user["id"], "name": user["name"], "email": user["email"], "avatar": user["avatar"]},
    }


@route("POST", r"/api/auth/logout")
def logout(ctx):
    auth.destroy_session(ctx.conn, ctx.token)
    return {"ok": True}


@route("GET", r"/api/auth/me")
def me(ctx):
    return {
        "user": {
            "id": ctx.user["id"],
            "name": ctx.user["name"],
            "email": ctx.user["email"],
            "avatar": ctx.user["avatar"],
        }
    }


@route("PATCH", r"/api/auth/profile")
def update_profile(ctx):
    name = clean(ctx.body.get("name"), 80)
    if name:
        ctx.conn.execute("UPDATE users SET name = ? WHERE id = ?", (name, ctx.user["id"]))
    if "avatar" in ctx.body:
        avatar = save_image(ctx.body.get("avatar"))
        delete_image(ctx.user["avatar"])
        ctx.conn.execute("UPDATE users SET avatar = ? WHERE id = ?", (avatar, ctx.user["id"]))
    ctx.conn.commit()
    return me(ctx)


# --------------------------------- Autos ------------------------------------ #


@route("GET", r"/api/cars")
def list_cars(ctx):
    status = ctx.query.get("status", "all")
    sql = "SELECT * FROM cars WHERE user_id = ?"
    params: list = [ctx.user["id"]]
    if status in {"current", "sold"}:
        sql += " AND status = ?"
        params.append(status)
    sql += " ORDER BY COALESCE(purchase_date, created_at) ASC, id ASC"
    cars = db.rows(ctx.conn.execute(sql, params))
    out = []
    for c in cars:
        counts = db.row(
            ctx.conn.execute(
                """SELECT
                     (SELECT COUNT(*) FROM modifications WHERE car_id = :id) AS mods,
                     (SELECT COUNT(*) FROM story_entries WHERE car_id = :id) AS mems,
                     (SELECT COUNT(*) FROM car_photos WHERE car_id = :id) AS pics""",
                {"id": c["id"]},
            )
        )
        out.append(car_card(c, counts["mods"], counts["mems"], counts["pics"]))
    return {"cars": out}


@route("POST", r"/api/cars")
def create_car(ctx):
    brand = clean(ctx.body.get("brand"), 60)
    model = clean(ctx.body.get("model"), 80)
    if not brand:
        raise HttpError(400, "Indicá la marca del auto.")
    if not model:
        raise HttpError(400, "Indicá el modelo del auto.")

    status = ctx.body.get("status") if ctx.body.get("status") in {"current", "sold"} else "current"
    photo = save_image(ctx.body.get("photo"))
    ts = db.now_iso()
    cur = ctx.conn.execute(
        """INSERT INTO cars (user_id, brand, model, year, nickname, color, description,
                             purchase_date, sold_date, status, photo, favorite, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ctx.user["id"], brand, model, as_int(ctx.body.get("year")),
            clean(ctx.body.get("nickname"), 60), clean(ctx.body.get("color"), 40),
            clean(ctx.body.get("description"), 4000), as_date(ctx.body.get("purchase_date")),
            as_date(ctx.body.get("sold_date")), status, photo, as_bool(ctx.body.get("favorite")),
            ts, ts,
        ),
    )
    ctx.conn.commit()
    return car_full(ctx.conn, cur.lastrowid)


@route("GET", r"/api/cars/(?P<car_id>\d+)")
def get_car(ctx):
    car = car_full(ctx.conn, int(ctx.params["car_id"]))
    if car["user_id"] != ctx.user["id"]:
        raise HttpError(404, "Ese auto no está en tu colección.")
    return car


@route("PATCH", r"/api/cars/(?P<car_id>\d+)")
def update_car(ctx):
    car = ctx.owned_car()
    fields, params = [], []
    text_fields = {
        "brand": 60, "model": 80, "nickname": 60, "color": 40, "description": 4000,
    }
    for key, limit in text_fields.items():
        if key in ctx.body:
            fields.append(f"{key} = ?")
            params.append(clean(ctx.body.get(key), limit))
    if "year" in ctx.body:
        fields.append("year = ?")
        params.append(as_int(ctx.body.get("year")))
    if "purchase_date" in ctx.body:
        fields.append("purchase_date = ?")
        params.append(as_date(ctx.body.get("purchase_date")))
    if "sold_date" in ctx.body:
        fields.append("sold_date = ?")
        params.append(as_date(ctx.body.get("sold_date")))
    if "status" in ctx.body and ctx.body["status"] in {"current", "sold"}:
        fields.append("status = ?")
        params.append(ctx.body["status"])
        if ctx.body["status"] == "current":
            fields.append("sold_date = NULL")
    if "favorite" in ctx.body:
        fields.append("favorite = ?")
        params.append(as_bool(ctx.body.get("favorite")))
    if "photo" in ctx.body:
        delete_image(car["photo"])
        fields.append("photo = ?")
        params.append(save_image(ctx.body.get("photo")))

    if fields:
        fields.append("updated_at = ?")
        params.append(db.now_iso())
        params.append(car["id"])
        ctx.conn.execute(f"UPDATE cars SET {', '.join(fields)} WHERE id = ?", params)
        ctx.conn.commit()
    return car_full(ctx.conn, car["id"])


@route("DELETE", r"/api/cars/(?P<car_id>\d+)")
def delete_car(ctx):
    car = ctx.owned_car()
    for p in db.rows(ctx.conn.execute("SELECT path FROM car_photos WHERE car_id = ?", (car["id"],))):
        delete_image(p["path"])
    for p in db.rows(
        ctx.conn.execute(
            """SELECT p.path FROM modification_photos p
               JOIN modifications m ON m.id = p.modification_id WHERE m.car_id = ?""",
            (car["id"],),
        )
    ):
        delete_image(p["path"])
    for p in db.rows(
        ctx.conn.execute(
            """SELECT p.path FROM story_photos p
               JOIN story_entries e ON e.id = p.entry_id WHERE e.car_id = ?""",
            (car["id"],),
        )
    ):
        delete_image(p["path"])
    delete_image(car["photo"])
    ctx.conn.execute("DELETE FROM cars WHERE id = ?", (car["id"],))
    ctx.conn.commit()
    return {"ok": True}


# ------------------------------ Fotos del auto ------------------------------ #


@route("POST", r"/api/cars/(?P<car_id>\d+)/photos")
def add_car_photo(ctx):
    car = ctx.owned_car()
    path = save_image(ctx.body.get("data"))
    if not path:
        raise HttpError(400, "No recibimos ninguna imagen.")
    role = ctx.body.get("role", "gallery")
    if role == "main":
        delete_image(car["photo"])
        ctx.conn.execute("UPDATE cars SET photo = ?, updated_at = ? WHERE id = ?",
                         (path, db.now_iso(), car["id"]))
        ctx.conn.commit()
        return {"ok": True, "photo": path}
    cur = ctx.conn.execute(
        """INSERT INTO car_photos (car_id, path, caption, taken_at, favorite, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (car["id"], path, clean(ctx.body.get("caption"), 200),
         as_date(ctx.body.get("taken_at")), as_bool(ctx.body.get("favorite")), db.now_iso()),
    )
    ctx.conn.commit()
    return {"ok": True, "id": cur.lastrowid, "photo": path}


@route("PATCH", r"/api/photos/(?P<photo_id>\d+)")
def update_car_photo(ctx):
    photo = db.row(ctx.conn.execute("SELECT * FROM car_photos WHERE id = ?", (int(ctx.params["photo_id"]),)))
    if not photo:
        raise HttpError(404, "Esa foto no existe.")
    ctx.require_car(photo["car_id"])
    if ctx.body.get("role") == "main":
        delete_image(db.row(ctx.conn.execute("SELECT photo FROM cars WHERE id = ?", (photo["car_id"],)))["photo"])
        ctx.conn.execute("UPDATE cars SET photo = ?, updated_at = ? WHERE id = ?",
                         (photo["path"], db.now_iso(), photo["car_id"]))
        ctx.conn.commit()
        return {"ok": True, "photo": photo["path"]}
    fields, params = [], []
    if "caption" in ctx.body:
        fields.append("caption = ?")
        params.append(clean(ctx.body.get("caption"), 200))
    if "favorite" in ctx.body:
        fields.append("favorite = ?")
        params.append(as_bool(ctx.body.get("favorite")))
    if "taken_at" in ctx.body:
        fields.append("taken_at = ?")
        params.append(as_date(ctx.body.get("taken_at")))
    if fields:
        params.append(photo["id"])
        ctx.conn.execute(f"UPDATE car_photos SET {', '.join(fields)} WHERE id = ?", params)
        ctx.conn.commit()
    return {"ok": True}


@route("DELETE", r"/api/photos/(?P<photo_id>\d+)")
def delete_car_photo(ctx):
    photo = db.row(ctx.conn.execute("SELECT * FROM car_photos WHERE id = ?", (int(ctx.params["photo_id"]),)))
    if not photo:
        raise HttpError(404, "Esa foto no existe.")
    ctx.require_car(photo["car_id"])
    delete_image(photo["path"])
    ctx.conn.execute("DELETE FROM car_photos WHERE id = ?", (photo["id"],))
    ctx.conn.commit()
    return {"ok": True}


# ------------------------------ Modificaciones ------------------------------ #


@route("POST", r"/api/cars/(?P<car_id>\d+)/modifications")
def add_modification(ctx):
    car = ctx.owned_car()
    title = clean(ctx.body.get("title"), 120)
    if not title:
        raise HttpError(400, "Poné un título para la modificación.")
    category = ctx.body.get("category")
    if category not in MOD_CATEGORIES:
        category = "otras"
    cur = ctx.conn.execute(
        """INSERT INTO modifications (car_id, category, title, description, date, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (car["id"], category, title, clean(ctx.body.get("description"), 4000),
         as_date(ctx.body.get("date")), db.now_iso()),
    )
    mod_id = cur.lastrowid
    for kind in ("before", "after"):
        items = ctx.body.get(kind) or []
        if isinstance(items, (str, dict)):
            items = [items]
        for item in items:
            data = item.get("data") if isinstance(item, dict) else item
            path = save_image(data)
            if path:
                ctx.conn.execute(
                    "INSERT INTO modification_photos (modification_id, path, kind, created_at) VALUES (?, ?, ?, ?)",
                    (mod_id, path, kind, db.now_iso()),
                )
    ctx.conn.commit()
    return car_full(ctx.conn, car["id"])


@route("PATCH", r"/api/modifications/(?P<mod_id>\d+)")
def update_modification(ctx):
    mod = ctx.owned_modification()
    fields, params = [], []
    if "title" in ctx.body:
        fields.append("title = ?")
        params.append(clean(ctx.body.get("title"), 120))
    if "description" in ctx.body:
        fields.append("description = ?")
        params.append(clean(ctx.body.get("description"), 4000))
    if "date" in ctx.body:
        fields.append("date = ?")
        params.append(as_date(ctx.body.get("date")))
    if "category" in ctx.body and ctx.body["category"] in MOD_CATEGORIES:
        fields.append("category = ?")
        params.append(ctx.body["category"])
    if fields:
        params.append(mod["id"])
        ctx.conn.execute(f"UPDATE modifications SET {', '.join(fields)} WHERE id = ?", params)
        ctx.conn.commit()
    return car_full(ctx.conn, mod["car_id"])


@route("DELETE", r"/api/modifications/(?P<mod_id>\d+)")
def delete_modification(ctx):
    mod = ctx.owned_modification()
    for p in db.rows(ctx.conn.execute("SELECT path FROM modification_photos WHERE modification_id = ?", (mod["id"],))):
        delete_image(p["path"])
    ctx.conn.execute("DELETE FROM modifications WHERE id = ?", (mod["id"],))
    ctx.conn.commit()
    return {"ok": True}


@route("POST", r"/api/modifications/(?P<mod_id>\d+)/photos")
def add_modification_photo(ctx):
    mod = ctx.owned_modification()
    kind = ctx.body.get("kind") if ctx.body.get("kind") in {"before", "after"} else "after"
    path = save_image(ctx.body.get("data"))
    if not path:
        raise HttpError(400, "No recibimos ninguna imagen.")
    ctx.conn.execute(
        "INSERT INTO modification_photos (modification_id, path, kind, created_at) VALUES (?, ?, ?, ?)",
        (mod["id"], path, kind, db.now_iso()),
    )
    ctx.conn.commit()
    return {"ok": True, "photo": path}


@route("DELETE", r"/api/mod-photos/(?P<photo_id>\d+)")
def delete_modification_photo(ctx):
    photo = db.row(ctx.conn.execute("SELECT * FROM modification_photos WHERE id = ?", (int(ctx.params["photo_id"]),)))
    if not photo:
        raise HttpError(404, "Esa foto no existe.")
    ctx.require_modification(photo["modification_id"])
    delete_image(photo["path"])
    ctx.conn.execute("DELETE FROM modification_photos WHERE id = ?", (photo["id"],))
    ctx.conn.commit()
    return {"ok": True}


# --------------------------------- Historia --------------------------------- #


@route("POST", r"/api/cars/(?P<car_id>\d+)/story")
def add_story(ctx):
    car = ctx.owned_car()
    body = clean(ctx.body.get("body"), 20000)
    title = clean(ctx.body.get("title"), 140)
    section = ctx.body.get("section")
    if section not in STORY_SECTIONS:
        section = "libre"
    if not body and not title and not ctx.body.get("photos"):
        raise HttpError(400, "Escribí algo o sumá una foto para guardar el recuerdo.")
    ts = db.now_iso()
    cur = ctx.conn.execute(
        """INSERT INTO story_entries (car_id, section, title, body, date, featured, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (car["id"], section, title, body, as_date(ctx.body.get("date")),
         as_bool(ctx.body.get("featured")), ts, ts),
    )
    entry_id = cur.lastrowid
    for item in ctx.body.get("photos") or []:
        data = item.get("data") if isinstance(item, dict) else item
        path = save_image(data)
        if path:
            ctx.conn.execute(
                "INSERT INTO story_photos (entry_id, path, favorite, created_at) VALUES (?, ?, ?, ?)",
                (entry_id, path, as_bool(item.get("favorite") if isinstance(item, dict) else None), db.now_iso()),
            )
    ctx.conn.commit()
    return car_full(ctx.conn, car["id"])


@route("PATCH", r"/api/story/(?P<entry_id>\d+)")
def update_story(ctx):
    entry = ctx.owned_story()
    fields, params = [], []
    if "title" in ctx.body:
        fields.append("title = ?")
        params.append(clean(ctx.body.get("title"), 140))
    if "body" in ctx.body:
        fields.append("body = ?")
        params.append(clean(ctx.body.get("body"), 20000))
    if "date" in ctx.body:
        fields.append("date = ?")
        params.append(as_date(ctx.body.get("date")))
    if "featured" in ctx.body:
        fields.append("featured = ?")
        params.append(as_bool(ctx.body.get("featured")))
    if "section" in ctx.body and ctx.body["section"] in STORY_SECTIONS:
        fields.append("section = ?")
        params.append(ctx.body["section"])
    if fields:
        fields.append("updated_at = ?")
        params.append(db.now_iso())
        params.append(entry["id"])
        ctx.conn.execute(f"UPDATE story_entries SET {', '.join(fields)} WHERE id = ?", params)
        ctx.conn.commit()
    return car_full(ctx.conn, entry["car_id"])


@route("DELETE", r"/api/story/(?P<entry_id>\d+)")
def delete_story(ctx):
    entry = ctx.owned_story()
    for p in db.rows(ctx.conn.execute("SELECT path FROM story_photos WHERE entry_id = ?", (entry["id"],))):
        delete_image(p["path"])
    ctx.conn.execute("DELETE FROM story_entries WHERE id = ?", (entry["id"],))
    ctx.conn.commit()
    return {"ok": True}


@route("POST", r"/api/story/(?P<entry_id>\d+)/photos")
def add_story_photo(ctx):
    entry = ctx.owned_story()
    path = save_image(ctx.body.get("data"))
    if not path:
        raise HttpError(400, "No recibimos ninguna imagen.")
    ctx.conn.execute(
        "INSERT INTO story_photos (entry_id, path, favorite, created_at) VALUES (?, ?, ?, ?)",
        (entry["id"], path, as_bool(ctx.body.get("favorite")), db.now_iso()),
    )
    ctx.conn.commit()
    return {"ok": True, "photo": path}


@route("PATCH", r"/api/story-photos/(?P<photo_id>\d+)")
def update_story_photo(ctx):
    photo = db.row(ctx.conn.execute("SELECT * FROM story_photos WHERE id = ?", (int(ctx.params["photo_id"]),)))
    if not photo:
        raise HttpError(404, "Esa foto no existe.")
    ctx.require_story(photo["entry_id"])
    if "favorite" in ctx.body:
        ctx.conn.execute("UPDATE story_photos SET favorite = ? WHERE id = ?",
                         (as_bool(ctx.body.get("favorite")), photo["id"]))
        ctx.conn.commit()
    return {"ok": True}


@route("DELETE", r"/api/story-photos/(?P<photo_id>\d+)")
def delete_story_photo(ctx):
    photo = db.row(ctx.conn.execute("SELECT * FROM story_photos WHERE id = ?", (int(ctx.params["photo_id"]),)))
    if not photo:
        raise HttpError(404, "Esa foto no existe.")
    ctx.require_story(photo["entry_id"])
    delete_image(photo["path"])
    ctx.conn.execute("DELETE FROM story_photos WHERE id = ?", (photo["id"],))
    ctx.conn.commit()
    return {"ok": True}


# ------------------------- Vistas de la colección --------------------------- #


@route("GET", r"/api/garage")
def garage(ctx):
    cars = list_cars(ctx)["cars"]
    return {"cars": [c for c in cars if c["status"] == "current"]}


@route("GET", r"/api/timeline")
def timeline(ctx):
    cars = db.rows(
        ctx.conn.execute(
            """SELECT * FROM cars WHERE user_id = ?
               ORDER BY COALESCE(purchase_date, created_at) ASC, year ASC, id ASC""",
            (ctx.user["id"],),
        )
    )
    stages = []
    for index, c in enumerate(cars, start=1):
        mods = db.rows(
            ctx.conn.execute(
                """SELECT id, category, title, description, date FROM modifications
                   WHERE car_id = ? ORDER BY COALESCE(date, created_at) ASC, id ASC""",
                (c["id"],),
            )
        )
        memory = db.row(
            ctx.conn.execute(
                """SELECT id, section, title, body, date FROM story_entries
                   WHERE car_id = ? ORDER BY featured DESC, COALESCE(date, created_at) ASC, id ASC LIMIT 1""",
                (c["id"],),
            )
        )
        stages.append({
            "order": index,
            "car": car_card(c),
            "modifications": mods,
            "memory": memory,
        })
    return {"stages": stages}


@route("GET", r"/api/memories/featured")
def featured_memories(ctx):
    limit = max(1, min(as_int(ctx.query.get("limit"), 24), 60))
    entries = db.rows(
        ctx.conn.execute(
            """SELECT e.id, e.section, e.title, e.body, e.date, e.featured,
                      e.car_id, c.brand, c.model, c.year, c.photo AS car_photo
               FROM story_entries e JOIN cars c ON c.id = e.car_id
               WHERE c.user_id = ? AND (e.featured = 1 OR e.id IN (
                     SELECT entry_id FROM story_photos WHERE favorite = 1))
               ORDER BY e.featured DESC, COALESCE(e.date, e.created_at) DESC, e.id DESC
               LIMIT ?""",
            (ctx.user["id"], limit),
        )
    )
    for e in entries:
        e["featured"] = bool(e["featured"])
        e["photos"] = db.rows(
            ctx.conn.execute(
                "SELECT id, path, favorite FROM story_photos WHERE entry_id = ? ORDER BY favorite DESC, id ASC",
                (e["id"],),
            )
        )
        for p in e["photos"]:
            p["favorite"] = bool(p["favorite"])

    favorite_photos = db.rows(
        ctx.conn.execute(
            """SELECT p.id, p.path, p.caption, p.favorite, p.car_id,
                      c.brand, c.model, c.year
               FROM car_photos p JOIN cars c ON c.id = p.car_id
               WHERE c.user_id = ? AND p.favorite = 1
               ORDER BY p.id DESC LIMIT ?""",
            (ctx.user["id"], limit),
        )
    )

    # Si el usuario todavía no destacó nada, mostramos lo más reciente.
    if not entries and not favorite_photos:
        entries = db.rows(
            ctx.conn.execute(
                """SELECT e.id, e.section, e.title, e.body, e.date, 0 AS featured,
                          e.car_id, c.brand, c.model, c.year, c.photo AS car_photo
                   FROM story_entries e JOIN cars c ON c.id = e.car_id
                   WHERE c.user_id = ?
                   ORDER BY COALESCE(e.date, e.created_at) DESC, e.id DESC LIMIT ?""",
                (ctx.user["id"], limit),
            )
        )
        for e in entries:
            e["featured"] = False
            e["photos"] = db.rows(
                ctx.conn.execute(
                    "SELECT id, path, favorite FROM story_photos WHERE entry_id = ? ORDER BY id ASC",
                    (e["id"],),
                )
            )
            for p in e["photos"]:
                p["favorite"] = bool(p["favorite"])
        favorite_photos = db.rows(
            ctx.conn.execute(
                """SELECT p.id, p.path, p.caption, p.favorite, p.car_id,
                          c.brand, c.model, c.year
                   FROM car_photos p JOIN cars c ON c.id = p.car_id
                   WHERE c.user_id = ? ORDER BY p.id DESC LIMIT ?""",
                (ctx.user["id"], limit),
            )
        )

    return {"memories": entries, "photos": favorite_photos}


@route("GET", r"/api/memories/today")
def memory_of_today(ctx):
    today = date.today()
    mmdd = today.strftime("%m-%d")
    uid = ctx.user["id"]
    pick = db.row(
        ctx.conn.execute(
            """SELECT e.id, e.section, e.title, e.body, e.date, e.car_id,
                      c.brand, c.model, c.year, c.photo AS car_photo
               FROM story_entries e JOIN cars c ON c.id = e.car_id
               WHERE c.user_id = ? AND e.date IS NOT NULL
                 AND strftime('%m-%d', e.date) = ?
               ORDER BY RANDOM() LIMIT 1""",
            (uid, mmdd),
        )
    )
    kind = "story"
    if not pick:
        pick = db.row(
            ctx.conn.execute(
                """SELECT m.id, m.category, m.title, m.description AS body, m.date, m.car_id,
                          c.brand, c.model, c.year, c.photo AS car_photo
                   FROM modifications m JOIN cars c ON c.id = m.car_id
                   WHERE c.user_id = ? AND m.date IS NOT NULL
                     AND strftime('%m-%d', m.date) = ?
                   ORDER BY RANDOM() LIMIT 1""",
                (uid, mmdd),
            )
        )
        kind = "modification"
    if not pick:
        pick = db.row(
            ctx.conn.execute(
                """SELECT id, brand, model, year, photo AS car_photo, purchase_date AS date,
                          id AS car_id, nickname
                   FROM cars WHERE user_id = ? AND purchase_date IS NOT NULL
                     AND strftime('%m-%d', purchase_date) = ?
                   ORDER BY RANDOM() LIMIT 1""",
                (uid, mmdd),
            )
        )
        kind = "car"
    if not pick:
        pick = db.row(
            ctx.conn.execute(
                """SELECT e.id, e.section, e.title, e.body, e.date, e.car_id,
                          c.brand, c.model, c.year, c.photo AS car_photo
                   FROM story_entries e JOIN cars c ON c.id = e.car_id
                   WHERE c.user_id = ?
                   ORDER BY RANDOM() LIMIT 1""",
                (uid,),
            )
        )
        kind = "story" if pick else None

    if not pick:
        return {"memory": None}

    photos = []
    if kind == "story":
        photos = db.rows(
            ctx.conn.execute("SELECT id, path FROM story_photos WHERE entry_id = ? ORDER BY favorite DESC, id ASC", (pick["id"],))
        )
    pick["photos"] = photos
    pick["kind"] = kind
    pick["today"] = today.strftime("%Y-%m-%d")
    pick["on_this_day"] = bool(pick.get("date") and str(pick["date"])[5:10] == mmdd)
    return {"memory": pick}


@route("GET", r"/api/stats")
def stats(ctx):
    uid = ctx.user["id"]
    cars = db.rows(ctx.conn.execute("SELECT * FROM cars WHERE user_id = ?", (uid,)))
    total = len(cars)
    current = sum(1 for c in cars if c["status"] == "current")
    sold = total - current
    ordered = sorted(cars, key=lambda c: (c["purchase_date"] or c["created_at"] or "", c["id"]))
    first = ordered[0] if ordered else None
    latest = ordered[-1] if ordered else None

    mods = db.row(ctx.conn.execute(
        """SELECT COUNT(*) AS n FROM modifications m JOIN cars c ON c.id = m.car_id WHERE c.user_id = ?""", (uid,)))
    memories = db.row(ctx.conn.execute(
        """SELECT COUNT(*) AS n FROM story_entries e JOIN cars c ON c.id = e.car_id WHERE c.user_id = ?""", (uid,)))
    photos = db.row(ctx.conn.execute(
        """SELECT COUNT(*) AS n FROM car_photos p JOIN cars c ON c.id = p.car_id WHERE c.user_id = ?""", (uid,)))
    fav_photos = db.row(ctx.conn.execute(
        """SELECT COUNT(*) AS n FROM car_photos p JOIN cars c ON c.id = p.car_id
           WHERE c.user_id = ? AND p.favorite = 1""", (uid,)))

    brand_rows = db.rows(ctx.conn.execute(
        """SELECT brand, COUNT(*) AS n FROM cars WHERE user_id = ? GROUP BY brand ORDER BY n DESC, brand ASC""", (uid,)))
    cat_rows = db.rows(ctx.conn.execute(
        """SELECT m.category, COUNT(*) AS n FROM modifications m JOIN cars c ON c.id = m.car_id
           WHERE c.user_id = ? GROUP BY m.category ORDER BY n DESC""", (uid,)))

    brands = {}
    for c in cars:
        brands.setdefault(c["brand"], 0)
        brands[c["brand"]] += 1
    top_brand = max(brands, key=brands.get) if brands else None

    def card(c):
        return car_card(c) if c else None

    return {
        "total": total,
        "current": current,
        "sold": sold,
        "first": card(first),
        "latest": card(latest),
        "modifications": mods["n"],
        "memories": memories["n"],
        "photos": photos["n"] + sum(1 for c in cars if c["photo"]),
        "favorite_photos": fav_photos["n"],
        "brands": brand_rows,
        "top_brand": top_brand,
        "categories": cat_rows,
        "years_span": None,
    }


# --------------------------------------------------------------------------- #
#  Contexto de petición y helpers de propiedad
# --------------------------------------------------------------------------- #


class Ctx:
    def __init__(self, conn, user, body, query, params, token):
        self.conn = conn
        self.user = user
        self.body = body or {}
        self.query = query or {}
        self.params = params or {}
        self.token = token

    # --- validación de pertenencia ---
    def require_car(self, car_id: int) -> dict:
        car = db.row(self.conn.execute("SELECT * FROM cars WHERE id = ?", (car_id,)))
        if not car or car["user_id"] != self.user["id"]:
            raise HttpError(404, "Ese auto no está en tu colección.")
        return car

    def owned_car(self) -> dict:
        return self.require_car(int(self.params["car_id"]))

    def require_modification(self, mod_id: int) -> dict:
        mod = db.row(self.conn.execute("SELECT * FROM modifications WHERE id = ?", (mod_id,)))
        if not mod:
            raise HttpError(404, "Esa modificación no existe.")
        self.require_car(mod["car_id"])
        return mod

    def owned_modification(self) -> dict:
        return self.require_modification(int(self.params["mod_id"]))

    def require_story(self, entry_id: int) -> dict:
        entry = db.row(self.conn.execute("SELECT * FROM story_entries WHERE id = ?", (entry_id,)))
        if not entry:
            raise HttpError(404, "Ese recuerdo no existe.")
        self.require_car(entry["car_id"])
        return entry

    def owned_story(self) -> dict:
        return self.require_story(int(self.params["entry_id"]))


def dispatch(conn, token, user, method: str, path: str, query: dict, body: dict):
    fn, params = find_route(method, path)
    if fn is None:
        raise HttpError(404, "Ruta no encontrada.")
    if not getattr(fn, "public", False) and not user:
        raise HttpError(401, "Necesitás iniciar sesión.")
    ctx = Ctx(conn, user, body, query, params, token)
    return fn(ctx)
