/**
 * Lightweight HTTP client for the bot-ville backend API.
 * Reads BV_API_URL from environment (set by the spawner).
 */

function getApiUrl(): string {
  const url = process.env.BV_API_URL;
  if (!url) {
    throw new Error(
      "BV_API_URL environment variable is not set. " +
        "Are you running inside a bot-ville agent session?"
    );
  }
  return url.replace(/\/$/, "");
}

function getSessionId(): string {
  const id = process.env.BV_SESSION_ID;
  if (!id) {
    throw new Error(
      "BV_SESSION_ID environment variable is not set. " +
        "Are you running inside a bot-ville agent session?"
    );
  }
  return id;
}

function getEnvOrNull(key: string): string | null {
  return process.env[key] ?? null;
}

export function getSessionContext() {
  return {
    apiUrl: getApiUrl(),
    sessionId: getSessionId(),
    role: getEnvOrNull("BV_ROLE"),
    agentPreset: getEnvOrNull("BV_AGENT_PRESET"),
    workOrderId: getEnvOrNull("BV_WORK_ORDER_ID"),
    taskId: getEnvOrNull("BV_TASK_ID"),
  };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const apiUrl = getApiUrl();
  const url = `${apiUrl}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Include session ID if available
  const sessionId = process.env.BV_SESSION_ID;
  if (sessionId) {
    headers["X-BV-Session-ID"] = sessionId;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // ── Work Orders ──
  getWorkOrder(id: string) {
    return request<unknown>("GET", `/api/work-orders/${id}`);
  },

  getSnapshot(workOrderId: string) {
    return request<unknown>("GET", `/api/work-orders/${workOrderId}`);
  },

  listWorkOrders() {
    return request<unknown[]>("GET", `/api/work-orders`);
  },

  // ── Tasks ──
  listTasks(workOrderId: string) {
    return request<unknown[]>("GET", `/api/work-orders/${workOrderId}/tasks`);
  },

  updateTaskStatus(taskId: string, body: { status: string; roleId: string }) {
    return request<unknown>("POST", `/api/tasks/${taskId}/status`, body);
  },

  // ── Artifacts ──
  submitArtifact(
    taskId: string,
    body: {
      type: string;
      content: string;
      roleId: string;
      workOrderId: string;
    }
  ) {
    return request<unknown>("POST", `/api/tasks/${taskId}/artifact`, body);
  },

  // ── Events ──
  listEvents(params?: Record<string, string>) {
    const query = params
      ? "?" + new URLSearchParams(params).toString()
      : "";
    return request<unknown[]>("GET", `/api/events${query}`);
  },

  // ── Agent Sessions ──
  getAgentSession(sessionId: string) {
    return request<unknown>("GET", `/api/agents/${sessionId}`);
  },

  heartbeat(sessionId: string, message?: string) {
    return request<unknown>("POST", `/api/agents/${sessionId}/heartbeat`, {
      message,
    });
  },

  done(sessionId: string, body?: { message?: string; artifactContent?: string; artifactType?: string }) {
    return request<unknown>("POST", `/api/agents/${sessionId}/done`, body ?? {});
  },

  // ── Mail ──
  sendMail(
    sessionId: string,
    body: { to: string; subject: string; body?: string }
  ) {
    return request<unknown>("POST", `/api/agents/${sessionId}/mail`, body);
  },

  checkMail(sessionId: string) {
    return request<unknown[]>("GET", `/api/agents/${sessionId}/mail`);
  },

  // ── Health ──
  health() {
    return request<unknown>("GET", `/api/health`);
  },
};
