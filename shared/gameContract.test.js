"use strict";

const assert = require("assert");
const {
  GAME_PHASE,
  EVENTS,
  CLOSE_REASON,
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
  finalResultPayload,
} = require("./gameContract");

// ── Curve ───────────────────────────────────────────────────────────────────
assert.strictEqual(qtknForPlace(1), 21);
assert.strictEqual(qtknForPlace(2), 18);
assert.strictEqual(qtknForPlace(3), 16);
assert.strictEqual(qtknForPlace(4), 15);
assert.strictEqual(qtknForPlace(5), 14);
assert.strictEqual(qtknForPlace(6), 13);
assert.strictEqual(qtknForPlace(7), 12);
assert.strictEqual(qtknForPlace(8), 11);
assert.strictEqual(qtknForPlace(9), 10);
assert.strictEqual(qtknForPlace(10), 10);
assert.strictEqual(qtknForPlace(99), 10);
assert.strictEqual(qtknForPlace(0), 0);
assert.strictEqual(qtknForPlace(null), 0);
assert.strictEqual(qtknForPlace(-1), 0);
assert.deepStrictEqual(QTKN_BY_PLACE, [21, 18, 16, 15, 14, 13, 12, 11, 10]);
assert.strictEqual(QTKN_FIRST, 21);
assert.strictEqual(QTKN_FLOOR_CORRECT, 10);
assert.strictEqual(QTKN_INCORRECT, 0);

// ── Phase mapping ───────────────────────────────────────────────────────────
assert.strictEqual(phaseFromStatus("waiting"), GAME_PHASE.LOBBY);
assert.strictEqual(phaseFromStatus("active"), GAME_PHASE.LOBBY);
assert.strictEqual(phaseFromStatus("showing_stats"), GAME_PHASE.SHOWING_RESULTS);
assert.strictEqual(phaseFromStatus("finished"), GAME_PHASE.FINAL_RESULTS);
assert.strictEqual(phaseFromStatus("distributing"), GAME_PHASE.DISTRIBUTING_REWARDS);
assert.strictEqual(phaseFromStatus(GAME_PHASE.REVEALING_PODIUM), GAME_PHASE.REVEALING_PODIUM);

assert.ok(EVENTS.QUESTION_OPENED);
assert.ok(CLOSE_REASON.DEADLINE);

// ── Arrival order, not client clock ─────────────────────────────────────────
const awarded = awardQuestionQtkn({
  answers: {
    a: { answerIndex: 0, receivedAt: 100, arrivalSeq: 1 },
    b: { answerIndex: 0, receivedAt: 101, arrivalSeq: 2 },
    c: { answerIndex: 1, receivedAt: 90, arrivalSeq: 3 },
    d: { answerIndex: 0, receivedAt: 102, arrivalSeq: 4 },
  },
  correctIndex: 0,
});
assert.strictEqual(awarded.a.place, 1);
assert.strictEqual(awarded.a.qtkn, 21);
assert.strictEqual(awarded.b.place, 2);
assert.strictEqual(awarded.b.qtkn, 18);
assert.strictEqual(awarded.d.place, 3);
assert.strictEqual(awarded.d.qtkn, 16);
assert.strictEqual(awarded.c.qtkn, 0);
assert.strictEqual(awarded.c.place, null);
assert.strictEqual(awarded.c.correct, false);

const lateCorrect = awardQuestionQtkn({
  answers: {
    slow: { answerIndex: 0, receivedAt: 9999, arrivalSeq: 1 },
  },
  correctIndex: 0,
});
assert.strictEqual(lateCorrect.slow.qtkn, 21);

// ── Ranking: QTKN, then correct, then real tie ──────────────────────────────
const ranked = rankPlayers({
  a: { totalQtkn: 40, correct: 2 },
  b: { totalQtkn: 21, correct: 1 },
  c: { totalQtkn: 40, correct: 3 },
});
assert.strictEqual(ranked[0].address, "c");
assert.strictEqual(ranked[0].rank, 1);
assert.strictEqual(ranked[1].address, "a");
assert.strictEqual(ranked[1].rank, 2);
assert.strictEqual(ranked[2].address, "b");
assert.strictEqual(ranked[2].rank, 3);

const tied = withGaps(rankPlayers({
  a: { totalQtkn: 36, correct: 2 },
  b: { totalQtkn: 36, correct: 2 },
  c: { totalQtkn: 21, correct: 1 },
}));
assert.strictEqual(tied[0].rank, 1);
assert.strictEqual(tied[1].rank, 1);
assert.strictEqual(tied[2].rank, 3);
assert.ok(tied[0].tied);
assert.ok(tied[1].tied);
assert.strictEqual(tied[2].tied, false);
assert.strictEqual(tied[2].gapToNext, 15);
assert.ok(tied[2].playerAhead === "a" || tied[2].playerAhead === "b");

