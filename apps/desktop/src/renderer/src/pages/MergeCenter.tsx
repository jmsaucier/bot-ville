import { useState, useEffect } from "react";
import { api } from "../hooks/useApi.js";

interface WorkOrder {
  id: string;
  goal: string;
  status: string;
}

interface Artifact {
  id: string;
  type: string;
  content: string;
  createdByRole: string;
  canonical: boolean;
  version: number;
}

export function MergeCenter() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedWo, setSelectedWo] = useState<string>("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [mergeType, setMergeType] = useState("");
  const [mergeResult, setMergeResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listWorkOrders().then((wos) => {
      setWorkOrders(wos as WorkOrder[]);
    });
  }, []);

  useEffect(() => {
    if (!selectedWo) {
      setArtifacts([]);
      return;
    }
    api.listArtifacts(selectedWo).then((arts) => {
      setArtifacts(arts as Artifact[]);
    });
  }, [selectedWo]);

  const drafts = artifacts.filter((a) => !a.canonical);
  const canonical = artifacts.filter((a) => a.canonical);
  const types = [...new Set(drafts.map((a) => a.type))];

  const handleMerge = async () => {
    if (!selectedWo || !mergeType) return;
    setLoading(true);
    try {
      const result = await api.requestMerge(selectedWo, mergeType);
      setMergeResult(result as Record<string, unknown>);
      // Refresh artifacts
      const arts = await api.listArtifacts(selectedWo);
      setArtifacts(arts as Artifact[]);
    } catch (err) {
      setMergeResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    setLoading(false);
  };

  return (
    <div>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 600,
          marginBottom: "1.5rem",
        }}
      >
        Merge Center (Grain Elevator)
      </h1>

      {/* Work Order Selector */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <label style={{ fontSize: "0.85rem" }}>Work Order:</label>
          <select
            value={selectedWo}
            onChange={(e) => setSelectedWo(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">Select a work order...</option>
            {workOrders.map((wo) => (
              <option key={wo.id} value={wo.id}>
                {wo.goal} ({wo.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedWo && (
        <>
          {/* Merge Controls */}
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              Merge Drafts
            </h3>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <select
                value={mergeType}
                onChange={(e) => setMergeType(e.target.value)}
              >
                <option value="">Select artifact type...</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t} ({drafts.filter((d) => d.type === t).length} drafts)
                  </option>
                ))}
              </select>
              <button
                className="primary"
                onClick={handleMerge}
                disabled={!mergeType || loading}
              >
                {loading ? "Merging..." : "Request Merge"}
              </button>
            </div>
          </div>

          {/* Merge Result */}
          {mergeResult && (
            <div
              className="card"
              style={{
                marginBottom: "1rem",
                borderColor: mergeResult["success"]
                  ? "var(--success)"
                  : "var(--danger)",
              }}
            >
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Merge Result
              </h3>
              <pre
                style={{
                  background: "var(--bg)",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.8rem",
                  overflow: "auto",
                }}
              >
                {JSON.stringify(mergeResult, null, 2)}
              </pre>
            </div>
          )}

          {/* Drafts vs Canonical */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Drafts ({drafts.length})
              </h3>
              {drafts.map((a) => (
                <ArtifactPreview key={a.id} artifact={a} />
              ))}
              {drafts.length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  No drafts.
                </p>
              )}
            </div>
            <div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Canonical ({canonical.length})
              </h3>
              {canonical.map((a) => (
                <ArtifactPreview key={a.id} artifact={a} />
              ))}
              {canonical.length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  No canonical artifacts yet.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="card"
      style={{
        marginBottom: "0.5rem",
        cursor: "pointer",
        borderColor: artifact.canonical ? "var(--success)" : "var(--border)",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
          {artifact.type}
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          v{artifact.version} by {artifact.createdByRole}
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
            whiteSpace: "pre-wrap",
            maxHeight: "300px",
            overflow: "auto",
          }}
        >
          {artifact.content}
        </pre>
      )}
    </div>
  );
}
