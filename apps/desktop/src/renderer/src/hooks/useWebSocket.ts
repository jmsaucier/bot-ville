import { useState, useEffect, useRef, useCallback } from "react";
import type { FarmEvent } from "@bot-ville/shared";

interface WsMessage {
  id: string;
  timestamp: string;
  event: FarmEvent;
}

interface UseWebSocketResult {
  events: WsMessage[];
  connected: boolean;
  sendFilter: (filters: Record<string, unknown>) => void;
  clearEvents: () => void;
}

export function useWebSocket(
  url = "ws://localhost:4000/ws"
): UseWebSocketResult {
  const [events, setEvents] = useState<WsMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string) as Record<string, unknown>;
          if (data["event"]) {
            setEvents((prev) => [data as unknown as WsMessage, ...prev].slice(0, 500));
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 2 seconds
        reconnectTimer.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimer.current = setTimeout(connect, 2000);
    }
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendFilter = useCallback((filters: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", filters }));
    }
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, connected, sendFilter, clearEvents };
}
