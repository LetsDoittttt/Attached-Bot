# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### Bot Dashboard (`artifacts/bot-dashboard`)
- React + Vite frontend served at `/`
- Dark terminal-themed UI for managing a Telegram/Discord link bypass bot
- Pages: Dashboard, Configuration, Activity Logs, Link Tester
- Real-time stats, activity logs, bot start/stop control

### API Server (`artifacts/api-server`)
- Express 5 backend served at `/api`
- Routes: `/config`, `/bot/status`, `/bot/start`, `/bot/stop`, `/logs`, `/stats`, `/bypass/test`

## Database Schema

- `bot_config` — single-row config (Telegram credentials, channels, bypass API settings)
- `activity_log` — per-link processing history (status: success/failed/skipped)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
