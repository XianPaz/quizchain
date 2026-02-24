import WalletBar from "../components/WalletBar";
import { styles } from "../styles/styles";
import { COLORS } from "../styles/colors";
import React from "react";

export default function LandingView({ onHostQuiz, onJoinQuiz, wallet, onConnectWallet }) {
  return (
    <div className="grid-bg noise" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{styles}</style>

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "20px 32px", borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bg + "cc", backdropFilter: "blur(10px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, background: COLORS.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 900, color: "#000",
          }}>Q</div>
          <span className="brand" style={{ fontSize: 18, color: COLORS.accent, letterSpacing: 2 }}>
            QUIZCHAIN
          </span>
        </div>
        <WalletBar wallet={wallet} onConnect={onConnectWallet} onDisconnect={() => {}} />
      </div>

      {/* Hero */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "80px 24px", textAlign: "center",
      }}>
        <div className="slide-up" style={{ animationDelay: "0.1s", opacity: 0 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: `${COLORS.accent}11`, border: `1px solid ${COLORS.accent}33`,
            borderRadius: 999, padding: "6px 14px", marginBottom: 24,
          }}>
            <span style={{ color: COLORS.accent, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
              ⬡ POWERED BY SEPOLIA TESTNET
            </span>
          </div>
        </div>

        <div className="slide-up" style={{ animationDelay: "0.2s", opacity: 0 }}>
          <h1 style={{
            fontFamily: "Orbitron", fontWeight: 900, fontSize: "clamp(40px, 7vw, 80px)",
            lineHeight: 1.1, marginBottom: 24, letterSpacing: "-1px",
          }}>
            <span style={{ color: COLORS.text }}>QUIZ.</span>
            <br />
            <span style={{
              background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.blue})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>COMPETE.</span>
            <br />
            <span style={{ color: COLORS.text }}>EARN.</span>
          </h1>
        </div>

        <div className="slide-up" style={{ animationDelay: "0.3s", opacity: 0 }}>
          <p style={{
            color: COLORS.muted, fontSize: 18, maxWidth: 520, lineHeight: 1.6, marginBottom: 48,
          }}>
            Real-time quiz battles where speed matters. Answer fast, earn more{" "}
            <span style={{ color: COLORS.accent, fontWeight: 700 }}>QTKN tokens</span>{" "}
            distributed directly to your wallet on Sepolia.
          </p>
        </div>

        <div className="slide-up" style={{
          animationDelay: "0.4s", opacity: 0,
          display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center",
        }}>
          <button className="btn btn-primary btn-lg" onClick={onHostQuiz}
            style={{ fontSize: 16, letterSpacing: 1 }}>
            🎯 Host a Quiz
          </button>
          <button className="btn btn-secondary btn-lg" onClick={onJoinQuiz}>
            👥 Join a Quiz
          </button>
        </div>

        {/* Stats row */}
        <div className="slide-up" style={{
          animationDelay: "0.5s", opacity: 0,
          display: "flex", gap: 40, marginTop: 80, flexWrap: "wrap", justifyContent: "center",
        }}>
          {[
            { label: "Base Reward", value: "10 QTKN", sub: "per correct answer" },
            { label: "Speed Multiplier", value: "2×", sub: "instant answer" },
            { label: "Participation Bonus", value: "5 QTKN", sub: "just for finishing" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Orbitron", fontSize: 28, fontWeight: 900, color: COLORS.accent }}>
                {s.value}
              </div>
              <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 14 }}>{s.label}</div>
              <div style={{ color: COLORS.muted, fontSize: 12 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Feature cards */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16, marginTop: 80, maxWidth: 900, width: "100%",
        }}>
          {[
            { icon: "⚡", title: "Speed-Based Rewards", desc: "The faster you answer correctly, the more QTKN you earn. Instant answers get 2× multiplier." },
            { icon: "🦊", title: "MetaMask Integration", desc: "Connect your wallet on Sepolia testnet. Tokens are minted directly to your address." },
            { icon: "🎮", title: "Real-Time Gameplay", desc: "Compete live with a countdown timer. See the leaderboard update after every question." },
            { icon: "📝", title: "Custom Quizzes", desc: "Hosts create quizzes with custom questions, time limits, and answer choices." },
          ].map((f) => (
            <div key={f.title} className="card slide-up" style={{
              textAlign: "left", animationDelay: "0.6s", opacity: 0,
              border: `1px solid ${COLORS.border}`,
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{f.title}</div>
              <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
