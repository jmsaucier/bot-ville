# AGENTS.md

## Project Vision

**bot-ville** is a farm-themed multi-agent workspace manager inspired by [Gas Town](https://github.com/steveyegge/gastown). Features:

- **Farm-themed role system** with 8 agent roles (Farm Manager, Field Hand, Field Scout, Grain Elevator, Bell Ringer, Barn Dog, Heel, Barn Crew), each with explicit policy enforcement.
- **First-party memory system** (`@repo/memory`): embedding-backed recall using semantic similarity + time-decay scoring.
- **Core orchestration engine** (`@repo/core`): role registry, policy enforcement, event bus, merge logic.
- **Full event streaming**: every action emits events persisted to SQLite and broadcast via WebSocket.
- **Desktop console** (Electron + Vite + React) for operator interaction.
- **Read-only web dashboard** (Next.js) for observation.

## Monorepo Structure

This is a Turborepo monorepo managed with pnpm workspaces.

```
bot-ville/
  apps/
    backend/          # Fastify API + WebSocket + SQLite (port 4000)
    desktop/          # Electron + Vite + React (Farm Ops Console)
    web/              # Next.js read-only dashboard (port 3000)
  packages/
    core/             # @repo/core -- engine, roles, policies, event bus, merge
    shared/           # @repo/shared -- Zod schemas, types, event definitions
    memory/           # @repo/memory -- embedding-backed memory system
    ui/               # @repo/ui -- shared React components (shadcn/ui + Tailwind v4)
    eslint-config/    # @repo/eslint-config -- shared ESLint flat configs
    typescript-config/ # @repo/typescript-config -- shared tsconfig bases
```

## Tech Stack

- **Framework:** Next.js 16 (App Router) for web, Vite + React 19 for desktop renderer
- **Backend:** Fastify 5 + Prisma + SQLite
- **UI:** React 19, shadcn/ui, Tailwind CSS v4
- **Language:** TypeScript 5.9 (strict mode, ESM)
- **Package Manager:** pnpm 9
- **Build Orchestration:** Turborepo 2
- **Real-time:** WebSocket (@fastify/websocket)
- **Validation:** Zod
- **Testing:** Vitest
- **Desktop:** Electron 35
- **Linting:** ESLint 9 (flat config, only-warn plugin)
- **Formatting:** Prettier
- **Runtime:** Node >= 18

## Commands

Run from the repo root:

| Command | Description |
|---|---|
| `pnpm dev` | Start backend + web in dev mode |
| `pnpm desktop` | Start backend + desktop app in dev mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all apps and packages |
| `pnpm test` | Run all tests |
| `pnpm format` | Format all `.ts`, `.tsx`, `.md` files with Prettier |
| `pnpm check-types` | Type-check all apps and packages |
| `pnpm db:push` | Push Prisma schema to SQLite |

Filter to a specific app or package with Turbo:

```sh
pnpm turbo dev --filter=backend
pnpm turbo test --filter=@repo/core
```

## Coding Conventions

- **TypeScript strict mode** is enabled everywhere via `@repo/typescript-config/base.json`.
- **ESM modules** (`"type": "module"`) in all apps and packages.
- **Inline prop types** -- define component props as inline object types, not in separate `types` files.
- **`"use client"` directive** for client-side React components in shared packages.
- **Flat ESLint config** -- all packages use the flat config format (`eslint.config.mjs`).
- **Prettier** for formatting -- no `.prettierrc` file; default config is used.
- **Zod schemas** for all data models, events, and API payloads (defined in `@repo/shared`).

## Package Conventions

- All internal packages use the `@repo/*` scope.
- Cross-package dependencies use `workspace:*` protocol.
- `@repo/ui` exports components via wildcard: `@repo/ui/button`, `@repo/ui/status-badge`, etc.
- `@repo/shared` exports via subpath: `@repo/shared`, `@repo/shared/events`, `@repo/shared/roles`, etc.
- `@repo/core` exports via subpath: `@repo/core`, `@repo/core/event-bus`, `@repo/core/roles`, etc.
- `@repo/memory` exports via subpath: `@repo/memory` or `@repo/memory/openai-embedder`.

## Core Engine (`@repo/core`)

The engine provides:
- `FarmEngine` class with: `createWorkOrder()`, `tick()`, `assignTask()`, `submitArtifact()`, `requestMerge()`, `getSnapshot()`
- `EventBus` for typed pub/sub
- `PersistenceAdapter` interface (implemented by Prisma adapter in backend)
- Role registry with 8 roles and policy enforcement
- Merge engine (text + JSON) with conflict detection

## Memory System (`@repo/memory`)

The memory package provides an embedding-backed knowledge store. Memories are scored using:

```
score = (alpha * cosineSimilarity) + ((1 - alpha) * recencyScore)
```

Where `alpha` defaults to 0.7 (favoring relevance). The `Embedder` interface is abstract -- an OpenAI adapter is provided out of the box, but any embedder can be plugged in.

Runtime data is stored under `.bot-ville/` (gitignored) as JSON files.

## Environment

- **Node >= 18** is required.
- `.env*` files are gitignored. The Turbo `build` task declares `.env*` as inputs.
- The OpenAI embedder reads `OPENAI_API_KEY` from the environment.
- Runtime memory data lives in `.bot-ville/` at the repo root (gitignored).
- SQLite database lives in `apps/backend/data/farm.db` (gitignored).
