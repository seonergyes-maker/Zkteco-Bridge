import { db, pool } from "./db";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";
import {
  clients, devices, attendanceEvents, operationLogs, deviceCommands, scheduledTasks, deviceUsers,
  adminUsers, accessLogs,
  type Client, type InsertClient,
  type Device, type InsertDevice,
  type AttendanceEvent, type InsertAttendanceEvent,
  type DeviceCommand,
  type DeviceUser, type InsertDeviceUser,
  type ScheduledTask, type InsertScheduledTask,
  type AdminUser, type AccessLog,
} from "@shared/schema";

export interface IStorage {
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  getClientByDeviceSerial(serial: string): Promise<Client | undefined>;
  createClient(data: InsertClient): Promise<Client>;
  updateClient(id: number, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<void>;

  getDevices(): Promise<Device[]>;
  getDevicesByClientId(clientId: number): Promise<Device[]>;
  getDevice(id: number): Promise<Device | undefined>;
  getDeviceBySerial(serial: string): Promise<Device | undefined>;
  createDevice(data: InsertDevice): Promise<Device>;
  updateDevice(id: number, data: Partial<InsertDevice>): Promise<Device | undefined>;
  updateDeviceLastSeen(serial: string, ip?: string, firmware?: string, model?: string): Promise<void>;
  updateDeviceStamps(serial: string, stamps: { attlogStamp?: string; operlogStamp?: string; attphotoStamp?: string }): Promise<void>;
  deleteDevice(id: number): Promise<void>;

  getEvents(limit?: number, clientId?: number): Promise<AttendanceEvent[]>;
  getRecentEvents(limit?: number): Promise<AttendanceEvent[]>;
  getPendingEvents(): Promise<AttendanceEvent[]>;
  getPendingCount(): Promise<number>;
  eventExists(deviceSerial: string, pin: string, timestamp: Date, rawData?: string): Promise<boolean>;
  createEvent(data: InsertAttendanceEvent): Promise<AttendanceEvent>;
  markEventForwarded(id: number): Promise<void>;
  markEventForwardError(id: number, error: string): Promise<void>;
  getEventTimestampString(id: number): Promise<string | null>;
  markAllEventsForwarded(): Promise<number>;
  deleteAllEvents(): Promise<void>;

  createOperationLog(deviceSerial: string, logType: string, content: string): Promise<void>;

  getPendingCommands(serial: string): Promise<DeviceCommand[]>;
  getCommandHistory(serial?: string, limit?: number): Promise<DeviceCommand[]>;
  createCommand(serial: string, commandId: string, command: string): Promise<DeviceCommand>;
  updateCommandResult(commandId: string, returnValue: string, returnData?: string): Promise<void>;
  clearCommandHistory(): Promise<void>;

  getDeviceUsers(clientId?: number): Promise<DeviceUser[]>;
  getDeviceUser(id: number): Promise<DeviceUser | undefined>;
  getDeviceUserByPin(clientId: number, pin: string): Promise<DeviceUser | undefined>;
  createDeviceUser(data: InsertDeviceUser): Promise<DeviceUser>;
  updateDeviceUser(id: number, data: Partial<InsertDeviceUser>): Promise<DeviceUser | undefined>;
  deleteDeviceUser(id: number): Promise<void>;
  upsertDeviceUsers(clientId: number, users: InsertDeviceUser[]): Promise<{ created: number; updated: number }>;
  updateDeviceUserSyncStatus(id: number, deviceSerial: string): Promise<void>;
  getUnsyncedUsersForDevice(clientId: number, deviceSerial: string): Promise<DeviceUser[]>;
  clearDeviceUsers(clientId: number): Promise<void>;

  getScheduledTasks(): Promise<ScheduledTask[]>;
  getScheduledTask(id: number): Promise<ScheduledTask | undefined>;
  createScheduledTask(data: InsertScheduledTask & { nextRunAt?: Date | null }): Promise<ScheduledTask>;
  updateScheduledTask(id: number, data: Partial<InsertScheduledTask & { nextRunAt?: Date | null }>): Promise<ScheduledTask | undefined>;
  deleteScheduledTask(id: number): Promise<void>;
  getDueScheduledTasks(now: Date): Promise<ScheduledTask[]>;
  markScheduledTaskRun(id: number, lastRunAt: Date, nextRunAt: Date | null): Promise<void>;

  getDashboardStats(): Promise<{
    totalClients: number;
    totalDevices: number;
    onlineDevices: number;
    todayEvents: number;
    pendingForward: number;
    forwardedToday: number;
  }>;

  getAdminUser(username: string): Promise<AdminUser | undefined>;
  getAdminUserById(id: number): Promise<AdminUser | undefined>;
  createAdminUser(username: string, passwordEncrypted: string): Promise<AdminUser>;
  updateAdminPassword(id: number, passwordEncrypted: string): Promise<void>;
  getAdminUsers(): Promise<AdminUser[]>;

  createAccessLog(username: string, ip: string, success: boolean, reason?: string): Promise<void>;
  getAccessLogs(limit?: number): Promise<AccessLog[]>;
  getRecentFailedAttempts(username: string, sinceMinutes: number): Promise<AccessLog[]>;
  getRecentFailedAttemptsByIp(ip: string, sinceMinutes: number): Promise<AccessLog[]>;
}

export class DatabaseStorage implements IStorage {
  async getClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(clients.name);
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByDeviceSerial(serial: string): Promise<Client | undefined> {
    const device = await this.getDeviceBySerial(serial);
    if (!device) return undefined;
    return this.getClient(device.clientId);
  }

