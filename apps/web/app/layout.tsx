import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Farm Dashboard (Read-Only)",
  description: "Read-only view of the Farm multi-agent system",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            padding: "0.75rem 1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--bg-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <h1 style={{ fontSize: "1rem", fontWeight: 600 }}>
              Farm Dashboard
            </h1>
            <nav style={{ display: "flex", gap: "1rem", fontSize: "0.875rem" }}>
              <a href="/">Dashboard</a>
              <a href="/events">Events</a>
            </nav>
          </div>
          <span
            style={{
              fontSize: "0.75rem",
              padding: "0.2rem 0.5rem",
              background: "var(--bg-hover)",
              borderRadius: "4px",
              color: "var(--text-muted)",
            }}
          >
            READ-ONLY
          </span>
        </header>
        <main style={{ padding: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
