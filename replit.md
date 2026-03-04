# Менеджер задач - replit.md

## Overview

Russian-language Trello-like task management web application. Users can create boards, organize tasks into lists (columns), and manage cards with descriptions, labels, checklists, assignees, and deadlines. Key features:

- User authentication (register/login) with roles (Преподаватель, Начальник кафедры)
- Multiple boards per user with custom colors
- Drag-and-drop reordering of cards between lists
- Card detail view with descriptions, labels, checklist items, assignee picker, and deadline
- Board membership/collaboration (invite users to boards)
- In-app notifications (task assignment, board invitations, deadline warnings)
- Confetti animation on card completion

Full-stack TypeScript monorepo: React frontend + Express backend + PostgreSQL via Drizzle ORM.

---

## User Preferences

Preferred communication style: Simple, everyday language. All UI in Russian.

---

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript, built with Vite
- **Routing**: `wouter` (lightweight client-side routing)
- **State/Data Fetching**: TanStack React Query v5
- **Auth State**: React Context (`AuthProvider` in `client/src/lib/auth.tsx`)
- **UI Components**: shadcn/ui (Radix UI) + Tailwind CSS
- **Drag and Drop**: `@hello-pangea/dnd`
- **Key Pages**:
  - `/` → BoardsPage (list of boards, notification bell, user role badge)
  - `/board/:id` → BoardPage (lists and cards, notification bell)
  - `/auth` → AuthPage (login/register with role selection)
- **Key Components**:
  - `notifications-bell.tsx` — notification popover with unread count badge, polling every 15s
  - `board-list.tsx` — list column with card creation form (assignee + deadline fields)
  - `card-detail.tsx` — card dialog with assignee/deadline pickers, labels, checklist
  - `invite-dialog.tsx` — invite users by username

### Backend Architecture

- **Framework**: Express.js with TypeScript, run via `tsx`
- **Routes**: `server/routes.ts`; all API routes under `/api/`
- **Authentication**: Passport.js with `passport-local`; sessions in PostgreSQL via `connect-pg-simple`
- **Storage Layer**: `server/storage.ts` — `DatabaseStorage` class implementing `IStorage` interface
- **Notifications**: Created server-side on key events (task assignment, board invite); polled by frontend

### Data Storage

- **Database**: PostgreSQL via Drizzle ORM
- **Schema Tables** (defined in `shared/schema.ts`):
  - `users` — id (UUID), username, password (bcrypt), displayName, **role** (text, default "преподаватель")
  - `boards` — id, title, ownerId → users, color
  - `board_members` — id, boardId → boards (cascade), userId → users
  - `lists` — id, title, boardId → boards (cascade), position
  - `cards` — id, title, description, listId → lists (cascade), position, labels (JSONB), completed, **assigneeId** → users, **deadline** (timestamp)
  - `checklist_items` — id, cardId → cards (cascade), text, checked, position
  - `notifications` — id, userId → users (cascade), type, title, message, read, boardId → boards (cascade), cardId → cards (cascade), createdAt

### Notification Types
- `task_assigned` — when a task is assigned to a user
- `board_invite` — when a user is invited to a board
- `deadline_warning` — for upcoming deadlines (checked every 30 min, warns 24h before)
- `board_joined` — when someone is invited to a board (owner gets notified)
- `task_completed` — when someone else marks an assigned task as completed

---

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `SESSION_SECRET` — Session signing secret
