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

export const forwardingConfig = mysqlTable("forwarding_config", {
  id: serial("id").primaryKey(),
  oracleApiUrl: text("oracle_api_url").notNull(),
  oracleApiKey: text("oracle_api_key"),
  enabled: boolean("enabled").notNull().default(false),
  retryAttempts: int("retry_attempts").notNull().default(3),
  retryDelayMs: int("retry_delay_ms").notNull().default(5000),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export const insertDeviceSchema = createInsertSchema(devices).omit({ id: true, lastSeen: true, attlogStamp: true, operlogStamp: true, attphotoStamp: true });
export const insertAttendanceEventSchema = createInsertSchema(attendanceEvents).omit({ id: true, receivedAt: true });
export const insertForwardingConfigSchema = createInsertSchema(forwardingConfig).omit({ id: true });

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type AttendanceEvent = typeof attendanceEvents.$inferSelect;
export type InsertAttendanceEvent = z.infer<typeof insertAttendanceEventSchema>;
export type OperationLog = typeof operationLogs.$inferSelect;
export type DeviceCommand = typeof deviceCommands.$inferSelect;
export type ForwardingConfig = typeof forwardingConfig.$inferSelect;
export type InsertForwardingConfig = z.infer<typeof insertForwardingConfigSchema>;

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
  2: "Tarjeta",
  9: "Otro",
};
