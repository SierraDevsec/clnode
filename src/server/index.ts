import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { getDb } from "./db.js";
import hooks from "./routes/hooks.js";
import api from "./routes/api.js";
import { addClient, removeClient } from "./routes/ws.js";

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// WebSocket 엔드포인트
app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen(_event, ws) {
      console.log("[ws] client connected");
      addClient(ws);
    },
    onClose(_event, ws) {
      console.log("[ws] client disconnected");
      removeClient(ws);
    },
    onError(error) {
      console.error("[ws] error:", error);
    },
  }))
);

// 라우트 마운트
app.route("/hooks", hooks);
app.route("/api", api);

// 루트
app.get("/", (c) => {
  return c.json({
    name: "clnode",
    version: "0.1.0",
    endpoints: {
      hooks: "POST /hooks/:event",
      api: "GET /api/*",
      ws: "GET /ws",
    },
  });
});

const PORT = parseInt(process.env.CLNODE_PORT ?? "3100", 10);

async function main() {
  // DB 초기화
  await getDb();
  console.log(`[clnode] database initialized`);

  const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`[clnode] server running on http://localhost:${info.port}`);
  });

  injectWebSocket(server);

  // graceful shutdown
  const shutdown = async () => {
    console.log("\n[clnode] shutting down...");
    const { closeDb } = await import("./db.js");
    await closeDb();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[clnode] Fatal error:", err);
  process.exit(1);
});
