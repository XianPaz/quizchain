import { formatAddress } from "../utils/helpers";
import { COLORS } from "../styles/colors";

export default function WalletBar({ wallet, onConnect, onDisconnect, error, connecting }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 10, padding: "8px 14px",
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%", display: "inline-block",
          background: wallet ? COLORS.accent : COLORS.muted,
          boxShadow: wallet ? `0 0 8px ${COLORS.accent}` : "none",
        }} />
        {wallet ? (
          <>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: COLORS.text }}>
              {formatAddress(wallet.address)}
            </span>
            <span style={{ fontSize: 11, color: COLORS.muted }}>Sepolia</span>
            <button onClick={onDisconnect} style={{
              background: "transparent", border: `1px solid ${COLORS.border}`,
              borderRadius: 6, color: COLORS.muted, cursor: "pointer",
              fontSize: 11, padding: "4px 10px",
              fontFamily: "Space Grotesk, sans-serif",
            }}>
              Disconnect
            </button>
          </>
        ) : (
          <button onClick={onConnect} disabled={connecting} style={{
            background: connecting ? COLORS.border : COLORS.accent,
            color: connecting ? COLORS.muted : "#000",
            border: "none", borderRadius: 6,
            cursor: connecting ? "not-allowed" : "pointer",
            fontSize: 12, padding: "6px 14px", fontWeight: 700,
            fontFamily: "Space Grotesk, sans-serif",
          }}>
            {connecting ? "Connecting..." : "🦊 Connect MetaMask"}
          </button>
        )}
      </div>

      {/* Error message below the bar */}
      {error && (
        <div style={{
          background: `${COLORS.red}11`, border: `1px solid ${COLORS.red}44`,
          borderRadius: 6, padding: "6px 12px",
          color: COLORS.red, fontSize: 11, maxWidth: 320, textAlign: "right",
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}