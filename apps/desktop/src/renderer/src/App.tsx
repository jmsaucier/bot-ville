import { useState, useEffect, useCallback } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { api } from "./hooks/useApi.js";
import { Dashboard } from "./pages/Dashboard.js";
import { WorkOrderDetail } from "./pages/WorkOrderDetail.js";
import { EventTimeline } from "./pages/EventTimeline.js";
import { RolePanels } from "./pages/RolePanels.js";
import { MergeCenter } from "./pages/MergeCenter.js";
import { AgentsPanel } from "./pages/AgentsPanel.js";

export function App() {
  const ws = useWebSocket();
  const [projectName, setProjectName] = useState<string | null>(null);
  const [projectDirectory, setProjectDirectory] = useState<string | null>(null);
  const [webDashboardUrl, setWebDashboardUrl] = useState<string | null>(null);

  // Hydrate project context on mount
  useEffect(() => {
    api
      .getProject()
      .then((ctx) => {
        setProjectName(ctx.projectName);
        setProjectDirectory(ctx.projectDirectory);
      })
      .catch(() => {
        // Backend may not be ready yet
      });

    // Check web dashboard status
    if (window.electronAPI) {
      window.electronAPI.getWebDashboardInfo().then((info) => {
        if (info.running) {
          setWebDashboardUrl(info.url);
        }
      });
    }
  }, []);

  const handleSelectProject = useCallback(async () => {
    const dir = window.electronAPI
      ? await window.electronAPI.openDirectoryDialog()
      : null;
    if (!dir) return;

    try {
      const result = await api.setProject(dir);
      setProjectName(result.projectName);
      setProjectDirectory(result.projectDirectory);
    } catch (err) {
      console.error("Failed to set project:", err);
    }
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <nav
        style={{
          width: 220,
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border)",
          padding: "1rem 0",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "0 1rem 1rem",
            borderBottom: "1px solid var(--border)",
            marginBottom: "0.5rem",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Farm Ops Console</h2>
          <div
            style={{
              fontSize: "0.75rem",
              color: ws.connected ? "var(--success)" : "var(--danger)",
              marginTop: "0.25rem",
            }}
          >
            {ws.connected ? "Connected" : "Disconnected"}
          </div>
        </div>

        {/* Project selector */}
        <div
          style={{
            padding: "0.5rem 1rem",
            borderBottom: "1px solid var(--border)",
            marginBottom: "0.5rem",
          }}
        >
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.25rem",
            }}
          >
            Project
          </div>
          {projectName ? (
            <button
              onClick={handleSelectProject}
              style={{
                display: "block",
                width: "100%",
                padding: "0.35rem 0.5rem",
                fontSize: "0.8rem",
                background: "var(--bg-hover)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "var(--text)",
                cursor: "pointer",
                textAlign: "left",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={projectDirectory ?? undefined}
            >
              {projectName}
            </button>
          ) : (
            <button
              onClick={handleSelectProject}
              style={{
                display: "block",
                width: "100%",
                padding: "0.35rem 0.5rem",
                fontSize: "0.8rem",
                background: "var(--accent)",
                border: "none",
                borderRadius: 4,
                color: "#fff",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              Select Project
            </button>
          )}
        </div>

        <NavItem to="/" label="Dashboard" />
        <NavItem to="/agents" label="Agents" />
        <NavItem to="/events" label="Event Timeline" />
        <NavItem to="/roles" label="Role Panels" />
        <NavItem to="/merge" label="Merge Center" />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Web dashboard link */}
        {webDashboardUrl && (
          <div
            style={{
              padding: "0.5rem 1rem",
              borderTop: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.25rem",
              }}
            >
              Web Dashboard
            </div>
            <a
              href={webDashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "0.75rem",
                color: "var(--accent)",
                textDecoration: "none",
              }}
            >
              {webDashboardUrl}
            </a>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          overflow: "auto",
          padding: "1.5rem",
        }}
      >
        <Routes>
          <Route path="/" element={<Dashboard events={ws.events} />} />
          <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
          <Route
            path="/events"
            element={
              <EventTimeline
                events={ws.events}
                clearEvents={ws.clearEvents}
              />
            }
          />
          <Route path="/roles" element={<RolePanels />} />
          <Route path="/merge" element={<MergeCenter />} />
          <Route path="/agents" element={<AgentsPanel />} />
        </Routes>
      </main>
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: "block",
        padding: "0.5rem 1rem",
        fontSize: "0.875rem",
        color: isActive ? "var(--accent)" : "var(--text-muted)",
        background: isActive ? "var(--bg-hover)" : "transparent",
        borderLeft: isActive
          ? "3px solid var(--accent)"
          : "3px solid transparent",
      })}
    >
      {label}
    </NavLink>
  );
}
