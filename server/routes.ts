import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClientSchema, insertDeviceSchema, insertForwardingConfigSchema } from "@shared/schema";
import { log } from "./index";
import { insertFichaje, testMariaDbConnection, ensureFichajesTable, getMariaDbStatus } from "./mariadb";

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

async function forwardEvent(event: any) {
  const config = await storage.getForwardingConfig();
  if (!config || !config.enabled) return;

  for (let attempt = 0; attempt < config.retryAttempts; attempt++) {
    try {
      const device = await storage.getDeviceBySerial(event.deviceSerial);
      const client = device ? await storage.getClient(device.clientId) : null;

      await insertFichaje({
        deviceSerial: event.deviceSerial,
        clientId: client?.clientId || null,
        pin: event.pin,
        timestamp: event.timestamp,
        status: event.status,
        verify: event.verify,
        workCode: event.workCode,
      });

      await storage.markEventForwarded(event.id);
      return;
    } catch (err: any) {
      if (attempt === config.retryAttempts - 1) {
        await storage.markEventForwardError(event.id, err.message);
      }
    }

    if (attempt < config.retryAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, config.retryDelayMs));
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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

  // Device requests commands
  app.get("/iclock/getrequest", async (req: Request, res: Response) => {
    const sn = req.query.SN as string;

    if (!sn) {
      res.status(400).send("ERROR");
      return;
    }

    await storage.updateDeviceLastSeen(sn);

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
    res.json(list);
  });

  app.post("/api/clients", async (req: Request, res: Response) => {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.message });
      return;
    }
    try {
      const client = await storage.createClient(parsed.data);
      res.json(client);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/clients/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const client = await storage.updateClient(id, req.body);
    if (!client) {
      res.status(404).json({ message: "Cliente no encontrado" });
      return;
    }
    res.json(client);
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
  app.get("/api/events", async (_req: Request, res: Response) => {
    const list = await storage.getEvents();
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

  // Forwarding config
  app.get("/api/forwarding-config", async (_req: Request, res: Response) => {
    const config = await storage.getForwardingConfig();
    res.json(config);
  });

  app.post("/api/forwarding-config", async (req: Request, res: Response) => {
    const parsed = insertForwardingConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.message });
      return;
    }
    const config = await storage.saveForwardingConfig(parsed.data);
    res.json(config);
  });

  app.post("/api/forwarding-config/test", async (_req: Request, res: Response) => {
    const result = await testMariaDbConnection();
    if (result.success) {
      await ensureFichajesTable();
    }
    res.json(result);
  });

  app.get("/api/mariadb/status", async (_req: Request, res: Response) => {
    const status = await getMariaDbStatus();
    res.json(status);
  });

  return httpServer;
}
