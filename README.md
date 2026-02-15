# bot-ville

A farm-themed multi-agent workspace manager inspired by [Gas Town](https://github.com/steveyegge/gastown). Features a first-party, human-like memory system with embedding-backed recall and a complete orchestration engine with role-based policy enforcement.

## Architecture

```
                    +-----------------------+
                    |   Electron Desktop    |
                    |   (Farm Ops Console)  |
                    |   mutate + read       |
                    +----------+------------+
                               |
                    POST /api/* | GET /api/*
                    WebSocket   |
                               v
                    +-----------------------+
                    |   Fastify Backend     |
                    |   :4000               |
                    |                       |
                    |  /api/*  (mutating)   |
                    |  /public/* (read-only)|
                    |  /ws     (events)     |
                    +-----+-----+-----------+
                          |     |
                  +-------+     +-------+
                  v                     v
          +---------------+    +----------------+
          |  FarmEngine   |    |  SQLite (Prisma)|
          |  (@repo/core) |    |  farm.db        |
          +---------------+    +----------------+
                               ^
                    GET /public/* |
                    WebSocket    |
                               |
                    +-----------------------+
                    |   Next.js Web View    |
                    |   :3000               |
                    |   READ-ONLY           |
                    +-----------------------+
```

## Monorepo Structure

```
bot-ville/
  apps/
    backend/          Fastify API + WebSocket + SQLite
    desktop/          Electron + Vite + React (Farm Ops Console)
    web/              Next.js read-only dashboard
  packages/
    core/             Engine, roles, policies, event bus, merge logic
    shared/           Zod schemas, TypeScript types, event definitions
    memory/           Embedding-backed memory system
    ui/               Shared React components (shadcn/ui + Tailwind v4)
    eslint-config/    Shared ESLint flat configs
    typescript-config/ Shared tsconfig bases
```

## Farm Roles

| Role | ID | Responsibilities | Constraints |
|------|-----|-----------------|-------------|
| Farm Manager | `FARM_MANAGER` | Orchestrator. Creates work orders, assigns tasks, requests merges. | Can complete tasks |
| Field Hand | `FIELD_HAND` | Executor. Works tasks, submits draft artifacts. | **Cannot** modify canonical artifacts |
| Field Scout | `FIELD_SCOUT` | Triage/unblock. Resolves blocked tasks. | **Cannot** complete tasks or create artifacts |
| Grain Elevator | `GRAIN_ELEVATOR` | Merge gate. Canonicalizes artifacts, resolves conflicts. | Can modify canonical |
| Bell Ringer | `BELL_RINGER` | Cadence daemon. Triggers system ticks. | **Cannot** create user-facing artifacts |
| Barn Dog | `BARN_DOG` | Maintenance. Background upkeep tasks. | **Cannot** complete tasks |
| Heel | `HEEL` | Watchdog. Monitors health, raises alerts. | **Cannot** complete tasks |
| Barn Crew | `BARN_CREW` | Persistent specialists. Domain-specific agents. | Can complete tasks, submit artifacts |

### Routing Constraints

- All "final output" must go through **Grain Elevator** to become canonical
- **Field Hands** cannot directly modify canonical artifacts
- **Scout** cannot complete tasks; only triage/unblock
- **Bell Ringer** only triggers cadence; does not create user-facing artifacts
- **Web view** is read-only (no mutations, no task claiming, no prompting agents)

## Event Streaming

Everything the system does emits events. Events flow through:

1. **FarmEngine** performs an action
2. **EventBus** (in-process) receives the event
3. Event is persisted to **EventLog** table (SQLite)
4. Event is broadcast to all **WebSocket** clients

### Event Types

| Event | Description |
|-------|-------------|
| `workorder.created` | New work order created |
| `task.created` | New task added to work order |
| `task.assigned` | Task assigned to a role |
| `task.status_changed` | Task status transition |
| `artifact.submitted` | Draft artifact submitted |
| `artifact.canonicalized` | Artifact promoted to canonical |
| `merge.requested` | Merge process initiated |
| `merge.conflict` | Merge conflict detected |
| `merge.completed` | Merge completed successfully |
| `cadence.tick` | System tick triggered |
| `scout.triage` | Scout triaged a blocked task |
| `dogs.maintenance` | Barn Dog maintenance action |
| `heel.watchdog_alert` | Watchdog alert raised |
| `decision.recorded` | Decision recorded |

### WebSocket Protocol

Connect to `ws://localhost:4000/ws`. Events arrive as JSON:

```json
{
  "id": "uuid",
  "timestamp": "2026-02-14T...",
  "event": {
    "type": "task.status_changed",
    "payload": {
      "taskId": "...",
      "fromStatus": "IN_PROGRESS",
      "toStatus": "DONE"
    }
  }
}
```

Send subscription filters:

```json
{
  "type": "subscribe",
  "filters": {
    "workOrderId": "...",
    "eventTypes": ["task.status_changed", "artifact.submitted"]
  }
}
```

## Task Statuses

`NEW` -> `ASSIGNED` -> `IN_PROGRESS` -> `BLOCKED` / `REVIEW` / `DONE` / `FAILED`

Full transition map:

| From | Valid Transitions |
|------|------------------|
| NEW | ASSIGNED, FAILED |
| ASSIGNED | IN_PROGRESS, BLOCKED, FAILED |
| IN_PROGRESS | BLOCKED, REVIEW, DONE, FAILED |
| BLOCKED | ASSIGNED, IN_PROGRESS, FAILED |
| REVIEW | MERGED, IN_PROGRESS, BLOCKED, FAILED |
| MERGED | DONE |
| DONE | (terminal) |
| FAILED | NEW |

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm 9

### Install

```sh
pnpm install
```

### Initialize Database

```sh
cd apps/backend
npx prisma db push
```

### Run (Backend + Web)

```sh
pnpm dev
```

This starts:
- Backend API on http://localhost:4000
- Web dashboard on http://localhost:3000

### Run (Backend + Desktop)

```sh
pnpm desktop
```

### Run Tests

```sh
pnpm test
```

Or just the core tests:

```sh
cd packages/core
npx vitest run
```

## Demo

### Run the scripted demo

Start the backend, then:

```sh
curl -X POST http://localhost:4000/api/demo/run
```

This creates a work order ("Design a small irrigation plan and bill of materials"), generates tasks, simulates a blocked task, runs Scout triage, submits artifacts, and merges them via Grain Elevator.

### Example curl calls

**Create a work order:**

```sh
curl -X POST http://localhost:4000/api/work-orders \
  -H "Content-Type: application/json" \
  -d '{"goal": "Build a chicken coop"}'
```

**Create a task:**

```sh
curl -X POST http://localhost:4000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"workOrderId": "<WO_ID>", "title": "Research coop designs"}'
```

**Assign a task:**

```sh
curl -X POST http://localhost:4000/api/tasks/<TASK_ID>/assign \
  -H "Content-Type: application/json" \
  -d '{"roleId": "FIELD_HAND"}'
```

**Run a tick:**

```sh
curl -X POST http://localhost:4000/api/work-orders/<WO_ID>/tick
```

**Get a snapshot:**

```sh
curl http://localhost:4000/public/work-orders/<WO_ID>
```

**Query events:**

```sh
curl "http://localhost:4000/public/events?limit=20"
```

**Check health:**

```sh
curl http://localhost:4000/public/health
```

## Read-Only Enforcement

The web view only calls `/public/*` endpoints. The backend enforces this:

- `/public/*` routes only register GET handlers
- A request hook rejects any non-GET method to `/public/*` with 405 Method Not Allowed
- The web app's API client is hardcoded to only use `/public/*` paths

## Merge Behavior (Grain Elevator)

Two merge modes:

1. **Text merge**: Section-based (heading-aware). Sections with the same heading are compared; identical content merges cleanly, different content triggers a conflict.

2. **JSON merge**: Key-based recursive merge. Non-overlapping keys merge cleanly. Same key with different values triggers a conflict.

On conflict:
- `merge.conflict` event emitted
- Conflict report artifact created
- Affected tasks marked `REVIEW`
- Farm Manager notified via event

## Tech Stack

- **TypeScript 5.9** (strict mode, ESM)
- **pnpm 9** + **Turborepo 2**
- **Fastify 5** (backend)
- **Prisma** + **SQLite** (persistence)
- **@fastify/websocket** (real-time)
- **Electron 35** + **Vite** + **React 19** (desktop)
- **Next.js 16** (web, read-only)
- **Zod** (schema validation)
- **Vitest** (testing)
