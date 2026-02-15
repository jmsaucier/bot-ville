"use client";

import { useState, useEffect, useRef } from "react";
import type { FarmEvent } from "@repo/shared";

interface WsMessage {
  id: string;
  timestamp: string;
  event: FarmEvent;
}

export default function EventsPage() {
  const [events, setEvents] = useState<WsMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket("ws://localhost:4000/ws");
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string) as Record<string, unknown>;
          if (data["event"]) {
            setEvents((prev) =>
              [data as unknown as WsMessage, ...prev].slice(0, 500)
            );
          }
        } catch {
          // ignore
        }
      };
    };

    connect();
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ fontSize: "1.3rem", fontWeight: 600 }}>
          Live Event Timeline
        </h2>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: connected ? "var(--success)" : "var(--danger)",
            }}
          >
            {connected ? "Connected" : "Disconnected"}
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {events.length} events
          </span>
        </div>
      </div>

      {events.length === 0 ? (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "2rem",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          No events yet. Events will appear here in real-time.
        </div>
      ) : (
        events.map((e) => (
          <div
            key={e.id}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              marginBottom: "0.5rem",
              cursor: "pointer",
            }}
            onClick={() =>
              setExpanded(expanded === e.id ? null : e.id)
            }
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  color: "var(--accent)",
                }}
              >
                {e.event.type}
              </span>
              <span
                style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
              >
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>
            </div>
            {expanded === e.id && (
              <pre
                style={{
                  marginTop: "0.5rem",
                  padding: "0.5rem",
                  background: "var(--bg)",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  overflow: "auto",
                }}
              >
                {JSON.stringify(e.event.payload, null, 2)}
              </pre>
            )}
          </div>
        ))
      )}
    </div>
  );
}
