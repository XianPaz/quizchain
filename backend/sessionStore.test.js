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

// a question index outside the quiz never reaches the scoring or stats code
{
  const code = room("range");
  seed(code, 1);
  assert.strictEqual(store.hasQuestion(code, 0), true);
  assert.strictEqual(store.hasQuestion(code, 5), false);
  assert.strictEqual(store.hasQuestion(code, -1), false);
  assert.strictEqual(store.hasQuestion(code, 1.5), false);
  assert.strictEqual(store.hasQuestion(code, "0"), false);
  assert.strictEqual(store.setCurrentQuestion(code, 5), null);
  assert.strictEqual(store.getQuestionStats(code, 5), null);
  assert.strictEqual(store.timeoutUnanswered(code, 5), null);
  assert.doesNotThrow(() => store.calculateScores(code, 5));
  store.delete(code);
}

// a player who never answers is scored: streak reset, no QTKN, still ranked
{
  const code = room("silent");
  seed(code, 2);
  store.recordAnswer(code, 0, "0x0", 0);
  store.timeoutUnanswered(code, 0);
  store.calculateScores(code, 0);
  const scores = store.getScores(code);
  assert.strictEqual(scores["0x1"].questionQtkn, 0);
  assert.strictEqual(scores["0x1"].streak, 0);
  assert.strictEqual(scores["0x1"].lastCorrect, false);
  assert.strictEqual(scores["0x1"].lastPlace, null);
  assert.strictEqual(scores["0x1"].rank, 2);
  assert.strictEqual(scores["0x0"].lastPoints, scores["0x0"].questionQtkn);
  assert.strictEqual(scores["0x0"].totalTokens, scores["0x0"].totalQtkn);
  store.delete(code);
}

// An index in range but a question with no options is not a usable question.
{
  const code = room("broken");
  store.create(code, { name: "Test", questions: [{ text: "sin opciones" }] });
  store.addPlayer(code, { address: "0x0", name: "P0" });
  assert.strictEqual(store.hasQuestion(code, 0), false);
  assert.strictEqual(store.getQuestionStats(code, 0), null);
  assert.strictEqual(store.setCurrentQuestion(code, 0), null);
  assert.doesNotThrow(() => store.calculateScores(code, 0));
  store.delete(code);
}

// A refused index must not grow the answers map.
{
  const code = room("grow");
  seed(code, 1);
  const before = Object.keys(store.get(code).answers).length;
  for (let i = 0; i < 5; i += 1) {
    const result = store.recordAnswer(code, 900 + i, "0x0", 0);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, "wrong_question");
  }
  assert.strictEqual(Object.keys(store.get(code).answers).length, before);
  store.delete(code);
}

// Las salas terminadas se liberan; las que están en juego, no.
{
  const viva = room("viva");
  const vieja = room("vieja");
  const reciente = room("reciente");
  seed(viva, 1);
  seed(vieja, 1);
  seed(reciente, 1);
  store.setStatus(vieja, "finished");
  store.setStatus(reciente, "finished");
  store.get(vieja).finishedAt = Date.now() - 10 * 60 * 60 * 1000;

  const liberadas = store.sweepFinished(6 * 60 * 60 * 1000);
  assert.ok(liberadas.includes(vieja), "la sala vieja tiene que liberarse");
  assert.ok(!liberadas.includes(reciente), "la recién terminada todavía no");
  assert.ok(!liberadas.includes(viva), "una sala en juego nunca se libera");
  assert.strictEqual(store.get(vieja), null);
  assert.ok(store.get(reciente));
  assert.ok(store.get(viva));
  store.delete(viva); store.delete(reciente);
}

console.log("sessionStore.test.js passed");
