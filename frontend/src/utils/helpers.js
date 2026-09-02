// The wallet, QTKN and ranking rules live in shared/gameContract.js, so the
// professor screen, the student screen and the server always agree.
import {
  normalizeAddress,
  sameAddress,
  qtknForPlace,
} from "../game/contract";

export { normalizeAddress, sameAddress, qtknForPlace };

export function formatAddress(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function pointsToTokens(qtkn) {
  return Number(qtkn) || 0;
}

// Ordinal en español: 1º, 2º, 3º.
export function placeLabel(place) {
  if (!place) return "";
  return `${Number(place)}º`;
}

export function getRankEmoji(rank) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
}
