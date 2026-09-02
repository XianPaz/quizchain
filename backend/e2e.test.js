"use strict";

const assert = require("node:assert/strict");
const {
  startHarness,
  expectedQtkn,
  qtknForPlace,
  rankByTokens,
  studentAddress,
  closeClients,
  sleep,
} = require("./test/harness");

const QUESTIONS = [
  { text: "Capital of France?", options: ["Paris", "Lyon", "Nice", "Lille"], correct: 0, timeLimit: 20 },
  { text: "2 + 2?", options: ["3", "4", "5", "22"], correct: 1, timeLimit: 20 },
];

function specs(count, prefix = "S") {
  return Array.from({ length: count }, (_, i) => ({
    name: `${prefix}${i + 1}`,
    address: studentAddress(i + 1),
  }));
}

function assertHostAndStudentsSaw(host, students, eventName, predicate) {
  assert.ok(host.inbox.last(eventName) !== undefined, `host missing ${eventName}`);
  for (const student of students) {
    assert.ok(student.inbox.last(eventName) !== undefined, `${student.name} missing ${eventName}`);
    if (predicate) {
      assert.ok(predicate(student.inbox.last(eventName)), `${student.name} bad ${eventName}`);
    }
  }
}

async function scenarioThreeStudentsAllAnswer(h) {
  const session = await h.createSession({ name: "3 students", questions: QUESTIONS });
  const host = await h.connectHost(session.roomCode, session.hostToken);
  const [alice, bob, cara] = await h.connectStudents(
    session.roomCode,
    [
      { name: "Alice", address: studentAddress(1) },
      { name: "Bob", address: studentAddress(2) },
      { name: "Cara", address: studentAddress(3) },
    ],
    host
  );

  const lobby = h.session(session.roomCode);
  assert.equal(lobby.status, "waiting");
  assert.equal(lobby.players.length, 3);

  host.startQuiz();
  await host.inbox.wait("quiz_started");
  assertHostAndStudentsSaw(host, [alice, bob, cara], "quiz_started");
  assert.equal(h.session(session.roomCode).status, "active");

  host.openQuestion(0);
  await alice.inbox.wait("question_opened", (p) => p.questionIndex === 0);
  assert.equal(h.session(session.roomCode).status, "question_open");
  assert.equal(h.session(session.roomCode).currentQuestion, 0);

  alice.answer({ questionIndex: 0, answerIndex: 0, speedScore: 90 });
  bob.answer({ questionIndex: 0, answerIndex: 0, speedScore: 70 });
  cara.answer({ questionIndex: 0, answerIndex: 2, speedScore: 50 });

  await host.inbox.wait("all_answered", (p) => p.questionIndex === 0);
  await alice.inbox.wait("answer_ack", (p) => p.answerIndex === 0);
  await bob.inbox.wait("answer_ack");
  await cara.inbox.wait("answer_ack");
  assert.equal(host.inbox.last("answer_count").answered, 3);
  assert.equal(host.inbox.last("answer_count").total, 3);

  host.showStats(0);
  const stats0 = await host.inbox.wait("question_stats", (p) => p.scores);
  assert.equal(stats0.questionIndex, 0);
  assert.equal(stats0.correctCount, 2);
  assert.equal(stats0.totalAnswered, 3);
  assert.equal(stats0.correctIndex, 0);
  assert.deepEqual(
    stats0.distribution.map((d) => d.count),
    [2, 0, 1, 0]
  );
  assert.equal(h.session(session.roomCode).status, "showing_stats");

  host.openQuestion(1);
  await bob.inbox.wait("question_opened", (p) => p.questionIndex === 1);

  alice.answer({ questionIndex: 1, answerIndex: 1, speedScore: 80 });
  bob.answer({ questionIndex: 1, answerIndex: 0, speedScore: 60 });
  cara.answer({ questionIndex: 1, answerIndex: 1, speedScore: 80 });
  await host.inbox.wait("all_answered", (p) => p.questionIndex === 1);

  host.showStats(1);
  await host.inbox.wait("question_stats", (p) => p.questionIndex === 1 && p.scores);

  host.endQuiz();
  const ended = await host.inbox.wait("quiz_ended");
  const scores = ended.scores;
  const totalQ = QUESTIONS.length;

  const expected = {
    [alice.address]: expectedQtkn([1, 1]),
    [bob.address]: expectedQtkn([2]),
    [cara.address]: expectedQtkn([2]),
  };

  assert.equal(scores[alice.address].correct, 2);
  assert.equal(scores[bob.address].correct, 1);
  assert.equal(scores[cara.address].correct, 1);
  assert.equal(scores[alice.address].totalQtkn, expected[alice.address]);
  assert.equal(scores[bob.address].totalQtkn, expected[bob.address]);
  assert.equal(scores[cara.address].totalQtkn, expected[cara.address]);
  assert.equal(expected[alice.address], 42);
  assert.equal(expected[bob.address], 18);

  const ranking = rankByTokens(scores);
  assert.equal(ranking[0].address, alice.address);
  assert.equal(ranking[0].rank, 1);
  assert.equal(ranking[1].rank, 2);
  assert.equal(ranking[2].rank, 2);
  assert.ok([bob.address, cara.address].includes(ranking[1].address));
  assert.ok([bob.address, cara.address].includes(ranking[2].address));

  assert.equal(h.session(session.roomCode).status, "finished");
  const getFinished = await h.fetchSession(session.roomCode);
  assert.equal(getFinished.status, 410);

  for (const student of [alice, bob, cara]) {
    const studentEnded = student.inbox.last("quiz_ended");
    assert.ok(studentEnded);
    assert.equal(studentEnded.scores[student.address].totalQtkn, expected[student.address]);
  }

  closeClients(host, alice, bob, cara);
}

