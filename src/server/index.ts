import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createNodeWebSocket } from "@hono/node-ws";
import { getDb } from "./db.js";
import hooks from "./routes/hooks.js";
import api from "./routes/api.js";
import { addClient, removeClient } from "./routes/ws.js";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

// 프로덕션: 빌드된 Web UI 서빙
const __dirname = dirname(fileURLToPath(import.meta.url));
const webDistPath = resolve(__dirname, "../web");

if (existsSync(webDistPath)) {
  app.use("/*", serveStatic({ root: webDistPath }));
  // SPA fallback: 매칭되지 않는 경로는 index.html로
  app.get("/*", serveStatic({ root: webDistPath, path: "index.html" }));
} else {
  app.get("/", (c) => {
    return c.json({
      name: "clnode",
      version: "0.1.0",
      endpoints: {
        hooks: "POST /hooks/:event",
        api: "GET /api/*",
        ws: "GET /ws",
        ui: "Run 'pnpm build:web' first, then restart",
      },
    });
  });
}

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
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("EADDRINUSE")) {
    console.error(`[clnode] Port ${PORT} is already in use. Is another clnode instance running?`);
    console.error(`[clnode] Try: clnode stop, or use CLNODE_PORT=<port> clnode start`);
  } else if (msg.includes("duckdb") || msg.includes("DuckDB")) {
    console.error(`[clnode] Database error: ${msg}`);
    console.error(`[clnode] Try deleting data/clnode.duckdb and restarting`);
  } else {
    console.error("[clnode] Fatal error:", msg);
  }
  process.exit(1);
});
