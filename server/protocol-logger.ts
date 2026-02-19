export interface ProtocolLogEntry {
  id: number;
  timestamp: string;
  direction: "IN" | "OUT";
  deviceSerial: string;
  endpoint: string;
  method: string;
  summary: string;
  details: string;
  ip: string;
  logType: string;
}

const MAX_ENTRIES = 500;
let nextId = 1;
const entries: ProtocolLogEntry[] = [];

export function addProtocolLog(
  direction: "IN" | "OUT",
  deviceSerial: string,
  endpoint: string,
  method: string,
  summary: string,
  details: string,
  ip: string = "",
  logType: string = ""
) {
  const entry: ProtocolLogEntry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    direction,
    deviceSerial,
    endpoint,
    method,
    summary,
    details,
    ip,
    logType,
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
}

export function getProtocolLogs(limit = 100, deviceFilter?: string, typeFilter?: string): ProtocolLogEntry[] {
  let filtered = entries;
  if (deviceFilter) {
    filtered = filtered.filter(e => e.deviceSerial === deviceFilter);
  }
  if (typeFilter) {
    filtered = filtered.filter(e => e.logType === typeFilter);
  }
  return filtered.slice(-limit).reverse();
}

export function getLogTypes(): string[] {
  const types = new Set<string>();
  for (const e of entries) {
    if (e.logType) types.add(e.logType);
  }
  return Array.from(types).sort();
}

export function clearProtocolLogs() {
  entries.length = 0;
}
