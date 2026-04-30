import { useState } from "react";
import { EventCard } from "../components/EventCard.js";
import type { FarmEvent, EventType } from "@repo/shared";

interface WsMessage {
  id: string;
  timestamp: string;
  event: FarmEvent;
}

interface EventTimelineProps {
  events: WsMessage[];
  clearEvents: () => void;
}

export function EventTimeline({ events, clearEvents }: EventTimelineProps) {
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");

  // Collect unique types and roles from events
  const types = [...new Set(events.map((e) => e.event.type))];

  const filtered = events.filter((e) => {
    if (typeFilter && e.event.type !== typeFilter) return false;
    const payload = e.event.payload as Record<string, unknown>;
    if (roleFilter && payload["roleId"] !== roleFilter) return false;
    return true;
  });

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
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
          Live Event Timeline
        </h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            placeholder="Filter by role..."
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ width: 150 }}
          />
          <button onClick={clearEvents}>Clear</button>
        </div>
      </div>

      <div
        style={{
          fontSize: "0.8rem",
          color: "var(--text-muted)",
          marginBottom: "1rem",
        }}
      >
        Showing {filtered.length} of {events.length} events
      </div>

      <div>
        {filtered.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--text-muted)", textAlign: "center" }}>
              No events yet. Events will appear here in real-time as the system operates.
            </p>
          </div>
        ) : (
          filtered.map((e) => (
            <EventCard
              key={e.id}
              id={e.id}
              timestamp={e.timestamp}
              event={e.event}
            />
          ))
        )}
      </div>
    </div>
  );
}
