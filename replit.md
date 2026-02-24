# ТрелоПародия - Управление задачами

## Overview
Trello-like task management app fully in Russian. Features boards, lists, cards with drag-and-drop, labels, checklists, user authentication, and board collaboration.

## Tech Stack
- **Frontend**: React, TanStack Query, wouter, @hello-pangea/dnd, Tailwind CSS, shadcn/ui
- **Backend**: Express, Passport.js (local strategy), bcrypt
- **Database**: PostgreSQL with Drizzle ORM
- **Sessions**: connect-pg-simple

## Project Structure
- `shared/schema.ts` - Data models (users, boards, boardMembers, lists, cards, checklistItems)
- `server/db.ts` - Database connection
- `server/storage.ts` - DatabaseStorage class with all CRUD operations
- `server/routes.ts` - API routes with auth and authorization
- `client/src/lib/auth.tsx` - AuthProvider context
- `client/src/pages/auth-page.tsx` - Login/Register page
- `client/src/pages/boards-page.tsx` - Boards listing page
- `client/src/pages/board-page.tsx` - Board detail with lists and drag-drop
- `client/src/components/board-list.tsx` - List column component
- `client/src/components/card-detail.tsx` - Card detail dialog (title, description, labels, checklist)
- `client/src/components/invite-dialog.tsx` - Invite users dialog

## Key Features
- Custom passport-local authentication (registration + login)
- Board CRUD with color selection
- Lists with positional ordering
- Cards with drag-and-drop between lists (@hello-pangea/dnd)
- Card labels (colored tags)
- Card checklists with progress bar
- Confetti animation on task completion
- Board member invitations
- Access control: only board owner/members can access board content

## Running
- `npm run dev` starts the Express + Vite dev server on port 5000
- `npm run db:push` syncs database schema
