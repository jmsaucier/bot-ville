import { useState } from "react";
import type { FarmEvent } from "@repo/shared";

interface EventCardProps {
  id: string;
  timestamp: string;
  event: FarmEvent;
}

export function EventCard({ id, timestamp, event }: EventCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="card"
      style={{
        marginBottom: "0.5rem",
        cursor: "pointer",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <span
            style={{
              fontWeight: 600,
              fontSize: "0.85rem",
              color: "var(--accent)",
            }}
          >
            {event.type}
          </span>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      </div>

      {expanded && (
        <pre
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem",
            background: "var(--bg)",
            borderRadius: "4px",
            fontSize: "0.75rem",
            overflow: "auto",
            maxHeight: "300px",
          }}
        >
          {JSON.stringify({ id, ...event.payload }, null, 2)}
        </pre>
      )}
    </div>
  );
}
