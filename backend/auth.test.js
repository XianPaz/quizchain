"use strict";

const assert = require("node:assert/strict");
const { io: ioClient } = require("socket.io-client");
const { createServer } = require("./app");
const store = require("./sessionStore");

const QUESTIONS = [
  { text: "Q1", options: ["A", "B", "C", "D"], correct: 0, timeLimit: 20 },
];

function waitConnected(socket, timeoutMs = 4000) {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("connect timeout")), timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function waitEvent(socket, name, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${name}`)), timeoutMs);
    socket.once(name, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function main() {
  const { server, io } = createServer({ corsOrigin: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const created = await fetch(`${baseUrl}/sessions/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Auth", questions: QUESTIONS }),
  }).then((r) => r.json());
  assert.equal(created.success, true);
  assert.ok(created.session.hostToken);
  assert.equal(created.session.questions[0].correct, undefined);
  assert.equal(created.session.answers, undefined);

  const roomCode = created.session.roomCode;
  const hostToken = created.session.hostToken;
  const path = encodeURIComponent(roomCode.replace(/ /g, "-"));

  const publicGet = await fetch(`${baseUrl}/sessions/${path}`).then((r) => r.json());
  assert.equal(publicGet.success, true);
  assert.equal(publicGet.session.hostToken, undefined);
  assert.equal(publicGet.session.questions[0].correct, undefined);
  assert.equal(publicGet.session.answers, undefined);
  assert.equal(publicGet.session.scores, undefined);

  const deniedDelete = await fetch(`${baseUrl}/sessions/${path}`, { method: "DELETE" });
  assert.equal(deniedDelete.status, 403);
  assert.ok(store.get(roomCode));

  const host = ioClient(baseUrl, { transports: ["websocket"], forceNew: true, reconnection: false });
  const student = ioClient(baseUrl, { transports: ["websocket"], forceNew: true, reconnection: false });
  const attacker = ioClient(baseUrl, { transports: ["websocket"], forceNew: true, reconnection: false });
  await Promise.all([waitConnected(host), waitConnected(student), waitConnected(attacker)]);

  host.emit("join_room", { roomCode, role: "host", hostToken });
  await waitEvent(host, "session_resumed");

  student.emit("join_room", {
    roomCode,
    role: "student",
    player: { name: "Ada", address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  });
  await waitEvent(host, "player_joined");

  attacker.emit("join_room", {
    roomCode,
    role: "student",
    player: { name: "Eve", address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  });
  await waitEvent(host, "player_joined");

  const thief = ioClient(baseUrl, { transports: ["websocket"], forceNew: true, reconnection: false });
  await waitConnected(thief);
  thief.emit("join_room", {
    roomCode,
    role: "student",
    player: { name: "Ada", address: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
  });
  const stolen = await waitEvent(thief, "join_rejected");
  assert.equal(stolen.reason, "seat_taken");
  assert.equal(
    store.findPlayer(roomCode, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").socketId,
    student.id
  );

  attacker.emit("join_room", { roomCode, role: "host" });
  attacker.emit("host_start_quiz", { roomCode });
  attacker.emit("host_end_quiz", { roomCode });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(store.get(roomCode).status, "waiting");

  host.emit("host_start_quiz");
  await waitEvent(student, "quiz_started");
  host.emit("host_open_question", { questionIndex: 0 });
  await waitEvent(student, "question_opened");

  const late = ioClient(baseUrl, { transports: ["websocket"], forceNew: true, reconnection: false });
  await waitConnected(late);
  late.emit("join_room", {
    roomCode,
    role: "student",
    player: { name: "Cara", address: "0xcccccccccccccccccccccccccccccccccccccccc" },
  });
  const lateReject = await waitEvent(late, "join_rejected");
  assert.equal(lateReject.reason, "quiz_already_started");
  assert.equal(store.get(roomCode).players.length, 2);

  attacker.emit("student_answer", {
    roomCode,
    address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    questionIndex: 0,
    answerIndex: 1,
  });
  await waitEvent(attacker, "answer_ack");
  const afterSpoof = store.get(roomCode).answers[0];
  assert.equal(afterSpoof["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"], undefined);
  assert.equal(afterSpoof["0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"].answerIndex, 1);

  student.emit("student_answer", { questionIndex: 0, answerIndex: 0 });
  await waitEvent(student, "answer_ack");
  assert.equal(
    store.get(roomCode).answers[0]["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"].answerIndex,
    0
  );

  const allowedDelete = await fetch(`${baseUrl}/sessions/${path}`, {
    method: "DELETE",
    headers: { "x-host-token": hostToken },
  });
  assert.equal(allowedDelete.status, 200);
  assert.equal(store.get(roomCode), null);

  host.disconnect();
  student.disconnect();
  attacker.disconnect();
  thief.disconnect();
  late.disconnect();
  await new Promise((resolve) => io.close(() => resolve()));
  console.log("auth.test.js passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
