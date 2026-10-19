// Arma lo que el profe firma en mintPodiumBatch: una medalla por alumno del podio.
// El puesto es el del servidor (con empates), así que puede haber más de tres.

const TEXT_MAX = 64;

// El contrato rechaza los bytes de control y la medalla no se puede re-mintear:
// mejor limpiarlos acá que perder la transacción entera por un apodo.
function isAllowedChar(ch) {
  const code = ch.charCodeAt(0);
  return code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
}

function cleanText(text) {
  return Array.from(String(text ?? ""))
    .filter(isAllowedChar)
    .join("")
    .trim()
    .slice(0, TEXT_MAX);
}

function qtknOf(score) {
  return score.totalQtkn ?? score.totalTokens ?? 0;
}

export function buildPodiumMint({ scores, players, quiz }) {
  const names = {};
  (players || []).forEach((p) => {
    names[String(p.address).toLowerCase()] = p.name;
  });

  const rows = Object.entries(scores || {})
    .map(([address, score]) => ({ address, ...score }))
    .filter((row) => /^0x[0-9a-fA-F]{40}$/.test(row.address))
    .filter((row) => row.rank >= 1 && row.rank <= 3 && qtknOf(row) > 0)
    .sort((a, b) => a.rank - b.rank || a.address.localeCompare(b.address));

  const quizName = cleanText(quiz?.name);
  const className = cleanText(quiz?.className) || quizName;
  const totalQuestions = quiz?.questions?.length ?? 0;

  return {
    recipients: rows.map((row) => row.address),
    inputs: rows.map((row) => ({
      sessionId: quiz?.sessionId,
      quizName,
      className,
      date: quiz?.date,
      rank: row.rank,
      qtkn: Math.round(qtknOf(row)),
      correct: row.correct ?? 0,
      totalQuestions,
      nickname: cleanText(names[row.address.toLowerCase()]) || row.address,
    })),
  };
}

// Medallas que el contrato emitió, en el formato que guarda el servidor.
export function podiumTokensFromEvents(events) {
  return (events || []).map((ev) => ({
    address: String(ev.student).toLowerCase(),
    tokenId: String(ev.tokenId),
    rank: Number(ev.rank),
  }));
}

export function myPodiumToken(podium, address) {
  if (!podium || !address) return null;
  const me = String(address).toLowerCase();
  return (podium.tokens || []).find((t) => t.address === me) || null;
}
