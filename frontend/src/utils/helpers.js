import { REWARDS } from "../config";

export function normalizeAddress(addr) {
  if (!addr || typeof addr !== "string") return null;
  const trimmed = addr.trim();
  if (!trimmed || trimmed === "undefined") return null;
  return trimmed.toLowerCase();
}

export function sameAddress(a, b) {
  const left = normalizeAddress(a);
  const right = normalizeAddress(b);
  return !!left && left === right;
}

export function formatAddress(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function qtknForPlace(place) {
  const n = Number(place);
  if (!Number.isInteger(n) || n < 1) return REWARDS.QTKN_INCORRECT;
  if (n >= REWARDS.QTKN_BY_PLACE.length) return REWARDS.QTKN_FLOOR_CORRECT;
  return REWARDS.QTKN_BY_PLACE[n - 1];
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

