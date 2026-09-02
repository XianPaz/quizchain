import { COLORS } from "../styles/colors";
import { formatAddress, getRankEmoji, sameAddress } from "../utils/helpers";
import { copy } from "../copy/es-AR.js";
import { rankedScores } from "../utils/ranking";

export default function Leaderboard({ scores, players, quiz, myAddress = null }) {
  const sorted = rankedScores(scores);
  const nicknameMap = {};
  (players || []).forEach((p) => { nicknameMap[p.address] = p.name; });

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted, marginBottom: 10 }}>
        {copy.game.leaderboard}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((p, i) => {
          const isMe = !!myAddress && sameAddress(p.address, myAddress);
          return (
            <div key={p.address} style={{
              display: "flex", alignItems: "center", gap: 12,
              background: isMe ? `${COLORS.accent}11` : COLORS.card,
              border: `1px solid ${isMe ? COLORS.accent + "44" : COLORS.border}`,
              borderRadius: 10, padding: "10px 14px",
            }}>
              <span style={{ fontSize: 16, width: 28 }}>{getRankEmoji(p.rank ?? i + 1)}</span>
              <span style={{
                flex: 1, fontSize: 14, fontWeight: isMe ? 700 : 600,
                color: isMe ? COLORS.accent : COLORS.text,
              }}>
                {nicknameMap[p.address] || formatAddress(p.address)}
                {isMe && <span style={{ color: COLORS.muted, fontSize: 11 }}> ({copy.game.you})</span>}
              </span>
              <span style={{ color: COLORS.muted, fontSize: 12 }}>
                {quiz ? copy.game.correctOf(p.correct, quiz.questions.length) : `${p.correct}`}
                {p.streak >= 3 ? ` · 🔥${p.streak}` : ""}
              </span>
              <span style={{
                background: `${COLORS.accent}22`, border: `1px solid ${COLORS.accent}44`,
                borderRadius: 6, padding: "3px 8px",
                fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: COLORS.accent,
              }}>
                {p.totalQtkn ?? p.totalTokens ?? "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