const bothCriteriaTied = rankPlayers({
  x: { totalQtkn: 21, correct: 1 },
  y: { totalQtkn: 21, correct: 1 },
});
assert.strictEqual(bothCriteriaTied[0].rank, 1);
assert.strictEqual(bothCriteriaTied[1].rank, 1);

// ── Apply question + personal result ────────────────────────────────────────
const start = {
  sofia: emptyPlayerScore(),
  mati: emptyPlayerScore(),
  lucho: emptyPlayerScore(),
};
const afterQ1 = applyQuestionScores({
  scores: start,
  awards: {
    sofia: { qtkn: 21, place: 1, correct: true },
    mati: { qtkn: 18, place: 2, correct: true },
    lucho: { qtkn: 0, place: null, correct: false },
  },
});
assert.strictEqual(afterQ1.scores.sofia.totalQtkn, 21);
assert.strictEqual(afterQ1.scores.sofia.rank, 1);
assert.strictEqual(afterQ1.scores.sofia.streak, 1);
assert.strictEqual(afterQ1.scores.mati.rank, 2);
assert.strictEqual(afterQ1.scores.mati.gapToNext, 3);
assert.strictEqual(afterQ1.scores.lucho.streak, 0);
assert.strictEqual(afterQ1.scores.lucho.correct, 0);

const sofiaView = personalResult({
  address: "mati",
  scores: afterQ1.scores,
  nicknames: { sofia: "Sofi", mati: "Mati", lucho: "Lucho" },
});
assert.strictEqual(sofiaView.questionQtkn, 18);
assert.strictEqual(sofiaView.rank, 2);
assert.strictEqual(sofiaView.gapToNext, 3);
assert.strictEqual(sofiaView.playerAhead.name, "Sofi");
assert.strictEqual(sofiaView.correct, true);

const afterQ2 = applyQuestionScores({
  scores: afterQ1.scores,
  awards: {
    sofia: { qtkn: 0, place: null, correct: false },
    mati: { qtkn: 21, place: 1, correct: true },
    lucho: { qtkn: 18, place: 2, correct: true },
  },
});
assert.strictEqual(afterQ2.scores.mati.totalQtkn, 39);
assert.strictEqual(afterQ2.scores.mati.rank, 1);
assert.strictEqual(afterQ2.scores.mati.previousRank, 2);
assert.strictEqual(afterQ2.scores.sofia.streak, 0);
assert.strictEqual(afterQ2.scores.mati.streak, 2);

const podium = publicPodium(afterQ2.ranking, { sofia: "Sofi", mati: "Mati", lucho: "Lucho" });
assert.strictEqual(podium.length, 3);
assert.strictEqual(podium[0].medal, "gold");
assert.strictEqual(podiumMedal(1), "gold");
assert.strictEqual(podiumMedal(4), null);

const finals = finalResultPayload({
  address: "mati",
  scores: afterQ2.scores,
  nicknames: { sofia: "Sofi", mati: "Mati", lucho: "Lucho" },
  totalQuestions: 2,
});
assert.strictEqual(finals.rank, 1);
assert.strictEqual(finals.podium, "gold");
assert.strictEqual(finals.totalQuestions, 2);

// ── Accept / reject answers ─────────────────────────────────────────────────
assert.strictEqual(canAcceptAnswer({
  phase: GAME_PHASE.QUESTION_OPEN,
  currentQuestion: 0,
  questionIndex: 0,
  alreadyAnswered: false,
  deadline: 1000,
  now: 999,
}).ok, true);

assert.strictEqual(canAcceptAnswer({
  phase: "showing_stats",
  currentQuestion: 0,
  questionIndex: 0,
  alreadyAnswered: false,
  deadline: 1000,
  now: 500,
}).reason, "question_not_open");

assert.strictEqual(canAcceptAnswer({
  phase: GAME_PHASE.QUESTION_OPEN,
  currentQuestion: 0,
  questionIndex: 1,
  alreadyAnswered: false,
}).reason, "wrong_question");

assert.strictEqual(canAcceptAnswer({
  phase: GAME_PHASE.QUESTION_OPEN,
  currentQuestion: 0,
  questionIndex: 0,
  alreadyAnswered: true,
}).reason, "duplicate");

assert.strictEqual(canAcceptAnswer({
  phase: GAME_PHASE.QUESTION_OPEN,
  currentQuestion: 0,
  questionIndex: 0,
  alreadyAnswered: false,
  deadline: 1000,
  now: 1001,
}).reason, "after_deadline");

const opened = questionOpenedPayload({ questionIndex: 2, openedAt: 1000, timeLimit: 20 });
assert.strictEqual(opened.deadline, 21000);
assert.strictEqual(opened.timeLimit, 20);

console.log("gameContract.test.js passed");
