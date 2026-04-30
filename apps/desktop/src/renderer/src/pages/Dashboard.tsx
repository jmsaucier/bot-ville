import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../hooks/useApi.js";
import { StatusBadge } from "../components/StatusBadge.js";
import type { FarmEvent } from "@bot-ville/shared";

interface WsMessage {
  id: string;
  timestamp: string;
  event: FarmEvent;
}

interface WorkOrder {
  id: string;
  goal: string;
  status: string;
  createdAt: string;
}

interface Health {
  status: string;
  uptime: number;
  workOrderCount: number;
  activeTaskCount: number;
  blockedTaskCount: number;
  lastTick: string | null;
}

export function Dashboard({ events }: { events: WsMessage[] }) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewWo, setShowNewWo] = useState(false);
  const [newGoal, setNewGoal] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [wos, h] = await Promise.all([
        api.listWorkOrders() as Promise<WorkOrder[]>,
        api.getHealth() as Promise<Health>,
      ]);
      setWorkOrders(wos);
      setHealth(h);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Auto-refresh on relevant events
  useEffect(() => {
    if (events.length > 0) {
      void refresh();
    }
  }, [events.length]);

  const handleCreateWorkOrder = async () => {
    if (!newGoal.trim()) return;
    await api.createWorkOrder(newGoal.trim());
    setNewGoal("");
    setShowNewWo(false);
    await refresh();
  };

  const handleRunDemo = async () => {
    await api.runDemo();
    await refresh();
  };

  const handleTick = async () => {
    if (workOrders[0]) {
      await api.tick(workOrders[0].id);
      await refresh();
    }
  };

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
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Dashboard</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={handleRunDemo} className="primary">
            Run Demo
          </button>
          <button onClick={handleTick}>Tick</button>
          <button onClick={() => setShowNewWo(true)}>New Work Order</button>
          <button onClick={() => void refresh()}>Refresh</button>
        </div>
      </div>

      {/* New Work Order Form */}
      {showNewWo && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginBottom: "0.5rem", fontSize: "0.9rem" }}>
            Create Work Order
          </h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              style={{ flex: 1 }}
              placeholder="Goal text..."
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateWorkOrder()}
            />
            <button className="primary" onClick={handleCreateWorkOrder}>
              Create
            </button>
            <button onClick={() => setShowNewWo(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Health Indicators */}
      {health && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <StatCard
            label="Work Orders"
            value={health.workOrderCount}
            color="var(--accent)"
          />
          <StatCard
            label="Active Tasks"
            value={health.activeTaskCount}
            color="var(--success)"
          />
          <StatCard
            label="Blocked Tasks"
            value={health.blockedTaskCount}
            color="var(--danger)"
          />
          <StatCard
            label="Last Tick"
            value={
              health.lastTick
                ? new Date(health.lastTick).toLocaleTimeString()
                : "Never"
            }
            color="var(--info)"
          />
        </div>
      )}

      {/* Work Orders Table */}
      <div className="card">
        <h3
          style={{
            marginBottom: "0.75rem",
            fontSize: "0.95rem",
            fontWeight: 600,
          }}
        >
          Work Orders
        </h3>
        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading...</p>
        ) : workOrders.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>
            No work orders yet. Create one or run the demo.
          </p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border)",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "0.5rem" }}>Goal</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((wo) => (
                <tr
                  key={wo.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "0.5rem" }}>
                    <Link to={`/work-orders/${wo.id}`}>{wo.goal}</Link>
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <StatusBadge status={wo.status} />
                  </td>
                  <td
                    style={{
                      padding: "0.5rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    {new Date(wo.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Events */}
      <div className="card" style={{ marginTop: "1rem" }}>
        <h3
          style={{
            marginBottom: "0.75rem",
            fontSize: "0.95rem",
            fontWeight: 600,
          }}
        >
          Recent Events ({events.length})
        </h3>
        {events.slice(0, 5).map((e) => (
          <div
            key={e.id}
            style={{
              padding: "0.35rem 0",
              fontSize: "0.8rem",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{ color: "var(--accent)" }}>{e.event.type}</span>
            <span style={{ color: "var(--text-muted)" }}>
              {new Date(e.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
        {events.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            No events yet.
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
        {label}
      </div>
    </div>
  );
}
