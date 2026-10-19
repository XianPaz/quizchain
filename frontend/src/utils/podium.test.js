// node src/utils/podium.test.js
import assert from "node:assert/strict";
import { buildPodiumMint, podiumTokensFromEvents, myPodiumToken } from "./podium.js";

const A = "0x" + "a".repeat(40);
const B = "0x" + "b".repeat(40);
const C = "0x" + "c".repeat(40);
const D = "0x" + "d".repeat(40);
const E = "0x" + "e".repeat(40);

const QUIZ = {
  name: "Ethereum",
  className: "6to A",
  sessionId: "2026-10-19-stove-awesome-abc123",
  date: "2026-10-19",
  questions: [{}, {}, {}, {}, {}],
};

const PLAYERS = [
  { address: A, name: "kela" },
  { address: B, name: "itba" },
  { address: C, name: "mati" },
  { address: D, name: "sol" },
  { address: E, name: "cero" },
];

// Solo el podio, ordenado por puesto, con los datos que escribe el contrato.
{
  const scores = {
    [D]: { rank: 4, totalQtkn: 30, correct: 2 },
    [B]: { rank: 2, totalQtkn: 50, correct: 4 },
    [A]: { rank: 1, totalQtkn: 63, correct: 5 },
    [C]: { rank: 3, totalQtkn: 40, correct: 3 },
  };
  const { recipients, inputs } = buildPodiumMint({ scores, players: PLAYERS, quiz: QUIZ });
  assert.deepEqual(recipients, [A, B, C]);
  assert.deepEqual(inputs.map((i) => i.rank), [1, 2, 3]);
  assert.deepEqual(inputs[0], {
    sessionId: QUIZ.sessionId,
    quizName: "Ethereum",
    className: "6to A",
    date: "2026-10-19",
    rank: 1,
    qtkn: 63,
    correct: 5,
    totalQuestions: 5,
    nickname: "kela",
  });
}

// Empate en el primer puesto: los dos se llevan oro y el siguiente es bronce.
{
  const scores = {
    [A]: { rank: 1, totalQtkn: 50, correct: 4 },
    [B]: { rank: 1, totalQtkn: 50, correct: 4 },
    [C]: { rank: 3, totalQtkn: 20, correct: 2 },
  };
  const { recipients, inputs } = buildPodiumMint({ scores, players: PLAYERS, quiz: QUIZ });
  assert.deepEqual(recipients, [A, B, C]);
  assert.deepEqual(inputs.map((i) => i.rank), [1, 1, 3]);
}

// Nadie sube al podio con 0 QTKN, aunque el ranking lo ponga 1º.
{
  const scores = { [E]: { rank: 1, totalQtkn: 0, correct: 0 } };
  const { recipients } = buildPodiumMint({ scores, players: PLAYERS, quiz: QUIZ });
  assert.deepEqual(recipients, []);
}

// Sin clase se usa el nombre del quiz; los bytes de control no llegan al contrato.
{
  const scores = { [A]: { rank: 1, totalQtkn: 21, correct: 1 } };
  const players = [{ address: A, name: "ke\u0007la\u0000" }];
  const { inputs } = buildPodiumMint({ scores, players, quiz: { ...QUIZ, className: "" } });
  assert.equal(inputs[0].className, "Ethereum");
  assert.equal(inputs[0].nickname, "kela");
}

// Sin apodo conocido queda la dirección, nunca un texto vacío.
{
  const scores = { [A]: { rank: 1, totalQtkn: 21, correct: 1 } };
  const { inputs } = buildPodiumMint({ scores, players: [], quiz: QUIZ });
  assert.equal(inputs[0].nickname, A);
}

// Los eventos del contrato se pasan al formato del servidor y cada alumno encuentra el suyo.
{
  const tokens = podiumTokensFromEvents([
    { student: A.toUpperCase().replace("0X", "0x"), tokenId: 7n, rank: 1n },
    { student: B, tokenId: 8n, rank: 2n },
  ]);
  assert.deepEqual(tokens, [
    { address: A, tokenId: "7", rank: 1 },
    { address: B, tokenId: "8", rank: 2 },
  ]);
  const podium = { txHash: "0x1", tokens };
  assert.equal(myPodiumToken(podium, B).tokenId, "8");
  assert.equal(myPodiumToken(podium, C), null);
  assert.equal(myPodiumToken(null, A), null);
}

console.log("podium ok");
