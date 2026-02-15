import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../hooks/useApi.js";
import { StatusBadge } from "../components/StatusBadge.js";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  ownerRole: string | null;
  deps: string[];
}

interface Artifact {
  id: string;
  type: string;
  content: string;
  createdByRole: string;
  canonical: boolean;
  version: number;
  createdAt: string;
}

interface Decision {
  id: string;
  summary: string;
  rationale: string;
  role: string;
  createdAt: string;
}

interface Snapshot {
  workOrder: {
    id: string;
    goal: string;
    status: string;
    createdAt: string;
  };
  tasks: Task[];
  artifacts: Artifact[];
  decisions: Decision[];
  events: { id: string; action: string; timestamp: string; role: string | null }[];
}

export function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tasks" | "artifacts" | "decisions" | "events">("tasks");

  const refresh = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = (await api.getSnapshot(id)) as Snapshot;
      setSnapshot(data);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [id]);

  if (loading || !snapshot) {
    return <p style={{ color: "var(--text-muted)" }}>Loading...</p>;
  }

  const wo = snapshot.workOrder;

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <Link to="/" style={{ fontSize: "0.85rem" }}>
          &larr; Back to Dashboard
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 600 }}>{wo.goal}</h1>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              marginTop: "0.25rem",
            }}
          >
            <StatusBadge status={wo.status} />
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              ID: {wo.id.slice(0, 8)}...
            </span>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Created: {new Date(wo.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => void api.tick(wo.id).then(() => refresh())}>
            Run Tick
          </button>
          <button onClick={() => void refresh()}>Refresh</button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1rem",
        }}
      >
        {(["tasks", "artifacts", "decisions", "events"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              border: "none",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              borderRadius: 0,
              background: "transparent",
              color: tab === t ? "var(--accent)" : "var(--text-muted)",
              padding: "0.5rem 1rem",
              fontWeight: tab === t ? 600 : 400,
              textTransform: "capitalize",
            }}
          >
            {t} ({t === "tasks"
              ? snapshot.tasks.length
              : t === "artifacts"
                ? snapshot.artifacts.length
                : t === "decisions"
                  ? snapshot.decisions.length
                  : snapshot.events.length})
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "tasks" && <TasksTab tasks={snapshot.tasks} />}
      {tab === "artifacts" && <ArtifactsTab artifacts={snapshot.artifacts} />}
      {tab === "decisions" && (
        <DecisionsTab decisions={snapshot.decisions} />
      )}
      {tab === "events" && <EventsTab events={snapshot.events} />}
    </div>
  );
}

function TasksTab({ tasks }: { tasks: Task[] }) {
  return (
    <div>
      {tasks.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No tasks yet.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.85rem",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: "0.5rem" }}>Title</th>
              <th style={{ padding: "0.5rem" }}>Status</th>
              <th style={{ padding: "0.5rem" }}>Owner</th>
              <th style={{ padding: "0.5rem" }}>Deps</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.5rem" }}>
                  <div>{task.title}</div>
                  {task.description && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        marginTop: "0.15rem",
                      }}
                    >
                      {task.description.slice(0, 100)}
                    </div>
                  )}
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <StatusBadge status={task.status} />
                </td>
                <td style={{ padding: "0.5rem", color: "var(--text-muted)" }}>
                  {task.ownerRole ?? "—"}
                </td>
                <td style={{ padding: "0.5rem", color: "var(--text-muted)" }}>
                  {task.deps.length > 0 ? task.deps.map((d) => d.slice(0, 6)).join(", ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ArtifactsTab({ artifacts }: { artifacts: Artifact[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      {artifacts.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No artifacts yet.</p>
      ) : (
        artifacts.map((a) => (
          <div
            key={a.id}
            className="card"
            style={{ marginBottom: "0.5rem", cursor: "pointer" }}
            onClick={() => setExpanded(expanded === a.id ? null : a.id)}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>{a.type}</span>
                {a.canonical && (
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      padding: "0.1rem 0.4rem",
                      background: "var(--success)",
                      color: "#000",
                      borderRadius: "4px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                    }}
                  >
                    CANONICAL
                  </span>
                )}
                <span
                  style={{
                    marginLeft: "0.5rem",
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                  }}
                >
                  v{a.version} by {a.createdByRole}
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {new Date(a.createdAt).toLocaleTimeString()}
              </span>
            </div>
            {expanded === a.id && (
              <pre
                style={{
                  marginTop: "0.5rem",
                  padding: "0.75rem",
                  background: "var(--bg)",
                  borderRadius: "4px",
                  fontSize: "0.8rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: "400px",
                  overflow: "auto",
                }}
              >
                {a.content}
              </pre>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function DecisionsTab({ decisions }: { decisions: Decision[] }) {
  return (
    <div>
      {decisions.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No decisions yet.</p>
      ) : (
        decisions.map((d) => (
          <div key={d.id} className="card" style={{ marginBottom: "0.5rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 600 }}>{d.summary}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {d.role} &middot; {new Date(d.createdAt).toLocaleTimeString()}
              </span>
            </div>
            {d.rationale && (
              <p
                style={{
                  marginTop: "0.25rem",
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                }}
              >
                {d.rationale}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function EventsTab({
  events,
}: {
  events: { id: string; action: string; timestamp: string; role: string | null }[];
}) {
  return (
    <div>
      {events.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No events yet.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.8rem",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: "0.4rem" }}>Action</th>
              <th style={{ padding: "0.4rem" }}>Role</th>
              <th style={{ padding: "0.4rem" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.4rem", color: "var(--accent)" }}>
                  {e.action}
                </td>
                <td style={{ padding: "0.4rem", color: "var(--text-muted)" }}>
                  {e.role ?? "—"}
                </td>
                <td style={{ padding: "0.4rem", color: "var(--text-muted)" }}>
                  {new Date(e.timestamp).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
