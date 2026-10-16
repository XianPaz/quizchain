import { COLORS } from "../styles/colors";
import { styles } from "../styles/styles";
import { formatAddress } from "../utils/helpers";
import { copy } from "../copy/es-AR";

export default function RejoinView({ savedSession, wallet, onRejoin, onLeave }) {
  return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "Space Grotesk, sans-serif",
    }}>
      <style>{styles}</style>

      <div className="slide-up" style={{
        opacity: 0, maxWidth: 420, width: "100%", textAlign: "center",
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎯</div>
        <h2 style={{
          fontFamily: "Orbitron, sans-serif", fontSize: 22,
          color: COLORS.text, marginBottom: 8,
        }}>
          {copy.rejoin.title}
        </h2>
        <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 32 }}>
          {copy.rejoin.body}
        </p>

        {/* Session info */}
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: 24, marginBottom: 24, textAlign: "left",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
                {copy.rejoin.quizName}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>
                {savedSession.quizData?.name}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
                {copy.rejoin.roomCode}
              </div>
              <div style={{
                fontFamily: "Orbitron, sans-serif", fontSize: 22,
                fontWeight: 900, color: COLORS.accent, letterSpacing: 1,
              }}>
                {savedSession.roomCode}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
                {copy.rejoin.wallet}
              </div>
              <div style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 13, color: COLORS.text,
              }}>
                {formatAddress(wallet?.address || savedSession.walletAddress)}
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={onRejoin}
            style={{
              background: COLORS.accent, color: "#000",
              border: "none", borderRadius: 10, padding: "14px",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              fontFamily: "Space Grotesk, sans-serif", width: "100%",
            }}>
            ▶ {copy.rejoin.rejoin}
          </button>
          <button
            onClick={onLeave}
            style={{
              background: "transparent", color: COLORS.muted,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10, padding: "12px",
              fontSize: 14, cursor: "pointer",
              fontFamily: "Space Grotesk, sans-serif", width: "100%",
            }}>
            ✕ {copy.rejoin.leave}
          </button>
        </div>
      </div>
    </div>
  );
}