# ZKTeco Hub - Middleware de Fichaje

## Overview
Middleware application that receives push notifications from ZKTeco time clocks via the PUSH SDK 2.0.1 protocol. Acts as an intermediary between ZKTeco devices and an Oracle database, forwarding attendance events via API.

## Architecture
- **Frontend**: React + TypeScript with Vite, Shadcn UI components, Wouter routing, TanStack Query
- **Backend**: Express.js server implementing ZKTeco PUSH SDK 2.0.1 protocol
- **Database**: MariaDB/MySQL with Drizzle ORM (via mysql2 driver, connection via MYSQL_DATABASE_URL secret)
- **Language**: Spanish (UI labels and messages)

## Key Features
- Secure authentication with AES-256 encrypted passwords, 30-min ban on failed login, access logging
- Full ZKTeco PUSH SDK 2.0.1 protocol implementation (GET/POST /iclock/*)
- Client management (CRUD) with multiple devices per client
- Device management with real-time online/offline status
- Device Users management with external API sync and auto-sync to devices
- Attendance event reception and storage (deduplication, UTC timestamps)
- Automatic event forwarding to Oracle API with retry logic
- Device command system: 31 commands including REBOOT, INFO, CHECK, LOG, CLEAR LOG/DATA/PHOTO, SET OPTION, QUERY ATTLOG/ATTPHOTO/USERINFO/FINGERTMP, DATA USER/DEL_USER/FP/DEL_FP, ENROLL_FP, AC_UNLOCK/UNALARM, RELOAD OPTIONS, UPDATE/DELETE TIMEZONE/GLOCK/SMS/USER_SMS/USERPIC, SHELL, GETFILE, PUTFILE
- Scheduled tasks with "all devices" option
- Dashboard with real-time statistics
- Dark/Light theme support

## Project Structure
```
client/src/
  pages/          - Dashboard, Clients, Devices, Events, Commands, Tasks, Logs, Settings
  components/     - AppSidebar, ThemeProvider, ThemeToggle, UI components
  lib/            - queryClient (TanStack Query setup)
server/
  index.ts        - Express server setup
  routes.ts       - ZKTeco PUSH endpoints + REST API routes
  protocol-logger.ts - In-memory circular buffer for protocol debug logs
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

## Authentication
- AES-256-CBC encrypted passwords stored in MySQL (using SESSION_SECRET as encryption key)
- 30-minute ban on any failed login attempt (per username)
- 5-attempt IP ban (per IP in 30 minutes)
- Access log recording all login attempts with IP, timestamp, and reason
- Default admin: user=admin, pass=admin123 (created on first startup)
- Session-based auth (express-session), 8h session timeout
- ZKTeco PUSH endpoints (/iclock/*) are NOT protected by auth (devices need direct access)

## API Routes
- `/api/auth/login` - POST login with username/password
- `/api/auth/logout` - POST logout
- `/api/auth/session` - GET current session status
- `/api/auth/access-logs` - GET access log history
- `/api/auth/change-password` - POST change password
- `/api/dashboard/stats` - Dashboard statistics
- `/api/clients` - Client CRUD
- `/api/devices` - Device CRUD
- `/api/device-users` - Device users CRUD + sync
- `/api/events` - Attendance events
- `/api/events/recent` - Latest 20 events
- `/api/events/pending-count` - Count of unforwarded events
- `/api/events/retry-forward` - Retry forwarding pending events
- `/api/commands` - GET (list command history), POST (send command to device)
- `/api/clients/:id/test-forwarding` - Test Oracle connection for specific client
- `/api/tasks` - GET (list scheduled tasks), POST (create), PATCH /:id (update), DELETE /:id

## Database Tables
- `admin_users` - Admin panel users with AES-256 encrypted passwords
- `access_logs` - Login attempt history with IP, success/fail, reason
- `clients` - Client registry with custom IDs, per-client Oracle forwarding config
- `devices` - ZKTeco devices with serial numbers, linked to clients
- `device_users` - Users to sync to devices, with sync status tracking
- `attendance_events` - All attendance records with forwarding status
- `operation_logs` - Device operation logs
- `device_commands` - Pending/executed device commands
- `scheduled_tasks` - Scheduled commands with support for one_time, interval, daily, weekly schedules; auto-executed by 30s scheduler loop