async function scenarioTimeoutAndHostClose(h) {
  const session = await h.createSession({
    name: "timeouts",
    questions: [QUESTIONS[0]],
  });
  const host = await h.connectHost(session.roomCode, session.hostToken);
  const [alice, bob, cara] = await h.connectStudents(
    session.roomCode,
    specs(3, "T"),
    host
  );

  host.startQuiz();
  await host.inbox.wait("quiz_started");
  host.openQuestion(0);
  await alice.inbox.wait("question_opened");

  alice.answer({ questionIndex: 0, answerIndex: 0, speedScore: 90 });
  await host.inbox.wait("answer_count", (p) => p.answered === 1);

  bob.timeout({ questionIndex: 0 });
  await sleep(30);
  assert.equal(host.inbox.last("answer_count").answered, 1);

  cara.disconnect();
  await sleep(30);

  assert.equal(h.session(session.roomCode).status, "question_open");
  assert.equal(host.inbox.last("all_answered"), undefined);

  host.showStats(0);
  const stats = await host.inbox.wait("question_stats", (p) => p.scores);
  assert.equal(h.session(session.roomCode).status, "showing_stats");
  assert.equal(stats.totalAnswered, 3);
  assert.equal(stats.correctCount, 1);
  assert.equal(stats.distribution[0].count, 1);

  const scores = h.scores(session.roomCode);
  assert.equal(scores[alice.address].correct, 1);
  assert.equal(scores[alice.address].totalQtkn, qtknForPlace(1));
  assert.equal(scores[bob.address].correct, 0);
  assert.equal(scores[bob.address].totalQtkn, 0);
  assert.equal(scores[cara.address].correct, 0);
  assert.equal(scores[cara.address].totalQtkn, 0);

  const answers = h.session(session.roomCode).answers[0];
  assert.equal(answers[alice.address].answerIndex, 0);
  assert.equal(answers[bob.address].answerIndex, -1);
  assert.equal(answers[cara.address].timedOut, true);

  assert.ok(alice.inbox.last("question_stats"));
  assert.ok(bob.inbox.last("question_stats"));

  closeClients(host, alice, bob, cara);
}

