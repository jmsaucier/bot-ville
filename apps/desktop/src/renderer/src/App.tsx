import { Routes, Route, NavLink } from "react-router-dom";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { Dashboard } from "./pages/Dashboard.js";
import { WorkOrderDetail } from "./pages/WorkOrderDetail.js";
import { EventTimeline } from "./pages/EventTimeline.js";
import { RolePanels } from "./pages/RolePanels.js";
import { MergeCenter } from "./pages/MergeCenter.js";

export function App() {
  const ws = useWebSocket();

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

        <NavItem to="/" label="Dashboard" />
        <NavItem to="/events" label="Event Timeline" />
        <NavItem to="/roles" label="Role Panels" />
        <NavItem to="/merge" label="Merge Center" />
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
