"use strict";

const assert = require("assert");
const store = require("./sessionStore");

const questions = [
  { options: ["a", "b", "c", "d"], correct: 0, timeLimit: 20 },
  { options: ["a", "b"], correct: 1, timeLimit: 10 },
];

function room(suffix) {
  return `TEST${suffix}${Date.now()}${Math.random().toString(16).slice(2)}`;
}

function seed(code, playerCount) {
  store.create(code, { name: "Test", questions });
  for (let i = 0; i < playerCount; i += 1) {
    store.addPlayer(code, { address: `0x${i}`, name: `P${i}` });
  }
  return store.setCurrentQuestion(code, 0);
}

// duplicate answer keeps the first
{
  const code = room("dup");
  seed(code, 1);
  store.recordAnswer(code, 0, "0x0", 0);
  store.recordAnswer(code, 0, "0x0", 1);
  assert.strictEqual(store.get(code).answers[0]["0x0"].answerIndex, 0);
  store.delete(code);
}

// answer after close is ignored
{
  const code = room("late");
  seed(code, 1);
  store.setStatus(code, "showing_stats");
  store.recordAnswer(code, 0, "0x0", 0);
  assert.strictEqual(store.get(code).answers[0]["0x0"], undefined);
  store.delete(code);
}

// answer after deadline is ignored
{
  const code = room("dead");
  const session = seed(code, 1);
  session.questionDeadline = Date.now() - 1;
  store.recordAnswer(code, 0, "0x0", 0);
  assert.strictEqual(store.get(code).answers[0]["0x0"], undefined);
  store.delete(code);
}

// scoring: 3 players, mix, QTKN curve and rank delta
{
  const code = room("score");
  seed(code, 3);
  store.recordAnswer(code, 0, "0x0", 0);
  store.recordAnswer(code, 0, "0x1", 0);
  store.recordAnswer(code, 0, "0x2", 1);
  store.calculateScores(code, 0);
  const scores = store.getScores(code);
  assert.strictEqual(scores["0x0"].totalQtkn, 21);
  assert.strictEqual(scores["0x1"].totalQtkn, 18);
  assert.strictEqual(scores["0x2"].totalQtkn, 0);
  assert.strictEqual(scores["0x0"].rank, 1);
  assert.strictEqual(scores["0x1"].rank, 2);
  assert.strictEqual(scores["0x1"].gapToNext, 3);
  assert.strictEqual(scores["0x0"].streak, 1);
  assert.strictEqual(scores["0x2"].streak, 0);
  store.delete(code);
}

// idempotent rescore
{
  const code = room("once");
  seed(code, 1);
  store.recordAnswer(code, 0, "0x0", 0);
  store.calculateScores(code, 0);
  store.calculateScores(code, 0);
  assert.strictEqual(store.getScores(code)["0x0"].totalQtkn, 21);
  store.delete(code);
}

// mixed-case addresses collapse to one roster seat
{
  const code = room("case");
  store.create(code, { name: "Test", questions });
  store.addPlayer(code, { address: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", name: "Ada" });
  store.addPlayer(code, { address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", name: "Ada2" });
  assert.strictEqual(store.get(code).players.length, 1);
  assert.strictEqual(store.get(code).players[0].address, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  store.delete(code);
}

// unknown address is rejected and does not create an answers bucket
{
  const code = room("ghost");
  seed(code, 1);
  const result = store.recordAnswer(code, 0, "0xdead", 0);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "not_a_player");
  assert.strictEqual(store.get(code).answers[0], undefined);
  store.delete(code);
}

// extra keys in the answers map cannot trip allAnswered
{
  const code = room("forge");
  seed(code, 2);
  store.recordAnswer(code, 0, "0x0", 0);
  store.get(code).answers[0]["0xghost"] = { answerIndex: 0 };
  assert.strictEqual(store.allAnswered(code, 0), false);
  store.recordAnswer(code, 0, "0x1", 0);
  assert.strictEqual(store.allAnswered(code, 0), true);
  store.delete(code);
}

// deadline drives remainingTime
{
  const code = room("timer");
  const session = seed(code, 1);
  session.questionDeadline = Date.now() + 5500;
  const left = store.remainingTime(code);
  assert.ok(left >= 5 && left <= 6, `remainingTime=${left}`);
  store.delete(code);
}

console.log("sessionStore.test.js passed");