async function scenarioReconnectMidQuestion(h) {
  const session = await h.createSession({
    name: "reconnect",
    questions: [QUESTIONS[0]],
  });
  const host = await h.connectHost(session.roomCode, session.hostToken);
  let [alice, bob] = await h.connectStudents(
    session.roomCode,
    [
      { name: "Alice", address: studentAddress(11) },
      { name: "Bob", address: studentAddress(12) },
    ],
    host
  );

  host.startQuiz();
  await alice.inbox.wait("quiz_started");
  host.openQuestion(0);
  await alice.inbox.wait("question_opened", (p) => p.questionIndex === 0);

  alice = await h.reconnectStudent(alice);
  const resumed = alice.inbox.last("session_resumed");
  assert.equal(resumed.status, "question_open");
  assert.equal(resumed.currentQuestion, 0);
  assert.equal(resumed.alreadyAnswered, false);
  assert.equal(resumed.players.length, 2);
  assert.ok(resumed.scores[alice.address]);

  const storePlayer = h.session(session.roomCode).players.find((p) => p.address === alice.address);
  assert.equal(storePlayer.socketId, alice.socket.id);

  alice.answer({ questionIndex: 0, answerIndex: 0, speedScore: 85 });
  await alice.inbox.wait("answer_ack");

  alice = await h.reconnectStudent(alice);
  const resumedAfter = alice.inbox.last("session_resumed");
  assert.equal(resumedAfter.status, "question_open");
  assert.equal(resumedAfter.alreadyAnswered, true);

  bob.answer({ questionIndex: 0, answerIndex: 1, speedScore: 40 });
  await host.inbox.wait("all_answered", (p) => p.questionIndex === 0);

  host.showStats(0);
  await host.inbox.wait("question_stats", (p) => p.scores);
  const scores = h.scores(session.roomCode);
  assert.equal(scores[alice.address].correct, 1);
  assert.equal(scores[bob.address].correct, 0);

  closeClients(host, alice, bob);
}

async function scenarioTenStudentsSmoke(h) {
  const n = 10;
  const session = await h.createSession({
    name: "10 smoke",
    questions: [QUESTIONS[0]],
  });
  const host = await h.connectHost(session.roomCode, session.hostToken);
  const students = await h.connectStudents(session.roomCode, specs(n, "P"), host);
  assert.equal(h.session(session.roomCode).players.length, n);

  host.startQuiz();
  await host.inbox.wait("quiz_started");
  host.openQuestion(0);
  await students[0].inbox.wait("question_opened");

  students.forEach((student, i) => {
    student.answer({
      questionIndex: 0,
      answerIndex: 0,
      speedScore: 100 - i * 10,
    });
  });

  await host.inbox.wait("all_answered", (p) => p.questionIndex === 0);
  assert.equal(host.inbox.last("answer_count").answered, n);

  host.showStats(0);
  const stats = await host.inbox.wait("question_stats", (p) => p.scores);
  assert.equal(stats.correctCount, n);
  assert.equal(stats.totalAnswered, n);

  const scores = h.scores(session.roomCode);
  const ranking = rankByTokens(scores);
  assert.equal(ranking.length, n);
  assert.equal(ranking[0].address, students[0].address);
  assert.equal(ranking[n - 1].address, students[n - 1].address);
  const expectedPlaces = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  ranking.forEach((row, i) => {
    assert.equal(row.correct, 1);
    assert.equal(row.totalQtkn ?? row.totalTokens, qtknForPlace(expectedPlaces[i]));
  });
  assert.equal(ranking[0].rank, 1);
  assert.equal(ranking[7].rank, 8);
  assert.equal(ranking[8].rank, 9);
  assert.equal(ranking[9].rank, 9);

  closeClients(host, students);
}

async function scenarioQuizEndAndDistribute(h) {
  const session = await h.createSession({
    name: "distribute",
    questions: [QUESTIONS[0]],
  });
  const host = await h.connectHost(session.roomCode, session.hostToken);
  const students = await h.connectStudents(session.roomCode, specs(2, "D"), host);

  host.startQuiz();
  await host.inbox.wait("quiz_started");
  host.openQuestion(0);
  await students[0].inbox.wait("question_opened");
  students[0].answer({ questionIndex: 0, answerIndex: 0, speedScore: 70 });
  students[1].answer({ questionIndex: 0, answerIndex: 0, speedScore: 60 });
  await host.inbox.wait("all_answered");
  host.showStats(0);
  await host.inbox.wait("question_stats", (p) => p.scores);

  host.endQuiz();
  const ended = await host.inbox.wait("quiz_ended");
  assert.equal(h.session(session.roomCode).status, "finished");
  assert.ok(ended.scores[students[0].address]);
  assertHostAndStudentsSaw(host, students, "quiz_ended");

  const txHash = "0xabc123distribute";
  host.distribute(txHash);
  const distributed = await host.inbox.wait("rewards_distributed");
  assert.equal(h.session(session.roomCode).status, "distributing");
  assert.equal(h.session(session.roomCode).txHash, txHash);
  assert.ok(distributed.scores);
  assert.equal(
    distributed.scores[students[0].address].totalQtkn,
    ended.scores[students[0].address].totalQtkn
  );
  for (const student of students) {
    assert.ok(student.inbox.last("rewards_distributed"));
  }

  closeClients(host, students);
}

