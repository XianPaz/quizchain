"use strict";

const { io: ioClient } = require("socket.io-client");
const store = require("../../sessionStore");
const { createServer } = require("../../app");

const TRACKED_EVENTS = [
  "player_joined",
  "quiz_started",
  "question_opened",
  "answer_ack",
  "answer_rejected",
  "answer_count",
  "all_answered",
  "question_stats",
  "quiz_ended",
  "rewards_distributed",
  "session_resumed",
  "session_cancelled",
  "redirect_lobby",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const { qtknForPlace } = require("../../scoring");

function expectedQtkn(places) {
  return (places || []).reduce((sum, place) => sum + qtknForPlace(place), 0);
}

function rankByTokens(scores) {
  const rows = Object.entries(scores)
    .map(([address, s]) => ({ address, ...s }))
    .sort((a, b) => {
      const tokenDiff = (b.totalTokens ?? 0) - (a.totalTokens ?? 0);
      if (tokenDiff !== 0) return tokenDiff;
      return (b.correct ?? 0) - (a.correct ?? 0);
    });

  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    const tied = prev
      && prev.totalTokens === row.totalTokens
      && prev.correct === row.correct;
    row.rank = tied ? prev.rank : i + 1;
  });
  return rows;
}

function attachInbox(socket) {
  const events = Object.fromEntries(TRACKED_EVENTS.map((name) => [name, []]));
  TRACKED_EVENTS.forEach((name) => {
    socket.on(name, (data) => {
      events[name].push(data === undefined ? null : data);
    });
  });

  return {
    events,
    last(name) {
      const bag = events[name] || [];
      return bag.length ? bag[bag.length - 1] : undefined;
    },
    async wait(name, predicate = () => true, timeoutMs = 4000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const match = (events[name] || []).find(predicate);
        if (match !== undefined) return match;
        await sleep(10);
      }
      throw new Error(
        `timeout waiting for ${name} (got ${JSON.stringify(events[name] || [])})`
      );
    },
  };
}

function waitConnected(socket, timeoutMs = 4000) {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("timeout waiting for socket connect"));
    }, timeoutMs);
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

function openClient(baseUrl) {
  return ioClient(baseUrl, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
}

function roomCodePath(roomCode) {
  return encodeURIComponent(String(roomCode || "").replace(/ /g, "-"));
}

function studentAddress(n) {
  return `0x${String(n).padStart(40, "0")}`;
}

function defaultQuestions() {
  return [
    { text: "Q1", options: ["A", "B", "C", "D"], correct: 0, timeLimit: 20 },
    { text: "Q2", options: ["A", "B", "C", "D"], correct: 1, timeLimit: 20 },
  ];
}

async function createSession(baseUrl, { roomCode, name = "Harness Quiz", questions } = {}) {
  const payload = {
    name,
    questions: questions || defaultQuestions(),
  };
  if (roomCode) payload.roomCode = roomCode;
  const res = await fetch(`${baseUrl}/sessions/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`create session failed: ${body.error || res.status}`);
  }
  return body.session;
}

async function fetchSession(baseUrl, roomCode) {
  const res = await fetch(`${baseUrl}/sessions/${roomCodePath(roomCode)}`);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function wrapHost(socket, inbox, roomCode) {
  return {
    socket,
    inbox,
    roomCode,
    emit(event, payload = {}) {
      socket.emit(event, { roomCode, ...payload });
    },
    startQuiz() {
      socket.emit("host_start_quiz", { roomCode });
    },
    openQuestion(questionIndex) {
      socket.emit("host_open_question", { roomCode, questionIndex });
    },
    showStats(questionIndex) {
      socket.emit("host_show_stats", { roomCode, questionIndex });
    },
    endQuiz() {
      socket.emit("host_end_quiz", { roomCode });
    },
    distribute(txHash = "0xtest") {
      socket.emit("host_distribute", { roomCode, txHash });
    },
    disconnect() {
      socket.disconnect();
    },
  };
}

function wrapStudent(socket, inbox, { roomCode, name, address }) {
  return {
    socket,
    inbox,
    roomCode,
    name,
    address,
    emit(event, payload = {}) {
      socket.emit(event, { roomCode, address, ...payload });
    },
    answer({ questionIndex, answerIndex, speedScore = 80 }) {
      socket.emit("student_answer", {
        roomCode,
        address,
        questionIndex,
        answerIndex,
        speedScore,
      });
    },
    timeout({ questionIndex }) {
      socket.emit("student_timeout", { roomCode, address, questionIndex });
    },
    disconnect() {
      socket.disconnect();
    },
  };
}

async function connectHost(baseUrl, roomCode, hostToken) {
  const socket = openClient(baseUrl);
  const inbox = attachInbox(socket);
  await waitConnected(socket);
  socket.emit("join_room", { roomCode, role: "host", hostToken });
  return wrapHost(socket, inbox, roomCode);
}

async function connectStudent(baseUrl, { roomCode, name, address }) {
  const socket = openClient(baseUrl);
  const inbox = attachInbox(socket);
  await waitConnected(socket);
  socket.emit("join_room", {
    roomCode,
    role: "student",
    player: { name, address },
  });
  return wrapStudent(socket, inbox, { roomCode, name, address });
}

async function connectStudents(baseUrl, roomCode, specs, host) {
  const students = [];
  for (const spec of specs) {
    const student = await connectStudent(baseUrl, { roomCode, ...spec });
    students.push(student);
    if (host) {
      await host.inbox.wait(
        "player_joined",
        (payload) => payload.players.length === students.length
      );
    }
  }
  return students;
}

async function reconnectStudent(baseUrl, student) {
  student.disconnect();
  await sleep(30);
  const next = await connectStudent(baseUrl, {
    roomCode: student.roomCode,
    name: student.name,
    address: student.address,
  });
  await next.inbox.wait("session_resumed");
  return next;
}

function closeClients(...clients) {
  for (const client of clients.flat().filter(Boolean)) {
    if (client.socket && client.socket.connected) {
      client.socket.disconnect();
    }
  }
}

async function startHarness(options = {}) {
  const { app, server, io } = createServer({
    corsOrigin: options.corsOrigin ?? true,
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    app,
    server,
    io,
    port,
    baseUrl,
    store,
    createSession: (opts) => createSession(baseUrl, opts),
    fetchSession: (roomCode) => fetchSession(baseUrl, roomCode),
    connectHost: (roomCode, hostToken) => connectHost(baseUrl, roomCode, hostToken),
    connectStudent: (spec) => connectStudent(baseUrl, spec),
    connectStudents: (roomCode, specs, host) => connectStudents(baseUrl, roomCode, specs, host),
    reconnectStudent: (student) => reconnectStudent(baseUrl, student),
    session: (roomCode) => store.get(roomCode),
    scores: (roomCode) => store.getScores(roomCode),
    async close() {
      await new Promise((resolve) => io.close(() => resolve()));
    },
  };
}

module.exports = {
  startHarness,
  expectedQtkn,
  qtknForPlace,
  rankByTokens,
  studentAddress,
  defaultQuestions,
  closeClients,
  sleep,
};
