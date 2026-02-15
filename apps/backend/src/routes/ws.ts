import type { FastifyInstance } from "fastify";
import type { EventBus } from "@repo/core";
import type { FarmEvent, RoleId, EventType } from "@repo/shared";
import type { WebSocket } from "ws";

interface SubscriptionFilters {
  workOrderId?: string;
  eventTypes?: EventType[];
  roles?: RoleId[];
}

/**
 * WebSocket route for real-time event streaming.
 * Clients connect to ws://host:port/ws and receive farm events as JSON.
 * Optional: send a JSON message to set subscription filters.
 */
export function registerWsRoute(
  app: FastifyInstance,
  eventBus: EventBus
): void {
  const clients = new Set<{
    socket: WebSocket;
    filters: SubscriptionFilters;
  }>();

  // Subscribe to all events and broadcast to connected clients
  eventBus.onAny((event: FarmEvent) => {
    const message = JSON.stringify({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      event,
    });

    for (const client of clients) {
      if (client.socket.readyState === 1) {
        // OPEN
        if (matchesFilters(event, client.filters)) {
          client.socket.send(message);
        }
      }
    }
  });

  app.get("/ws", { websocket: true }, (socket, _request) => {
    const client = { socket, filters: {} as SubscriptionFilters };
    clients.add(client);

    app.log.info(`WebSocket client connected (${clients.size} total)`);

    // Clients can send filter updates
    socket.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as {
          type?: string;
          filters?: SubscriptionFilters;
        };
        if (msg.type === "subscribe" && msg.filters) {
          client.filters = msg.filters;
          socket.send(
            JSON.stringify({
              type: "subscribed",
              filters: client.filters,
            })
          );
        }
      } catch {
        // Ignore malformed messages
      }
    });

    socket.on("close", () => {
      clients.delete(client);
      app.log.info(`WebSocket client disconnected (${clients.size} total)`);
    });

    // Send welcome message
    socket.send(
      JSON.stringify({
        type: "connected",
        message: "Connected to Farm Event Stream",
        timestamp: new Date().toISOString(),
      })
    );
  });
}

function matchesFilters(
  event: FarmEvent,
  filters: SubscriptionFilters
): boolean {
  if (filters.eventTypes && filters.eventTypes.length > 0) {
    if (!filters.eventTypes.includes(event.type as EventType)) {
      return false;
    }
  }

  // Check workOrderId from payload if present
  if (filters.workOrderId) {
    const payload = event.payload as Record<string, unknown>;
    if (payload["workOrderId"] && payload["workOrderId"] !== filters.workOrderId) {
      return false;
    }
  }

  return true;
}
