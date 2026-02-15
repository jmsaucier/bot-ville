import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { PrismaClient } from "@prisma/client";
import {
  FarmEngine,
  EventBus,
  registerAllRoles,
  AgentRegistry,
  AgentSpawner,
} from "@repo/core";
import { PrismaAdapter } from "./persistence/prisma-adapter.js";
import { registerApiRoutes } from "./routes/api.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerWsRoute } from "./routes/ws.js";
import { registerDemoRoute } from "./routes/demo.js";
import { registerAgentRoutes } from "./routes/agents.js";

const PORT = Number(process.env["PORT"] ?? 4000);
const HOST = process.env["HOST"] ?? "0.0.0.0";

async function main() {
  // Initialize Prisma
  const prisma = new PrismaClient();
  await prisma.$connect();

  // Initialize core engine
  registerAllRoles();
  const eventBus = new EventBus();
  const adapter = new PrismaAdapter(prisma);
  const engine = new FarmEngine(adapter, eventBus);

  // Initialize agent orchestration
  const agentRegistry = new AgentRegistry();
  const agentSpawner = new AgentSpawner(agentRegistry, eventBus);

  // Create Fastify instance
  const app = Fastify({
    logger: {
      level: "info",
    },
  });

  // Register plugins
  await app.register(cors, { origin: true });
  await app.register(websocket);

  // Register routes
  registerApiRoutes(app, engine, adapter);
  registerPublicRoutes(app, engine, adapter, prisma);
  registerWsRoute(app, eventBus);
  registerDemoRoute(app, engine);
  registerAgentRoutes(app, prisma, agentSpawner, agentRegistry);

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info("Shutting down...");
    agentSpawner.killAll("Server shutdown");
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start server
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Farm backend running on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
