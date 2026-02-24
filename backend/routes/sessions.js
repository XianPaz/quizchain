const express = require("express");
const router = express.Router();
const store = require("../sessionStore");

// Host creates a session
router.post("/create", (req, res) => {
  const { roomCode, name, questions } = req.body;
  if (!roomCode || !questions?.length) {
    return res.status(400).json({ error: "roomCode and questions are required" });
  }
  if (store.get(roomCode)) {
    return res.status(409).json({ error: "Room code already in use" });
  }
  const session = store.create(roomCode, { name, questions });
  res.json({ success: true, session });
});

// Player validates a room code
router.get("/:roomCode", (req, res) => {
  const session = store.get(req.params.roomCode.toUpperCase());
  if (!session) {
    return res.status(404).json({ error: "No active quiz found with that code" });
  }
  if (session.status === "finished") {
    return res.status(410).json({ error: "This quiz has already ended" });
  }
  res.json({ success: true, session });
});

// Delete session when quiz ends
router.delete("/:roomCode", (req, res) => {
  store.delete(req.params.roomCode.toUpperCase());
  res.json({ success: true });
});

module.exports = router;