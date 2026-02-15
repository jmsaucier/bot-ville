import { useState, useEffect, useCallback } from "react";
import { api } from "../hooks/useApi.js";

interface AgentSession {
  id: string;
  agentPresetId: string;
  roleId: string;
  workOrderId: string | null;
  taskId: string | null;
  status: string;
  pid: number | null;
  workingDirectory: string | null;
  lastHeartbeat: string | null;
  spawnedAt: string;
  completedAt: string | null;
}

interface AgentPreset {
  id: string;
  name: string;
  command: string;
}

const STATUS_COLORS: Record<string, string> = {
  spawning: "var(--warning)",
  running: "var(--success)",
  paused: "var(--text-muted)",
  completed: "var(--accent)",
  failed: "var(--danger)",
  killed: "var(--danger)",
};

export function AgentsPanel() {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [presets, setPresets] = useState<AgentPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [agentData, presetData] = await Promise.all([
        api.listAgents(filter === "all" ? undefined : filter),
        api.listAgentPresets(),
      ]);
      setSessions(agentData as AgentSession[]);
      setPresets(presetData as AgentPreset[]);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleKill = async (id: string) => {
    await api.killAgent(id, "Killed from console");
    void refresh();
  };

  const activeCount = sessions.filter(
    (s) => s.status === "running" || s.status === "spawning"
  ).length;

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
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            Agents
          </h1>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              margin: "0.25rem 0 0",
            }}
          >
            {activeCount} active, {sessions.length} total
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: "0.4rem 0.6rem",
              fontSize: "0.8rem",
              background: "var(--bg-surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
            }}
          >
            <option value="all">All</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="killed">Killed</option>
          </select>

          <button
            onClick={() => void refresh()}
            style={{
              padding: "0.4rem 0.8rem",
              fontSize: "0.8rem",
              background: "var(--bg-hover)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Presets overview */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3
          style={{
            fontSize: "0.75rem",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            letterSpacing: "0.05em",
            marginBottom: "0.5rem",
          }}
        >
          Available Agent Presets
        </h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {presets.map((preset) => (
            <span
              key={preset.id}
              style={{
                padding: "0.25rem 0.6rem",
                fontSize: "0.75rem",
                background: "var(--bg-hover)",
                borderRadius: "4px",
                border: "1px solid var(--border)",
              }}
            >
              {preset.name}{" "}
              <span style={{ color: "var(--text-muted)" }}>
                ({preset.command})
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Sessions table */}
      {loading && sessions.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      ) : sessions.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: "center", color: "var(--text-muted)" }}
        >
          No agent sessions found.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "var(--bg-hover)",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  letterSpacing: "0.05em",
                }}
              >
                <th style={{ ...thStyle }}>Status</th>
                <th style={{ ...thStyle }}>Agent</th>
                <th style={{ ...thStyle }}>Role</th>
                <th style={{ ...thStyle }}>PID</th>
                <th style={{ ...thStyle }}>Spawned</th>
                <th style={{ ...thStyle }}>Heartbeat</th>
                <th style={{ ...thStyle }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td style={{ ...tdStyle }}>
                    <span
                      style={{
                        color: STATUS_COLORS[session.status] ?? "var(--text)",
                        fontWeight: 500,
                        fontSize: "0.8rem",
                      }}
                    >
                      {session.status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: "0.8rem" }}>
                    {session.agentPresetId}
                  </td>
                  <td style={{ ...tdStyle, fontSize: "0.8rem" }}>
                    {session.roleId}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontSize: "0.75rem",
                      fontFamily: "monospace",
                    }}
                  >
                    {session.pid ?? "-"}
                  </td>
                  <td style={{ ...tdStyle, fontSize: "0.75rem" }}>
                    {new Date(session.spawnedAt).toLocaleTimeString()}
                  </td>
                  <td style={{ ...tdStyle, fontSize: "0.75rem" }}>
                    {session.lastHeartbeat
                      ? new Date(session.lastHeartbeat).toLocaleTimeString()
                      : "-"}
                  </td>
                  <td style={{ ...tdStyle }}>
                    {(session.status === "running" ||
                      session.status === "spawning") && (
                      <button
                        onClick={() => void handleKill(session.id)}
                        style={{
                          padding: "0.2rem 0.5rem",
                          fontSize: "0.7rem",
                          background: "transparent",
                          color: "var(--danger)",
                          border: "1px solid var(--danger)",
                          borderRadius: "3px",
                          cursor: "pointer",
                        }}
                      >
                        Kill
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: "0.5rem 0.75rem",
  textAlign: "left" as const,
  fontWeight: 500,
};

const tdStyle = {
  padding: "0.5rem 0.75rem",
};
