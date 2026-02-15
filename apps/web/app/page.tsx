import { publicApi } from "./lib/api.js";
import { StatusBadge } from "./components/StatusBadge.js";

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

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let workOrders: WorkOrder[] = [];
  let health: Health | null = null;
  let error: string | null = null;

  try {
    [workOrders, health] = await Promise.all([
      publicApi.listWorkOrders() as Promise<WorkOrder[]>,
      publicApi.getHealth() as Promise<Health>,
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to connect to backend";
  }

  return (
    <div>
      <h2
        style={{
          fontSize: "1.3rem",
          fontWeight: 600,
          marginBottom: "1.5rem",
        }}
      >
        Dashboard
      </h2>

      {error && (
        <div
          style={{
            padding: "1rem",
            background: "var(--bg-surface)",
            border: "1px solid var(--danger)",
            borderRadius: "8px",
            marginBottom: "1rem",
            color: "var(--danger)",
          }}
        >
          Backend not available: {error}
        </div>
      )}

      {/* Health Cards */}
      {health && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <StatCard label="Work Orders" value={health.workOrderCount} />
          <StatCard label="Active Tasks" value={health.activeTaskCount} />
          <StatCard label="Blocked Tasks" value={health.blockedTaskCount} />
          <StatCard
            label="Last Tick"
            value={health.lastTick ? new Date(health.lastTick).toLocaleTimeString() : "Never"}
          />
        </div>
      )}

      {/* Work Orders */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "1rem",
        }}
      >
        <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Work Orders
        </h3>
        {workOrders.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>
            No work orders yet. Use the Electron desktop app to create work orders.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem" }}>Goal</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((wo) => (
                <tr key={wo.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem" }}>
                    <a href={`/work-orders/${wo.id}`}>{wo.goal}</a>
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <StatusBadge status={wo.status} />
                  </td>
                  <td style={{ padding: "0.5rem", color: "var(--text-muted)" }}>
                    {new Date(wo.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "1rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent)" }}>
        {value}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}
