const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const store = require("./sessionStore");
const sessionRoutes = require("./routes/sessions");
const { parseRoomCode } = require("./roomCodes");

function resolveOrigin(options = {}) {
  return options.corsOrigin !== undefined ? options.corsOrigin : process.env.CLIENT_URL;
}

function createApp(options = {}) {
  const origin = resolveOrigin(options);
  const app = express();
  app.use(cors({ origin }));
  app.use(express.json());
  app.use("/sessions", sessionRoutes);
  app.get("/health", (req, res) => res.json({ status: "ok" }));
  return app;
}

function createServer(options = {}) {
  const app = createApp(options);
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: resolveOrigin(options),
      methods: ["GET", "POST"],
    },
  });
  attachSocketHandlers(io);
  return { app, server, io };
}

function attachSocketHandlers(io) {
  const questionTimers = {};

  function clearQuestionTimer(roomCode) {
    if (questionTimers[roomCode]) {
      clearTimeout(questionTimers[roomCode]);
      delete questionTimers[roomCode];
    }
  }

  function emitQuestionResults(roomCode, questionIndex) {
    const session = store.get(roomCode);
    if (!session) return;
    store.timeoutUnanswered(roomCode, questionIndex);
    store.calculateScores(roomCode, questionIndex);
    store.setStatus(roomCode, "showing_stats");
    const stats = store.getQuestionStats(roomCode, questionIndex);
    const scores = store.getScores(roomCode);
    const highlights = store.getHighlights(roomCode);
    io.to(roomCode).emit("question_stats", { ...stats, scores, highlights });
  }

  function armQuestionTimer(roomCode, questionIndex) {
    clearQuestionTimer(roomCode);
    const session = store.get(roomCode);
    if (!session) return;
    const timeLimit = session.questions[questionIndex]?.timeLimit || 20;
    questionTimers[roomCode] = setTimeout(() => {
      delete questionTimers[roomCode];
      const current = store.get(roomCode);
      if (!current) return;
      if (current.status !== "question_open") return;
      if (current.currentQuestion !== questionIndex) return;
      emitQuestionResults(roomCode, questionIndex);
      console.log(`Question ${questionIndex} timed out in room ${roomCode}`);
    }, timeLimit * 1000);
  }

  function requireHost(socket) {
    const code = socket.data.roomCode;
    if (socket.data.role !== "host" || !code) return null;
    const session = store.get(code);
    if (!session || socket.id !== session.hostSocketId) return null;
    return { code, session };
  }

  function isSocketLive(socketId) {
    if (!socketId) return false;
    const seated = io.sockets.sockets.get(socketId);
    return !!(seated && seated.connected);
  }

  function requireStudent(socket) {
    const code = socket.data.roomCode;
    const address = store.normalizeAddress(socket.data.address);
    if (socket.data.role !== "student" || !code || !address) return null;
    const session = store.get(code);
    const player = store.findPlayer(code, address);
    if (!session || !player || player.socketId !== socket.id) return null;
    return { code, address, session };
  }

  function emitAnswerCount(code) {
    const session = store.get(code);
    if (!session) return 0;
    const answered = store.answeredPlayerCount(code, session.currentQuestion);
    io.to(code).emit("answer_count", {
      answered,
      total: session.players.length,
    });
    return answered;
  }

  function closeIfAllAnswered(code, questionIndex) {
    if (!store.allAnswered(code, questionIndex)) return;
    const session = store.get(code);
    const answered = store.answeredPlayerCount(code, questionIndex);
    clearQuestionTimer(code);
    io.to(code).emit("all_answered", {
      questionIndex,
      answered,
      total: session.players.length,
    });
    emitQuestionResults(code, questionIndex);
    console.log(`All answered question ${questionIndex} in room ${code}`);
  }

  io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    socket.on("join_room", ({ roomCode, player, role, hostToken }) => {
      const code = parseRoomCode(roomCode);
      if (!code) return;
      const session = store.get(code);
      if (!session) return;

      if (role === "host") {
        if (!hostToken || hostToken !== session.hostToken) return;
        store.reconnectHost(code, socket.id);
        socket.data.roomCode = code;
        socket.data.role = "host";
        socket.data.address = null;
        socket.join(code);

        const answeredCount = session.currentQuestion >= 0
          ? store.answeredPlayerCount(code, session.currentQuestion)
          : 0;

        socket.emit("session_resumed", {
          status: session.status,
          currentQuestion: session.currentQuestion,
          scores: store.getScores(code),
          players: session.players,
          answeredCount,
          remainingTime: store.remainingTime(code),
          openedAt: session.questionOpenedAt,
          deadline: session.questionDeadline,
          txHash: session.txHash || null,
          highlights: store.getHighlights(code),
          questionStats: session.status === "showing_stats"
            ? {
                ...store.getQuestionStats(code, session.currentQuestion),
                scores: store.getScores(code),
                highlights: store.getHighlights(code),
              }
            : null,
        });
        return;
      }

      const address = store.normalizeAddress(player?.address);
      if (role !== "student" || !address) {
        socket.emit("join_rejected", { reason: "invalid_address" });
        return;
      }

      const existing = store.findPlayer(code, address);
      if (existing) {
        if (existing.socketId && existing.socketId !== socket.id && isSocketLive(existing.socketId)) {
          socket.emit("join_rejected", { reason: "seat_taken" });
          return;
        }

        store.reconnectPlayer(code, address, socket.id);
        socket.data.roomCode = code;
        socket.data.role = "student";
        socket.data.address = address;
        socket.join(code);

        const resumePayload = {
          status: session.status,
          currentQuestion: session.currentQuestion,
          scores: store.getScores(code),
          players: session.players,
          alreadyAnswered: !!session.answers[session.currentQuestion]?.[address],
          remainingTime: store.remainingTime(code),
          openedAt: session.questionOpenedAt,
          deadline: session.questionDeadline,
          highlights: store.getHighlights(code),
        };

        if (session.status === "showing_stats") {
          resumePayload.questionStats = {
            ...store.getQuestionStats(code, session.currentQuestion),
            scores: store.getScores(code),
            highlights: store.getHighlights(code),
          };
        }

        socket.emit("join_accepted", { roomCode: code, status: session.status });
        socket.emit("session_resumed", resumePayload);
        return;
      }

      if (session.status !== "waiting") {
        socket.emit("join_rejected", { reason: "quiz_already_started" });
        return;
      }

      const updated = store.addPlayer(code, { ...player, address, socketId: socket.id });
      if (!updated) {
        socket.emit("join_rejected", { reason: "invalid_address" });
        return;
      }

      socket.data.roomCode = code;
      socket.data.role = "student";
      socket.data.address = address;
      socket.join(code);
      socket.emit("join_accepted", { roomCode: code, status: session.status });
      io.to(code).emit("player_joined", { players: updated.players });
    });

    socket.on("host_start_quiz", () => {
      const ctx = requireHost(socket);
      if (!ctx) return;
      store.setStatus(ctx.code, "active");
      io.to(ctx.code).emit("quiz_started");
      console.log(`Quiz started in room ${ctx.code}`);
    });

    socket.on("host_open_question", ({ questionIndex }) => {
      const ctx = requireHost(socket);
      if (!ctx) return;
      const session = store.setCurrentQuestion(ctx.code, questionIndex);
      if (!session) return;
      io.to(ctx.code).emit("question_opened", {
        questionIndex,
        openedAt: session.questionOpenedAt,
        timeLimit: session.questions[questionIndex]?.timeLimit,
        deadline: session.questionDeadline,
      });
      armQuestionTimer(ctx.code, questionIndex);
      console.log(`Question ${questionIndex} opened in room ${ctx.code}`);
    });

    socket.on("student_answer", ({ questionIndex, answerIndex }) => {
      const ctx = requireStudent(socket);
      if (!ctx) return;
      const result = store.recordAnswer(ctx.code, questionIndex, ctx.address, answerIndex);
      if (!result.ok) {
        socket.emit("answer_rejected", { questionIndex, reason: result.reason });
        return;
      }

      socket.emit("answer_ack", { questionIndex, answerIndex });
      emitAnswerCount(ctx.code);
      closeIfAllAnswered(ctx.code, questionIndex);
    });

    socket.on("student_timeout", () => {
      // Client clocks are not trusted. The server deadline / host close writes -1.
    });

    socket.on("host_show_stats", ({ questionIndex }) => {
      const ctx = requireHost(socket);
      if (!ctx) return;
      if (ctx.session.status === "showing_stats") {
        const stats = store.getQuestionStats(ctx.code, questionIndex);
        io.to(ctx.code).emit("question_stats", {
          ...stats,
          scores: store.getScores(ctx.code),
          highlights: store.getHighlights(ctx.code),
        });
        return;
      }
      clearQuestionTimer(ctx.code);
      emitQuestionResults(ctx.code, questionIndex);
    });

    socket.on("host_end_quiz", () => {
      const ctx = requireHost(socket);
      if (!ctx) return;
      clearQuestionTimer(ctx.code);
      store.calculateTokens(ctx.code);
      store.setStatus(ctx.code, "finished");
      const scores = store.getScores(ctx.code);
      io.to(ctx.code).emit("quiz_ended", { scores });
      console.log(`Quiz ended in room ${ctx.code}`);
    });

    socket.on("host_end_without_distribute", () => {
      const ctx = requireHost(socket);
      if (!ctx) return;
      clearQuestionTimer(ctx.code);
      store.calculateTokens(ctx.code);
      const scores = store.getScores(ctx.code);
      io.to(ctx.code).emit("session_cancelled", { scores });
      store.delete(ctx.code);
    });

    socket.on("host_distribute", ({ txHash }) => {
      const ctx = requireHost(socket);
      if (!ctx) return;
      store.setStatus(ctx.code, "distributing");
      const session = store.get(ctx.code);
      if (session) session.txHash = txHash || null;
      const scores = store.getScores(ctx.code);
      io.to(ctx.code).emit("rewards_distributed", { scores });
      console.log(`Rewards distributed in room ${ctx.code}`);
    });

    socket.on("play_again", () => {
      socket.emit("redirect_lobby");
    });

    socket.on("disconnect", () => {
      console.log("Disconnected:", socket.id);
    });
  });
}

module.exports = { createApp, createServer };
