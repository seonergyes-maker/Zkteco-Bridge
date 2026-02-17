# ZKTeco Hub - Middleware de Fichaje

## Overview
Middleware application that receives push notifications from ZKTeco time clocks via the PUSH SDK 2.0.1 protocol. Acts as an intermediary between ZKTeco devices and an external MariaDB database, forwarding attendance events directly via SQL INSERT.

## Architecture
- **Frontend**: React + TypeScript with Vite, Shadcn UI components, Wouter routing, TanStack Query
- **Backend**: Express.js server implementing ZKTeco PUSH SDK 2.0.1 protocol
- **Database**: PostgreSQL with Drizzle ORM (internal), MariaDB (external forwarding via mysql2)
- **Language**: Spanish (UI labels and messages)

## Key Features
- Full ZKTeco PUSH SDK 2.0.1 protocol implementation (GET/POST /iclock/*)
- Client management (CRUD) with multiple devices per client
- Device management with real-time online/offline status
- Attendance event reception and storage
- Automatic event forwarding to external MariaDB (vred.es) with retry logic
- Dashboard with real-time statistics
- Dark/Light theme support

## Project Structure
```
client/src/
  pages/          - Dashboard, Clients, Devices, Events, Settings
  components/     - AppSidebar, ThemeProvider, ThemeToggle, UI components
  lib/            - queryClient (TanStack Query setup)
server/
  index.ts        - Express server setup
  routes.ts       - ZKTeco PUSH endpoints + REST API routes
  storage.ts      - Database storage layer (IStorage interface)
  db.ts           - PostgreSQL connection with Drizzle
  mariadb.ts      - MariaDB connection pool + fichajes table management
  seed.ts         - Sample data seeding
shared/
  schema.ts       - Drizzle schema + Zod validators + TypeScript types
```

## ZKTeco PUSH SDK Endpoints
- `GET /iclock/cdata?SN=xxx&options=all` - Device config request
- `POST /iclock/cdata?SN=xxx&table=ATTLOG` - Attendance upload
- `POST /iclock/cdata?SN=xxx&table=OPERLOG` - Operation log upload
- `GET /iclock/getrequest?SN=xxx` - Device command polling
- `POST /iclock/devicecmd?SN=xxx` - Command result return

## API Routes
- `/api/dashboard/stats` - Dashboard statistics
- `/api/clients` - Client CRUD
- `/api/devices` - Device CRUD
- `/api/events` - Attendance events
- `/api/events/recent` - Latest 20 events
- `/api/events/pending-count` - Count of unforwarded events
- `/api/events/retry-forward` - Retry forwarding pending events
- `/api/forwarding-config` - Forwarding configuration (enabled/retry)
- `/api/mariadb/status` - MariaDB connection status

## Database Tables (PostgreSQL - internal)
- `clients` - Client registry with custom IDs
- `devices` - ZKTeco devices with serial numbers, linked to clients
- `attendance_events` - All attendance records with forwarding status
- `operation_logs` - Device operation logs
- `device_commands` - Pending/executed device commands
- `forwarding_config` - Forwarding settings (enabled, retries)

## MariaDB External Database
- **Host**: vred.es
- **Credentials**: Stored in env vars (MARIA_DB_HOST, MARIA_DB_USER, MARIA_DB_PASS, MARIA_DB_NAME)
- **Table**: `fichajes` - Auto-created, stores forwarded attendance events