async function scenarioTie(h) {
  const session = await h.createSession({
    name: "tie",
    questions: [QUESTIONS[0], QUESTIONS[1]],
  });
  const host = await h.connectHost(session.roomCode, session.hostToken);
  const [ana, bel] = await h.connectStudents(
    session.roomCode,
    [
      { name: "Ana", address: studentAddress(21) },
      { name: "Bel", address: studentAddress(22) },
    ],
    host
  );

  host.startQuiz();
  await host.inbox.wait("quiz_started");

  host.openQuestion(0);
  await ana.inbox.wait("question_opened", (p) => p.questionIndex === 0);
  ana.answer({ questionIndex: 0, answerIndex: 0 });
  bel.answer({ questionIndex: 0, answerIndex: 1 });
  await host.inbox.wait("all_answered", (p) => p.questionIndex === 0);
  host.showStats(0);
  await host.inbox.wait("question_stats", (p) => p.questionIndex === 0 && p.scores);

  host.openQuestion(1);
  await ana.inbox.wait("question_opened", (p) => p.questionIndex === 1);
  bel.answer({ questionIndex: 1, answerIndex: 1 });
  ana.answer({ questionIndex: 1, answerIndex: 0 });
  await host.inbox.wait("all_answered", (p) => p.questionIndex === 1);
  host.showStats(1);
  await host.inbox.wait("question_stats", (p) => p.questionIndex === 1 && p.scores);

  host.endQuiz();
  const ended = await host.inbox.wait("quiz_ended");
  assert.equal(ended.scores[ana.address].totalQtkn, 21);
  assert.equal(ended.scores[bel.address].totalQtkn, 21);
  assert.equal(ended.scores[ana.address].correct, 1);
  assert.equal(ended.scores[bel.address].correct, 1);

  const ranking = rankByTokens(ended.scores);
  assert.equal(ranking[0].rank, 1);
  assert.equal(ranking[1].rank, 1);
  assert.equal(ranking[0].totalQtkn ?? ranking[0].totalTokens, ranking[1].totalQtkn ?? ranking[1].totalTokens);

  closeClients(host, ana, bel);
}

async function scenarioTwentyFiveSmoke(h) {
  const n = 25;
  const session = await h.createSession({
    name: "25 smoke",
    questions: [QUESTIONS[0]],
  });
  const host = await h.connectHost(session.roomCode, session.hostToken);
  const students = await h.connectStudents(session.roomCode, specs(n, "X"), host);

  host.startQuiz();
  await host.inbox.wait("quiz_started");
  host.openQuestion(0);
  await students[0].inbox.wait("question_opened");

  students.forEach((student, i) => {
    student.answer({
      questionIndex: 0,
      answerIndex: i % 4 === 0 ? 1 : 0,
      speedScore: 50,
    });
  });

  await host.inbox.wait("all_answered");
  host.showStats(0);
  const stats = await host.inbox.wait("question_stats", (p) => p.scores);
  assert.equal(stats.totalAnswered, n);
  assert.equal(stats.totalPlayers, n);
  assert.ok(stats.correctCount < n);
  assert.ok(stats.correctCount > 0);

  const ranking = rankByTokens(h.scores(session.roomCode));
  assert.equal(ranking.length, n);
  assert.equal(h.session(session.roomCode).status, "showing_stats");

  closeClients(host, students);
}

// A host command with a question index outside the quiz must be refused, and the
// server must survive it. Before the fix this crashed the whole process 20 s later.
async function scenarioBadQuestionIndex(h) {
  const session = await h.createSession({ name: "bad index", questions: QUESTIONS });
  const host = await h.connectHost(session.roomCode, session.hostToken);
  const [alice] = await h.connectStudents(session.roomCode, specs(1), host);

  host.startQuiz();
  await alice.inbox.wait("quiz_started");

  host.openQuestion(5);
  const openRejected = await host.inbox.wait(
    "host_command_rejected",
    (p) => p.command === "host_open_question"
  );
  assert.equal(openRejected.reason, "invalid_question_index");

  host.showStats(5);
  const statsRejected = await host.inbox.wait(
    "host_command_rejected",
    (p) => p.command === "host_show_stats"
  );
  assert.equal(statsRejected.reason, "invalid_question_index");

  assert.equal(h.session(session.roomCode).status, "active");
  assert.equal(alice.inbox.last("question_opened"), undefined);

  // The room still works after the refused commands.
  host.openQuestion(0);
  await alice.inbox.wait("question_opened", (p) => p.questionIndex === 0);
  alice.answer({ questionIndex: 0, answerIndex: 0 });
  await alice.inbox.wait("answer_ack");
  await host.inbox.wait("question_stats");

  closeClients(host, alice);
}

