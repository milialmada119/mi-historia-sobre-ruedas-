"""Capa de acceso a datos: SQLite + utilidades de tiempo."""
from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
DB_PATH = os.path.join(DATA_DIR, "mhsr.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  avatar        TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cars (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand         TEXT NOT NULL,
  model         TEXT NOT NULL,
  year          INTEGER,
  nickname      TEXT,
  color         TEXT,
  description   TEXT,
  purchase_date TEXT,
  sold_date     TEXT,
  status        TEXT NOT NULL DEFAULT 'current',
  photo         TEXT,
  favorite      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS car_photos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id     INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  caption    TEXT,
  taken_at   TEXT,
  favorite   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS modifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id      INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT 'otras',
  title       TEXT NOT NULL,
  description TEXT,
  date        TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS modification_photos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  modification_id INTEGER NOT NULL REFERENCES modifications(id) ON DELETE CASCADE,
  path            TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'after',
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS story_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id     INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  section    TEXT NOT NULL DEFAULT 'libre',
  title      TEXT,
  body       TEXT,
  date       TEXT,
  featured   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS story_photos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id   INTEGER NOT NULL REFERENCES story_entries(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  favorite   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cars_user ON cars(user_id);
CREATE INDEX IF NOT EXISTS idx_mods_car ON modifications(car_id);
CREATE INDEX IF NOT EXISTS idx_story_car ON story_entries(car_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 8000")
    return conn


def init() -> None:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    conn = connect()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def rows(cur) -> list[dict]:
    return [dict(r) for r in cur.fetchall()]


def row(cur) -> dict | None:
    r = cur.fetchone()
    return dict(r) if r else None
