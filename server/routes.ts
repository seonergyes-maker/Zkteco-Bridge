import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClientSchema, insertDeviceSchema } from "@shared/schema";
import { log } from "./index";
import { encrypt, decrypt, maskApiKey, isEncrypted } from "./crypto";

function parseZktecoTimestamp(timeStr: string): Date | null {
  const match = timeStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, min, sec] = match;
  const d = new Date(
    parseInt(year), parseInt(month) - 1, parseInt(day),
    parseInt(hour), parseInt(min), parseInt(sec)
  );
  if (isNaN(d.getTime())) return null;
  return d;
}

function maskClientForResponse(client: any) {
  return {
    ...client,
    oracleApiKey: maskApiKey(client.oracleApiKey),
  };
}

async function forwardEvent(event: any) {
  const client = await storage.getClientByDeviceSerial(event.deviceSerial);
  if (!client || !client.forwardingEnabled || !client.oracleApiUrl) return;

  const retryAttempts = client.retryAttempts || 3;
  const retryDelayMs = client.retryDelayMs || 5000;

  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (client.oracleApiKey) {
        headers["Authorization"] = `Bearer ${decrypt(client.oracleApiKey)}`;
      }

      const response = await fetch(client.oracleApiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          deviceSerial: event.deviceSerial,
          clientId: client.clientId,
          pin: event.pin,
          timestamp: event.timestamp,
          status: event.status,
          verify: event.verify,
          workCode: event.workCode,
        }),
      });

      if (response.ok) {
        await storage.markEventForwarded(event.id);
        return;
      }

      const errorText = await response.text();
      if (attempt === retryAttempts - 1) {
        await storage.markEventForwardError(event.id, `HTTP ${response.status}: ${errorText}`);
      }
    } catch (err: any) {
      if (attempt === retryAttempts - 1) {
        await storage.markEventForwardError(event.id, err.message);
      }
    }

    if (attempt < retryAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Encrypt any existing plaintext API keys on startup
  try {
    const allClients = await storage.getClients();
    for (const client of allClients) {
      if (client.oracleApiKey && !isEncrypted(client.oracleApiKey)) {
        await storage.updateClient(client.id, { oracleApiKey: encrypt(client.oracleApiKey) });
        log(`[Security] Encrypted API key for client ${client.clientId}`, "security");
      }
    }
  } catch (err: any) {
    log(`[Security] Error encrypting existing keys: ${err.message}`, "error");
  }

  // ===== ZKTeco PUSH SDK Protocol Endpoints =====

  // Device requests configuration
  app.get("/iclock/cdata", async (req: Request, res: Response) => {
    const sn = req.query.SN as string;
    const options = req.query.options as string;

    if (!sn) {
      res.status(400).send("ERROR: Missing SN parameter");
      return;
    }

    log(`[PUSH] Device ${sn} requesting config (options=${options})`, "zkteco");

    const device = await storage.getDeviceBySerial(sn);

    // Update last seen
    const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
    await storage.updateDeviceLastSeen(sn, ip);

    if (!device) {
      log(`[PUSH] Unknown device ${sn} - not registered`, "zkteco");
    }

    const stamps = device || { attlogStamp: "0", operlogStamp: "0", attphotoStamp: "0" };

    const responseLines = [
      `GET OPTION FROM: ${sn}`,
      `ATTLOGStamp=${stamps.attlogStamp || "0"}`,
      `OPERLOGStamp=${stamps.operlogStamp || "0"}`,
      `ATTPHOTOStamp=${stamps.attphotoStamp || "0"}`,
      `ErrorDelay=60`,
      `Delay=30`,
      `TransTimes=00:00;14:05`,
      `TransInterval=1`,
      "TransFlag=TransData AttLog\tOpLog\tAttPhoto\tEnrollUser\tChgUser\tEnrollFP\tChgFP",
      `Realtime=1`,
      `Encrypt=0`,
      `ServerVer=2.0.1`,
    ];

    res.set("Content-Type", "text/plain");
    res.send(responseLines.join("\n") + "\n");
  });

  // Device uploads data (attendance, operation logs, photos)
  app.post("/iclock/cdata", async (req: Request, res: Response) => {
    const sn = req.query.SN as string;
    const table = req.query.table as string;
    const stamp = req.query.Stamp as string;

    if (!sn) {
      res.status(400).send("ERROR: Missing SN parameter");
      return;
    }

    const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
    await storage.updateDeviceLastSeen(sn, ip);

    let body = "";
    if (typeof req.body === "string") {
      body = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      body = req.body.toString("utf-8");
    } else if (req.rawBody) {
      body = Buffer.isBuffer(req.rawBody) ? (req.rawBody as Buffer).toString("utf-8") : String(req.rawBody);
    }

    log(`[PUSH] Device ${sn} uploading ${table} (stamp=${stamp}), body length: ${body.length}`, "zkteco");

    if (table === "ATTLOG") {
      const lines = body.split("\n").filter(l => l.trim());
      let processedCount = 0;

      for (const line of lines) {
        try {
          const parts = line.trim().split("\t");
          if (parts.length < 2) continue;

          const pin = parts[0]?.trim();
          const time = parts[1]?.trim();
          const status = parseInt(parts[2]?.trim() || "0", 10);
          const verify = parseInt(parts[3]?.trim() || "0", 10);
          const workCode = parts[4]?.trim() || undefined;

          if (!pin || !time) continue;

          const parsedTime = parseZktecoTimestamp(time);
          if (!parsedTime) {
            log(`[PUSH] Invalid timestamp format: "${time}" from ${sn}`, "zkteco");
            continue;
          }

          const event = await storage.createEvent({
            deviceSerial: sn,
            pin,
            timestamp: parsedTime,
            status: isNaN(status) ? 0 : status,
            verify: isNaN(verify) ? 0 : verify,
            workCode: workCode || null,
            forwarded: false,
            forwardedAt: null,
            forwardError: null,
            rawData: line.trim(),
          });

          processedCount++;

          // Forward event asynchronously
          forwardEvent(event).catch(err => {
            log(`[FORWARD] Error forwarding event ${event.id}: ${err.message}`, "zkteco");
          });
        } catch (err: any) {
          log(`[PUSH] Error processing ATTLOG line: ${err.message}`, "zkteco");
        }
      }

      if (stamp) {
        await storage.updateDeviceStamps(sn, { attlogStamp: stamp });
      }

      log(`[PUSH] Processed ${processedCount} attendance records from ${sn}`, "zkteco");
    } else if (table === "OPERLOG") {
      const lines = body.split("\n").filter(l => l.trim());
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let logType = "UNKNOWN";
        if (trimmed.startsWith("USER")) logType = "USER";
        else if (trimmed.startsWith("FP")) logType = "FP";
        else if (trimmed.startsWith("OPLOG")) logType = "OPLOG";

        await storage.createOperationLog(sn, logType, trimmed);
      }

      if (stamp) {
        await storage.updateDeviceStamps(sn, { operlogStamp: stamp });
      }

      log(`[PUSH] Processed ${lines.length} operation logs from ${sn}`, "zkteco");
    } else if (table === "ATTPHOTO") {
      if (stamp) {
        await storage.updateDeviceStamps(sn, { attphotoStamp: stamp });
      }
      log(`[PUSH] Received photo from ${sn} (not stored)`, "zkteco");
    }

    res.set("Content-Type", "text/plain");
    res.send("OK\n");
  });

  // Device requests commands (ping every ~30s)
  app.get("/iclock/getrequest", async (req: Request, res: Response) => {
    const sn = req.query.SN as string;

    if (!sn) {
      res.status(400).send("ERROR");
      return;
    }

    const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
    await storage.updateDeviceLastSeen(sn, ip);

    const commands = await storage.getPendingCommands(sn);

    if (commands.length === 0) {
      res.set("Content-Type", "text/plain");
      res.send("OK\n");
      return;
    }

    const lines = commands.map(cmd => `C:${cmd.commandId}:${cmd.command}`);
    res.set("Content-Type", "text/plain");
    res.send(lines.join("\n") + "\n");
  });

  // Device returns command results
  app.post("/iclock/devicecmd", async (req: Request, res: Response) => {
    const sn = req.query.SN as string;

    const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
    if (sn) await storage.updateDeviceLastSeen(sn, ip);

    let body = "";
    if (typeof req.body === "string") {
      body = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      body = req.body.toString("utf-8");
    } else if (req.rawBody) {
      body = Buffer.isBuffer(req.rawBody) ? (req.rawBody as Buffer).toString("utf-8") : String(req.rawBody);
    }

    log(`[PUSH] Device ${sn} command result: ${body.substring(0, 200)}`, "zkteco");

    // Parse: ID=iiii&Return=vvvv&CMD=ssss
    const params = new URLSearchParams(body);
    const cmdId = params.get("ID");
    const returnVal = params.get("Return");
    const cmdData = params.get("CMD");

    if (cmdId && returnVal) {
      await storage.updateCommandResult(cmdId, returnVal, cmdData || undefined);
    }

    res.set("Content-Type", "text/plain");
    res.send("OK\n");
  });

  // ===== Application API Routes =====

  // Dashboard
  app.get("/api/dashboard/stats", async (_req: Request, res: Response) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  // Clients CRUD
  app.get("/api/clients", async (_req: Request, res: Response) => {
    const list = await storage.getClients();
    res.json(list.map(maskClientForResponse));
  });

  app.post("/api/clients", async (req: Request, res: Response) => {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.message });
      return;
    }
    try {
      const data = { ...parsed.data };
      if (data.oracleApiKey) {
        data.oracleApiKey = encrypt(data.oracleApiKey);
      }
      const client = await storage.createClient(data);
      res.json(maskClientForResponse(client));
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/clients/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const updateData = { ...req.body };
    if (updateData.oracleApiKey !== undefined) {
      if (updateData.oracleApiKey && updateData.oracleApiKey.trim() !== "") {
        updateData.oracleApiKey = encrypt(updateData.oracleApiKey);
      } else {
        updateData.oracleApiKey = null;
      }
    }
    const client = await storage.updateClient(id, updateData);
    if (!client) {
      res.status(404).json({ message: "Cliente no encontrado" });
      return;
    }
    res.json(maskClientForResponse(client));
  });

  app.delete("/api/clients/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    await storage.deleteClient(id);
    res.json({ success: true });
  });

  // Devices CRUD
  app.get("/api/devices", async (_req: Request, res: Response) => {
    const list = await storage.getDevices();
    res.json(list);
  });

  app.post("/api/devices", async (req: Request, res: Response) => {
    const parsed = insertDeviceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.message });
      return;
    }
    try {
      const device = await storage.createDevice(parsed.data);
      res.json(device);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/devices/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const device = await storage.updateDevice(id, req.body);
    if (!device) {
      res.status(404).json({ message: "Dispositivo no encontrado" });
      return;
    }
    res.json(device);
  });

  app.delete("/api/devices/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    await storage.deleteDevice(id);
    res.json({ success: true });
  });

  // Events
  app.get("/api/events", async (req: Request, res: Response) => {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string, 10) : undefined;
    const list = await storage.getEvents(500, clientId);
    res.json(list);
  });

  app.get("/api/events/recent", async (_req: Request, res: Response) => {
    const list = await storage.getRecentEvents(20);
    res.json(list);
  });

  app.get("/api/events/pending-count", async (_req: Request, res: Response) => {
    const count = await storage.getPendingCount();
    res.json(count);
  });

  app.post("/api/events/retry-forward", async (_req: Request, res: Response) => {
    const pending = await storage.getPendingEvents();
    let forwarded = 0;
    for (const event of pending) {
      try {
        await forwardEvent(event);
        forwarded++;
      } catch (err) {
        // Continue with next event
      }
    }
    res.json({ forwarded, total: pending.length });
  });

  app.post("/api/clients/:id/test-forwarding", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const client = await storage.getClient(id);
    if (!client) {
      res.status(404).json({ message: "Cliente no encontrado" });
      return;
    }
    if (!client.oracleApiUrl) {
      res.json({ success: false, error: "No hay URL de API configurada para este cliente" });
      return;
    }
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (client.oracleApiKey) {
        headers["Authorization"] = `Bearer ${decrypt(client.oracleApiKey)}`;
      }
      const response = await fetch(client.oracleApiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ test: true, clientId: client.clientId, timestamp: new Date().toISOString() }),
      });
      if (response.ok) {
        res.json({ success: true });
      } else {
        const text = await response.text();
        res.json({ success: false, error: `HTTP ${response.status}: ${text.substring(0, 200)}` });
      }
    } catch (err: any) {
      res.json({ success: false, error: err.message });
    }
  });

  // Commands API
  app.get("/api/commands", async (req: Request, res: Response) => {
    const serial = req.query.serial as string | undefined;
    const commands = await storage.getCommandHistory(serial);
    res.json(commands);
  });

  app.post("/api/commands", async (req: Request, res: Response) => {
    const { deviceSerial, commandType, params } = req.body;

    if (!deviceSerial || !commandType) {
      res.status(400).json({ message: "Falta el dispositivo o tipo de comando" });
      return;
    }

    const device = await storage.getDeviceBySerial(deviceSerial);
    if (!device) {
      res.status(404).json({ message: "Dispositivo no encontrado" });
      return;
    }

    let commandStr = "";
    const cmdId = `CMD_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    switch (commandType) {
      case "REBOOT":
        commandStr = "REBOOT";
        break;
      case "INFO":
        commandStr = "INFO";
        break;
      case "CHECK":
        commandStr = "CHECK";
        break;
      case "LOG":
        commandStr = "LOG";
        break;
      case "CLEAR_LOG":
        commandStr = "CLEAR LOG";
        break;
      case "SET_OPTION":
        if (!params?.item || params?.value === undefined) {
          res.status(400).json({ message: "Falta ITEM o VALUE para SET OPTION" });
          return;
        }
        commandStr = `SET OPTION ${params.item}=${params.value}`;
        break;
      case "QUERY_ATTLOG":
        if (!params?.startTime || !params?.endTime) {
          res.status(400).json({ message: "Falta StartTime o EndTime para QUERY ATTLOG" });
          return;
        }
        commandStr = `QUERY ATTLOG StartTime=${params.startTime}\tEndTime=${params.endTime}`;
        break;
      case "DATA_USER":
        if (!params?.pin) {
          res.status(400).json({ message: "Falta PIN para DATA USER" });
          return;
        }
        {
          const parts = [`PIN=${params.pin}`];
          if (params.name) parts.push(`Name=${params.name}`);
          if (params.password) parts.push(`Passwd=${params.password}`);
          if (params.card) parts.push(`Card=${params.card}`);
          if (params.privilege !== undefined) parts.push(`Pri=${params.privilege}`);
          if (params.group !== undefined) parts.push(`Grp=${params.group}`);
          commandStr = `DATA USER ${parts.join("\t")}`;
        }
        break;
      case "DATA_DEL_USER":
        if (!params?.pin) {
          res.status(400).json({ message: "Falta PIN para DATA DEL_USER" });
          return;
        }
        commandStr = `DATA DEL_USER PIN=${params.pin}`;
        break;
      case "AC_UNLOCK":
        commandStr = "AC_UNLOCK";
        break;
      default:
        res.status(400).json({ message: `Tipo de comando desconocido: ${commandType}` });
        return;
    }

    try {
      const cmd = await storage.createCommand(deviceSerial, cmdId, commandStr);
      log(`[CMD] Command ${commandType} queued for ${deviceSerial}: ${commandStr}`, "commands");
      res.json(cmd);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
