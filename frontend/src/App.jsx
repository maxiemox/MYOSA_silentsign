import { useSilentSignSocket } from "./hooks/useSilentSignSocket";
import LivePanel from "./components/LivePanel";
import CommandTable from "./components/CommandTable";
import StatusBadge from "./components/StatusBadge";
import "./App.css";

export default function App() {
  const { connected, commands, lastEvent, envData, log, saveCommand, deleteCommand } =
    useSilentSignSocket();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>SilentSign</h1>
          <p className="tagline">Gesture recognition, spoken live</p>
        </div>
        <StatusBadge connected={connected} />
      </header>

      <main className="app-grid">
        <LivePanel lastEvent={lastEvent} envData={envData} log={log} />
        <CommandTable
          commands={commands}
          saveCommand={saveCommand}
          deleteCommand={deleteCommand}
        />
      </main>
    </div>
  );
}