  async createClient(data: InsertClient): Promise<Client> {
    const result = await db.insert(clients).values(data);
    const insertId = result[0].insertId;
    const [client] = await db.select().from(clients).where(eq(clients.id, insertId));
    return client;
  }

  async updateClient(id: number, data: Partial<InsertClient>): Promise<Client | undefined> {
    await db.update(clients).set(data).where(eq(clients.id, id));
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async deleteClient(id: number): Promise<void> {
    await db.delete(devices).where(eq(devices.clientId, id));
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getDevices(): Promise<Device[]> {
    return db.select().from(devices).orderBy(devices.serialNumber);
  }

  async getDevicesByClientId(clientId: number): Promise<Device[]> {
    return db.select().from(devices).where(eq(devices.clientId, clientId)).orderBy(devices.serialNumber);
  }

  async getDevice(id: number): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device;
  }

  async getDeviceBySerial(serial: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.serialNumber, serial));
    return device;
  }

  async createDevice(data: InsertDevice): Promise<Device> {
    const result = await db.insert(devices).values(data);
    const insertId = result[0].insertId;
    const [device] = await db.select().from(devices).where(eq(devices.id, insertId));
    return device;
  }

  async updateDevice(id: number, data: Partial<InsertDevice>): Promise<Device | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.alias !== undefined) { fields.push("alias = ?"); values.push(data.alias); }
    if (data.active !== undefined) { fields.push("active = ?"); values.push(data.active ? 1 : 0); }
    if (data.clientId !== undefined) { fields.push("client_id = ?"); values.push(data.clientId); }
    if ((data as any).timezone !== undefined) { fields.push("timezone = ?"); values.push((data as any).timezone); }
    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE devices SET ${fields.join(", ")} WHERE id = ?`, values);
    }
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device;
  }

  async updateDeviceLastSeen(serial: string, ip?: string, firmware?: string, model?: string): Promise<void> {
    const sets: string[] = ["last_seen = NOW()"];
    const vals: any[] = [];
    if (ip) { sets.push("ip_address = ?"); vals.push(ip); }
    if (firmware) { sets.push("firmware_version = ?"); vals.push(firmware); }
    if (model) { sets.push("model = ?"); vals.push(model); }
    vals.push(serial);
    await pool.query(`UPDATE devices SET ${sets.join(", ")} WHERE serial_number = ?`, vals);
  }

  async updateDeviceStamps(serial: string, stamps: { attlogStamp?: string; operlogStamp?: string; attphotoStamp?: string }): Promise<void> {
    const updateData: any = {};
    if (stamps.attlogStamp) updateData.attlogStamp = stamps.attlogStamp;
    if (stamps.operlogStamp) updateData.operlogStamp = stamps.operlogStamp;
    if (stamps.attphotoStamp) updateData.attphotoStamp = stamps.attphotoStamp;
    if (Object.keys(updateData).length > 0) {
      await db.update(devices).set(updateData).where(eq(devices.serialNumber, serial));
    }
  }

  async deleteDevice(id: number): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
  }

  async getEvents(limit = 500, clientId?: number): Promise<AttendanceEvent[]> {
    if (clientId) {
      const clientDevices = await db.select({ serialNumber: devices.serialNumber })
        .from(devices)
        .where(eq(devices.clientId, clientId));
      const serials = clientDevices.map(d => d.serialNumber);
      if (serials.length === 0) return [];
      return db.select().from(attendanceEvents)
        .where(sql`${attendanceEvents.deviceSerial} IN (${sql.join(serials.map(s => sql`${s}`), sql`, `)})`)
        .orderBy(desc(attendanceEvents.timestamp))
        .limit(limit);
    }
    return db.select().from(attendanceEvents).orderBy(desc(attendanceEvents.timestamp)).limit(limit);
  }

  async getRecentEvents(limit = 20): Promise<AttendanceEvent[]> {
    return db.select().from(attendanceEvents).orderBy(desc(attendanceEvents.timestamp)).limit(limit);
  }

  async getPendingEvents(): Promise<AttendanceEvent[]> {
    return db.select().from(attendanceEvents).where(eq(attendanceEvents.forwarded, false)).orderBy(attendanceEvents.receivedAt);
  }

  async getPendingCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(attendanceEvents).where(eq(attendanceEvents.forwarded, false));
    return result?.count || 0;
  }

  async eventExists(deviceSerial: string, pin: string, timestamp: Date, rawData?: string): Promise<boolean> {
    let tsStr: string | null = null;
    if (rawData) {
      const parts = rawData.split("\t");
      const rawTime = parts[1]?.trim();
      if (rawTime && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(rawTime)) {
        tsStr = rawTime;
      }
    }
    if (!tsStr) {
      const d = timestamp instanceof Date ? timestamp : new Date(timestamp as any);
      const pad = (n: number) => String(n).padStart(2, "0");
      tsStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    const [rows] = await pool.query(
      "SELECT id FROM attendance_events WHERE device_serial = ? AND pin = ? AND `timestamp` = ? LIMIT 1",
      [deviceSerial, pin, tsStr]
    ) as any;
    return rows.length > 0;
  }

  async createEvent(data: InsertAttendanceEvent): Promise<AttendanceEvent> {
    let tsStr: string | null = null;
    const rawData = (data as any).rawData as string | undefined;
    if (rawData) {
      const parts = rawData.split("\t");
      const rawTime = parts[1]?.trim();
      if (rawTime && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(rawTime)) {
        tsStr = rawTime;
      }
    }
    if (!tsStr) {
      const d = data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp as any);
      const pad = (n: number) => String(n).padStart(2, "0");
      tsStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    const [result] = await pool.query(
      "INSERT INTO attendance_events (device_serial, pin, timestamp, status, verify, work_code, forwarded, raw_data) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
      [data.deviceSerial, data.pin, tsStr, data.status ?? 0, data.verify ?? 0, data.workCode ?? null, rawData ?? null]
    ) as any;
    const insertId = result.insertId;
    const [event] = await db.select().from(attendanceEvents).where(eq(attendanceEvents.id, insertId));
    return event;
  }

  async markEventForwarded(id: number): Promise<void> {
    await pool.query(
      "UPDATE attendance_events SET forwarded = 1, forwarded_at = NOW(), forward_error = NULL WHERE id = ?",
      [id]
    );
  }

  async markEventForwardError(id: number, error: string): Promise<void> {
    await db.update(attendanceEvents).set({ forwardError: error }).where(eq(attendanceEvents.id, id));
  }

  async markAllEventsForwarded(): Promise<number> {
    const [result] = await pool.query(
      "UPDATE attendance_events SET forwarded = 1, forwarded_at = NOW(), forward_error = NULL WHERE forwarded = 0"
    ) as any;
    return result?.affectedRows || 0;
  }

  async getEventTimestampString(id: number): Promise<string | null> {
    const [rows] = await pool.query(
      "SELECT DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:%s') as ts FROM attendance_events WHERE id = ?",
      [id]
    ) as any;
    return rows[0]?.ts || null;
  }

  async deleteAllEvents(): Promise<void> {
    await db.delete(attendanceEvents);
  }

  async createOperationLog(deviceSerial: string, logType: string, content: string): Promise<void> {
    await db.insert(operationLogs).values({ deviceSerial, logType, content });
  }

  async getPendingCommands(serial: string): Promise<DeviceCommand[]> {
    return db.select().from(deviceCommands).where(
      and(eq(deviceCommands.deviceSerial, serial), eq(deviceCommands.status, "pending"))
    ).orderBy(deviceCommands.createdAt);
  }

  async getCommandHistory(serial?: string, limit = 100): Promise<DeviceCommand[]> {
    if (serial) {
      return db.select().from(deviceCommands)
        .where(eq(deviceCommands.deviceSerial, serial))
        .orderBy(desc(deviceCommands.createdAt))
        .limit(limit);
    }
    return db.select().from(deviceCommands)
      .orderBy(desc(deviceCommands.createdAt))
      .limit(limit);
  }

  async createCommand(serial: string, commandId: string, command: string): Promise<DeviceCommand> {
    const result = await db.insert(deviceCommands).values({ deviceSerial: serial, commandId, command });
    const insertId = result[0].insertId;
    const [cmd] = await db.select().from(deviceCommands).where(eq(deviceCommands.id, insertId));
    return cmd;
  }

  async updateCommandResult(commandId: string, returnValue: string, returnData?: string): Promise<void> {
    await pool.query(
      "UPDATE device_commands SET status = 'executed', return_value = ?, return_data = ?, executed_at = NOW() WHERE command_id = ?",
      [returnValue, returnData || null, commandId]
    );
  }

  async clearCommandHistory(): Promise<void> {
    await db.delete(deviceCommands);
  }

  async getDeviceUsers(clientId?: number): Promise<DeviceUser[]> {
    if (clientId) {
      return db.select().from(deviceUsers).where(eq(deviceUsers.clientId, clientId)).orderBy(deviceUsers.pin);
    }
    return db.select().from(deviceUsers).orderBy(deviceUsers.pin);
  }

  async getDeviceUser(id: number): Promise<DeviceUser | undefined> {
    const [user] = await db.select().from(deviceUsers).where(eq(deviceUsers.id, id));
    return user;
  }

  async getDeviceUserByPin(clientId: number, pin: string): Promise<DeviceUser | undefined> {
    const [user] = await db.select().from(deviceUsers).where(
      and(eq(deviceUsers.clientId, clientId), eq(deviceUsers.pin, pin))
    );
    return user;
  }

  async createDeviceUser(data: InsertDeviceUser): Promise<DeviceUser> {
    const result = await db.insert(deviceUsers).values(data);
    const insertId = Number(result[0].insertId);
    const [user] = await db.select().from(deviceUsers).where(eq(deviceUsers.id, insertId));
    return user;
  }

  async updateDeviceUser(id: number, data: Partial<InsertDeviceUser>): Promise<DeviceUser | undefined> {
    await db.update(deviceUsers).set({ ...data, updatedAt: sql`NOW()` }).where(eq(deviceUsers.id, id));
    const [user] = await db.select().from(deviceUsers).where(eq(deviceUsers.id, id));
    return user;
  }

  async deleteDeviceUser(id: number): Promise<void> {
    await db.delete(deviceUsers).where(eq(deviceUsers.id, id));
  }

  async upsertDeviceUsers(clientId: number, users: InsertDeviceUser[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    for (const u of users) {
      const existing = await this.getDeviceUserByPin(clientId, u.pin);
      if (existing) {
        await this.updateDeviceUser(existing.id, { name: u.name, password: u.password, card: u.card, privilege: u.privilege });
        updated++;
      } else {
        await this.createDeviceUser({ ...u, clientId });
        created++;
      }
    }
    return { created, updated };
  }

  async updateDeviceUserSyncStatus(id: number, deviceSerial: string): Promise<void> {
    const user = await this.getDeviceUser(id);
    if (!user) return;
    const synced: string[] = user.syncedToDevices ? JSON.parse(user.syncedToDevices) : [];
    if (!synced.includes(deviceSerial)) {
      synced.push(deviceSerial);
    }
    await db.update(deviceUsers).set({ syncedToDevices: JSON.stringify(synced), updatedAt: sql`NOW()` }).where(eq(deviceUsers.id, id));
  }

  async getUnsyncedUsersForDevice(clientId: number, deviceSerial: string): Promise<DeviceUser[]> {
    const allUsers = await db.select().from(deviceUsers).where(eq(deviceUsers.clientId, clientId));
    return allUsers.filter(u => {
      if (!u.syncedToDevices) return true;
      try {
        const synced: string[] = JSON.parse(u.syncedToDevices);
        return !synced.includes(deviceSerial);
      } catch { return true; }
    });
  }

  async clearDeviceUsers(clientId: number): Promise<void> {
    await db.delete(deviceUsers).where(eq(deviceUsers.clientId, clientId));
  }

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    const [clientCount] = await db.select({ count: count() }).from(clients);
    const [deviceCount] = await db.select({ count: count() }).from(devices);
    const [onlineCount] = await db.select({ count: count() }).from(devices).where(gte(devices.lastSeen, fiveMinAgo));
    const [todayCount] = await db.select({ count: count() }).from(attendanceEvents).where(gte(attendanceEvents.receivedAt, today));
    const [pendingCount] = await db.select({ count: count() }).from(attendanceEvents).where(eq(attendanceEvents.forwarded, false));
    const [forwardedCount] = await db.select({ count: count() }).from(attendanceEvents).where(
      and(eq(attendanceEvents.forwarded, true), gte(attendanceEvents.forwardedAt, today))
    );

    const [forwardingEnabledCount] = await db.select({ count: count() }).from(clients).where(eq(clients.forwardingEnabled, true));

    return {
      totalClients: clientCount?.count || 0,
      totalDevices: deviceCount?.count || 0,
      onlineDevices: onlineCount?.count || 0,
      todayEvents: todayCount?.count || 0,
      pendingForward: pendingCount?.count || 0,
      forwardedToday: forwardedCount?.count || 0,
      forwardingActive: (forwardingEnabledCount?.count || 0) > 0,
    };
  }

  async getScheduledTasks(): Promise<ScheduledTask[]> {
    return db.select().from(scheduledTasks).orderBy(desc(scheduledTasks.createdAt));
  }

  async getScheduledTask(id: number): Promise<ScheduledTask | undefined> {
    const [task] = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id));
    return task;
  }

  async createScheduledTask(data: InsertScheduledTask & { nextRunAt?: Date | null }): Promise<ScheduledTask> {
    const result = await db.insert(scheduledTasks).values(data);
    const insertId = result[0].insertId;
    const [task] = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, insertId));
    return task;
  }

  async updateScheduledTask(id: number, data: Partial<InsertScheduledTask & { nextRunAt?: Date | null }>): Promise<ScheduledTask | undefined> {
    await db.update(scheduledTasks).set(data).where(eq(scheduledTasks.id, id));
    const [task] = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id));
    return task;
  }

  async deleteScheduledTask(id: number): Promise<void> {
    await db.delete(scheduledTasks).where(eq(scheduledTasks.id, id));
  }

  async getDueScheduledTasks(now: Date): Promise<ScheduledTask[]> {
    return db.select().from(scheduledTasks).where(
      and(
        eq(scheduledTasks.enabled, true),
        sql`${scheduledTasks.nextRunAt} <= ${now}`
      )
    );
  }

  async markScheduledTaskRun(id: number, lastRunAt: Date, nextRunAt: Date | null): Promise<void> {
    const data: any = { lastRunAt };
    if (nextRunAt) {
      data.nextRunAt = nextRunAt;
    } else {
      data.nextRunAt = null;
      data.enabled = false;
    }
    await db.update(scheduledTasks).set(data).where(eq(scheduledTasks.id, id));
  }

  async getAdminUser(username: string): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
    return user;
  }

  async getAdminUserById(id: number): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return user;
  }

  async createAdminUser(username: string, passwordEncrypted: string): Promise<AdminUser> {
    const result = await db.insert(adminUsers).values({ username, passwordEncrypted });
    const insertId = result[0].insertId;
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, insertId));
    return user;
  }

  async updateAdminPassword(id: number, passwordEncrypted: string): Promise<void> {
    await db.update(adminUsers).set({ passwordEncrypted }).where(eq(adminUsers.id, id));
  }

  async getAdminUsers(): Promise<AdminUser[]> {
    return db.select().from(adminUsers).orderBy(adminUsers.username);
  }

  async createAccessLog(username: string, ip: string, success: boolean, reason?: string): Promise<void> {
    await db.insert(accessLogs).values({ username, ip, success, reason: reason || null });
  }

  async getAccessLogs(limit = 100): Promise<AccessLog[]> {
    return db.select().from(accessLogs).orderBy(desc(accessLogs.createdAt)).limit(limit);
  }

  async getRecentFailedAttempts(username: string, sinceMinutes: number): Promise<AccessLog[]> {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
    return db.select().from(accessLogs).where(
      and(
        eq(accessLogs.username, username),
        eq(accessLogs.success, false),
        gte(accessLogs.createdAt, since)
      )
    ).orderBy(desc(accessLogs.createdAt));
  }

  async getRecentFailedAttemptsByIp(ip: string, sinceMinutes: number): Promise<AccessLog[]> {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
    return db.select().from(accessLogs).where(
      and(
        eq(accessLogs.ip, ip),
        eq(accessLogs.success, false),
        gte(accessLogs.createdAt, since)
      )
    ).orderBy(desc(accessLogs.createdAt));
  }
}

export const storage = new DatabaseStorage();
