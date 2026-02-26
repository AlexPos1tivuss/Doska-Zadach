# ТрелоПародия (Trello Parody) - replit.md

## Overview

ТрелоПародия is a Russian-language Trello-like task management web application. It allows users to create boards, organize tasks into lists (columns), and manage cards with descriptions, labels, and checklists. Key features include:

- User authentication (register/login)
- Multiple boards per user with custom colors
- Drag-and-drop reordering of lists and cards
- Card detail view with descriptions, labels, and checklist items
- Board membership/collaboration (invite users to boards)
- Confetti animation on card completion

The app is a full-stack TypeScript monorepo with a React frontend and an Express backend, connected to a PostgreSQL database via Drizzle ORM.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript, built with Vite
- **Routing**: `wouter` (lightweight client-side routing)
- **State/Data Fetching**: TanStack React Query v5 for server state, with a custom `queryClient` and `apiRequest` helper
- **Auth State**: React Context (`AuthProvider` in `client/src/lib/auth.tsx`) wrapping the whole app; auth state is derived from a `/api/auth/me` query
- **UI Components**: shadcn/ui (New York style) using Radix UI primitives + Tailwind CSS
- **Drag and Drop**: `@hello-pangea/dnd` for list and card reordering
- **Theming**: CSS custom properties for both light and dark mode, defined in `index.css`; Tailwind is configured to use these variables
- **Notifications**: Custom `useToast` hook + Radix Toast
- **Key Pages**:
  - `/` → BoardsPage (list of boards)
  - `/board/:id` → BoardPage (lists and cards for a board)
  - `/auth` → AuthPage (login/register)
- **Protected Routes**: A `ProtectedRoute` wrapper redirects unauthenticated users to the auth page

### Backend Architecture

- **Framework**: Express.js with TypeScript, run via `tsx`
- **Entry Point**: `server/index.ts` creates the HTTP server, registers routes, and serves static files in production or proxies to Vite in development
- **Routes**: Defined in `server/routes.ts`; all API routes are under `/api/`
- **Authentication**: Passport.js with `passport-local` strategy; sessions stored in PostgreSQL using `connect-pg-simple`
- **Password Hashing**: `bcrypt`
- **Session**: `express-session` with a PostgreSQL session store; secret from `SESSION_SECRET` env var
- **Storage Layer**: `server/storage.ts` exports a `DatabaseStorage` class implementing an `IStorage` interface — all database interactions go through this abstraction
- **Middleware**: JSON body parsing with raw body capture (for potential webhook use), URL-encoded parsing, request logging

### Data Storage

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM (`drizzle-orm/node-postgres`) with schema defined in `shared/schema.ts`
- **Schema Tables**:
  - `users` — id (UUID), username, password (hashed), displayName
  - `boards` — id, title, ownerId (FK → users), color
  - `board_members` — id, boardId (FK → boards, cascade delete), userId (FK → users)
  - `lists` — id, title, boardId (FK → boards, cascade delete), position
  - `cards` — id, title, description, listId (FK → lists, cascade delete), position, labels (JSONB array), completed
  - `checklist_items` — id, cardId (FK → cards, cascade delete), text, checked, position
- **Migrations**: Drizzle Kit with `drizzle.config.ts`; `npm run db:push` applies schema
- **Connection**: Via `DATABASE_URL` environment variable

### Shared Code

- `shared/schema.ts` is shared between the frontend (for TypeScript types) and backend (for database queries and Zod validation schemas via `drizzle-zod`)
- TypeScript path alias `@shared/*` maps to `./shared/*`

### Build System

- **Development**: `tsx server/index.ts` runs the server; Vite dev server runs as middleware (via `server/vite.ts`) with HMR
- **Production Build**: Custom `script/build.ts` runs Vite for the client (output to `dist/public`) and esbuild for the server (output to `dist/index.cjs`), bundling a specific allowlist of server dependencies for faster cold starts
- **Client alias `@`** maps to `client/src/`

---

## External Dependencies

### Core Runtime Dependencies
| Package | Purpose |
|---|---|
| `express` | HTTP server framework |
| `passport` + `passport-local` | Authentication strategy |
| `bcrypt` | Password hashing |
| `express-session` | Session management |
| `connect-pg-simple` | PostgreSQL session store |
| `drizzle-orm` + `pg` | PostgreSQL ORM and driver |
| `zod` + `drizzle-zod` | Schema validation |
| `@hello-pangea/dnd` | Drag-and-drop UI |
| `@tanstack/react-query` | Server state management |
| `wouter` | Client-side routing |
| `canvas-confetti` | Celebration animation on card completion |

### UI Libraries
| Package | Purpose |
|---|---|
| All `@radix-ui/react-*` packages | Accessible UI primitives |
| `tailwindcss` | Utility-first CSS |
| `class-variance-authority` | Component variant styling |
| `clsx` + `tailwind-merge` | Class name utilities |
| `lucide-react` | Icon set |

### Development / Build Tools
| Package | Purpose |
|---|---|
| `vite` + `@vitejs/plugin-react` | Frontend bundler |
| `esbuild` | Server bundler for production |
| `tsx` | TypeScript execution for dev server |
| `drizzle-kit` | Database migrations CLI |
| `@replit/vite-plugin-*` | Replit-specific dev tooling (cartographer, dev banner, runtime error modal) |

### Environment Variables Required
- `DATABASE_URL` — PostgreSQL connection string (required; app throws on startup without it)
- `SESSION_SECRET` — Session signing secret (falls back to a hardcoded default if not set; should be set in production)