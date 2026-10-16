import { styles } from "../styles/styles";
import { COLORS } from "../styles/colors";
import { useState } from "react";
import { formatAddress } from "../utils/helpers";
import { normalizeRoomCode } from "../api";
import { copy } from "../copy/es-AR";

export default function JoinView({ wallet, onJoin, onBack, onConnectWallet, activeSessions, walletError, connecting }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [nickname, setNickname] = useState("");

  const handleJoin = async () => {
    // Validate wallet
    if (!wallet?.address) {
      setError(copy.join.missingWallet);
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet.address)) {
      setError(copy.join.badWallet);
      return;
    }
    if (!nickname.trim()) {
      setError(copy.join.missingNickname);
      return;
    }
    const trimmed = normalizeRoomCode(code);
    if (trimmed.split(" ").filter(Boolean).length !== 2) {
      setError(copy.join.shortCode);
      return;
    }

    setJoining(true);
    const result = await onJoin(trimmed, nickname.trim());
    if (result?.error) {
      setError(result.error);
      setJoining(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: 24,
    }}>
      <style>{styles}</style>
      <button onClick={onBack} className="btn btn-secondary btn-sm"
        style={{ position: "fixed", top: 20, left: 20 }}>
        ← {copy.hostDashboard.back}
      </button>

      <div className="slide-up" style={{ opacity: 0, maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>👾</div>
        <h2 style={{ fontFamily: "Orbitron", fontSize: 24, marginBottom: 8, color: COLORS.accent }}>
          {copy.join.title}
        </h2>
        <p style={{ color: COLORS.muted, marginBottom: 32, fontSize: 14 }}>
          {copy.join.subtitle}
        </p>

        {!wallet ? (
          <div className="card" style={{ marginBottom: 20 }}>
            <p style={{ color: COLORS.yellow, fontSize: 13, marginBottom: 12 }}>
              ⚠️ {copy.join.connectFirst}
            </p>
            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={onConnectWallet}
              disabled={connecting}
            >
              {connecting ? copy.wallet.connecting : `🦊 ${copy.wallet.connect}`}
            </button>
            {walletError && (
              <div style={{
                marginTop: 10, color: COLORS.red, fontSize: 12,
                background: `${COLORS.red}11`, border: `1px solid ${COLORS.red}33`,
                borderRadius: 6, padding: "8px 10px",
              }}>
                ⚠️ {walletError}
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{
            marginBottom: 20, borderColor: `${COLORS.accent}44`,
            background: "#00ff8808", textAlign: "left",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%", background: COLORS.accent,
                display: "inline-block", boxShadow: `0 0 6px ${COLORS.accent}`,
              }} />
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: COLORS.text }}>
                {formatAddress(wallet.address)}
              </span>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 6 }}>
            {copy.join.nickname}
          </label>
          <input
            className="input"
            placeholder={copy.join.nicknamePlaceholder}
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            maxLength={20}
            style={{ fontSize: 16 }}
          />
        </div>

        <input
          className="input"
          placeholder={copy.join.codePlaceholder}
          value={code}
          onChange={e => { setCode(e.target.value); setError(""); }}
          style={{ textAlign: "center", fontSize: 22, letterSpacing: 1, fontFamily: "Orbitron", marginBottom: 8 }}
          maxLength={40}
        />

        {/* Error message */}
        {error && (
          <div style={{
            background: "#f8717111",
            border: "1px solid #f8717144",
            borderRadius: 8,
            padding: "10px 14px",
            color: "#f87171",
            fontSize: 13,
            marginBottom: 12,
            textAlign: "left",
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          className="btn btn-primary btn-lg"
          style={{ width: "100%" }}
          onClick={handleJoin}
          disabled={normalizeRoomCode(code).split(" ").filter(Boolean).length !== 2 || !nickname.trim() || joining}
        >
          {joining ? copy.join.joining : `${copy.join.join} →`}
        </button>
      </div>
    </div>
  );
}
