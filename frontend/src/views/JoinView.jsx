import { styles } from "../styles/styles";
import { COLORS } from "../styles/colors";
import { useState } from "react";
import { formatAddress } from "../utils/helpers";

export default function JoinView({ wallet, onJoin, onBack, onConnectWallet, activeSessions }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [nickname, setNickname] = useState("");

  const handleJoin = async () => {
    if (!wallet?.address) {
      setError("Please connect your MetaMask wallet before joining.");
      return;
    }
    
    const trimmed = code.trim().toUpperCase();

    if (!nickname.trim()) {
      setError("Please enter a nickname.");
      return;
    }
    if (trimmed.length < 4) {
      setError("Room code is too short.");
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
        ← Back
      </button>

      <div className="slide-up" style={{ opacity: 0, maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>👾</div>
        <h2 style={{ fontFamily: "Orbitron", fontSize: 24, marginBottom: 8, color: COLORS.accent }}>
          JOIN QUIZ
        </h2>
        <p style={{ color: COLORS.muted, marginBottom: 32, fontSize: 14 }}>
          Enter the room code provided by your host
        </p>

        {!wallet ? (
          <div className="card" style={{ marginBottom: 20 }}>
            <p style={{ color: COLORS.yellow, fontSize: 13, marginBottom: 12 }}>
              ⚠️ Connect your wallet first to earn QTKN rewards
            </p>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={onConnectWallet}>
              🦊 Connect MetaMask
            </button>
          </div>
        ) : (
          <div className="card" style={{
            marginBottom: 20, borderColor: `${COLORS.accent}44`,
            background: "#00ff8808", textAlign: "left",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.accent, display: "inline-block", boxShadow: `0 0 6px ${COLORS.accent}` }} />
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 13 }}>
                {formatAddress(wallet.address)}
              </span>
              <span style={{ marginLeft: "auto" }} className="token-badge">
                ⬡ {wallet.balance} QTKN
              </span>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 6 }}>
            YOUR NICKNAME
          </label>
          <input
            className="input"
            placeholder="Enter your nickname..."
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            maxLength={20}
            style={{ fontSize: 16 }}
          />
        </div>

        <input
          className="input"
          placeholder="Enter room code (e.g. AB12CD)"
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
          style={{ textAlign: "center", fontSize: 24, letterSpacing: 8, fontFamily: "Orbitron", marginBottom: 8 }}
          maxLength={6}
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
          disabled={code.length < 4 || !nickname.trim() || joining}
        >
          {joining ? "Joining..." : "Join Room →"}
        </button>
      </div>
    </div>
  );
}
