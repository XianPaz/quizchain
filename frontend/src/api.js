const BASE = "http://localhost:3001";

export async function createSession(roomCode, name, questions) {
  const res = await fetch(`${BASE}/sessions/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomCode, name, questions }),
  });
  return res.json();
}

export async function validateSession(roomCode) {
  const res = await fetch(`${BASE}/sessions/${roomCode}`);
  return res.json(); // { success, session } or { error }
}

export async function deleteSession(roomCode) {
  await fetch(`${BASE}/sessions/${roomCode}`, { method: "DELETE" });
}