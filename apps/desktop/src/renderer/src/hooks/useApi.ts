import { useState, useCallback } from "react";

const API_BASE = "http://localhost:4000";

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Typed API client ──

export const api = {
  // Mutating
  createWorkOrder: (goal: string, context?: Record<string, unknown>) =>
    apiFetch("/api/work-orders", {
      method: "POST",
      body: JSON.stringify({ goal, context }),
    }),

  createTask: (workOrderId: string, title: string, description?: string, deps?: string[]) =>
    apiFetch("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ workOrderId, title, description, deps }),
    }),

  assignTask: (taskId: string, roleId: string) =>
    apiFetch(`/api/tasks/${taskId}/assign`, {
      method: "POST",
      body: JSON.stringify({ roleId }),
    }),

  updateTaskStatus: (taskId: string, status: string, roleId: string, reason?: string) =>
    apiFetch(`/api/tasks/${taskId}/status`, {
      method: "POST",
      body: JSON.stringify({ status, roleId, reason }),
    }),

  submitArtifact: (taskId: string, roleId: string, type: string, content: string, workOrderId: string) =>
    apiFetch(`/api/tasks/${taskId}/artifact`, {
      method: "POST",
      body: JSON.stringify({ roleId, type, content, workOrderId }),
    }),

  requestMerge: (workOrderId: string, artifactType: string) =>
    apiFetch(`/api/work-orders/${workOrderId}/merge`, {
      method: "POST",
      body: JSON.stringify({ artifactType }),
    }),

  tick: (workOrderId: string) =>
    apiFetch(`/api/work-orders/${workOrderId}/tick`, { method: "POST" }),

  runDemo: () => apiFetch("/api/demo/run", { method: "POST" }),

  // Read
  listWorkOrders: () => apiFetch("/api/work-orders"),
  getSnapshot: (id: string) => apiFetch(`/api/work-orders/${id}`),
  listTasks: (workOrderId: string) => apiFetch(`/api/work-orders/${workOrderId}/tasks`),
  listArtifacts: (workOrderId: string) => apiFetch(`/api/work-orders/${workOrderId}/artifacts`),
  listEvents: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiFetch(`/api/events${qs}`);
  },
  getHealth: () => apiFetch("/api/health"),
};

// ── Hook for loading states ──

export function useApiCall<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async (fn: () => Promise<T>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, data, execute };
}
