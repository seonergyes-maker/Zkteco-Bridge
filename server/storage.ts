import { db } from "./db";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";
import {
  clients, devices, attendanceEvents, operationLogs, deviceCommands, scheduledTasks,
  type Client, type InsertClient,
  type Device, type InsertDevice,
  type AttendanceEvent, type InsertAttendanceEvent,
  type DeviceCommand,
  type ScheduledTask, type InsertScheduledTask,
} from "@shared/schema";

export interface IStorage {
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  getClientByDeviceSerial(serial: string): Promise<Client | undefined>;
  createClient(data: InsertClient): Promise<Client>;
  updateClient(id: number, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<void>;

  getDevices(): Promise<Device[]>;
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
  createEvent(data: InsertAttendanceEvent): Promise<AttendanceEvent>;
  markEventForwarded(id: number): Promise<void>;
  markEventForwardError(id: number, error: string): Promise<void>;

  createOperationLog(deviceSerial: string, logType: string, content: string): Promise<void>;

  getPendingCommands(serial: string): Promise<DeviceCommand[]>;
  getCommandHistory(serial?: string, limit?: number): Promise<DeviceCommand[]>;
  createCommand(serial: string, commandId: string, command: string): Promise<DeviceCommand>;
  updateCommandResult(commandId: string, returnValue: string, returnData?: string): Promise<void>;
  clearCommandHistory(): Promise<void>;

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
    await db.update(devices).set(data).where(eq(devices.id, id));
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device;
  }

  async updateDeviceLastSeen(serial: string, ip?: string, firmware?: string, model?: string): Promise<void> {
    const updateData: any = { lastSeen: new Date() };
    if (ip) updateData.ipAddress = ip;
    if (firmware) updateData.firmwareVersion = firmware;
    if (model) updateData.model = model;
    await db.update(devices).set(updateData).where(eq(devices.serialNumber, serial));
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
        .orderBy(desc(attendanceEvents.receivedAt))
        .limit(limit);
    }
    return db.select().from(attendanceEvents).orderBy(desc(attendanceEvents.receivedAt)).limit(limit);
  }

  async getRecentEvents(limit = 20): Promise<AttendanceEvent[]> {
    return db.select().from(attendanceEvents).orderBy(desc(attendanceEvents.receivedAt)).limit(limit);
  }

  async getPendingEvents(): Promise<AttendanceEvent[]> {
    return db.select().from(attendanceEvents).where(eq(attendanceEvents.forwarded, false)).orderBy(attendanceEvents.receivedAt);
  }

  async getPendingCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(attendanceEvents).where(eq(attendanceEvents.forwarded, false));
    return result?.count || 0;
  }

  async createEvent(data: InsertAttendanceEvent): Promise<AttendanceEvent> {
    const result = await db.insert(attendanceEvents).values(data);
    const insertId = result[0].insertId;
    const [event] = await db.select().from(attendanceEvents).where(eq(attendanceEvents.id, insertId));
    return event;
  }

  async markEventForwarded(id: number): Promise<void> {
    await db.update(attendanceEvents).set({ forwarded: true, forwardedAt: new Date(), forwardError: null }).where(eq(attendanceEvents.id, id));
  }

  async markEventForwardError(id: number, error: string): Promise<void> {
    await db.update(attendanceEvents).set({ forwardError: error }).where(eq(attendanceEvents.id, id));
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
    await db.update(deviceCommands).set({
      status: "executed",
      returnValue,
      returnData: returnData || null,
      executedAt: new Date(),
    }).where(eq(deviceCommands.commandId, commandId));
  }

  async clearCommandHistory(): Promise<void> {
    await db.delete(deviceCommands);
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

    return {
      totalClients: clientCount?.count || 0,
      totalDevices: deviceCount?.count || 0,
      onlineDevices: onlineCount?.count || 0,
      todayEvents: todayCount?.count || 0,
      pendingForward: pendingCount?.count || 0,
      forwardedToday: forwardedCount?.count || 0,
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
}

export const storage = new DatabaseStorage();
