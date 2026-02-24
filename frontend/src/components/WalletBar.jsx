import { formatAddress } from "../utils/helpers";
import { COLORS } from "../styles/colors";

export default function WalletBar({ wallet, onConnect, onDisconnect }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderRadius: 10, padding: "8px 14px",
    }}>
      <span className="wallet-dot" style={{
        width: 8, height: 8, borderRadius: "50%", display: "inline-block",
        background: wallet ? COLORS.accent : COLORS.muted,
        boxShadow: wallet ? `0 0 8px ${COLORS.accent}` : "none",
      }} />
      {wallet ? (
        <>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: COLORS.text }}>
            {formatAddress(wallet.address)}
          </span>
          <div className="token-badge" style={{ fontSize: 11, padding: "3px 8px" }}>
            ⬡ {wallet.balance} QTKN
          </div>
          <span style={{ fontSize: 11, color: COLORS.muted }}>Sepolia</span>
          <button onClick={onDisconnect} className="btn btn-sm btn-secondary"
            style={{ padding: "4px 10px", fontSize: 11 }}>
            Disconnect
          </button>
        </>
      ) : (
        <button onClick={onConnect} className="btn btn-sm btn-primary"
          style={{ padding: "6px 14px", fontSize: 12 }}>
          🦊 Connect MetaMask
        </button>
      )}
    </div>
  );
}