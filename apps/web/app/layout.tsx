import type { ReactNode } from "react";
import { publicApi, type ProjectContext } from "./lib/api";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Farm Dashboard (Read-Only)",
  description: "Read-only view of the Farm multi-agent system",
};

async function getProjectContext(): Promise<ProjectContext> {
  try {
    return await publicApi.getProject();
  } catch {
    return { projectDirectory: null, projectName: null };
  }
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const project = await getProjectContext();

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
          <div
            style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}
          >
            <h1 style={{ fontSize: "1rem", fontWeight: 600 }}>
              Farm Dashboard
            </h1>
            <nav
              style={{ display: "flex", gap: "1rem", fontSize: "0.875rem" }}
            >
              <a href="/">Dashboard</a>
              <a href="/agents">Agents</a>
              <a href="/events">Events</a>
            </nav>
          </div>
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            {project.projectName && (
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "0.2rem 0.5rem",
                  background: "var(--bg-hover)",
                  borderRadius: "4px",
                  color: "var(--text)",
                  maxWidth: 200,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={project.projectDirectory ?? undefined}
              >
                {project.projectName}
              </span>
            )}
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
          </div>
        </header>
        <main style={{ padding: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
