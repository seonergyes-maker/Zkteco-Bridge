import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "@shared/schema";

if (!process.env.MYSQL_DATABASE_URL) {
  throw new Error("MYSQL_DATABASE_URL must be set.");
}

function getTimezoneOffset(tz: string): string {
  const now = new Date();
  const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const diffH = (local.getTime() - utc.getTime()) / 3600000;
  const sign = diffH >= 0 ? "+" : "-";
  const absH = Math.floor(Math.abs(diffH));
  const absM = Math.round((Math.abs(diffH) - absH) * 60);
  return `${sign}${String(absH).padStart(2, "0")}:${String(absM).padStart(2, "0")}`;
}

const appTimezone = process.env.TZ || "Europe/Madrid";
const mysqlTimezone = getTimezoneOffset(appTimezone);

export const pool = mysql.createPool({
  uri: process.env.MYSQL_DATABASE_URL,
  timezone: mysqlTimezone,
});
export const db = drizzle(pool, { schema, mode: "default" });
