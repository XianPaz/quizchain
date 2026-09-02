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

// Sin CLIENT_URL, cors y socket.io aceptan cualquier origen. No rompemos el
// arranque, pero que no pase en silencio.
function warnIfOriginOpen(origin) {
  if (origin === undefined || origin === null) {
    console.warn(
      "AVISO: CLIENT_URL no está configurada. El servidor acepta pedidos de "
      + "cualquier origen. Configurá CLIENT_URL con la URL del frontend."
    );
  }
}

function createApp(options = {}) {
  const origin = resolveOrigin(options);
  warnIfOriginOpen(origin);
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

// Cuánto vive una sala terminada antes de liberarse. El profe puede reconectar y
// ver los resultados; después la sala y su código vuelven a estar libres.
const FINISHED_ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 15 * 60 * 1000;

function attachSocketHandlers(io) {
  const questionTimers = {};

  // Las sesiones viven en memoria y nada las borraba. Cada sala terminada se
  // quedaba con sus jugadores, todas sus respuestas y su código de dos palabras.
  const sweep = setInterval(() => {
    const removed = store.sweepFinished(FINISHED_ROOM_TTL_MS);
    removed.forEach((code) => {
      clearQuestionTimer(code);
      console.log(`Room ${code} released`);
    });
  }, SWEEP_EVERY_MS);
  sweep.unref?.();

  function clearQuestionTimer(roomCode) {
    if (questionTimers[roomCode]) {
      clearTimeout(questionTimers[roomCode]);
      delete questionTimers[roomCode];
    }
  }

  function emitQuestionResults(roomCode, questionIndex) {
    if (!store.hasQuestion(roomCode, questionIndex)) return;
    store.timeoutUnanswered(roomCode, questionIndex);
    store.calculateScores(roomCode, questionIndex);
    const stats = store.getQuestionStats(roomCode, questionIndex);
    const scores = store.getScores(roomCode);
    const highlights = store.getHighlights(roomCode);
    // Advance only once the payload is ready, so a room is never left saying
    // "showing_stats" with no stats on the way.
    store.setStatus(roomCode, "showing_stats");
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
      // This runs outside any request. An error escaping here would end the whole
      // process, so it is caught and kept inside this room.
      try {
        emitQuestionResults(roomCode, questionIndex);
        console.log(`Question ${questionIndex} timed out in room ${roomCode}`);
      } catch (err) {
        console.error(`Failed to close question ${questionIndex} in room ${roomCode}:`, err);
        io.to(roomCode).emit("room_error", { reason: "close_question_failed", questionIndex });
      }
    }, timeLimit * 1000);
  }

  // A dropped host command used to be silent, so the host console kept advancing
  // on its own. Every rejection now names a reason the client can show.
  function rejectHostCommand(socket, command, reason) {
    socket.emit("host_command_rejected", { command, reason });
    return null;
  }

  function requireHost(socket, command) {
    const code = socket.data.roomCode;
    if (socket.data.role !== "host" || !code) {
      return rejectHostCommand(socket, command, "not_a_host");
    }
    const session = store.get(code);
    if (!session) return rejectHostCommand(socket, command, "session_gone");
    if (socket.id !== session.hostSocketId) {
      return rejectHostCommand(socket, command, "host_moved");
    }
    return { code, session };
  }

  function isSocketLive(socketId) {
    if (!socketId) return false;
    const seated = io.sockets.sockets.get(socketId);
    return !!(seated && seated.connected);
  }

  function requireStudent(socket, questionIndex) {
    const reject = (reason) => {
      socket.emit("answer_rejected", { questionIndex, reason });
      return null;
    };
    const code = socket.data.roomCode;
    const address = store.normalizeAddress(socket.data.address);
    if (socket.data.role !== "student" || !code || !address) return reject("not_a_player");
    const session = store.get(code);
    if (!session) return reject("no_session");
    const player = store.findPlayer(code, address);
    if (!player) return reject("not_a_player");
    // The seat moved to another socket, usually this same student reconnecting.
    if (player.socketId !== socket.id) return reject("seat_moved");
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

    // One room's error must not travel up and end the process. Every handler is
    // wrapped, so a failure stays with the socket that caused it.
    const on = (event, handler) => {
      socket.on(event, (...args) => {
        try {
          handler(...args);
        } catch (err) {
          console.error(`Handler ${event} failed for ${socket.id}:`, err);
          socket.emit("room_error", { reason: "handler_failed", event });
        }
      });
    };

    on("join_room", ({ roomCode, player, role, hostToken }) => {
      const code = parseRoomCode(roomCode);
      if (!code) {
        socket.emit("join_rejected", { reason: "invalid_room_code" });
        return;
      }
      const session = store.get(code);
      if (!session) {
        socket.emit("join_rejected", { reason: "session_gone" });
        return;
      }

      if (role === "host") {
        if (!hostToken || hostToken !== session.hostToken) {
          socket.emit("join_rejected", { reason: "bad_host_token" });
          return;
        }
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

    on("host_start_quiz", () => {
      const ctx = requireHost(socket, "host_start_quiz");
      if (!ctx) return;
      store.setStatus(ctx.code, "active");
      io.to(ctx.code).emit("quiz_started");
      console.log(`Quiz started in room ${ctx.code}`);
    });

    on("host_open_question", ({ questionIndex }) => {
      const ctx = requireHost(socket, "host_open_question");
      if (!ctx) return;
      if (!store.hasQuestion(ctx.code, questionIndex)) {
        rejectHostCommand(socket, "host_open_question", "invalid_question_index");
        return;
      }
      if (store.isScored(ctx.code, questionIndex)) {
        rejectHostCommand(socket, "host_open_question", "already_scored");
        return;
      }
      // Abrir otra pregunta con una abierta dejaba la anterior perdida para
      // siempre: sin puntuar, sin estadísticas y con las respuestas tiradas.
      if (ctx.session.status === "question_open"
        && ctx.session.currentQuestion !== questionIndex) {
        rejectHostCommand(socket, "host_open_question", "question_still_open");
        return;
      }
      const session = store.setCurrentQuestion(ctx.code, questionIndex);
      io.to(ctx.code).emit("question_opened", {
        questionIndex,
        openedAt: session.questionOpenedAt,
        timeLimit: session.questions[questionIndex]?.timeLimit,
        deadline: session.questionDeadline,
      });
      armQuestionTimer(ctx.code, questionIndex);
      console.log(`Question ${questionIndex} opened in room ${ctx.code}`);
    });

    on("student_answer", ({ questionIndex, answerIndex }) => {
      const ctx = requireStudent(socket, questionIndex);
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

    on("student_timeout", () => {
      // Client clocks are not trusted. The server deadline / host close writes -1.
    });

    on("host_show_stats", ({ questionIndex }) => {
      const ctx = requireHost(socket, "host_show_stats");
      if (!ctx) return;
      if (!store.hasQuestion(ctx.code, questionIndex)) {
        rejectHostCommand(socket, "host_show_stats", "invalid_question_index");
        return;
      }
      // Only the question that is actually open can be closed. A stale index used
      // to close the wrong question and leave the live one unscored for good.
      if (questionIndex !== ctx.session.currentQuestion) {
        rejectHostCommand(socket, "host_show_stats", "not_the_open_question");
        return;
      }
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

    on("host_end_quiz", () => {
      const ctx = requireHost(socket, "host_end_quiz");
      if (!ctx) return;
      clearQuestionTimer(ctx.code);
      store.calculateTokens(ctx.code);
      store.setStatus(ctx.code, "finished");
      const scores = store.getScores(ctx.code);
      io.to(ctx.code).emit("quiz_ended", { scores });
      console.log(`Quiz ended in room ${ctx.code}`);
    });

    on("host_end_without_distribute", () => {
      const ctx = requireHost(socket, "host_end_without_distribute");
      if (!ctx) return;
      clearQuestionTimer(ctx.code);
      store.calculateTokens(ctx.code);
      const scores = store.getScores(ctx.code);
      io.to(ctx.code).emit("session_cancelled", { scores });
      store.delete(ctx.code);
    });

    on("host_distribute", ({ txHash }) => {
      const ctx = requireHost(socket, "host_distribute");
      if (!ctx) return;
      store.setStatus(ctx.code, "distributing");
      const session = store.get(ctx.code);
      if (session) session.txHash = txHash || null;
      const scores = store.getScores(ctx.code);
      io.to(ctx.code).emit("rewards_distributed", { scores });
      console.log(`Rewards distributed in room ${ctx.code}`);
    });

    on("play_again", () => {
      socket.emit("redirect_lobby");
    });

    socket.on("disconnect", () => {
      console.log("Disconnected:", socket.id);
    });
  });
}

module.exports = { createApp, createServer };
