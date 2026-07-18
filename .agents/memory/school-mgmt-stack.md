---
name: EduCore School Management Stack
description: Key decisions, quirks, and conventions for the EduCore school management system.
---

## Auth: Clerk (Replit-managed)
- Secrets: CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, VITE_CLERK_PUBLISHABLE_KEY (set via Clerk skill)
- Web: cookie-based — do NOT add Authorization headers or call setAuthTokenGetter
- Clerk proxy middleware is mounted BEFORE body parsers in app.ts
- `publishableKeyFromHost` used in App.tsx for proxy-aware key resolution
- JIT user provisioning in `GET /api/users/me` — first call creates the DB user record with role "admin"; role can be changed via PATCH /users/:id

## Express 5 TypeScript quirks
- Route handlers must have explicit `: void` or `: Promise<void>` return types to avoid TS7030
- `req.params` values typed as `string | string[]` — always cast: `req.params['id'] as string`
- Use `return; res.status(N).json(...)` pattern (separate return) rather than `return res.status(N).json(...)` in void functions to avoid "not all code paths" errors

## DB Schema (lib/db/src/schema/)
- Tables: users, classes, students, teachers, attendance, exams, marks, notices, fee_structures, fee_payments
- Integer PKs (serial), not UUIDs
- After schema changes: run `pnpm run typecheck:libs` to rebuild declarations before API server typecheck

## API Codegen (lib/api-spec/openapi.yaml)
- Do NOT use `format: email` — incompatible with zod v4 generated output
- Report card endpoint: `GET /marks/report/:studentId` (no query params — avoids Orval Params type collision)
- Run codegen after spec changes: `pnpm --filter @workspace/api-client-react run generate`

## Seed data
- Run with: `cd artifacts/api-server && pnpm dlx tsx src/seed.ts`
- Safe to run once (skips if classes table already has rows)
- Seeds: 3 classes, 1 admin, 3 teachers, 6 students, 5 notices, 3 exams, marks, fee structures, payments

**Why:** These patterns were non-obvious and took multiple iterations to get right across Express 5 + Drizzle + Clerk.
