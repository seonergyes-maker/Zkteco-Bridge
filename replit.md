# ZKTeco Hub - Middleware de Fichaje

## Overview
Middleware application that receives push notifications from ZKTeco time clocks via the PUSH SDK 2.0.1 protocol. Acts as an intermediary between ZKTeco devices and an Oracle database, forwarding attendance events via API.

## Architecture
- **Frontend**: React + TypeScript with Vite, Shadcn UI components, Wouter routing, TanStack Query
- **Backend**: Express.js server implementing ZKTeco PUSH SDK 2.0.1 protocol
- **Database**: MariaDB/MySQL with Drizzle ORM (via mysql2 driver, connection via MYSQL_DATABASE_URL secret)
- **Language**: Spanish (UI labels and messages)

## Key Features
- Full ZKTeco PUSH SDK 2.0.1 protocol implementation (GET/POST /iclock/*)
- Client management (CRUD) with multiple devices per client
- Device management with real-time online/offline status
- Attendance event reception and storage
- Automatic event forwarding to Oracle API with retry logic
- Device command system: 31 commands including REBOOT, INFO, CHECK, LOG, CLEAR LOG/DATA/PHOTO, SET OPTION, QUERY ATTLOG/ATTPHOTO/USERINFO/FINGERTMP, DATA USER/DEL_USER/FP/DEL_FP, ENROLL_FP, AC_UNLOCK/UNALARM, RELOAD OPTIONS, UPDATE/DELETE TIMEZONE/GLOCK/SMS/USER_SMS/USERPIC, SHELL, GETFILE, PUTFILE
- Dashboard with real-time statistics
- Dark/Light theme support

## Project Structure
```
client/src/
  pages/          - Dashboard, Clients, Devices, Events, Commands, Tasks, Settings
  components/     - AppSidebar, ThemeProvider, ThemeToggle, UI components
  lib/            - queryClient (TanStack Query setup)
server/
  index.ts        - Express server setup
  routes.ts       - ZKTeco PUSH endpoints + REST API routes
  storage.ts      - Database storage layer (IStorage interface)
  db.ts           - MySQL/MariaDB connection with Drizzle
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
- `/api/commands` - GET (list command history), POST (send command to device)
- `/api/clients/:id/test-forwarding` - Test Oracle connection for specific client
- `/api/tasks` - GET (list scheduled tasks), POST (create), PATCH /:id (update), DELETE /:id

## Database Tables
- `clients` - Client registry with custom IDs, per-client Oracle forwarding config
- `devices` - ZKTeco devices with serial numbers, linked to clients
- `attendance_events` - All attendance records with forwarding status
- `operation_logs` - Device operation logs
- `device_commands` - Pending/executed device commands
- `scheduled_tasks` - Scheduled commands with support for one_time, interval, daily, weekly schedules; auto-executed by 30s scheduler loop
