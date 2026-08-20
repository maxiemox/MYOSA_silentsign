#!/usr/bin/env python3
"""
server.py — SilentSign Phase 1 web dashboard + command editor.

Two jobs, one process:
  1. TCP server on --esp-port (default 5000): ESP32 connects here and streams
     newline-delimited JSON, e.g. {"gesture": "swipe_up", "confidence": 0.92}
     This side uses a plain threaded socket server (recv + manual buffering),
     the same approach as json_server.py, since that's the version that was
     confirmed to parse ESP32 payloads correctly. The previous asyncio
     StreamReader.readline()-based listener was producing gesture=None for
     every message — this file drops that path entirely.
  2. FastAPI app on --web-port (default 8000): serves the web UI, a REST API
     to view/add/edit/delete gesture->phrase commands, and a WebSocket that
     broadcasts every recognized gesture live to connected browsers.

Storage: SQLite file `commands.db` in the working directory. Table `commands`
has one row per gesture: (gesture TEXT PRIMARY KEY, phrase TEXT).

Run:
    pip install -r requirements.txt --break-system-packages
    python3 server.py --esp-port 5000 --web-port 8000

ESP32 side (unchanged from before): open a TCP connection to this host on
--esp-port and send one JSON object per line, newline-terminated.
"""

import argparse
import asyncio
import json
import socket
import sqlite3
import threading
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

DB_PATH = Path(__file__).parent / "commands.db"
# In production this points at the built React app (`npm run build` output).
# During development the React app runs separately on :5173 via `npm run dev`
# and proxies /api + /ws to this server, so this folder can be empty then.
STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)

# Accept these alternate key names too, in case firmware ever changes its
# field names — makes the parser tolerant instead of silently returning None.
# NOTE: "type" deliberately excluded here — on this firmware "type" is the
# MESSAGE CATEGORY ("gesture" | "environment"), not the gesture name itself.
GESTURE_KEYS = ("gesture", "gesture_name", "label", "value")
CONFIDENCE_KEYS = ("confidence", "conf", "score")


def timestamp():
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]


# ---------- storage ----------

