const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();

const app = require("./app");
const connectToDatabase = require("./config/db");
const { seedDevUser } = require("./config/devSeed");
const { attachQuizSocket } = require("./modules/live-sessions/socketService");
const {
  setRedisClient,
  recoverSessionsFromRedis,
} = require("./modules/live-sessions/socketSessionStore");

const PORT = process.env.PORT || 4000;

async function startServer() {
  await connectToDatabase();
  await seedDevUser();

  const allowedOrigins = (process.env.CLIENT_URL || "*")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
      credentials: true,
    },
  });

  if (process.env.REDIS_URL) {
    try {
      const Redis = require("ioredis");
      const { createAdapter } = require("@socket.io/redis-adapter");

      const pubClient = new Redis(process.env.REDIS_URL, { lazyConnect: true });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      setRedisClient(pubClient);
      io.adapter(createAdapter(pubClient, subClient));

      const recovered = await recoverSessionsFromRedis();
      console.log(
        `[Redis] Connected. Adapter active. Sessions recovered: ${recovered}`
      );
    } catch (err) {
      console.warn("[Redis] Failed to connect — running without Redis:", err.message);
    }
  }

  attachQuizSocket(io);

  server.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
