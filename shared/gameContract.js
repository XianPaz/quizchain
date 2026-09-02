"use strict";

// Shared game contract for QuizChain.
// Backend (CJS) and frontend (Vite) must speak this language.
// See docs/plan-ejecucion-suite-agentica.md — PR 1.

const GAME_PHASE = Object.freeze({
  LOBBY: "lobby",
  QUESTION_OPEN: "question_open",
  QUESTION_CLOSED: "question_closed",
  SHOWING_RESULTS: "showing_results",
  TRANSITION: "transition",
  FINALIZING: "finalizing",
  REVEALING_PODIUM: "revealing_podium",
  FINAL_RESULTS: "final_results",
  DISTRIBUTING_REWARDS: "distributing_rewards",
});

// session.status values still used by the running server.
const LEGACY_STATUS_TO_PHASE = Object.freeze({
  waiting: GAME_PHASE.LOBBY,
  active: GAME_PHASE.LOBBY,
  question_open: GAME_PHASE.QUESTION_OPEN,
  showing_stats: GAME_PHASE.SHOWING_RESULTS,
  finished: GAME_PHASE.FINAL_RESULTS,
  distributing: GAME_PHASE.DISTRIBUTING_REWARDS,
});

const EVENTS = Object.freeze({
  QUESTION_OPENED: "question_opened",
  DEADLINE: "question_deadline",
  ANSWER_SUBMITTED: "student_answer",
  QUESTION_CLOSED: "question_closed",
  PERSONAL_RESULT: "personal_result",
  PARTIAL_RANKING: "partial_ranking",
  HIGHLIGHT: "highlight",
  FINAL_RESULT: "final_result",
  PODIUM_REVEAL: "podium_reveal",
});

const CLOSE_REASON = Object.freeze({
  DEADLINE: "deadline",
  ALL_ANSWERED: "all_answered",
  HOST: "host",
});

const HIGHLIGHT_TYPE = Object.freeze({
  PODIUM_ENTRY: "podium_entry",
  PODIUM_CHANGE: "podium_change",
  BIG_CLIMB: "big_climb",
  STREAK: "streak",
  COLLECTIVE: "collective",
  FIRST_CORRECT: "first_correct",
});

const PODIUM = Object.freeze({
  GOLD: "gold",
  SILVER: "silver",
  BRONZE: "bronze",
});

// 1º → 21, 2º → 18, 3º → 16, then 15…11, 9º+ correct → 10. Wrong/timeout → 0.
const QTKN_BY_PLACE = Object.freeze([21, 18, 16, 15, 14, 13, 12, 11, 10]);
const QTKN_FIRST = 21;
const QTKN_FLOOR_CORRECT = 10;
const QTKN_INCORRECT = 0;

function phaseFromStatus(status) {
  if (!status) return GAME_PHASE.LOBBY;
  if (Object.values(GAME_PHASE).includes(status)) return status;
  return LEGACY_STATUS_TO_PHASE[status] || status;
}

function qtknForPlace(place) {
  const n = Number(place);
  if (!Number.isInteger(n) || n < 1) return QTKN_INCORRECT;
  if (n >= QTKN_BY_PLACE.length) return QTKN_FLOOR_CORRECT;
  return QTKN_BY_PLACE[n - 1];
}

function emptyPlayerScore() {
  return {
    questionQtkn: 0,
    totalQtkn: 0,
    rank: null,
    previousRank: null,
    gapToNext: 0,
    correct: 0,
    streak: 0,
    lastCorrect: false,
    lastPlace: null,
  };
}

function arrivalKey(data) {
  if (data && data.arrivalSeq != null) return { seq: Number(data.arrivalSeq), at: 0 };
  const at = data?.receivedAt ?? data?.answeredAt ?? Number.MAX_SAFE_INTEGER;
  return { seq: Number.MAX_SAFE_INTEGER, at };
}

