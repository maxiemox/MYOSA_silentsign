import { useEffect, useRef, useState, useCallback } from "react";

const MAX_LOG = 50;

export function useSilentSignSocket() {
  const [connected, setConnected] = useState(false);
  const [commands, setCommands] = useState({});
  const [lastEvent, setLastEvent] = useState(null);
  const [envData, setEnvData] = useState(null);
  const [log, setLog] = useState([]);
  const wsRef = useRef(null);
  const retryTimer = useRef(null);

  const fetchCommands = useCallback(async () => {
    try {
      const res = await fetch("/api/commands");
      if (res.ok) {
        const data = await res.json();
        setCommands(data);
      }
    } catch (err) {
      console.error("Failed to fetch commands from backend API:", err);
    }
  }, []);

  const connect = useCallback(() => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${proto}://${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      retryTimer.current = setTimeout(() => {
        connect();
      }, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "gesture") {
          setLastEvent(msg);
          setLog((prev) => [msg, ...prev].slice(0, MAX_LOG));
        } else if (msg.type === "environment") {
          setEnvData(msg);
        } else if (msg.type === "commands_updated") {
          if (msg.commands) {
            setCommands(msg.commands);
          }
        }
      } catch (e) {
        console.error("Error parsing WebSocket message:", e);
      }
    };
  }, []);

  useEffect(() => {
    connect();
    fetchCommands();

    return () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, fetchCommands]);

  const saveCommand = useCallback(async (gesture, phrase) => {
    try {
      const res = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gesture: gesture.trim(), phrase: phrase.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.commands) {
          setCommands(data.commands);
        }
      }
    } catch (err) {
      console.error("Failed to save command via backend API:", err);
    }
  }, []);

  const deleteCommand = useCallback(async (gesture) => {
    try {
      const res = await fetch(`/api/commands/${encodeURIComponent(gesture)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.commands) {
          setCommands(data.commands);
        }
      }
    } catch (err) {
      console.error("Failed to delete command via backend API:", err);
    }
  }, []);

  return {
    connected,
    commands,
    lastEvent,
    envData,
    log,
    saveCommand,
    deleteCommand,
    refreshCommands: fetchCommands,
  };
}