// Every join must get an answer. A room that is gone used to leave the student
// waiting on an ack that never came, with the Join button stuck.
async function scenarioJoinAlwaysAnswered(h) {
  const session = await h.createSession({ name: "join answers", questions: QUESTIONS });
  const host = await h.connectHost(session.roomCode, session.hostToken);

  const ghost = await h.connectStudent({
    roomCode: "zzzz zzzz",
    name: "Ghost",
    address: studentAddress(90),
  });
  const badCode = await ghost.inbox.wait("join_rejected");
  assert.equal(badCode.reason, "invalid_room_code");

  const missing = await h.connectStudent({
    roomCode: "cactus maple",
    name: "Missing",
    address: studentAddress(91),
  });
  const gone = await missing.inbox.wait("join_rejected");
  assert.ok(["session_gone", "invalid_room_code"].includes(gone.reason), gone.reason);

  const wrongToken = await h.connectHost(session.roomCode, "not-the-token");
  const tokenRejected = await wrongToken.inbox.wait("join_rejected");
  assert.equal(tokenRejected.reason, "bad_host_token");

  closeClients(host, ghost, missing, wrongToken);
}

// A host console that lost the seat is told, instead of being ignored.
async function scenarioStaleHostIsTold(h) {
  const session = await h.createSession({ name: "stale host", questions: QUESTIONS });
  const firstTab = await h.connectHost(session.roomCode, session.hostToken);
  await sleep(50);
  const secondTab = await h.connectHost(session.roomCode, session.hostToken);
  await secondTab.inbox.wait("session_resumed");

  firstTab.startQuiz();
  const rejected = await firstTab.inbox.wait("host_command_rejected");
  assert.equal(rejected.command, "host_start_quiz");
  assert.equal(rejected.reason, "host_moved");
  assert.equal(h.session(session.roomCode).status, "waiting");

  closeClients(firstTab, secondTab);
}

// A quiz with a malformed question must be refused at creation, not blow up a room.
async function scenarioMalformedQuizRefused(h) {
  const res = await fetch(`${h.baseUrl}/sessions/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "roto", questions: [{ text: "sin opciones" }] }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /options/);

  const bad = await fetch(`${h.baseUrl}/sessions/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "correct fuera de rango",
      questions: [{ text: "q", options: ["a", "b"], correct: 7 }],
    }),
  });
  assert.equal(bad.status, 400);
}

// A stale question index must not close a question that is not the open one.
async function scenarioStaleIndexDoesNotCloseWrongQuestion(h) {
  const session = await h.createSession({ name: "stale index", questions: QUESTIONS });
  const host = await h.connectHost(session.roomCode, session.hostToken);
  const [alice] = await h.connectStudents(session.roomCode, specs(1), host);

  host.startQuiz();
  host.openQuestion(0);
  await alice.inbox.wait("question_opened", (p) => p.questionIndex === 0);
  alice.answer({ questionIndex: 0, answerIndex: 0 });
  await alice.inbox.wait("answer_ack");
  await host.inbox.wait("question_stats");

  host.openQuestion(1);
  await alice.inbox.wait("question_opened", (p) => p.questionIndex === 1);

  // Question 1 is open. Closing question 0 again must be refused.
  host.showStats(0);
  const rejected = await host.inbox.wait(
    "host_command_rejected",
    (p) => p.command === "host_show_stats"
  );
  assert.equal(rejected.reason, "not_the_open_question");
  assert.equal(h.session(session.roomCode).status, "question_open");
  assert.equal(h.session(session.roomCode).currentQuestion, 1);

  // Reopening a question that is already scored is refused too.
  host.openQuestion(0);
  const reopen = await host.inbox.wait(
    "host_command_rejected",
    (p) => p.command === "host_open_question"
  );
  assert.equal(reopen.reason, "already_scored");

  // Question 1 still closes normally.
  alice.answer({ questionIndex: 1, answerIndex: 1 });
  await alice.inbox.wait("answer_ack");
  await host.inbox.wait("question_stats", (p) => p.questionIndex === 1);

  closeClients(host, alice);
}

