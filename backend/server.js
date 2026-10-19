require("dotenv").config();
const { createServer } = require("./app");

// Socket handlers and question timers catch their own errors in app.js, so a room
// that fails stays contained. Anything that still reaches here left the process in
// an unknown state: log it and exit, so the supervisor starts a clean one.
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception, exiting:", err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection, exiting:", err);
  process.exit(1);
});

const { server } = createServer();
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`QuizChain backend running on port ${PORT}`));