function compareArrival(a, b) {
  const ka = arrivalKey(a);
  const kb = arrivalKey(b);
  if (ka.seq !== kb.seq) return ka.seq - kb.seq;
  if (ka.at !== kb.at) return ka.at - kb.at;
  return 0;
}

// Place is among correct answers, ordered by server arrival. Client clocks are ignored.
function awardQuestionQtkn({ answers, correctIndex }) {
  const result = {};
  Object.keys(answers || {}).forEach((address) => {
    result[address] = { qtkn: QTKN_INCORRECT, place: null, correct: false };
  });

  const correct = Object.entries(answers || {})
    .filter(([, data]) => data && data.answerIndex === correctIndex)
    .sort((a, b) => {
      const byArrival = compareArrival(a[1], b[1]);
      if (byArrival !== 0) return byArrival;
      return a[0].localeCompare(b[0]);
    });

  correct.forEach(([address], i) => {
    const place = i + 1;
    result[address] = { qtkn: qtknForPlace(place), place, correct: true };
  });

  return result;
}

function compareScoreRows(a, b) {
  if (b.totalQtkn !== a.totalQtkn) return b.totalQtkn - a.totalQtkn;
  if (b.correct !== a.correct) return b.correct - a.correct;
  return 0;
}

function scoreRow(address, score) {
  return {
    address,
    totalQtkn: Number(score?.totalQtkn ?? score?.totalTokens ?? 0),
    correct: Number(score?.correct ?? 0),
  };
}

// Competition ranking: equal QTKN + correct share a rank; the next rank skips (1, 2, 2, 4).
function rankPlayers(scores) {
  const rows = Object.entries(scores || {}).map(([address, score]) => scoreRow(address, score));
  rows.sort((a, b) => {
    const byScore = compareScoreRows(a, b);
    if (byScore !== 0) return byScore;
    return a.address.localeCompare(b.address);
  });

  let lastFingerprint = null;
  let lastRank = 0;
  return rows.map((row, i) => {
    const fingerprint = `${row.totalQtkn}:${row.correct}`;
    const rank = fingerprint === lastFingerprint ? lastRank : i + 1;
    lastFingerprint = fingerprint;
    lastRank = rank;
    return { ...row, rank };
  });
}

function withGaps(ranked) {
  return (ranked || []).map((row) => {
    const better = ranked.filter((other) => other.rank < row.rank);
    const nearest = better.length ? better[better.length - 1] : null;
    const tied = ranked.filter((other) => other.rank === row.rank).length > 1;
    return {
      ...row,
      gapToNext: nearest ? nearest.totalQtkn - row.totalQtkn : 0,
      playerAhead: nearest ? nearest.address : null,
      tied,
    };
  });
}

function applyQuestionScores({ scores, awards }) {
  const previousRanks = {};
  rankPlayers(scores).forEach((row) => {
    previousRanks[row.address] = row.rank;
  });

  const next = {};
  Object.entries(scores || {}).forEach(([address, score]) => {
    const award = awards?.[address] || { qtkn: 0, place: null, correct: false };
    const correct = !!award.correct;
    next[address] = {
      ...emptyPlayerScore(),
      ...score,
      questionQtkn: award.qtkn,
      totalQtkn: Number(score.totalQtkn ?? score.totalTokens ?? 0) + award.qtkn,
      correct: Number(score.correct ?? 0) + (correct ? 1 : 0),
      streak: correct ? Number(score.streak ?? 0) + 1 : 0,
      lastCorrect: correct,
      lastPlace: award.place,
      previousRank: previousRanks[address] ?? null,
    };
  });

  const ranking = withGaps(rankPlayers(next));
  ranking.forEach((row) => {
    if (!next[row.address]) return;
    next[row.address].rank = row.rank;
    next[row.address].gapToNext = row.gapToNext;
  });

  return { scores: next, ranking, previousRanks };
}

function podiumMedal(rank) {
  if (rank === 1) return PODIUM.GOLD;
  if (rank === 2) return PODIUM.SILVER;
  if (rank === 3) return PODIUM.BRONZE;
  return null;
}

