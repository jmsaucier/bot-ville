import { Command } from "commander";
import { api, getSessionContext } from "../api-client.js";

export const eventsCommand = new Command("events")
  .description("View recent events")
  .option("-n, --limit <count>", "Number of events to show", "20")
  .option("-w, --work-order <id>", "Filter by work order ID")
  .option("-f, --follow", "Stream events in real-time via WebSocket")
  .action(async (options: { limit: string; workOrder?: string; follow?: boolean }) => {
    const ctx = getSessionContext();

    if (options.follow) {
      await streamEvents(ctx.apiUrl, options.workOrder);
      return;
    }

    const params: Record<string, string> = {
      limit: options.limit,
    };

    if (options.workOrder) {
      params.workOrderId = options.workOrder;
    } else if (ctx.workOrderId) {
      params.workOrderId = ctx.workOrderId;
    }

    const events = (await api.listEvents(params)) as {
      id: string;
      timestamp: string;
      action: string;
      role: string | null;
      payload: Record<string, unknown>;
    }[];

    if (events.length === 0) {
      console.log("No events found.");
      return;
    }

    for (const event of events) {
      const time = new Date(event.timestamp).toLocaleTimeString();
      const role = event.role ? `[${event.role}]` : "";
      console.log(`${time} ${role.padEnd(18)} ${event.action}`);
    }

    console.log(`\n${events.length} event(s).`);
  });

async function streamEvents(apiUrl: string, workOrderId?: string): Promise<void> {
  const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws";
  console.log(`Connecting to ${wsUrl}...`);

  // Dynamic import for WebSocket (Node 18+ has built-in WebSocket)
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("Connected. Streaming events (Ctrl+C to stop)...\n");

    // Send subscription filter if needed
    if (workOrderId) {
      ws.send(
        JSON.stringify({
          type: "subscribe",
          filters: { workOrderId },
        })
      );
    }
  };

  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(String(msg.data)) as {
        event: { type: string; payload: unknown };
        role: string | null;
        timestamp: string;
      };
      const time = new Date(data.timestamp).toLocaleTimeString();
      const role = data.role ? `[${data.role}]` : "";
      console.log(`${time} ${role.padEnd(18)} ${data.event.type}`);
    } catch {
      // Ignore non-JSON messages
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };

  ws.onclose = () => {
    console.log("\nDisconnected.");
  };

  // Keep alive until Ctrl+C
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      ws.close();
      resolve();
    });
  });
}