def db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = db_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS commands (
            gesture TEXT PRIMARY KEY,
            phrase TEXT NOT NULL
        )"""
    )
    # Seed defaults matching the ESP32 firmware's actual gesture vocabulary.
    # "movement" type messages carry values like "ROLL RIGHT", "ROLL LEFT",
    # "TILT FORWARD", "TILT BACK" — stored lowercase to match normalization.
    defaults = [
        ("up", "Yes"),
        ("down", "No"),
        ("left", "I need help"),
        ("right", "Thank you"),
        ("roll right", "Yes"),
        ("roll left", "No"),
        ("tilt forward", "Please"),
        ("tilt back", "Stop"),
    ]
    cur = conn.execute("SELECT COUNT(*) FROM commands")
    if cur.fetchone()[0] == 0:
        conn.executemany(
            "INSERT INTO commands (gesture, phrase) VALUES (?, ?)", defaults
        )
    conn.commit()
    conn.close()


def get_commands():
    conn = db_conn()
    rows = conn.execute("SELECT gesture, phrase FROM commands ORDER BY gesture").fetchall()
    conn.close()
    return {row["gesture"]: row["phrase"] for row in rows}


def upsert_command(gesture: str, phrase: str):
    # Normalize the same way incoming ESP gesture values are normalized
    # (lowercased) so entries added via the UI actually match what the
    # ESP32 sends (it sends e.g. "UP", not "swipe_up").
    gesture = gesture.strip().lower()
    conn = db_conn()
    conn.execute(
        """INSERT INTO commands (gesture, phrase) VALUES (?, ?)
           ON CONFLICT(gesture) DO UPDATE SET phrase = excluded.phrase""",
        (gesture, phrase),
    )
    conn.commit()
    conn.close()


def delete_command(gesture: str):
    conn = db_conn()
    conn.execute("DELETE FROM commands WHERE gesture = ?", (gesture,))
    conn.commit()
    conn.close()


# ---------- websocket broadcast hub ----------

class Hub:
    def __init__(self):
        self.clients: set[WebSocket] = set()
        self.lock = asyncio.Lock()

    async def register(self, ws: WebSocket):
        async with self.lock:
            self.clients.add(ws)

    async def unregister(self, ws: WebSocket):
        async with self.lock:
            self.clients.discard(ws)

    async def broadcast(self, message: dict):
        dead = []
        async with self.lock:
            targets = list(self.clients)
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        if dead:
            async with self.lock:
                for ws in dead:
                    self.clients.discard(ws)


hub = Hub()

# Set once the FastAPI app starts, so the background TCP thread can safely
# schedule hub.broadcast() coroutines onto the asyncio event loop.
MAIN_LOOP: asyncio.AbstractEventLoop | None = None


def first_present(data: dict, keys: tuple[str, ...]):
    """Return the value of the first key in `keys` that exists in `data`
    (even if its value is falsy/0), else None."""
    for k in keys:
        if k in data:
            return data[k]
    return None


# ---------- threaded TCP listener for the ESP32 ----------
# Ported from json_server.py, which was confirmed to parse ESP32 payloads
# correctly (unlike the previous asyncio readline()-based listener here).

def handle_esp_client(conn: socket.socket, addr, esp_port: int):
    print(f"[esp] connected: {addr[0]}:{addr[1]}")
    buffer = ""
    with conn:
        conn.settimeout(60)
        while True:
            try:
                chunk = conn.recv(4096)
            except socket.timeout:
                print(f"[esp] {addr[0]}:{addr[1]} timed out, closing.")
                break
            except OSError:
                break
            if not chunk:
                break
            buffer += chunk.decode("utf-8", errors="replace")

            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError as e:
                    print(f"[esp] bad JSON from {addr[0]}:{addr[1]}: {e} -- raw: {line!r}")
                    continue

                # TEMP debug: shows exactly what the ESP sent, key names included.
                print(f"[esp] raw parsed: {data}")

                msg_type = data.get("type")  # "gesture" | "environment" | other

                # "movement" is the firmware's term for a gesture event —
                # treat it identically to "gesture" so ROLL RIGHT, ROLL LEFT, etc.
                # are dispatched to the browser instead of dropped.
                if msg_type in ("gesture", "movement"):
                    raw_gesture = first_present(data, GESTURE_KEYS)
                    gesture = (
                        str(raw_gesture).strip().lower()
                        if raw_gesture is not None
                        else None
                    )
                    confidence = first_present(data, CONFIDENCE_KEYS)
                    commands = get_commands()
                    phrase = commands.get(gesture, "(unknown gesture)")

                    event = {
                        "type": "gesture",
                        "gesture": gesture,
                        "phrase": phrase,
                        "confidence": confidence,
                        "device": data.get("device"),
                        "timestamp": datetime.now().isoformat(timespec="milliseconds"),
                    }

                elif msg_type == "environment":
                    # BMP180 telemetry — not a gesture event. Broadcast under
                    # its own type so the React UI can route it separately
                    # (e.g. a small sensor readout) instead of showing it as
                    # an unrecognized gesture.
                    event = {
                        "type": "environment",
                        "device": data.get("device"),
                        "temperature": data.get("temperature"),
                        "pressure": data.get("pressure"),
                        "altitude": data.get("altitude"),
                        "timestamp": datetime.now().isoformat(timespec="milliseconds"),
                    }

                else:
                    print(f"[esp] unrecognized message type {msg_type!r}, skipping: {data}")
                    continue

                print(f"[esp] {event}")

                if MAIN_LOOP is not None:
                    asyncio.run_coroutine_threadsafe(hub.broadcast(event), MAIN_LOOP)

    print(f"[esp] disconnected: {addr[0]}:{addr[1]}")


def run_esp_server(host: str, port: int):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as srv:
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind((host, port))
        srv.listen()
        print(f"[esp] listening on {host}:{port}")
        while True:
            conn, addr = srv.accept()
            t = threading.Thread(
                target=handle_esp_client, args=(conn, addr, port), daemon=True
            )
            t.start()


# ---------- FastAPI app ----------

ESP_HOST = "0.0.0.0"
ESP_PORT = 5000


@asynccontextmanager
async def lifespan(app: FastAPI):
    global MAIN_LOOP
    init_db()
    MAIN_LOOP = asyncio.get_running_loop()
    esp_thread = threading.Thread(
        target=run_esp_server, args=(ESP_HOST, ESP_PORT), daemon=True
    )
    esp_thread.start()
    yield
    # daemon thread; process exit cleans it up


app = FastAPI(lifespan=lifespan)

# Allows the Vite dev server (localhost:5173) to call this API during development.
# Not needed in production once the React build is served from this same app.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CommandIn(BaseModel):
    gesture: str
    phrase: str


@app.get("/api/commands")
def api_get_commands():
    return get_commands()


@app.post("/api/commands")
async def api_upsert_command(cmd: CommandIn):
    upsert_command(cmd.gesture.strip(), cmd.phrase.strip())
    await hub.broadcast({"type": "commands_updated", "commands": get_commands()})
    return {"ok": True, "commands": get_commands()}


@app.delete("/api/commands/{gesture}")
async def api_delete_command(gesture: str):
    delete_command(gesture)
    await hub.broadcast({"type": "commands_updated", "commands": get_commands()})
    return {"ok": True, "commands": get_commands()}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    await hub.register(ws)
    # send current state right away
    await ws.send_json({"type": "commands_updated", "commands": get_commands()})
    try:
        while True:
            await ws.receive_text()  # we don't expect client->server msgs, just keep alive
    except WebSocketDisconnect:
        pass
    finally:
        await hub.unregister(ws)


# Serves the built React app (index.html + /assets/*) for every other path.
# Build it with: cd silentsign_react && npm run build
# Then copy the contents of dist/ into this "static" folder.
# Must be mounted last so it doesn't shadow the /api and /ws routes above.
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    parser = argparse.ArgumentParser(description="SilentSign web dashboard + ESP bridge")
    parser.add_argument("--esp-port", type=int, default=5000, help="TCP port for ESP32 (default 5000)")
    parser.add_argument("--web-port", type=int, default=8000, help="HTTP port for web UI (default 8000)")
    args = parser.parse_args()

    ESP_PORT = args.esp_port
    uvicorn.run(app, host="0.0.0.0", port=args.web_port)