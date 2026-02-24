const sessions = {};

module.exports = {
  create(roomCode, sessionData) {
    sessions[roomCode] = {
      ...sessionData,
      roomCode,
      players: [],          // { address, name, socketId }
      answers: {},          // { questionIndex: { address: { answerIndex, speedScore } } }
      scores: {},           // { address: { correct, speedScores[], totalTokens } }
      status: "waiting",    // waiting | active | question_open | showing_stats | finished
      currentQuestion: -1,
      createdAt: Date.now(),
    };
    return sessions[roomCode];
  },

  get(roomCode) {
    return sessions[roomCode] || null;
  },

  addPlayer(roomCode, player) {
    if (!sessions[roomCode]) return null;
    const already = sessions[roomCode].players.find(p => p.address === player.address);
    if (!already) {
      sessions[roomCode].players.push(player);
      sessions[roomCode].scores[player.address] = {
        correct: 0,
        speedScores: [],
        totalTokens: 0,
      };
    }
    return sessions[roomCode];
  },

  recordAnswer(roomCode, questionIndex, address, answerIndex, speedScore) {
    const s = sessions[roomCode];
    if (!s) return null;
    if (!s.answers[questionIndex]) s.answers[questionIndex] = {};
    // Only record first answer
    if (s.answers[questionIndex][address]) return s;
    s.answers[questionIndex][address] = { answerIndex, speedScore, answeredAt: Date.now() };
    return s;
  },

  allAnswered(roomCode, questionIndex) {
    const s = sessions[roomCode];
    if (!s) return false;
    const answered = Object.keys(s.answers[questionIndex] || {}).length;
    return answered >= s.players.length;
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
      totalAnswered: Object.keys(answers).length,
      totalPlayers: s.players.length,
      correctIndex: question.correct,
    };
  },

  calculateScores(roomCode, questionIndex) {
    const s = sessions[roomCode];
    if (!s) return;
    const question = s.questions[questionIndex];
    const answers = s.answers[questionIndex] || {};
    Object.entries(answers).forEach(([address, data]) => {
      if (!s.scores[address]) return;
      if (data.answerIndex === question.correct) {
        s.scores[address].correct++;
        s.scores[address].speedScores.push(data.speedScore);
      }
    });
  },

  calculateTokens(roomCode) {
    const s = sessions[roomCode];
    if (!s) return;
    const totalQ = s.questions.length;
    Object.entries(s.scores).forEach(([address, score]) => {
      const avgSpeed = score.speedScores.length > 0
        ? score.speedScores.reduce((a, b) => a + b, 0) / score.speedScores.length
        : 0;
      const accuracyPct = (score.correct / totalQ) * 100;
      const base = score.correct * 10;
      const speedBonus = (base * avgSpeed * 2) / 100;
      score.totalTokens = Math.round((base + speedBonus) * (accuracyPct / 100) + 5);
    });
  },

  setStatus(roomCode, status) {
    if (!sessions[roomCode]) return null;
    sessions[roomCode].status = status;
    return sessions[roomCode];
  },

  setCurrentQuestion(roomCode, index) {
    if (!sessions[roomCode]) return null;
    sessions[roomCode].currentQuestion = index;
    sessions[roomCode].status = "question_open";
    return sessions[roomCode];
  },

  getScores(roomCode) {
    return sessions[roomCode]?.scores || {};
  },

  delete(roomCode) {
    delete sessions[roomCode];
  },
};