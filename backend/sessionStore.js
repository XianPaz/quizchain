// In-memory store — sessions live as long as the server is running
const sessions = {};

module.exports = {
  create(roomCode, sessionData) {
    sessions[roomCode] = {
      ...sessionData,
      roomCode,
      players: [],
      status: "waiting", // waiting | active | finished
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
    if (!already) sessions[roomCode].players.push(player);
    return sessions[roomCode];
  },

  setStatus(roomCode, status) {
    if (!sessions[roomCode]) return null;
    sessions[roomCode].status = status;
    return sessions[roomCode];
  },

  getAll() {
    return sessions;
  },

  delete(roomCode) {
    delete sessions[roomCode];
  },
};