// A student whose seat moved gets an answer, instead of dead buttons.
async function scenarioStudentAnswerAlwaysAnswered(h) {
  const session = await h.createSession({ name: "student answers", questions: QUESTIONS });
  const host = await h.connectHost(session.roomCode, session.hostToken);
  const [alice] = await h.connectStudents(session.roomCode, specs(1), host);

  host.startQuiz();
  host.openQuestion(0);
  await alice.inbox.wait("question_opened");

  // The seat moves to a second socket for the same wallet; the old one is refused.
  alice.disconnect();
  await sleep(60);
  const back = await h.connectStudent({
    roomCode: session.roomCode,
    name: alice.name,
    address: alice.address,
  });
  await back.inbox.wait("session_resumed");
  alice.socket.connect();
  await sleep(120);
  alice.socket.emit("student_answer", { questionIndex: 0, answerIndex: 0 });
  const refused = await alice.inbox.wait("answer_rejected");
  assert.ok(refused.reason, "the refusal must name a reason");

  closeClients(host, alice, back);
}

// Abrir otra pregunta con una abierta dejaba la anterior sin puntuar para siempre.
async function scenarioCannotAbandonOpenQuestion(h) {
  const session = await h.createSession({ name: "no abandonar", questions: QUESTIONS });
  const host = await h.connectHost(session.roomCode, session.hostToken);
  const [alice] = await h.connectStudents(session.roomCode, specs(1), host);

  host.startQuiz();
  host.openQuestion(0);
  await alice.inbox.wait("question_opened", (p) => p.questionIndex === 0);

  host.openQuestion(1);
  const rejected = await host.inbox.wait(
    "host_command_rejected",
    (p) => p.command === "host_open_question"
  );
  assert.equal(rejected.reason, "question_still_open");
  assert.equal(h.session(session.roomCode).currentQuestion, 0);
  assert.equal(h.session(session.roomCode).status, "question_open");

  // La pregunta 0 se cierra normal y recién ahí se puede abrir la siguiente.
  alice.answer({ questionIndex: 0, answerIndex: 0 });
  await alice.inbox.wait("answer_ack");
  await host.inbox.wait("question_stats", (p) => p.questionIndex === 0);
  host.openQuestion(1);
  await alice.inbox.wait("question_opened", (p) => p.questionIndex === 1);

  closeClients(host, alice);
}

async function main() {
  const harness = await startHarness();
  const health = await fetch(`${harness.baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });

  const cases = [
    ["3 students, all answer, scores + ranking", scenarioThreeStudentsAllAnswer],
    ["some timeout / disconnect / host closes question", scenarioTimeoutAndHostClose],
    ["reconnect mid-question", scenarioReconnectMidQuestion],
    ["10 students smoke (all answer)", scenarioTenStudentsSmoke],
    ["quiz end + distribute event", scenarioQuizEndAndDistribute],
    ["tie case (same QTKN + correctas)", scenarioTie],
    ["25 students smoke", scenarioTwentyFiveSmoke],
    ["bad question index is refused, server survives", scenarioBadQuestionIndex],
    ["every join gets an answer", scenarioJoinAlwaysAnswered],
    ["stale host console is told, not ignored", scenarioStaleHostIsTold],
    ["a malformed quiz is refused at creation", scenarioMalformedQuizRefused],
    ["a stale index does not close the wrong question", scenarioStaleIndexDoesNotCloseWrongQuestion],
    ["every student answer gets an answer", scenarioStudentAnswerAlwaysAnswered],
    ["cannot abandon a question that is still open", scenarioCannotAbandonOpenQuestion],
  ];

  let passed = 0;
  let failed = 0;

  console.log("QuizChain e2e harness");
  console.log(`server ${harness.baseUrl}\n`);

  for (const [name, fn] of cases) {
    try {
      await fn(harness);
      passed += 1;
      console.log(`  ok    ${name}`);
    } catch (err) {
      failed += 1;
      console.log(`  FAIL  ${name}`);
      console.log(err.stack || err);
    }
  }

  await harness.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
