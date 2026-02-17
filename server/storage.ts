import { db } from "./db";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";
import {
  clients, devices, attendanceEvents, operationLogs, deviceCommands, forwardingConfig,
  type Client, type InsertClient,
  type Device, type InsertDevice,
  type AttendanceEvent, type InsertAttendanceEvent,
  type ForwardingConfig, type InsertForwardingConfig,
  type DeviceCommand,
} from "@shared/schema";

export interface IStorage {
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(data: InsertClient): Promise<Client>;
  updateClient(id: number, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<void>;

  getDevices(): Promise<Device[]>;
  getDevice(id: number): Promise<Device | undefined>;
  getDeviceBySerial(serial: string): Promise<Device | undefined>;
  createDevice(data: InsertDevice): Promise<Device>;
  updateDevice(id: number, data: Partial<InsertDevice>): Promise<Device | undefined>;
  updateDeviceLastSeen(serial: string, ip?: string, firmware?: string): Promise<void>;
  updateDeviceStamps(serial: string, stamps: { attlogStamp?: string; operlogStamp?: string; attphotoStamp?: string }): Promise<void>;
  deleteDevice(id: number): Promise<void>;

  getEvents(limit?: number): Promise<AttendanceEvent[]>;
  getRecentEvents(limit?: number): Promise<AttendanceEvent[]>;
  getPendingEvents(): Promise<AttendanceEvent[]>;
  getPendingCount(): Promise<number>;
  createEvent(data: InsertAttendanceEvent): Promise<AttendanceEvent>;
  markEventForwarded(id: number): Promise<void>;
  markEventForwardError(id: number, error: string): Promise<void>;

  createOperationLog(deviceSerial: string, logType: string, content: string): Promise<void>;

  getPendingCommands(serial: string): Promise<DeviceCommand[]>;
  createCommand(serial: string, commandId: string, command: string): Promise<DeviceCommand>;
  updateCommandResult(commandId: string, returnValue: string, returnData?: string): Promise<void>;

  getForwardingConfig(): Promise<ForwardingConfig | null>;
  saveForwardingConfig(data: InsertForwardingConfig): Promise<ForwardingConfig>;

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

  async updateDeviceLastSeen(serial: string, ip?: string, firmware?: string): Promise<void> {
    const updateData: any = { lastSeen: new Date() };
    if (ip) updateData.ipAddress = ip;
    if (firmware) updateData.firmwareVersion = firmware;
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

  async getEvents(limit = 500): Promise<AttendanceEvent[]> {
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

  async getForwardingConfig(): Promise<ForwardingConfig | null> {
    const [config] = await db.select().from(forwardingConfig).limit(1);
    return config || null;
  }

  async saveForwardingConfig(data: InsertForwardingConfig): Promise<ForwardingConfig> {
    const existing = await this.getForwardingConfig();
    if (existing) {
      await db.update(forwardingConfig).set(data).where(eq(forwardingConfig.id, existing.id));
      const [updated] = await db.select().from(forwardingConfig).where(eq(forwardingConfig.id, existing.id));
      return updated;
    }
    const result = await db.insert(forwardingConfig).values(data);
    const insertId = result[0].insertId;
    const [created] = await db.select().from(forwardingConfig).where(eq(forwardingConfig.id, insertId));
    return created;
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
}

export const storage = new DatabaseStorage();
