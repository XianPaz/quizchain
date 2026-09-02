import { COLORS } from "../styles/colors";
import { getRankEmoji, sameAddress } from "../utils/helpers";
import { copy } from "../copy/es-AR";

export default function HighlightsBanner({ highlights, myAddress }) {
  if (!highlights) return null;

  const items = [];
  if (highlights.fastest) {
    items.push({
      key: "fastest",
      mine: sameAddress(highlights.fastest.address, myAddress),
      text: copy.highlights.firstCorrect(highlights.fastest.name, highlights.fastest.points),
    });
  }
  (highlights.climbers || []).slice(0, 2).forEach((c) => {
    items.push({
      key: `climb-${c.address}`,
      mine: sameAddress(c.address, myAddress),
      text: copy.highlights.climb(c.name, c.delta, c.fromRank, c.toRank),
    });
  });
  (highlights.podiumEntries || []).forEach((p) => {
    items.push({
      key: `podium-${p.address}`,
      mine: sameAddress(p.address, myAddress),
      text: `${getRankEmoji(p.rank)} ${copy.highlights.podium(p.name)}`,
    });
  });
  (highlights.streaks || []).slice(0, 2).forEach((s) => {
    items.push({
      key: `streak-${s.address}`,
      mine: sameAddress(s.address, myAddress),
      text: copy.highlights.streak(s.name, s.streak),
    });
  });

  if (items.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
      {items.map((item) => (
        <div
          key={item.key}
          style={{
            background: item.mine ? `${COLORS.accent}18` : COLORS.card,
            border: `1px solid ${item.mine ? COLORS.accent + "55" : COLORS.border}`,
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: item.mine ? 700 : 500,
            color: item.mine ? COLORS.accent : COLORS.text,
          }}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
}
