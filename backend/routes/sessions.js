const crypto = require("crypto");
const express = require("express");
const router = express.Router();
const store = require("../sessionStore");
const {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  parseRoomCode,
} = require("../roomCodes");

function roomCodeFromParam(param) {
  const raw = Array.isArray(param) ? param.join(" ") : param;
  return parseRoomCode(raw);
}

function hostTokenFromReq(req) {
  return req.get("x-host-token") || req.body?.hostToken || "";
}

function hostCreatePayload(session) {
  return {
    ...store.toPublicJSON(session),
    hostToken: session.hostToken,
  };
}

router.post("/create", (req, res) => {
  const { roomCode, name, questions } = req.body;
  if (!questions?.length) {
    return res.status(400).json({ error: "questions are required" });
  }

  let code;
  if (roomCode) {
    if (!isValidRoomCode(roomCode)) {
      return res.status(400).json({ error: "Invalid room code" });
    }
    code = normalizeRoomCode(roomCode);
    if (store.get(code)) {
      return res.status(409).json({ error: "Room code already in use" });
    }
  } else {
    try {
      code = generateRoomCode((candidate) => Boolean(store.get(candidate)));
    } catch {
      return res.status(503).json({ error: "Could not generate a unique room code" });
    }
  }

  const hostToken = crypto.randomBytes(32).toString("hex");
  const session = store.create(code, { name, questions, hostToken });
  res.json({ success: true, session: hostCreatePayload(session) });
});

router.get("/:roomCode", (req, res) => {
  const code = roomCodeFromParam(req.params.roomCode);
  if (!code) {
    return res.status(404).json({ error: "No active quiz found with that code" });
  }
  const session = store.get(code);
  if (!session) {
    return res.status(404).json({ error: "No active quiz found with that code" });
  }
  if (session.status === "finished") {
    return res.status(410).json({ error: "This quiz has already ended" });
  }
  res.json({ success: true, session: store.toPublicJSON(session) });
});

router.delete("/:roomCode", (req, res) => {
  const code = roomCodeFromParam(req.params.roomCode);
  const session = code ? store.get(code) : null;
  if (!session || hostTokenFromReq(req) !== session.hostToken) {
    return res.status(403).json({ error: "Forbidden" });
  }
  store.delete(code);
  res.json({ success: true });
});

module.exports = router;