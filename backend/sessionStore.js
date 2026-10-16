const { scoreAnswers, ranksFromScores, buildHighlights } = require("./scoring");
const { emptyPlayerScore, canAcceptAnswer, rankPlayers, withGaps } = require("../shared/gameContract");

const sessions = {};

function normalizeAddress(address) {
  if (!address || typeof address !== "string") return null;
  const trimmed = address.trim();
  if (!trimmed || trimmed === "undefined") return null;
  return trimmed.toLowerCase();
}

function emptyScore() {
  const score = emptyPlayerScore();
  return {
    ...score,
    lastPoints: 0,
    totalPoints: 0,
    totalTokens: 0,
  };
}

function aliasLegacyScoreFields(score) {
  score.lastPoints = score.questionQtkn ?? 0;
  score.totalPoints = score.totalQtkn ?? 0;
  score.totalTokens = score.totalQtkn ?? 0;
  return score;
}

module.exports = {
  create(roomCode, sessionData) {
    sessions[roomCode] = {
      ...sessionData,
      roomCode,
      players: [],          // { address, name, socketId }
      answers: {},          // { questionIndex: { address: { answerIndex, responseTime } } }
      scores: {},           // { address: emptyScore() }
      scoredQuestions: new Set(),
      status: "waiting",    // waiting | active | question_open | showing_stats | finished
      currentQuestion: -1,
      questionOpenedAt: null,
      questionDeadline: null,
      arrivalCursor: 0,
      previousRanks: {},
      lastHighlights: null,
      createdAt: Date.now(),
    };
    return sessions[roomCode];
  },

  get(roomCode) {
    return sessions[roomCode] || null;
  },

  normalizeAddress,

  findPlayer(roomCode, address) {
    const s = sessions[roomCode];
    const key = normalizeAddress(address);
    if (!s || !key) return null;
    return s.players.find((p) => p.address === key) || null;
  },

  isPlayer(roomCode, address) {
    return !!this.findPlayer(roomCode, address);
  },

  answeredPlayerCount(roomCode, questionIndex) {
    const s = sessions[roomCode];
    if (!s) return 0;
    const answers = s.answers[questionIndex] || {};
    return s.players.filter((p) => answers[p.address]).length;
  },

  toPublicJSON(session) {
    if (!session) return null;
    return {
      roomCode: session.roomCode,
      name: session.name,
      status: session.status,
      currentQuestion: session.currentQuestion,
      questions: (session.questions || []).map((q) => ({
        id: q.id,
        question: q.question ?? q.text,
        options: q.options,
        timeLimit: q.timeLimit,
      })),
    };
  },

  addPlayer(roomCode, player) {
    if (!sessions[roomCode]) return null;
    const address = normalizeAddress(player?.address);
    if (!address) {
      console.error("Invalid player address:", player);
      return null;
    }
    const already = sessions[roomCode].players.find((p) => p.address === address);
    if (!already) {
      sessions[roomCode].players.push({ ...player, address });
      sessions[roomCode].scores[address] = emptyScore();
    }
    return sessions[roomCode];
  },

  recordAnswer(roomCode, questionIndex, address, answerIndex) {
    const s = sessions[roomCode];
    if (!s) return { ok: false, session: null, reason: "no_session" };
    const key = normalizeAddress(address);
    if (!this.isPlayer(roomCode, key)) {
      return { ok: false, session: s, reason: "not_a_player" };
    }
    if (!s.answers[questionIndex]) s.answers[questionIndex] = {};
    const now = Date.now();
    const accepted = canAcceptAnswer({
      phase: s.status,
      currentQuestion: s.currentQuestion,
      questionIndex,
      alreadyAnswered: !!s.answers[questionIndex][key],
      deadline: s.questionDeadline,
      now,
    });
    if (!accepted.ok) return { ok: false, session: s, reason: accepted.reason };

    const openedAt = s.questionOpenedAt || now;
    const question = s.questions[questionIndex];
    const timeLimit = question?.timeLimit || 20;
    const responseTime = Math.max(0, (now - openedAt) / 1000);

    s.arrivalCursor = (s.arrivalCursor || 0) + 1;
    s.answers[questionIndex][key] = {
      answerIndex,
      responseTime: Math.min(responseTime, timeLimit),
      answeredAt: now,
      receivedAt: now,
      arrivalSeq: s.arrivalCursor,
    };
    return { ok: true, session: s, reason: null };
  },

  timeoutUnanswered(roomCode, questionIndex) {
    const s = sessions[roomCode];
    if (!s) return null;
    if (!s.answers[questionIndex]) s.answers[questionIndex] = {};
    const question = s.questions[questionIndex];
    const timeLimit = question?.timeLimit || 20;
    s.players.forEach((p) => {
      if (s.answers[questionIndex][p.address]) return;
      s.answers[questionIndex][p.address] = {
        answerIndex: -1,
        responseTime: timeLimit,
        answeredAt: Date.now(),
        receivedAt: Date.now(),
        timedOut: true,
      };
    });
    return s;
  },

  allAnswered(roomCode, questionIndex) {
    const s = sessions[roomCode];
    if (!s) return false;
    return s.players.length > 0
      && this.answeredPlayerCount(roomCode, questionIndex) >= s.players.length;
  },

  getQuestionStats(roomCode, questionIndex) {
    const s = sessions[roomCode];
    if (!s) return null;
    const question = s.questions[questionIndex];
    const answers = s.answers[questionIndex] || {};
    const distribution = question.options.map((_, i) => ({
      index: i,
      count: Object.values(answers).filter(a => a.answerIndex === i).length,
    }));
    const correctCount = Object.values(answers).filter(
      a => a.answerIndex === question.correct
    ).length;
    return {
      questionIndex,
      distribution,
      correctCount,
      totalAnswered: this.answeredPlayerCount(roomCode, questionIndex),
      totalPlayers: s.players.length,
      correctIndex: question.correct,
    };
  },

  calculateScores(roomCode, questionIndex) {
    const s = sessions[roomCode];
    if (!s) return;
    if (s.scoredQuestions.has(questionIndex)) {
      this.calculateTokens(roomCode);
      return;
    }
    s.scoredQuestions.add(questionIndex);

    s.previousRanks = ranksFromScores(s.scores);

    const question = s.questions[questionIndex];
    const answers = s.answers[questionIndex] || {};
    const awarded = scoreAnswers({ answers, correctIndex: question.correct });

    Object.entries(answers).forEach(([address, data]) => {
      if (!s.scores[address]) return;
      const result = awarded[address] || { qtkn: 0, points: 0, place: null, correct: false };
      const qtkn = result.qtkn ?? result.points ?? 0;
      const correct = data.answerIndex === question.correct;
      if (correct) {
        s.scores[address].correct++;
        s.scores[address].streak = (s.scores[address].streak || 0) + 1;
      } else {
        s.scores[address].streak = 0;
      }
      s.scores[address].questionQtkn = qtkn;
      s.scores[address].lastCorrect = correct;
      s.scores[address].lastPoints = qtkn;
      s.scores[address].lastPlace = result.place;
      s.scores[address].totalQtkn = (s.scores[address].totalQtkn || 0) + qtkn;
      s.scores[address].totalPoints = s.scores[address].totalQtkn;
    });

    s.players.forEach((p) => {
      if (answers[p.address] || !s.scores[p.address]) return;
      s.scores[p.address].streak = 0;
      s.scores[p.address].questionQtkn = 0;
      s.scores[p.address].lastCorrect = false;
      s.scores[p.address].lastPoints = 0;
      s.scores[p.address].lastPlace = null;
    });

    const ranked = withGaps(rankPlayers(s.scores));
    ranked.forEach((row) => {
      const score = s.scores[row.address];
      if (!score) return;
      score.previousRank = s.previousRanks[row.address] ?? null;
      score.rank = row.rank;
      score.gapToNext = row.gapToNext;
      aliasLegacyScoreFields(score);
    });

    this.calculateTokens(roomCode);
    s.lastHighlights = buildHighlights({
      players: s.players,
      scores: s.scores,
      answers,
      correctIndex: question.correct,
      previousRanks: s.previousRanks,
    });
  },

  calculateTokens(roomCode) {
    const s = sessions[roomCode];
    if (!s) return;
    Object.entries(s.scores).forEach(([address, score]) => {
      if (!address || address === "undefined") return;
      score.totalQtkn = score.totalQtkn ?? score.totalPoints ?? 0;
      score.totalTokens = score.totalQtkn;
      score.totalPoints = score.totalQtkn;
    });
  },

  reconnectPlayer(roomCode, address, newSocketId) {
    const s = sessions[roomCode];
    if (!s) return null;
    const player = this.findPlayer(roomCode, address);
    if (player) {
      player.socketId = newSocketId;
    }
    return s;
  },

  reconnectHost(roomCode, newSocketId) {
    const s = sessions[roomCode];
    if (!s) return null;
    s.hostSocketId = newSocketId;
    return s;
  },

  setStatus(roomCode, status) {
    if (!sessions[roomCode]) return null;
    sessions[roomCode].status = status;
    return sessions[roomCode];
  },

  setCurrentQuestion(roomCode, index) {
    if (!sessions[roomCode]) return null;
    const openedAt = Date.now();
    const timeLimit = sessions[roomCode].questions[index]?.timeLimit || 20;
    sessions[roomCode].currentQuestion = index;
    sessions[roomCode].status = "question_open";
    sessions[roomCode].questionOpenedAt = openedAt;
    sessions[roomCode].questionDeadline = openedAt + timeLimit * 1000;
    return sessions[roomCode];
  },

  getScores(roomCode) {
    return sessions[roomCode]?.scores || {};
  },

  getHighlights(roomCode) {
    return sessions[roomCode]?.lastHighlights || null;
  },

  remainingTime(roomCode) {
    const s = sessions[roomCode];
    if (!s || s.status !== "question_open" || s.currentQuestion < 0) return 0;
    if (s.questionDeadline) {
      return Math.max(0, Math.ceil((s.questionDeadline - Date.now()) / 1000));
    }
    const limit = s.questions[s.currentQuestion]?.timeLimit || 0;
    const elapsed = (Date.now() - (s.questionOpenedAt || Date.now())) / 1000;
    return Math.max(0, Math.ceil(limit - elapsed));
  },

  delete(roomCode) {
    delete sessions[roomCode];
  },
};
