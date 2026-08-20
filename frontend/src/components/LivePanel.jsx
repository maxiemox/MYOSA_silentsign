import { useEffect, useRef, useState } from "react";
import "./LivePanel.css";

/**
 * Speaks a phrase using the Web Speech API.
 * Uses setTimeout after cancel() to work around a Chrome bug where
 * calling speak() immediately after cancel() silently drops the utterance.
 */
function speakPhrase(phrase) {
  if (!window.speechSynthesis) {
    console.warn("[TTS] speechSynthesis not available in this browser.");
    return;
  }
  window.speechSynthesis.cancel();
  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.onstart = () => console.log("[TTS] speaking:", phrase);
    utterance.onerror = (e) => console.error("[TTS] error:", e.error, phrase);
    utterance.onend = () => console.log("[TTS] done:", phrase);
    window.speechSynthesis.speak(utterance);
  }, 100);
}

export default function LivePanel({ lastEvent, envData, log }) {
  const [pulseKey, setPulseKey] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const lastSpokenRef = useRef(null);

  useEffect(() => {
    if (lastEvent) setPulseKey((k) => k + 1);
  }, [lastEvent]);

  // Speak the phrase whenever a new gesture event arrives
  useEffect(() => {
    if (!lastEvent || !ttsEnabled) return;
    // Guard: don't re-speak the same event on re-renders
    if (lastSpokenRef.current === lastEvent.timestamp) return;
    lastSpokenRef.current = lastEvent.timestamp;

    const phrase = lastEvent.phrase;
    if (!phrase || phrase === "(unknown gesture)") return;

    console.log("[TTS] triggered for phrase:", phrase);
    speakPhrase(phrase);
  }, [lastEvent, ttsEnabled]);

  return (
    <section className="live-panel">
      <div className="live-panel-header">
        <h2 className="eyebrow">Now speaking</h2>
        <div className="tts-controls">
          <button
            className={`tts-toggle ${ttsEnabled ? "tts-on" : "tts-off"}`}
            onClick={() => setTtsEnabled((v) => !v)}
            title={ttsEnabled ? "Mute TTS" : "Unmute TTS"}
            aria-label={ttsEnabled ? "Mute text-to-speech" : "Enable text-to-speech"}
          >
            {ttsEnabled ? "🔊 TTS On" : "🔇 TTS Off"}
          </button>
          <button
            className="tts-test"
            onClick={() => speakPhrase("Text to speech is working")}
            title="Test TTS"
          >
            Test
          </button>
        </div>
      </div>

      <div className="phrase-stage">
        <p className="phrase" key={lastEvent ? lastEvent.timestamp : "idle"}>
          {lastEvent ? lastEvent.phrase : "Waiting for a gesture…"}
        </p>
        <Waveform active={!!lastEvent} pulseKey={pulseKey} />
      </div>

      {lastEvent && (
        <div className="phrase-meta">
          <span className="gesture-id">{lastEvent.gesture}</span>
          {lastEvent.confidence != null && (
            <span className="confidence">
              {Math.round(lastEvent.confidence * 100)}% confidence
            </span>
          )}
          <span className="time">{formatTime(lastEvent.timestamp)}</span>
        </div>
      )}

      {envData && (
        <div className="env-meta">
          <span className="env-title">Sensor (BMP180):</span>
          {envData.temperature != null && (
            <span className="env-item">{envData.temperature}°C</span>
          )}
          {envData.pressure != null && (
            <span className="env-item">{envData.pressure} hPa</span>
          )}
          {envData.altitude != null && (
            <span className="env-item">{envData.altitude}m</span>
          )}
        </div>
      )}

      <h3 className="eyebrow log-heading">Recent events</h3>
      <div className="event-log">
        {log.length === 0 && <div className="empty-log">No gestures received yet.</div>}
        {log.map((evt, i) => (
          <div className="event-row" key={`${evt.timestamp}-${i}`}>
            <span className="time">{formatTime(evt.timestamp)}</span>
            <span className="gesture-id">{evt.gesture}</span>
            <span className="arrow">→</span>
            <span className="event-phrase">{evt.phrase}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Waveform({ active, pulseKey }) {
  const bars = 24;
  return (
    <div className="waveform" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={`${pulseKey}-${i}`}
          className={`bar ${active ? "pulse" : ""}`}
          style={{ animationDelay: `${(i % 8) * 35}ms` }}
        />
      ))}
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour12: false });
}
