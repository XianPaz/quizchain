require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const store = require("./sessionStore");
const sessionRoutes = require("./routes/sessions");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());
app.use("/sessions", sessionRoutes);

// ── Socket.io events ──────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // ── Join room ──────────────────────────────────────────────────────────────
  socket.on("join_room", ({ roomCode, player, role }) => {
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.role = role;
    socket.data.address = player?.address;

    if (role === "student" && player) {
      const session = store.addPlayer(roomCode, { ...player, socketId: socket.id });
      if (session) {
        io.to(roomCode).emit("player_joined", { players: session.players });
      }
    }

    if (role === "host") {
      const session = store.get(roomCode);
      if (session) socket.emit("session_state", session);
    }
  });

  // ── Host starts the quiz ───────────────────────────────────────────────────
  socket.on("host_start_quiz", ({ roomCode }) => {
    store.setStatus(roomCode, "active");
    io.to(roomCode).emit("quiz_started");
    console.log(`Quiz started in room ${roomCode}`);
  });

  // ── Host opens a question ──────────────────────────────────────────────────
  socket.on("host_open_question", ({ roomCode, questionIndex }) => {
    store.setCurrentQuestion(roomCode, questionIndex);
    io.to(roomCode).emit("question_opened", {
      questionIndex,
      openedAt: Date.now(),
    });
    console.log(`Question ${questionIndex} opened in room ${roomCode}`);
  });

  // ── Student submits answer ─────────────────────────────────────────────────
  socket.on("student_answer", ({ roomCode, address, questionIndex, answerIndex, speedScore }) => {
    const session = store.recordAnswer(roomCode, questionIndex, address, answerIndex, speedScore);
    if (!session) return;

    socket.emit("answer_ack", { questionIndex, answerIndex });

    // Notify host of updated answer count
    const answered = Object.keys(session.answers[questionIndex] || {}).length;
    io.to(roomCode).emit("answer_count", {
      answered,
      total: session.players.length,
    });

    // Check if all students answered
    if (store.allAnswered(roomCode, questionIndex)) {
      store.calculateScores(roomCode, questionIndex);
      io.to(roomCode).emit("all_answered", { questionIndex });
      console.log(`All answered question ${questionIndex} in room ${roomCode}`);
    }
  });

  // ── Student timed out (no answer) ─────────────────────────────────────────
  socket.on("student_timeout", ({ roomCode, address, questionIndex }) => {
    store.recordAnswer(roomCode, questionIndex, address, -1, 0);
    const session = store.get(roomCode);
    if (!session) return;

    const answered = Object.keys(session.answers[questionIndex] || {}).length;
    io.to(roomCode).emit("answer_count", {
      answered,
      total: session.players.length,
    });

    if (store.allAnswered(roomCode, questionIndex)) {
      store.calculateScores(roomCode, questionIndex);
      io.to(roomCode).emit("all_answered", { questionIndex });
    }
  });

  // ── Host shows stats for current question ─────────────────────────────────
  socket.on("host_show_stats", ({ roomCode, questionIndex }) => {
    store.calculateScores(roomCode, questionIndex);
    const stats = store.getQuestionStats(roomCode, questionIndex);
    store.setStatus(roomCode, "showing_stats");
    io.to(roomCode).emit("question_stats", stats);
  });

  // ── Host ends the quiz ─────────────────────────────────────────────────────
  socket.on("host_end_quiz", ({ roomCode }) => {
    store.calculateTokens(roomCode);
    store.setStatus(roomCode, "finished");
    const scores = store.getScores(roomCode);
    io.to(roomCode).emit("quiz_ended", { scores });
    console.log(`Quiz ended in room ${roomCode}`);
  });

  // ── Host show stats ─────────────────────────────────────────────────────────
  socket.on("host_show_stats", ({ roomCode, questionIndex }) => {
    store.calculateScores(roomCode, questionIndex);
    const stats = store.getQuestionStats(roomCode, questionIndex);
    store.setStatus(roomCode, "showing_stats");
    const scores = store.getScores(roomCode);
    io.to(roomCode).emit("question_stats", { ...stats, scores });
  });

  // ── Host ends the quiz without reward distribution ─────────────────────────
  socket.on("host_end_without_distribute", ({ roomCode }) => {
    store.calculateTokens(roomCode);
    const scores = store.getScores(roomCode);
    // Notify students the session ended without rewards
    io.to(roomCode).emit("session_cancelled", { scores });
    store.delete(roomCode);
  });

  // ── Host distributes rewards ───────────────────────────────────────────────
  socket.on("host_distribute", ({ roomCode }) => {
    const scores = store.getScores(roomCode);
    // In production: call QuizGame.finalizeAndDistribute() here via ethers.js
    io.to(roomCode).emit("rewards_distributed", { scores });
    console.log(`Rewards distributed in room ${roomCode}`);
  });

  // ── Play again ─────────────────────────────────────────────────────────────
  socket.on("play_again", ({ roomCode, address }) => {
    socket.emit("redirect_lobby");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`QuizChain backend running on port ${PORT}`));