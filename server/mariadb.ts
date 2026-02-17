import mysql from "mysql2/promise";
import { log } from "./index";

let pool: mysql.Pool | null = null;

export function getMariaDbPool(): mysql.Pool | null {
  if (pool) return pool;

  const host = process.env.MARIA_DB_HOST;
  const user = process.env.MARIA_DB_USER;
  const password = process.env.MARIA_DB_PASS;
  const database = process.env.MARIA_DB_NAME;

  if (!host || !user || !password || !database) {
    log("[MariaDB] Missing connection credentials in environment variables", "mariadb");
    return null;
  }

  try {
    pool = mysql.createPool({
      host,
      user,
      password,
      database,
      port: parseInt(process.env.MARIA_DB_PORT || "3306"),
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 10000,
    });
    log(`[MariaDB] Connection pool created for ${host}/${database}`, "mariadb");
    return pool;
  } catch (err: any) {
    log(`[MariaDB] Failed to create pool: ${err.message}`, "mariadb");
    return null;
  }
}

export async function testMariaDbConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const p = getMariaDbPool();
    if (!p) {
      return { success: false, error: "Credenciales de MariaDB no configuradas" };
    }
    const conn = await p.getConnection();
    await conn.ping();
    conn.release();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function ensureFichajesTable(): Promise<void> {
  const p = getMariaDbPool();
  if (!p) return;

  try {
    await p.execute(`
      CREATE TABLE IF NOT EXISTS fichajes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_serial VARCHAR(100) NOT NULL,
        client_id VARCHAR(100),
        pin VARCHAR(50) NOT NULL,
        timestamp DATETIME NOT NULL,
        status INT DEFAULT 0,
        verify INT DEFAULT 0,
        work_code VARCHAR(50),
        received_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    log("[MariaDB] Table 'fichajes' verified/created", "mariadb");
  } catch (err: any) {
    log(`[MariaDB] Error creating table: ${err.message}`, "mariadb");
  }
}

export async function insertFichaje(data: {
  deviceSerial: string;
  clientId: string | null;
  pin: string;
  timestamp: Date;
  status: number;
  verify: number;
  workCode: string | null;
}): Promise<void> {
  const p = getMariaDbPool();
  if (!p) throw new Error("MariaDB no disponible");

  await p.execute(
    `INSERT INTO fichajes (device_serial, client_id, pin, timestamp, status, verify, work_code)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.deviceSerial,
      data.clientId,
      data.pin,
      data.timestamp,
      data.status,
      data.verify,
      data.workCode,
    ]
  );
}

export async function getMariaDbStatus(): Promise<{
  connected: boolean;
  host: string;
  database: string;
  user: string;
  totalRecords?: number;
  error?: string;
}> {
  const host = process.env.MARIA_DB_HOST || "";
  const database = process.env.MARIA_DB_NAME || "";
  const user = process.env.MARIA_DB_USER || "";

  try {
    const p = getMariaDbPool();
    if (!p) {
      return { connected: false, host, database, user, error: "Credenciales no configuradas" };
    }
    const conn = await p.getConnection();
    await conn.ping();
    const [rows] = await conn.execute("SELECT COUNT(*) as total FROM fichajes") as any;
    conn.release();
    return { connected: true, host, database, user, totalRecords: rows[0]?.total || 0 };
  } catch (err: any) {
    return { connected: false, host, database, user, error: err.message };
  }
}
