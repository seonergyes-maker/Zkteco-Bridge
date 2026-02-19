import { storage } from "./storage";
import { log } from "./index";
import { pool } from "./db";
import { encrypt } from "./crypto";

async function ensureTables() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name TEXT NOT NULL,
      device_serial VARCHAR(255) NOT NULL,
      command_type VARCHAR(50) NOT NULL,
      command_params TEXT,
      schedule_type VARCHAR(20) NOT NULL,
      run_at DATETIME,
      interval_minutes INT,
      days_of_week TEXT,
      time_of_day VARCHAR(5),
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      last_run_at DATETIME,
      next_run_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT NOW()
    )`);
    const addColumnSafe = async (table: string, column: string, definition: string) => {
      try {
        await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      } catch (e: any) {
        if (!e.message?.includes("Duplicate column")) throw e;
      }
    };
    await addColumnSafe("clients", "users_api_url", "TEXT");
    await addColumnSafe("clients", "users_api_key", "TEXT");
    await conn.query(`CREATE TABLE IF NOT EXISTS device_users (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      pin VARCHAR(255) NOT NULL,
      name TEXT,
      password TEXT,
      card TEXT,
      privilege INT NOT NULL DEFAULT 0,
      synced_to_devices TEXT,
      created_at DATETIME NOT NULL DEFAULT NOW(),
      updated_at DATETIME NOT NULL DEFAULT NOW()
    )`);
    await conn.query(`CREATE TABLE IF NOT EXISTS admin_users (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_encrypted TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT NOW()
    )`);
    await conn.query(`CREATE TABLE IF NOT EXISTS access_logs (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL,
      ip VARCHAR(45) NOT NULL,
      success BOOLEAN NOT NULL,
      reason TEXT,
      created_at DATETIME NOT NULL DEFAULT NOW()
    )`);
  } finally {
    conn.release();
  }
}

export async function seedDatabase() {
  try {
    await ensureTables();

    const existingAdmin = await storage.getAdminUser("admin");
    if (!existingAdmin) {
      await storage.createAdminUser("admin", encrypt("admin123"));
      log("Default admin user created (user: admin, pass: admin123)", "seed");
    }

    const existingEnrique = await storage.getAdminUser("enrique@daemon4.com");
    if (!existingEnrique) {
      await storage.createAdminUser("enrique@daemon4.com", encrypt("Daemon4$"));
      log("Admin user enrique@daemon4.com created", "seed");
    }

    const existingClients = await storage.getClients();
    if (existingClients.length > 0) {
      log("Database already has data, skipping seed", "seed");
      return;
    }

    log("Seeding database with sample data...", "seed");

    const client1 = await storage.createClient({
      clientId: "CLI-001",
      name: "Construcciones Martinez S.L.",
      contactEmail: "admin@martinez-sl.com",
      contactPhone: "+34 912 345 678",
      active: true,
    });

    const client2 = await storage.createClient({
      clientId: "CLI-002",
      name: "Logistica Iberia S.A.",
      contactEmail: "rrhh@logisticaiberia.es",
      contactPhone: "+34 933 456 789",
      active: true,
    });

    const client3 = await storage.createClient({
      clientId: "CLI-003",
      name: "Hotel Costa del Sol",
      contactEmail: "gerencia@hotelcostasol.com",
      contactPhone: "+34 952 678 901",
      active: true,
    });

    await storage.createDevice({
      serialNumber: "AZKF230100001",
      clientId: client1.id,
      alias: "Entrada principal",
      model: "ZK-F22",
      firmwareVersion: "Ver 6.39",
      ipAddress: "192.168.1.100",
      active: true,
    });

    await storage.createDevice({
      serialNumber: "AZKF230100002",
      clientId: client1.id,
      alias: "Almacen",
      model: "ZK-F22",
      firmwareVersion: "Ver 6.39",
      ipAddress: "192.168.1.101",
      active: true,
    });

    await storage.createDevice({
      serialNumber: "BZKF230200001",
      clientId: client2.id,
      alias: "Oficina central",
      model: "iClock 880",
      firmwareVersion: "Ver 6.60",
      ipAddress: "10.0.0.50",
      active: true,
    });

    await storage.createDevice({
      serialNumber: "CZKF230300001",
      clientId: client3.id,
      alias: "Recepcion",
      model: "SpeedFace V5L",
      firmwareVersion: "Ver 2.1",
      ipAddress: "172.16.0.10",
      active: true,
    });

    await storage.createDevice({
      serialNumber: "CZKF230300002",
      clientId: client3.id,
      alias: "Cocina",
      model: "SpeedFace V5L",
      firmwareVersion: "Ver 2.1",
      ipAddress: "172.16.0.11",
      active: true,
    });

    const now = new Date();
    const sampleEvents = [
      { pin: "101", deviceSerial: "AZKF230100001", offset: -120, status: 0, verify: 1 },
      { pin: "102", deviceSerial: "AZKF230100001", offset: -115, status: 0, verify: 2 },
      { pin: "201", deviceSerial: "BZKF230200001", offset: -100, status: 0, verify: 1 },
      { pin: "101", deviceSerial: "AZKF230100001", offset: -60, status: 1, verify: 1 },
      { pin: "301", deviceSerial: "CZKF230300001", offset: -50, status: 0, verify: 1 },
      { pin: "302", deviceSerial: "CZKF230300002", offset: -45, status: 0, verify: 2 },
      { pin: "201", deviceSerial: "BZKF230200001", offset: -30, status: 1, verify: 1 },
      { pin: "102", deviceSerial: "AZKF230100002", offset: -20, status: 2, verify: 1 },
      { pin: "301", deviceSerial: "CZKF230300001", offset: -10, status: 1, verify: 1 },
      { pin: "103", deviceSerial: "AZKF230100001", offset: -5, status: 0, verify: 1 },
    ];

    for (const e of sampleEvents) {
      const ts = new Date(now.getTime() + e.offset * 60 * 1000);
      await storage.createEvent({
        deviceSerial: e.deviceSerial,
        pin: e.pin,
        timestamp: ts,
        status: e.status,
        verify: e.verify,
        workCode: null,
        forwarded: false,
        forwardedAt: null,
        forwardError: null,
        rawData: `${e.pin}\t${ts.toISOString()}\t${e.status}\t${e.verify}`,
      });
    }

    log("Database seeded successfully", "seed");
  } catch (err: any) {
    log(`Error seeding database: ${err.message}`, "seed");
  }
}
