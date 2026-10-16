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

export function calcPlacementPoints(place) {
  return qtknForPlace(place);
}

export function pointsToTokens(qtkn) {
  return Number(qtkn) || 0;
}

export function placeLabel(place) {
  if (!place) return "";
  const n = Number(place);
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

export function getRankEmoji(rank) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
}
