const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();

const app = require("./app");
const connectToDatabase = require("./config/db");
const { attachQuizSocket } = require("./modules/live-sessions/socketService");

const PORT = process.env.PORT || 4000;

async function startServer() {
  await connectToDatabase();

  const allowedOrigins = (process.env.CLIENT_URL || "*")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
    },
  });

  attachQuizSocket(io);

  server.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
