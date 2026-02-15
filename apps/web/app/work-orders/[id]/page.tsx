import { publicApi } from "../../lib/api";
import { StatusBadge } from "../../components/StatusBadge";

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

export const dynamic = "force-dynamic";

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let snapshot: Snapshot | null = null;
  let error: string | null = null;

  try {
    snapshot = (await publicApi.getSnapshot(id)) as Snapshot;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load work order";
  }

  if (error || !snapshot) {
    return (
      <div>
        <a href="/" style={{ fontSize: "0.85rem" }}>
          &larr; Back
        </a>
        <p style={{ color: "var(--danger)", marginTop: "1rem" }}>
          {error ?? "Work order not found"}
        </p>
      </div>
    );
  }

  const wo = snapshot.workOrder;
  const canonicalArtifacts = snapshot.artifacts.filter((a) => a.canonical);
  const draftArtifacts = snapshot.artifacts.filter((a) => !a.canonical);

  return (
    <div>
      <a href="/" style={{ fontSize: "0.85rem" }}>
        &larr; Back to Dashboard
      </a>

      <div style={{ marginTop: "1rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 600 }}>{wo.goal}</h2>
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
            Created: {new Date(wo.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Tasks */}
      <Section title={`Tasks (${snapshot.tasks.length})`}>
        {snapshot.tasks.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No tasks.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem" }}>Title</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.tasks.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem" }}>{t.title}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <StatusBadge status={t.status} />
                  </td>
                  <td style={{ padding: "0.5rem", color: "var(--text-muted)" }}>
                    {t.ownerRole ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Canonical Artifacts */}
      <Section title={`Canonical Artifacts (${canonicalArtifacts.length})`}>
        {canonicalArtifacts.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No canonical artifacts yet.</p>
        ) : (
          canonicalArtifacts.map((a) => <ArtifactView key={a.id} artifact={a} />)
        )}
      </Section>

      {/* Draft Artifacts */}
      <Section title={`Draft Artifacts (${draftArtifacts.length})`}>
        {draftArtifacts.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No drafts.</p>
        ) : (
          draftArtifacts.map((a) => <ArtifactView key={a.id} artifact={a} />)
        )}
      </Section>

      {/* Decisions */}
      <Section title={`Decisions (${snapshot.decisions.length})`}>
        {snapshot.decisions.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No decisions.</p>
        ) : (
          snapshot.decisions.map((d) => (
            <div
              key={d.id}
              style={{
                padding: "0.5rem",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{d.summary}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {d.role}
                </span>
              </div>
              {d.rationale && (
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                  {d.rationale}
                </p>
              )}
            </div>
          ))
        )}
      </Section>

      {/* Recent Events */}
      <Section title={`Events (${snapshot.events.length})`}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: "0.4rem" }}>Action</th>
              <th style={{ padding: "0.4rem" }}>Role</th>
              <th style={{ padding: "0.4rem" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.events.slice(0, 50).map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.4rem", color: "var(--accent)" }}>{e.action}</td>
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
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "1rem",
        marginBottom: "1rem",
      }}
    >
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function ArtifactView({ artifact }: { artifact: Artifact }) {
  return (
    <div
      style={{
        padding: "0.5rem",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
          {artifact.type}
          {artifact.canonical && (
            <span
              style={{
                marginLeft: "0.5rem",
                padding: "0.1rem 0.3rem",
                background: "var(--success)",
                color: "#000",
                borderRadius: "4px",
                fontSize: "0.65rem",
                fontWeight: 700,
              }}
            >
              CANONICAL
            </span>
          )}
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          v{artifact.version} by {artifact.createdByRole}
        </span>
      </div>
      <pre
        style={{
          marginTop: "0.5rem",
          padding: "0.5rem",
          background: "var(--bg)",
          borderRadius: "4px",
          fontSize: "0.75rem",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: "200px",
          overflow: "auto",
        }}
      >
        {artifact.content}
      </pre>
    </div>
  );
}
