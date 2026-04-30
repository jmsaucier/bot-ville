const STATUS_COLORS: Record<string, string> = {
  NEW: "var(--status-new)",
  ASSIGNED: "var(--status-assigned)",
  IN_PROGRESS: "var(--status-in-progress)",
  BLOCKED: "var(--status-blocked)",
  REVIEW: "var(--status-review)",
  MERGED: "var(--status-merged)",
  DONE: "var(--status-done)",
  FAILED: "var(--status-failed)",
};

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "var(--text-muted)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.15rem 0.5rem",
        borderRadius: "9999px",
        fontSize: "0.7rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        background: `color-mix(in srgb, ${color} 20%, transparent)`,
        color,
        border: `1px solid ${color}`,
      }}
    >
      {status.replace("_", " ")}
    </span>
  );
}
