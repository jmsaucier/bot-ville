/**
 * Read-only API client for the web view.
 * ONLY calls /public/* endpoints -- no mutations allowed.
 */

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

async function publicFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/public${path}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export const publicApi = {
  listWorkOrders: () => publicFetch("/work-orders"),
  getSnapshot: (id: string) => publicFetch(`/work-orders/${id}`),
  listTasks: (workOrderId: string) => publicFetch(`/work-orders/${workOrderId}/tasks`),
  listArtifacts: (workOrderId: string) =>
    publicFetch(`/work-orders/${workOrderId}/artifacts`),
  listEvents: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return publicFetch(`/events${qs}`);
  },
  getHealth: () => publicFetch("/health"),
  listAgents: (status?: string) => {
    const qs = status ? `?status=${status}` : "";
    return publicFetch(`/agents${qs}`);
  },
};
