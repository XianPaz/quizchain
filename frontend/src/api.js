import { normalizeRoomCode } from "./game/contract";

const BASE = import.meta.env.VITE_API_URL;

export { normalizeRoomCode };

// Canonical HTTP path: /sessions/cactus-maple
function roomCodePath(roomCode) {
  return encodeURIComponent(normalizeRoomCode(roomCode).replace(/ /g, "-"));
}

export async function createSession(roomCode, name, questions) {
  const body = { name, questions };
  if (roomCode) body.roomCode = roomCode;
  const res = await fetch(`${BASE}/sessions/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function validateSession(roomCode) {
  const res = await fetch(`${BASE}/sessions/${roomCodePath(roomCode)}`);
  return res.json(); // { success, session } or { error }
}

export async function deleteSession(roomCode, hostToken) {
  await fetch(`${BASE}/sessions/${roomCodePath(roomCode)}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "x-host-token": hostToken || "",
    },
  });
}