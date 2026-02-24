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
  console.log("Client connected:", socket.id);

  // Host or player joins a socket room
  socket.on("join_room", ({ roomCode, player }) => {
    socket.join(roomCode);
    if (player) {
      const session = store.addPlayer(roomCode, player);
      if (session) {
        // Notify everyone in the room a new player joined
        io.to(roomCode).emit("player_joined", { players: session.players });
      }
    }
  });

  // Host starts the quiz
  socket.on("start_quiz", ({ roomCode }) => {
    store.setStatus(roomCode, "active");
    io.to(roomCode).emit("quiz_started");
  });

  // Host broadcasts next question
  socket.on("next_question", ({ roomCode, questionIndex }) => {
    io.to(roomCode).emit("question", { questionIndex });
  });

  // Player submits answer — host receives it
  socket.on("submit_answer", ({ roomCode, player, questionIndex, answerIndex, timeRemaining, timeLimit }) => {
    const speedScore = Math.round((timeRemaining / timeLimit) * 100);
    // Broadcast to host only (host is also in the room)
    io.to(roomCode).emit("answer_received", {
      player,
      questionIndex,
      answerIndex,
      speedScore,
    });
  });

  // Host ends quiz and triggers reward distribution
  socket.on("end_quiz", ({ roomCode }) => {
    store.setStatus(roomCode, "finished");
    const session = store.get(roomCode);
    io.to(roomCode).emit("quiz_ended", { players: session?.players });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`QuizChain backend running on port ${PORT}`));