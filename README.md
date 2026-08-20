# SilentSign Dashboard

Two pieces:

- **backend/** — FastAPI app. Listens for the ESP32 over raw TCP, stores the
  gesture→phrase vocabulary in SQLite, and pushes live gesture events to the
  browser over WebSocket.
- **frontend/** — React (Vite) dashboard. Shows the currently spoken phrase
  live, a scrolling event log, and an editable command table.

## Development (two servers, hot reload)

```bash
# terminal 1 — backend
cd backend
pip install -r requirements.txt --break-system-packages
python3 server.py --esp-port 5000 --web-port 8000

# terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` and `/ws` to the backend on
:8000 (see `frontend/vite.config.js`).

## Production (single server, single port)

```bash
cd frontend
npm install
npm run build
cp -r dist/* ../backend/static/

cd ../backend
pip install -r requirements.txt --break-system-packages
python3 server.py --esp-port 5000 --web-port 8000
```

Open http://<pi-ip>:8000 — the backend now serves the built React app
directly, so only one port needs to be reachable at the demo table.

## ESP32 side

Unchanged: connect via TCP to `--esp-port` (default 5000) and send one JSON
object per line, newline-terminated:

```cpp
WiFiClient client;
client.connect(serverIP, 5000);
client.print("{\"gesture\":\"swipe_up\",\"confidence\":0.92}\n");
```

The gesture id must match a row in the command table (edit it from the web
UI) or it'll show as "(unknown gesture)" on the live panel.
