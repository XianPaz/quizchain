"use strict";

const assert = require("assert");
const {
  qtknForPlace,
  scoreAnswers,
  ranksFromScores,
  buildHighlights,
} = require("./scoring");
const { applyQuestionScores, emptyPlayerScore, rankPlayers } = require("../shared/gameContract");

assert.strictEqual(qtknForPlace(1), 21);
assert.strictEqual(qtknForPlace(2), 18);
assert.strictEqual(qtknForPlace(3), 16);
assert.strictEqual(qtknForPlace(4), 15);
assert.strictEqual(qtknForPlace(9), 10);
assert.strictEqual(qtknForPlace(20), 10);
assert.strictEqual(qtknForPlace(0), 0);
assert.strictEqual(qtknForPlace(null), 0);

function answer(index, seq) {
  return { answerIndex: index, arrivalSeq: seq, receivedAt: 1000 + seq };
}

// 1 student
const one = scoreAnswers({
  answers: { a: answer(0, 1) },
  correctIndex: 0,
});
assert.strictEqual(one.a.place, 1);
assert.strictEqual(one.a.qtkn, 21);

// 3 students, mix
const three = scoreAnswers({
  answers: {
    a: answer(0, 1),
    b: answer(0, 2),
    c: answer(1, 3),
  },
  correctIndex: 0,
});
assert.strictEqual(three.a.qtkn, 21);
assert.strictEqual(three.b.qtkn, 18);
assert.strictEqual(three.c.qtkn, 0);
assert.strictEqual(three.c.place, null);

// 8 students, all correct
const eightAnswers = {};
for (let i = 0; i < 8; i += 1) eightAnswers[`p${i}`] = answer(0, i + 1);
const eight = scoreAnswers({ answers: eightAnswers, correctIndex: 0 });
assert.deepStrictEqual(
  [1, 2, 3, 4, 5, 6, 7, 8].map((n) => eight[`p${n - 1}`].qtkn),
  [21, 18, 16, 15, 14, 13, 12, 11]
);

// 20+ students, all correct — 9th and later get the floor
const twentyAnswers = {};
for (let i = 0; i < 22; i += 1) twentyAnswers[`p${i}`] = answer(0, i + 1);
const twenty = scoreAnswers({ answers: twentyAnswers, correctIndex: 0 });
assert.strictEqual(twenty.p0.qtkn, 21);
assert.strictEqual(twenty.p8.qtkn, 10);
assert.strictEqual(twenty.p21.qtkn, 10);

// all incorrect
const allWrong = scoreAnswers({
  answers: { a: answer(1, 1), b: answer(2, 2), c: answer(3, 3) },
  correctIndex: 0,
});
assert.strictEqual(allWrong.a.qtkn, 0);
assert.strictEqual(allWrong.b.qtkn, 0);
assert.strictEqual(allWrong.c.qtkn, 0);

// near-simultaneous: arrivalSeq is the only order that matters
const photoFinish = scoreAnswers({
  answers: {
    a: { answerIndex: 0, receivedAt: 100, arrivalSeq: 2 },
    b: { answerIndex: 0, receivedAt: 100, arrivalSeq: 1 },
  },
  correctIndex: 0,
});
assert.strictEqual(photoFinish.b.place, 1);
assert.strictEqual(photoFinish.a.place, 2);

// ranking: QTKN, then correct, then real tie
const ranks = ranksFromScores({
  a: { totalQtkn: 39, correct: 2 },
  b: { totalQtkn: 21, correct: 1 },
  c: { totalQtkn: 39, correct: 3 },
});
assert.deepStrictEqual(ranks, { c: 1, a: 2, b: 3 });

const tiedRanks = rankPlayers({
  a: { totalQtkn: 21, correct: 1 },
  b: { totalQtkn: 21, correct: 1 },
  c: { totalQtkn: 18, correct: 1 },
});
assert.strictEqual(tiedRanks.find((r) => r.address === "a").rank, 1);
assert.strictEqual(tiedRanks.find((r) => r.address === "b").rank, 1);
assert.strictEqual(tiedRanks.find((r) => r.address === "c").rank, 3);

// accumulate two questions
const start = { a: emptyPlayerScore(), b: emptyPlayerScore(), c: emptyPlayerScore() };
const q1 = applyQuestionScores({
  scores: start,
  awards: {
    a: { qtkn: 21, place: 1, correct: true },
    b: { qtkn: 18, place: 2, correct: true },
    c: { qtkn: 0, place: null, correct: false },
  },
});
const q2 = applyQuestionScores({
  scores: q1.scores,
  awards: {
    a: { qtkn: 0, place: null, correct: false },
    b: { qtkn: 21, place: 1, correct: true },
    c: { qtkn: 18, place: 2, correct: true },
  },
});
assert.strictEqual(q2.scores.b.totalQtkn, 39);
assert.strictEqual(q2.scores.b.rank, 1);
assert.strictEqual(q2.scores.b.previousRank, 2);
assert.strictEqual(q2.scores.a.streak, 0);
assert.strictEqual(q2.scores.b.streak, 2);

const highlights = buildHighlights({
  players: [
    { address: "a", name: "Ada" },
    { address: "b", name: "Bob" },
    { address: "c", name: "Cam" },
  ],
  scores: {
    a: { totalQtkn: 42, lastPoints: 21, questionQtkn: 21, streak: 4 },
    b: { totalQtkn: 0, lastPoints: 0, questionQtkn: 0, streak: 0 },
    c: { totalQtkn: 18, lastPoints: 18, questionQtkn: 18, streak: 1 },
  },
  answers: {
    a: { answerIndex: 0, arrivalSeq: 1, receivedAt: 10 },
    b: { answerIndex: 1, arrivalSeq: 2, receivedAt: 11 },
    c: { answerIndex: 0, arrivalSeq: 3, receivedAt: 12 },
  },
  correctIndex: 0,
  previousRanks: { a: 5, b: 1, c: 2 },
});

assert.strictEqual(highlights.fastest.address, "a");
assert.strictEqual(highlights.streaks[0].streak, 4);
assert.strictEqual(highlights.climbers[0].address, "a");
assert.strictEqual(highlights.climbers[0].delta, 4);
assert.ok(highlights.podiumEntries.find((p) => p.address === "a"));

console.log("scoring.test.js passed");
