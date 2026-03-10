# ТрелоПародия — Task Manager (Trello Clone)

## Overview

A Russian-language Trello-like task management web application. Users can create boards, add lists to boards, and manage cards within those lists. Features include drag-and-drop reordering, card labels, deadlines, assignees, checklist items, board member invitations, and a notification system with deadline warnings. The app is fully in Russian and targets an educational/teaching context (users have roles like "преподаватель").

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript, bundled by Vite.
- **Routing**: `wouter` — lightweight client-side router. Two main routes: `/` (boards list) and `/board/:id` (single board view). A `ProtectedRoute` wrapper redirects unauthenticated users to `/auth`.
- **State Management**: TanStack React Query v5 handles all server state, caching, and invalidation. No separate global state store (Redux, Zustand, etc.) is used.
- **Auth Context**: A custom `AuthProvider` in `client/src/lib/auth.tsx` wraps the app and exposes `user`, `login`, `register`, and `logout` via React context, backed by React Query mutations and the `/api/auth/me` endpoint.
- **Drag and Drop**: `@hello-pangea/dnd` (a maintained fork of `react-beautiful-dnd`) handles dragging cards between lists and reordering lists.
- **UI Components**: shadcn/ui built on Radix UI primitives, styled with Tailwind CSS. All component files live in `client/src/components/ui/`.
- **Notifications**: A bell icon component (`notifications-bell.tsx`) polls `/api/notifications/unread-count` every 15 seconds and shows a popover with the notification list.
- **Confetti**: `canvas-confetti` triggers a celebration animation when a card is marked as completed.
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`.

### Backend Architecture

- **Runtime**: Node.js with Express, written in TypeScript, run via `tsx` in development.
- **Entry point**: `server/index.ts` sets up the Express app, registers routes via `server/routes.ts`, and serves the frontend.
- **Dev mode**: `server/vite.ts` integrates Vite as middleware (HMR included).
- **Prod mode**: `server/static.ts` serves the pre-built `dist/public` directory and falls back to `index.html` for SPA routing.
- **Storage Layer**: `server/storage.ts` defines an `IStorage` interface and a `DatabaseStorage` class that implements all data access using Drizzle ORM queries. This pattern makes it easy to swap the backend if needed.
- **Build**: A custom `script/build.ts` runs Vite for the client and esbuild for the server, bundling selected server dependencies to reduce cold-start syscalls.

### Authentication & Sessions

- **Strategy**: Passport.js with the `local` strategy (username + password). Passwords hashed with `bcrypt`.
- **Sessions**: `express-session` stores sessions in PostgreSQL via `connect-pg-simple`. Session data persists across server restarts.
- **Protected routes**: The frontend checks `/api/auth/me`; if unauthenticated (401), it renders the auth page instead of the requested route.

### Database Schema (PostgreSQL via Drizzle ORM)

Defined in `shared/schema.ts` so both client types and server queries share the same source of truth.

| Table | Key Columns |
|---|---|
| `users` | id (UUID), username, password, displayName, role |
| `boards` | id, title, ownerId → users, color |
| `board_members` | id, boardId → boards (cascade), userId → users |
| `lists` | id, title, boardId → boards (cascade), position |
| `cards` | id, title, description, listId → lists (cascade), position, labels (JSONB), completed, assigneeId → users, deadline |
| `checklistItems` | id, cardId → cards (cascade), text, checked |
| `notifications` | id, userId → users, type, message, read, createdAt |

- UUIDs are generated server-side using `gen_random_uuid()`.
- Zod validation schemas are auto-generated from Drizzle table definitions via `drizzle-zod`.
- Migrations live in `./migrations/`, managed with `drizzle-kit push`.

### API Structure

All API routes are prefixed `/api/`. Key route groups:
- `/api/auth/*` — login, register, logout, current user
- `/api/boards` — CRUD for boards
- `/api/boards/:id/members` — manage board members
- `/api/boards/:id/lists` — lists with embedded cards
- `/api/lists` — create list
- `/api/lists/:id` — delete list
- `/api/cards` — create card
- `/api/cards/:id` — get, update, delete, move card
- `/api/cards/:id/checklist` — checklist item CRUD
- `/api/notifications` — fetch, mark read
- `/api/notifications/unread-count` — polling endpoint

---

## External Dependencies

| Dependency | Purpose |
|---|---|
| **PostgreSQL** | Primary database; requires `DATABASE_URL` env variable |
| **Drizzle ORM** | Database access layer and schema definition |
| **Drizzle Kit** | Schema migrations (`drizzle-kit push`) |
| **connect-pg-simple** | Stores Express sessions in PostgreSQL |
| **Passport.js** (local) | Authentication strategy |
| **bcrypt** | Password hashing |
| **Google Fonts** | Fonts: Architects Daughter, DM Sans, Fira Code, Geist Mono (loaded via CDN in `index.html`) |
| **Replit Vite plugins** | `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner` — dev-only, only active when `REPL_ID` is set |
| **canvas-confetti** | Card completion celebration animation |
| **@hello-pangea/dnd** | Drag-and-drop for cards and lists |

### Environment Variables Required

- `DATABASE_URL` — PostgreSQL connection string (required at startup for both server and drizzle-kit)
- `NODE_ENV` — controls dev vs production mode (`development` / `production`)