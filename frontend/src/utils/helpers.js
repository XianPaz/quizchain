import { REWARDS } from "../config";

export function formatAddress(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function calcSpeedScore(timeRemaining, timeLimit) {
  return Math.round((timeRemaining / timeLimit) * 100);
}

export function calcTokenReward(correct, speedScores, totalQuestions) {
  if (correct === 0) return 5;
  const avgSpeed = speedScores.reduce((a, b) => a + b, 0) / speedScores.length;
  const accuracyPct = (correct / totalQuestions) * 100;
  const base = correct * 10;
  const speedBonus = (base * avgSpeed * 2) / 100;
  return Math.round((base + speedBonus) * (accuracyPct / 100) + 5);
}

export function getRankEmoji(rank) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
}

