import React from "react";
function App() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>🐾 Clawbot Control Panel</h1>
      <p>Status: <strong>Connected</strong></p>

      <button
  onClick={async () => {
    const res = await fetch("/api/start", { method: "POST" });
    alert("Started: " + (await res.text()));
  }}
>
  Start Runner
</button>

<button
  style={{ marginLeft: 12 }}
  onClick={async () => {
    const res = await fetch("/api/stop", { method: "POST" });
    alert("Stopped: " + (await res.text()));
  }}
>
  Stop Runner
</button>

    </div>
  );
}

export default App;
