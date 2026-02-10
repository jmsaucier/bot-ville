# AGENTS.md

## Project Vision

**bot-ville** is a multi-agent workspace manager inspired by [Gas Town](https://github.com/steveyegge/gastown). The key differentiator is a first-party, human-like memory system: instead of a FIFO queue (like Gas Town's beads), bot-ville retrieves memories using a combination of **semantic similarity** (via embeddings) and **time-decay scoring**, mirroring how human recall works -- relevant AND recent memories surface first.

## Monorepo Structure

This is a Turborepo monorepo managed with pnpm workspaces.

```
bot-ville/
  apps/
    web/          # Next.js app (port 3000)
    docs/         # Next.js app (port 3001)
  packages/
    ui/           # @repo/ui -- shared React component library
    memory/       # @repo/memory -- first-party embedding-backed memory system
    eslint-config/# @repo/eslint-config -- shared ESLint flat configs
    typescript-config/ # @repo/typescript-config -- shared tsconfig bases
```

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19
- **Language:** TypeScript 5.9 (strict mode, ESM)
- **Package Manager:** pnpm 9
- **Build Orchestration:** Turborepo 2
- **Linting:** ESLint 9 (flat config, only-warn plugin)
- **Formatting:** Prettier
- **Runtime:** Node >= 18

## Commands

Run from the repo root:

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all apps and packages |
| `pnpm format` | Format all `.ts`, `.tsx`, `.md` files with Prettier |
| `pnpm check-types` | Type-check all apps and packages |

Filter to a specific app or package with Turbo:

```sh
pnpm turbo dev --filter=web
pnpm turbo build --filter=@repo/memory
```

## Coding Conventions

- **TypeScript strict mode** is enabled everywhere via `@repo/typescript-config/base.json`.
- **ESM modules** (`"type": "module"`) in all apps and packages.
- **Inline prop types** -- define component props as inline object types, not in separate `types` files (see `@repo/ui` components for examples).
- **`"use client"` directive** for client-side React components in shared packages.
- **CSS Modules** for component styling in Next.js apps.
- **Flat ESLint config** -- all packages use the flat config format (`eslint.config.mjs`).
- **Prettier** for formatting -- no `.prettierrc` file; default config is used.

## Package Conventions

- All internal packages use the `@repo/*` scope.
- Cross-package dependencies use `workspace:*` protocol.
- `@repo/ui` exports components via wildcard: import as `@repo/ui/button`, `@repo/ui/card`, etc.
- `@repo/memory` exports via subpath: import as `@repo/memory` or `@repo/memory/openai-embedder`.

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
