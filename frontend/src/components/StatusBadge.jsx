import "./StatusBadge.css";

export default function StatusBadge({ connected }) {
  return (
    <div className="status-badge">
      <span className={`dot ${connected ? "on" : ""}`} />
      {connected ? "Live" : "Reconnecting…"}
    </div>
  );
}
