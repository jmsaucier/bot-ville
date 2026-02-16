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

interface WorkOrderSummary {
  id: string;
  goal: string;
  status: string;
}

interface TaskSummary {
  id: string;
  title: string;
  status: string;
  ownerRole: string | null;
}

const ALL_ROLES = [
  "FARM_MANAGER",
  "FIELD_HAND",
  "FIELD_SCOUT",
  "GRAIN_ELEVATOR",
  "BELL_RINGER",
  "BARN_DOG",
  "HEEL",
  "BARN_CREW",
] as const;

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

  // Spawn form state
  const [showSpawnForm, setShowSpawnForm] = useState(false);
  const [spawnPresetId, setSpawnPresetId] = useState("");
  const [spawnRoleId, setSpawnRoleId] = useState<string>(ALL_ROLES[1]);
  const [spawnWorkOrderId, setSpawnWorkOrderId] = useState("");
  const [spawnTaskId, setSpawnTaskId] = useState("");
  const [spawnPrompt, setSpawnPrompt] = useState("");
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [spawning, setSpawning] = useState(false);

  // Data for spawn form dropdowns
  const [workOrders, setWorkOrders] = useState<WorkOrderSummary[]>([]);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);

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

  // Fetch work orders when the spawn form opens
  useEffect(() => {
    if (!showSpawnForm) return;
    api
      .listWorkOrders()
      .then((data) => setWorkOrders(data as WorkOrderSummary[]))
      .catch(() => setWorkOrders([]));
  }, [showSpawnForm]);

  // Fetch tasks when a work order is selected
  useEffect(() => {
    if (!spawnWorkOrderId) {
      setTasks([]);
      setSpawnTaskId("");
      return;
    }
    api
      .listTasks(spawnWorkOrderId)
      .then((data) => setTasks(data as TaskSummary[]))
      .catch(() => setTasks([]));
  }, [spawnWorkOrderId]);

  // Default the preset selector when presets load
  useEffect(() => {
    if (presets.length > 0 && !spawnPresetId) {
      setSpawnPresetId(presets[0]!.id);
    }
  }, [presets, spawnPresetId]);

  const resetSpawnForm = () => {
    setSpawnPresetId(presets[0]?.id ?? "");
    setSpawnRoleId(ALL_ROLES[1]);
    setSpawnWorkOrderId("");
    setSpawnTaskId("");
    setSpawnPrompt("");
    setSpawnError(null);
    setSpawning(false);
  };

  const handleOpenSpawnForm = () => {
    resetSpawnForm();
    setShowSpawnForm(true);
  };

  const handleCancelSpawn = () => {
    setShowSpawnForm(false);
    resetSpawnForm();
  };

  const handleSpawn = async () => {
    setSpawnError(null);
    setSpawning(true);
    try {
      await api.spawnAgent({
        agentPresetId: spawnPresetId || undefined,
        roleId: spawnRoleId,
        workOrderId: spawnWorkOrderId || undefined,
        taskId: spawnTaskId || undefined,
        initialPrompt: spawnPrompt.trim() || undefined,
      });
      setShowSpawnForm(false);
      resetSpawnForm();
      void refresh();
    } catch (err) {
      setSpawnError(err instanceof Error ? err.message : String(err));
    } finally {
      setSpawning(false);
    }
  };

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

          <button
            onClick={handleOpenSpawnForm}
            style={{
              padding: "0.4rem 0.8rem",
              fontSize: "0.8rem",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Spawn Agent
          </button>
        </div>
      </div>

      {/* Spawn Agent form */}
      {showSpawnForm && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3
            style={{
              fontSize: "0.75rem",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              letterSpacing: "0.05em",
              marginBottom: "0.75rem",
            }}
          >
            Spawn New Agent
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              marginBottom: "0.75rem",
            }}
          >
            {/* Agent Preset */}
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={labelStyle}>Agent Preset</span>
              <select
                value={spawnPresetId}
                onChange={(e) => setSpawnPresetId(e.target.value)}
                style={selectStyle}
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Role */}
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={labelStyle}>Role</span>
              <select
                value={spawnRoleId}
                onChange={(e) => setSpawnRoleId(e.target.value)}
                style={selectStyle}
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            {/* Work Order (optional) */}
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={labelStyle}>Work Order (optional)</span>
              <select
                value={spawnWorkOrderId}
                onChange={(e) => {
                  setSpawnWorkOrderId(e.target.value);
                  setSpawnTaskId("");
                }}
                style={selectStyle}
              >
                <option value="">None</option>
                {workOrders.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    {wo.goal.length > 50
                      ? wo.goal.slice(0, 50) + "..."
                      : wo.goal}{" "}
                    ({wo.status})
                  </option>
                ))}
              </select>
            </label>

            {/* Task (optional) */}
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={labelStyle}>Task (optional)</span>
              <select
                value={spawnTaskId}
                onChange={(e) => setSpawnTaskId(e.target.value)}
                disabled={!spawnWorkOrderId}
                style={{
                  ...selectStyle,
                  opacity: spawnWorkOrderId ? 1 : 0.5,
                  cursor: spawnWorkOrderId ? "pointer" : "not-allowed",
                }}
              >
                <option value="">None</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.status})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Initial Prompt */}
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              marginBottom: "0.75rem",
            }}
          >
            <span style={labelStyle}>Initial Prompt (optional)</span>
            <textarea
              value={spawnPrompt}
              onChange={(e) => setSpawnPrompt(e.target.value)}
              rows={3}
              placeholder="Instructions for the agent..."
              style={{
                padding: "0.4rem 0.6rem",
                fontSize: "0.8rem",
                background: "var(--bg-surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </label>

          {/* Error display */}
          {spawnError && (
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--danger)",
                margin: "0 0 0.5rem",
              }}
            >
              {spawnError}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => void handleSpawn()}
              disabled={spawning || !spawnRoleId}
              style={{
                padding: "0.4rem 1rem",
                fontSize: "0.8rem",
                background: spawning ? "var(--bg-hover)" : "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: spawning ? "not-allowed" : "pointer",
              }}
            >
              {spawning ? "Spawning..." : "Spawn"}
            </button>
            <button
              onClick={handleCancelSpawn}
              style={{
                padding: "0.4rem 0.8rem",
                fontSize: "0.8rem",
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const selectStyle: React.CSSProperties = {
  padding: "0.4rem 0.6rem",
  fontSize: "0.8rem",
  background: "var(--bg-surface)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "4px",
};
