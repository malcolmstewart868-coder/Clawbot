type Props = {
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onRefresh: () => Promise<void>;
};

export function CommandStrip({ onStart, onStop, onRefresh }: Props) {
  const btn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#e2e8f0",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      <button style={btn} onClick={() => void onStart()}>START</button>
      <button style={btn} onClick={() => void onStop()}>STOP</button>
      <button style={btn} onClick={() => void onRefresh()}>REFRESH</button>
    </div>
  );
}