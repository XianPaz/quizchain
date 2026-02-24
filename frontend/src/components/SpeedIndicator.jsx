import { COLORS } from "../styles/colors";

export default function SpeedIndicator({ speedPct }) {
  const color = speedPct > 70 ? COLORS.accent : speedPct > 40 ? COLORS.yellow : COLORS.red;
  const label = speedPct > 70 ? "⚡ Lightning" : speedPct > 40 ? "🔥 Fast" : "🐌 Slow";
  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: COLORS.muted }}>Speed bonus</span>
        <span style={{ color, fontWeight: 700 }}>{label} ({speedPct}%)</span>
      </div>
      <div className="speed-bar">
        <div className="speed-fill" style={{ width: `${speedPct}%`, background: color }} />
      </div>
    </div>
  );
}

