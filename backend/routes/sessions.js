const crypto = require("crypto");
const express = require("express");
const router = express.Router();
const store = require("../sessionStore");
const { validateQuestions } = require("../../shared/gameContract");
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

const CLASS_NAME_MAX = 40;

// La clase termina escrita on-chain en el NFT de podio, que no se puede re-mintear:
// se recorta acá y se rechaza lo que el contrato rechazaría.
function parseClassName(raw) {
  if (raw === undefined || raw === null) return { ok: true, value: "" };
  if (typeof raw !== "string") return { ok: false };
  const value = raw.trim();
  if (value.length > CLASS_NAME_MAX || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) {
    return { ok: false };
  }
  return { ok: true, value };
}

function localDate(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

router.post("/create", (req, res) => {
  const { roomCode, name, questions } = req.body;
  const valid = validateQuestions(questions);
  if (!valid.ok) {
    return res.status(400).json({ error: valid.error });
  }
  const className = parseClassName(req.body.className);
  if (!className.ok) {
    return res.status(400).json({ error: "Invalid class name" });
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
  // El código de sala se reusa con el tiempo; el sessionId no, y es la clave
  // que usa el contrato para no dar dos medallas del mismo quiz.
  const date = localDate();
  const sessionId = `${date}-${code.replace(/ /g, "-")}-${crypto.randomBytes(3).toString("hex")}`;
  const session = store.create(code, {
    name, questions, hostToken, className: className.value, date, sessionId,
  });
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