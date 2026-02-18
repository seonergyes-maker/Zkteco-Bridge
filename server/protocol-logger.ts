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
  ip: string = ""
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
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
}

export function getProtocolLogs(limit = 100, deviceFilter?: string): ProtocolLogEntry[] {
  let filtered = entries;
  if (deviceFilter) {
    filtered = entries.filter(e => e.deviceSerial === deviceFilter);
  }
  return filtered.slice(-limit).reverse();
}

export function clearProtocolLogs() {
  entries.length = 0;
}