function publicPodium(ranking, nicknames) {
  return (ranking || [])
    .filter((row) => row.rank <= 3)
    .map((row) => ({
      rank: row.rank,
      address: row.address,
      name: nicknames?.[row.address] || row.address,
      totalQtkn: row.totalQtkn,
      correct: row.correct,
      tied: !!row.tied,
      medal: podiumMedal(row.rank),
    }));
}

function personalResult({ address, scores, nicknames }) {
  const score = scores?.[address];
  if (!score) return null;
  const ranking = withGaps(rankPlayers(scores));
  const row = ranking.find((entry) => entry.address === address);
  const previousRank = score.previousRank ?? null;
  const rank = row?.rank ?? score.rank ?? null;
  const aheadAddress = row?.playerAhead || null;
  return {
    correct: !!score.lastCorrect,
    questionQtkn: score.questionQtkn ?? 0,
    totalQtkn: score.totalQtkn ?? 0,
    rank,
    previousRank,
    rankDelta: previousRank != null && rank != null ? previousRank - rank : 0,
    streak: score.streak ?? 0,
    gapToNext: row?.gapToNext ?? 0,
    playerAhead: aheadAddress
      ? { address: aheadAddress, name: nicknames?.[aheadAddress] || aheadAddress }
      : null,
  };
}

function canAcceptAnswer({
  phase,
  currentQuestion,
  questionIndex,
  alreadyAnswered,
  deadline,
  now,
}) {
  const resolved = phaseFromStatus(phase);
  if (resolved !== GAME_PHASE.QUESTION_OPEN) {
    return { ok: false, reason: "question_not_open" };
  }
  if (currentQuestion !== questionIndex) {
    return { ok: false, reason: "wrong_question" };
  }
  if (alreadyAnswered) {
    return { ok: false, reason: "duplicate" };
  }
  if (deadline != null && now > deadline) {
    return { ok: false, reason: "after_deadline" };
  }
  return { ok: true };
}

function questionOpenedPayload({ questionIndex, openedAt, timeLimit }) {
  const limit = Number(timeLimit) || 0;
  const opened = Number(openedAt);
  return {
    questionIndex,
    openedAt: opened,
    timeLimit: limit,
    deadline: opened + limit * 1000,
  };
}

function questionClosedPayload({ questionIndex, reason, closedAt }) {
  return { questionIndex, reason, closedAt };
}

function personalResultPayload({ questionIndex, result }) {
  return { questionIndex, ...result };
}

function partialRankingPayload({ questionIndex, ranking, nicknames }) {
  return {
    questionIndex,
    podium: publicPodium(ranking, nicknames),
  };
}

function finalResultPayload({ address, scores, nicknames, totalQuestions }) {
  const result = personalResult({ address, scores, nicknames });
  if (!result) return null;
  return {
    rank: result.rank,
    totalQtkn: result.totalQtkn,
    correct: scores[address]?.correct ?? 0,
    totalQuestions,
    podium: podiumMedal(result.rank),
    gapToNext: result.gapToNext,
    playerAhead: result.playerAhead,
  };
}

const gameContract = {
  GAME_PHASE,
  LEGACY_STATUS_TO_PHASE,
  EVENTS,
  CLOSE_REASON,
  HIGHLIGHT_TYPE,
  PODIUM,
  QTKN_BY_PLACE,
  QTKN_FIRST,
  QTKN_FLOOR_CORRECT,
  QTKN_INCORRECT,
  phaseFromStatus,
  qtknForPlace,
  emptyPlayerScore,
  awardQuestionQtkn,
  rankPlayers,
  withGaps,
  applyQuestionScores,
  podiumMedal,
  publicPodium,
  personalResult,
  canAcceptAnswer,
  questionOpenedPayload,
  questionClosedPayload,
  personalResultPayload,
  partialRankingPayload,
  finalResultPayload,
};

module.exports = gameContract;
