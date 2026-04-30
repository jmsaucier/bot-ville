import { publicApi } from "../lib/api";

export const dynamic = "force-dynamic";

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

const STATUS_COLORS: Record<string, string> = {
  spawning: "var(--warning)",
  running: "var(--success)",
  paused: "var(--text-muted)",
  completed: "var(--accent)",
  failed: "var(--danger)",
  killed: "var(--danger)",
};

export default async function AgentsPage() {
  let sessions: AgentSession[] = [];
  let error: string | null = null;

  try {
    sessions = (await publicApi.listAgents()) as AgentSession[];
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const activeCount = sessions.filter(
    (s) => s.status === "running" || s.status === "spawning"
  ).length;

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.25rem" }}>
        Agent Sessions
      </h1>
      <p
        style={{
          fontSize: "0.85rem",
          color: "var(--text-muted)",
          marginBottom: "1.5rem",
        }}
      >
        {activeCount} active, {sessions.length} total
      </p>

      {error ? (
        <Section>
          <p style={{ color: "var(--danger)" }}>Error: {error}</p>
        </Section>
      ) : sessions.length === 0 ? (
        <Section>
          <p style={{ color: "var(--text-muted)", textAlign: "center" }}>
            No agent sessions found.
          </p>
        </Section>
      ) : (
        <Section noPadding>
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
                <Th>Status</Th>
                <Th>Agent</Th>
                <Th>Role</Th>
                <Th>PID</Th>
                <Th>Spawned</Th>
                <Th>Heartbeat</Th>
                <Th>Session ID</Th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <Td>
                    <span
                      style={{
                        color:
                          STATUS_COLORS[session.status] ?? "var(--text)",
                        fontWeight: 500,
                        fontSize: "0.8rem",
                      }}
                    >
                      {session.status}
                    </span>
                  </Td>
                  <Td>{session.agentPresetId}</Td>
                  <Td>{session.roleId}</Td>
                  <Td mono>{session.pid ?? "-"}</Td>
                  <Td small>
                    {new Date(session.spawnedAt).toLocaleString()}
                  </Td>
                  <Td small>
                    {session.lastHeartbeat
                      ? new Date(session.lastHeartbeat).toLocaleString()
                      : "-"}
                  </Td>
                  <Td mono small>
                    {session.id.slice(0, 8)}...
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}

function Section({
  children,
  noPadding,
}: {
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: noPadding ? 0 : "1rem",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "0.5rem 0.75rem",
        textAlign: "left",
        fontWeight: 500,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  mono,
  small,
}: {
  children: React.ReactNode;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <td
      style={{
        padding: "0.5rem 0.75rem",
        fontSize: small ? "0.75rem" : "0.8rem",
        fontFamily: mono ? "monospace" : "inherit",
      }}
    >
      {children}
    </td>
  );
}
