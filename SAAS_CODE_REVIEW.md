# SaaS Code Review - Decisionary

## 1) Quick Summary

The application is a **frontend-first SaaS** built on Next.js (App Router) and Supabase, with most business logic executed in the browser (Supabase calls from the client). The product model is a tabletop simulation platform (scenarios, sessions, participants, injects, actions).

Top strengths:
- Clear domain split across modules (`sessions`, `sessionsRuntime`, `facilitator`, `users`).
- Solid realtime handling with subscription debouncing.
- Reasonable RPC -> direct-query fallback strategy.

Top risks:
- A large part of authorization depends on client-side checks (requires strong RLS and SECURITY DEFINER RPC design).
- Duplicated logic between `lib/sessions.ts` and `lib/sessionsRuntime.ts` increases maintenance cost.
- Lack of tests and limited architecture/operations documentation.

## 2) Architecture and Layers

### Stack
- Next.js 16 + React 19 + TypeScript
- Supabase JS (auth, query, realtime)
- UI: custom components + Radix

### App Layer
- Domain logic is mainly in `lib/*`.
- Views are in `app/*`.
- Middleware currently only redirects `/` -> `/login` (no server-side auth gate).

Assessment: **strong MVP baseline**, but as scale grows it is worth moving critical operations to server route handlers / server actions.

## 3) Auth Model and Security

### What works well
- User session enforcement via `requireUserId()` before mutating operations.
- RPC-first approach (e.g. `grant_session_role`, `start_session`, `join_session`) can centralize access rules well.

### Risks
1. **Client-side gating in UI**:
   - routing and role gates run in the browser.
   - Without strict RLS, this can be bypassed.

2. **Fallback to direct insert/update/delete**:
   - when RPC is missing, code attempts direct operations.
   - Useful for compatibility, but security must remain fully enforced by RLS.

3. **Limited server-boundary input validation**:
   - e.g. inject text and scenario/session names are only lightly validated.

Critical recommendation:
- Treat the client as untrusted; enforce permissions in RLS + RPC.
- Maintain a Supabase security checklist (RLS, SECURITY DEFINER functions, grants audit).

## 4) Code Quality and Maintainability

### Positives
- Readable sections and function naming.
- Explicit TS types for most entities.
- Good debounce practice around realtime subscriptions.

### Improvement areas
1. **Session module duplication**:
   - `lib/sessions.ts` and `lib/sessionsRuntime.ts` cover overlapping behavior.
   - Risk of behavioral drift and regression bugs.

2. **Broad `any` usage**:
   - Weakens type safety in several places.

3. **No central input schema validation**:
   - Consider schema-based validation (e.g. Zod) for form payloads.

4. **No automated tests**:
   - Makes safe refactoring harder.

## 5) Product Scalability (SaaS Readiness)

Current code is suitable for MVP / early stage.
For production and larger customer volume, recommended next steps:

- **Observability**: errors, metrics, telemetry, tracing.
- **Multi-tenant hardening**: explicit tenant isolation (if multi-tenant architecture is planned).
- **Background jobs**: inject scheduling and heavier work outside request/response.
- **Audit trail**: full log of critical changes and moderator actions.

## 6) Delivery Priorities (30/60/90 Days)

### 0-30 days (highest priority)
- Review and harden all RLS policies + RPC permissions.
- Consolidate to one session module (remove duplication or extract common core).
- Add minimal tests for critical flows (login, join, create/start/end session).

### 31-60 days
- Add schema-based input validation.
- Standardize errors and UI messages.
- Add error monitoring and metrics.

### 61-90 days
- Refactor toward a clearer boundary: client UI vs server-domain API.
- Expand audit and post-session reporting.

## 7) Final Assessment

- **Strengths**: fast MVP delivery, strong Supabase ergonomics, clear project structure.
- **Weaknesses**: security quality depends heavily on DB configuration, duplicated domain logic, no tests.
- **Current SaaS readiness**: **medium** (good foundation, requires hardening for larger scale).
