require("dotenv").config();
const { createServer } = require("./app");

const { server } = createServer();
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`QuizChain backend running on port ${PORT}`));
