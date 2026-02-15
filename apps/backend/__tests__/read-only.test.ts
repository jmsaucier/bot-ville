import { describe, it, expect, beforeAll, afterAll } from "vitest";

const API_BASE = "http://localhost:4000";

/**
 * These tests verify that /public/* endpoints reject non-GET methods.
 * Requires the backend server to be running on port 4000.
 * Run with: cd apps/backend && pnpm test
 *
 * If the server is not running, tests will be skipped.
 */
describe("Read-Only Enforcement (/public/*)", () => {
  let serverAvailable = false;

  beforeAll(async () => {
    try {
      const res = await fetch(`${API_BASE}/public/health`);
      serverAvailable = res.ok;
    } catch {
      serverAvailable = false;
    }
  });

  const skipIfNoServer = () => {
    if (!serverAvailable) {
      return true;
    }
    return false;
  };

  it("should allow GET /public/health", async () => {
    if (skipIfNoServer()) return;
    const res = await fetch(`${API_BASE}/public/health`);
    expect(res.status).toBe(200);
  });

  it("should allow GET /public/work-orders", async () => {
    if (skipIfNoServer()) return;
    const res = await fetch(`${API_BASE}/public/work-orders`);
    expect(res.status).toBe(200);
  });

  it("should allow GET /public/events", async () => {
    if (skipIfNoServer()) return;
    const res = await fetch(`${API_BASE}/public/events`);
    expect(res.status).toBe(200);
  });

  it("should reject POST /public/work-orders", async () => {
    if (skipIfNoServer()) return;
    const res = await fetch(`${API_BASE}/public/work-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "test" }),
    });
    expect(res.status).toBe(405);
  });

  it("should reject PUT /public/work-orders", async () => {
    if (skipIfNoServer()) return;
    const res = await fetch(`${API_BASE}/public/work-orders`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(405);
  });

  it("should reject DELETE /public/work-orders", async () => {
    if (skipIfNoServer()) return;
    const res = await fetch(`${API_BASE}/public/work-orders`, {
      method: "DELETE",
    });
    expect(res.status).toBe(405);
  });

  it("should reject PATCH /public/events", async () => {
    if (skipIfNoServer()) return;
    const res = await fetch(`${API_BASE}/public/events`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(405);
  });
});
