import { sql } from "drizzle-orm";
import { mysqlTable, text, varchar, int, datetime, boolean, serial } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const clients = mysqlTable("clients", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").notNull(),
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  active: boolean("active").notNull().default(true),
  oracleApiUrl: text("oracle_api_url"),
  oracleApiKey: text("oracle_api_key"),
  forwardingEnabled: boolean("forwarding_enabled").notNull().default(false),
  retryAttempts: int("retry_attempts").notNull().default(3),
  retryDelayMs: int("retry_delay_ms").notNull().default(5000),
  usersApiUrl: text("users_api_url"),
  usersApiKey: text("users_api_key"),
  createdAt: datetime("created_at").default(sql`NOW()`).notNull(),
});

export const devices = mysqlTable("devices", {
  id: serial("id").primaryKey(),
  serialNumber: varchar("serial_number", { length: 255 }).notNull().unique(),
  clientId: int("client_id").references(() => clients.id).notNull(),
  alias: text("alias"),
  model: text("model"),
  firmwareVersion: text("firmware_version"),
  ipAddress: text("ip_address"),
  lastSeen: datetime("last_seen"),
  active: boolean("active").notNull().default(true),
  attlogStamp: text("attlog_stamp").default("0"),
  operlogStamp: text("operlog_stamp").default("0"),
  attphotoStamp: text("attphoto_stamp").default("0"),
});

export const attendanceEvents = mysqlTable("attendance_events", {
  id: serial("id").primaryKey(),
  deviceSerial: varchar("device_serial", { length: 255 }).notNull(),
  pin: varchar("pin", { length: 255 }).notNull(),
  timestamp: datetime("timestamp").notNull(),
  status: int("status").notNull().default(0),
  verify: int("verify").notNull().default(0),
  workCode: text("work_code"),
  forwarded: boolean("forwarded").notNull().default(false),
  forwardedAt: datetime("forwarded_at"),
  forwardError: text("forward_error"),
  rawData: text("raw_data"),
  receivedAt: datetime("received_at").default(sql`NOW()`).notNull(),
});

export const operationLogs = mysqlTable("operation_logs", {
  id: serial("id").primaryKey(),
  deviceSerial: varchar("device_serial", { length: 255 }).notNull(),
  logType: varchar("log_type", { length: 255 }).notNull(),
  content: text("content").notNull(),
  receivedAt: datetime("received_at").default(sql`NOW()`).notNull(),
});

export const deviceCommands = mysqlTable("device_commands", {
  id: serial("id").primaryKey(),
  deviceSerial: varchar("device_serial", { length: 255 }).notNull(),
  commandId: varchar("command_id", { length: 255 }).notNull(),
  command: text("command").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  returnValue: text("return_value"),
  returnData: text("return_data"),
  createdAt: datetime("created_at").default(sql`NOW()`).notNull(),
  executedAt: datetime("executed_at"),
});

export const deviceUsers = mysqlTable("device_users", {
  id: serial("id").primaryKey(),
  clientId: int("client_id").references(() => clients.id).notNull(),
  pin: varchar("pin", { length: 255 }).notNull(),
  name: text("name"),
  password: text("password"),
  card: text("card"),
  privilege: int("privilege").notNull().default(0),
  syncedToDevices: text("synced_to_devices"),
  createdAt: datetime("created_at").default(sql`NOW()`).notNull(),
  updatedAt: datetime("updated_at").default(sql`NOW()`).notNull(),
});

export const scheduledTasks = mysqlTable("scheduled_tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  deviceSerial: varchar("device_serial", { length: 255 }).notNull(),
  commandType: varchar("command_type", { length: 50 }).notNull(),
  commandParams: text("command_params"),
  scheduleType: varchar("schedule_type", { length: 20 }).notNull(),
  runAt: datetime("run_at"),
  intervalMinutes: int("interval_minutes"),
  daysOfWeek: text("days_of_week"),
  timeOfDay: varchar("time_of_day", { length: 5 }),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: datetime("last_run_at"),
  nextRunAt: datetime("next_run_at"),
  createdAt: datetime("created_at").default(sql`NOW()`).notNull(),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export const insertDeviceSchema = createInsertSchema(devices).omit({ id: true, lastSeen: true, attlogStamp: true, operlogStamp: true, attphotoStamp: true });
export const insertAttendanceEventSchema = createInsertSchema(attendanceEvents).omit({ id: true, receivedAt: true });
export const insertDeviceUserSchema = createInsertSchema(deviceUsers).omit({ id: true, createdAt: true, updatedAt: true, syncedToDevices: true });
export const insertScheduledTaskSchema = createInsertSchema(scheduledTasks).omit({ id: true, createdAt: true, lastRunAt: true, nextRunAt: true }).extend({
  runAt: z.preprocess((val) => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    if (typeof val === "string") return new Date(val);
    return undefined;
  }, z.date().optional()),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type AttendanceEvent = typeof attendanceEvents.$inferSelect;
export type InsertAttendanceEvent = z.infer<typeof insertAttendanceEventSchema>;
export type OperationLog = typeof operationLogs.$inferSelect;
export type DeviceCommand = typeof deviceCommands.$inferSelect;
export type DeviceUser = typeof deviceUsers.$inferSelect;
export type InsertDeviceUser = z.infer<typeof insertDeviceUserSchema>;
export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type InsertScheduledTask = z.infer<typeof insertScheduledTaskSchema>;

export const adminUsers = mysqlTable("admin_users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordEncrypted: text("password_encrypted").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: datetime("created_at").default(sql`NOW()`).notNull(),
});

export const accessLogs = mysqlTable("access_logs", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull(),
  ip: varchar("ip", { length: 45 }).notNull(),
  success: boolean("success").notNull(),
  reason: text("reason"),
  createdAt: datetime("created_at").default(sql`NOW()`).notNull(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({ id: true, createdAt: true });
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AccessLog = typeof accessLogs.$inferSelect;

export const ATTENDANCE_STATUS: Record<number, string> = {
  0: "Entrada",
  1: "Salida",
  2: "Salida temporal",
  3: "Regreso",
  4: "Entrada horas extra",
  5: "Salida horas extra",
  8: "Inicio comida",
  9: "Fin comida",
};

export const VERIFY_MODE: Record<number, string> = {
  0: "Contrasena",
  1: "Huella",
  2: "Tarjeta RFID",
  3: "Contrasena + Huella",
  4: "Tarjeta",
  5: "Tarjeta + Huella",
  6: "Tarjeta + Contrasena",
  7: "Tarjeta + Contrasena + Huella",
  8: "Tarjeta + Huella + Contrasena",
  9: "Otro",
  15: "Facial",
};
