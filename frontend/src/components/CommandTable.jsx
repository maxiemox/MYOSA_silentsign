import { useState } from "react";
import "./CommandTable.css";

export default function CommandTable({ commands, saveCommand, deleteCommand }) {
  const [newGesture, setNewGesture] = useState("");
  const [newPhrase, setNewPhrase] = useState("");
  const entries = Object.entries(commands).sort(([a], [b]) => a.localeCompare(b));

  async function handleAdd(e) {
    e.preventDefault();
    const gesture = newGesture.trim();
    const phrase = newPhrase.trim();
    if (!gesture || !phrase) return;
    await saveCommand(gesture, phrase);
    setNewGesture("");
    setNewPhrase("");
  }

  return (
    <section className="command-table">
      <h2 className="eyebrow">Gesture vocabulary</h2>

      {entries.length === 0 ? (
        <div className="empty-state">
          No commands yet. Add the first gesture below.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Gesture</th>
              <th>Spoken phrase</th>
              <th aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([gesture, phrase]) => (
              <CommandRow
                key={gesture}
                gesture={gesture}
                phrase={phrase}
                onSave={(p) => saveCommand(gesture, p)}
                onDelete={() => deleteCommand(gesture)}
              />
            ))}
          </tbody>
        </table>
      )}

      <form className="add-row" onSubmit={handleAdd}>
        <input
          placeholder="gesture id, e.g. tilt_left"
          value={newGesture}
          onChange={(e) => setNewGesture(e.target.value)}
          aria-label="New gesture id"
        />
        <input
          placeholder="phrase to speak"
          value={newPhrase}
          onChange={(e) => setNewPhrase(e.target.value)}
          aria-label="New phrase"
        />
        <button type="submit">Add</button>
      </form>
    </section>
  );
}

function CommandRow({ gesture, phrase, onSave, onDelete }) {
  const [value, setValue] = useState(phrase);
  const [saved, setSaved] = useState(false);

  async function commit() {
    if (value.trim() === phrase) return;
    await onSave(value.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1000);
  }

  return (
    <tr>
      <td className="gesture-cell">{gesture}</td>
      <td>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={saved ? "saved" : ""}
        />
      </td>
      <td>
        <button className="danger" onClick={onDelete} type="button">
          Delete
        </button>
      </td>
    </tr>
  );
}
