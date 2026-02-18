import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClientSchema, insertDeviceSchema, insertScheduledTaskSchema, insertDeviceUserSchema } from "@shared/schema";
import { log } from "./index";
import { encrypt, decrypt, maskApiKey, isEncrypted } from "./crypto";
import { addProtocolLog, getProtocolLogs, clearProtocolLogs } from "./protocol-logger";

function buildCommandString(commandType: string, params?: any): string | null {
  switch (commandType) {
    case "REBOOT": return "REBOOT";
    case "INFO": return "INFO";
    case "CHECK": return "CHECK";
    case "LOG": return "LOG";
    case "CLEAR_LOG": return "CLEAR LOG";
    case "CLEAR_DATA": return "CLEAR DATA";
    case "CLEAR_PHOTO": return "CLEAR PHOTO";
    case "AC_UNLOCK": return "AC_UNLOCK";
    case "AC_UNALARM": return "AC_UNALARM";
    case "RELOAD_OPTIONS": return "RELOAD OPTIONS";
    case "SET_OPTION":
      if (!params?.item || params?.value === undefined) return null;
      return `SET OPTION ${params.item}=${params.value}`;
    case "QUERY_ATTLOG":
      if (!params?.startTime || !params?.endTime) return null;
      return `DATA QUERY ATTLOG StartTime=${params.startTime}\tEndTime=${params.endTime}`;
    case "QUERY_ATTPHOTO":
      if (!params?.startTime || !params?.endTime) return null;
      return `DATA QUERY ATTPHOTO StartTime=${params.startTime}\tEndTime=${params.endTime}`;
    case "QUERY_USERINFO":
      return params?.pin ? `DATA QUERY USERINFO PIN=${params.pin}` : `DATA QUERY USERINFO`;
    case "QUERY_FINGERTMP":
      if (params?.pin && params?.fingerId !== undefined) {
        return `DATA QUERY FINGERTMP PIN=${params.pin}\tFingerID=${params.fingerId}`;
      } else if (params?.pin) {
        return `DATA QUERY FINGERTMP PIN=${params.pin}`;
      }
      return `DATA QUERY FINGERTMP`;
    case "DATA_USER":
      if (!params?.pin) return null;
      {
        const parts = [`PIN=${params.pin}`];
        if (params.name) parts.push(`Name=${params.name}`);
        if (params.password) parts.push(`Passwd=${params.password}`);
        if (params.card) parts.push(`Card=${params.card}`);
        if (params.privilege !== undefined) parts.push(`Pri=${params.privilege}`);
        if (params.group !== undefined) parts.push(`Grp=${params.group}`);
        if (params.tz !== undefined) parts.push(`TZ=${params.tz}`);
        return `DATA USER ${parts.join("\t")}`;
      }
    case "DATA_DEL_USER":
      if (!params?.pin) return null;
      return `DATA DEL_USER PIN=${params.pin}`;
    case "DATA_FP":
      if (!params?.pin || params?.fid === undefined || !params?.size || params?.valid === undefined || !params?.tmp) return null;
      return `DATA FP PIN=${params.pin}\tFID=${params.fid}\tSize=${params.size}\tValid=${params.valid}\tTMP=${params.tmp}`;
    case "DATA_DEL_FP":
      if (!params?.pin || params?.fid === undefined) return null;
      return `DATA DEL_FP PIN=${params.pin}\tFID=${params.fid}`;
    case "ENROLL_FP":
      if (!params?.pin || params?.fid === undefined) return null;
      {
        const parts = [`PIN=${params.pin}`, `FID=${params.fid}`];
        if (params.retry !== undefined) parts.push(`RETRY=${params.retry}`);
        if (params.overwrite !== undefined) parts.push(`OVERWRITE=${params.overwrite}`);
        return `ENROLL_FP ${parts.join("\t")}`;
      }
    case "UPDATE_USERPIC":
      if (!params?.pin || !params?.picFile) return null;
      {
        const pin2 = params.pin2 !== undefined ? params.pin2 : params.pin;
        return `UPDATE USERPIC PIN=${params.pin}\tPIN2=${pin2} PICFILE=${params.picFile}`;
      }
    case "DELETE_USERPIC":
      if (!params?.pin) return null;
      return `DELETE USERPIC PIN=${params.pin}`;
    case "UPDATE_TIMEZONE":
      if (params?.tzid === undefined || !params?.itime) return null;
      {
        const parts = [`TZID=${params.tzid}`, `ITIME=${params.itime}`];
        if (params.reserve) parts.push(`RESERVE=${params.reserve}`);
        return `UPDATE TIMEZONE ${parts.join("\t")}`;
      }
    case "DELETE_TIMEZONE":
      if (params?.tzid === undefined) return null;
      return `DELETL TIMEZONE TZID=${params.tzid}`;
    case "UPDATE_GLOCK":
      if (params?.glid === undefined || !params?.groupIds || params?.memberCount === undefined) return null;
      {
        const parts = [`GLID=${params.glid}`, `GROUPIDS=${params.groupIds}`, `MEMBERCOUNT=${params.memberCount}`];
        if (params.reserve) parts.push(`RESERVE=${params.reserve}`);
        return `UPDATE GLOCK ${parts.join("\t")}`;
      }
    case "DELETE_GLOCK":
      if (params?.glid === undefined) return null;
      return `DELETE GLOCK GLID=${params.glid}`;
    case "UPDATE_SMS":
      if (!params?.msg || params?.tag === undefined || params?.uid === undefined) return null;
      {
        const parts = [`MSG=${params.msg}`, `TAG=${params.tag}`, `UID=${params.uid}`];
        if (params.min !== undefined) parts.push(`MIN=${params.min}`);
        if (params.startTime) parts.push(`StartTime=${params.startTime}`);
        return `UPDATE SMS ${parts.join("\t")}`;
      }
    case "UPDATE_USER_SMS":
      if (!params?.pin || params?.uid === undefined) return null;
      return `UPDATE USER_SMS PIN=${params.pin}\tUID=${params.uid}`;
    case "SHELL":
      if (!params?.cmdString) return null;
      return `SHELL ${params.cmdString}`;
    case "GETFILE":
      if (!params?.filePath) return null;
      return `GetFile ${params.filePath}`;
    case "PUTFILE":
      if (!params?.url || !params?.filePath) return null;
      return `PutFile ${params.url} ${params.filePath}`;
    default: return null;
  }
}

function computeNextRunAt(task: { scheduleType: string; runAt?: Date | null; intervalMinutes?: number | null; daysOfWeek?: string | null; timeOfDay?: string | null }, fromDate?: Date): Date | null {
  const now = fromDate || new Date();

  if (task.scheduleType === "one_time") {
    return task.runAt ? new Date(task.runAt) : null;
  }

  if (task.scheduleType === "interval" && task.intervalMinutes) {
    return new Date(now.getTime() + task.intervalMinutes * 60 * 1000);
  }

  if (task.scheduleType === "daily" && task.timeOfDay) {
    const [hours, minutes] = task.timeOfDay.split(":").map(Number);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  if (task.scheduleType === "weekly" && task.timeOfDay && task.daysOfWeek) {
    const [hours, minutes] = task.timeOfDay.split(":").map(Number);
    const days = task.daysOfWeek.split(",").map(Number);
    if (days.length === 0) return null;

    for (let offset = 0; offset <= 7; offset++) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + offset);
      candidate.setHours(hours, minutes, 0, 0);
      if (candidate > now && days.includes(candidate.getDay())) {
        return candidate;
      }
    }
    return null;
  }

  return null;
}

function validateScheduleFields(data: { scheduleType: string; runAt?: Date | null; intervalMinutes?: number | null; timeOfDay?: string | null; daysOfWeek?: string | null }): string | null {
  switch (data.scheduleType) {
    case "one_time":
      if (!data.runAt) return "Falta la fecha/hora de ejecucion para tarea unica";
      break;
    case "interval":
      if (!data.intervalMinutes || data.intervalMinutes < 1) return "Falta o invalido el intervalo en minutos";
      break;
    case "daily":
      if (!data.timeOfDay) return "Falta la hora para tarea diaria";
      break;
    case "weekly":
      if (!data.timeOfDay) return "Falta la hora para tarea semanal";
      if (!data.daysOfWeek) return "Falta seleccionar los dias de la semana";
      break;
  }
  return null;
}

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
    usersApiKey: maskApiKey(client.usersApiKey),
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
    } else if (!device.model) {
      const existingCmds = await storage.getPendingCommands(sn);
      const hasInfoCmd = existingCmds.some(c => c.command === "INFO");
      if (!hasInfoCmd) {
        const cmdId = `CMD_${Date.now()}_auto_info`;
        await storage.createCommand(sn, cmdId, "INFO");
        log(`[PUSH] Auto-queued INFO command for device ${sn} to detect model`, "zkteco");
      }
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
      `TimeZone=1`,
      `DSTF=1`,
      `ServerVer=2.0.1`,
    ];

    const responseBody = responseLines.join("\n") + "\n";

    addProtocolLog("IN", sn, "/iclock/cdata", "GET", `Registro/config (options=${options})`, `Query: SN=${sn}&options=${options}`, ip);
    addProtocolLog("OUT", sn, "/iclock/cdata", "GET", `Config enviada al dispositivo`, responseBody, ip);

    res.set("Content-Type", "text/plain");
    res.send(responseBody);
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
    addProtocolLog("IN", sn, "/iclock/cdata", "POST", `Datos ${table} (stamp=${stamp}, ${body.length} bytes)`, body || "(vacio)", ip);

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

    addProtocolLog("IN", sn, "/iclock/getrequest", "GET", `Polling de comandos`, `Query: SN=${sn}`, ip);

    const commands = await storage.getPendingCommands(sn);

    if (commands.length === 0) {
      res.set("Content-Type", "text/plain");
      res.send("OK\n");
      return;
    }

    const lines = commands.map(cmd => {
      if (/^C:\d+:/.test(cmd.command)) {
        return cmd.command;
      }
      return `C:${cmd.commandId}:${cmd.command}`;
    });
    const responseBody = lines.join("\n") + "\n";

    addProtocolLog("OUT", sn, "/iclock/getrequest", "GET", `${commands.length} comando(s) enviado(s)`, responseBody, ip);

    res.set("Content-Type", "text/plain");
    res.send(responseBody);
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
    addProtocolLog("IN", sn || "?", "/iclock/devicecmd", "POST", `Resultado de comando`, body || "(vacio)", ip);

    // Parse: ID=iiii&Return=vvvv&CMD=ssss
    const cmdParams = new URLSearchParams(body);
    const cmdId = cmdParams.get("ID");
    const returnVal = cmdParams.get("Return");
    const cmdData = cmdParams.get("CMD");

    if (cmdId && returnVal) {
      await storage.updateCommandResult(cmdId, returnVal, cmdData || undefined);

      if (cmdData && sn) {
        const infoLines = cmdData.split("\n");
        let deviceName = "";
        let fwVersion = "";
        for (const line of infoLines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("~DeviceName=")) deviceName = trimmed.substring("~DeviceName=".length).trim();
          else if (trimmed.startsWith("DeviceName=") && !deviceName) deviceName = trimmed.substring("DeviceName=".length).trim();
          if (trimmed.startsWith("FWVersion=")) fwVersion = trimmed.substring("FWVersion=".length).trim();
        }
        if (deviceName || fwVersion) {
          await storage.updateDeviceLastSeen(sn, undefined, fwVersion || undefined, deviceName || undefined);
          log(`[PUSH] Auto-detected device ${sn}: model=${deviceName}, firmware=${fwVersion}`, "zkteco");
        }
      }
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
      if (data.usersApiKey) {
        data.usersApiKey = encrypt(data.usersApiKey);
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
    if (updateData.usersApiKey !== undefined) {
      if (updateData.usersApiKey && updateData.usersApiKey.trim() !== "") {
        updateData.usersApiKey = encrypt(updateData.usersApiKey);
      } else {
        updateData.usersApiKey = null;
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

    const commandStr = buildCommandString(commandType, params);
    if (!commandStr) {
      res.status(400).json({ message: `Parametros invalidos para el comando ${commandType}` });
      return;
    }

    const cmdId = `CMD_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      const cmd = await storage.createCommand(deviceSerial, cmdId, commandStr);
      log(`[CMD] Command ${commandType} queued for ${deviceSerial}: ${commandStr}`, "commands");
      res.json(cmd);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Device Users API
  app.get("/api/device-users", async (req: Request, res: Response) => {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
    const users = await storage.getDeviceUsers(clientId);
    res.json(users);
  });

  app.post("/api/device-users", async (req: Request, res: Response) => {
    const parsed = insertDeviceUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.message });
      return;
    }
    try {
      const user = await storage.createDeviceUser(parsed.data);
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/device-users/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    try {
      const user = await storage.updateDeviceUser(id, req.body);
      if (!user) {
        res.status(404).json({ message: "Usuario no encontrado" });
        return;
      }
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/device-users/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    try {
      await storage.deleteDeviceUser(id);
      res.json({ message: "Usuario eliminado" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/device-users/client/:clientId", async (req: Request, res: Response) => {
    const clientId = parseInt(req.params.clientId);
    try {
      await storage.clearDeviceUsers(clientId);
      res.json({ message: "Usuarios del cliente eliminados" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/device-users/sync-from-api", async (req: Request, res: Response) => {
    const { clientId } = req.body;
    if (!clientId) {
      res.status(400).json({ message: "Falta el clientId" });
      return;
    }

    const client = await storage.getClient(clientId);
    if (!client) {
      res.status(404).json({ message: "Cliente no encontrado" });
      return;
    }

    if (!client.usersApiUrl) {
      res.status(400).json({ message: "El cliente no tiene configurada una API de usuarios" });
      return;
    }

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (client.usersApiKey) {
        const apiKey = isEncrypted(client.usersApiKey) ? decrypt(client.usersApiKey) : client.usersApiKey;
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const response = await fetch(client.usersApiUrl, { headers });
      if (!response.ok) {
        res.status(400).json({ message: `Error de la API: ${response.status} ${response.statusText}` });
        return;
      }

      const data = await response.json();
      const usersArray = Array.isArray(data) ? data : (data.users || data.data || data.results || []);

      if (!Array.isArray(usersArray) || usersArray.length === 0) {
        res.status(400).json({ message: "La API no devolvio usuarios validos" });
        return;
      }

      const mappedUsers = usersArray.map((u: any) => ({
        clientId,
        pin: String(u.pin || u.PIN || u.id || u.ID || u.employeeId || ""),
        name: u.name || u.Name || u.nombre || u.Nombre || null,
        password: u.password || u.Password || u.passwd || null,
        card: u.card || u.Card || u.cardno || u.CardNo || null,
        privilege: parseInt(u.privilege || u.Privilege || "0") || 0,
      })).filter((u: any) => u.pin);

      const result = await storage.upsertDeviceUsers(clientId, mappedUsers);
      log(`[USERS] Synced from API for client ${client.name}: ${result.created} created, ${result.updated} updated`, "users");
      res.json({ message: `Sincronizados ${mappedUsers.length} usuarios: ${result.created} nuevos, ${result.updated} actualizados`, ...result, total: mappedUsers.length });
    } catch (err: any) {
      res.status(500).json({ message: `Error al conectar con la API: ${err.message}` });
    }
  });

  app.post("/api/device-users/sync-to-device", async (req: Request, res: Response) => {
    const { userIds, deviceSerial } = req.body;

    if (!deviceSerial || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ message: "Falta el dispositivo o los usuarios" });
      return;
    }

    const device = await storage.getDeviceBySerial(deviceSerial);
    if (!device) {
      res.status(404).json({ message: "Dispositivo no encontrado" });
      return;
    }

    let queued = 0;
    for (const userId of userIds) {
      const user = await storage.getDeviceUser(userId);
      if (!user) continue;

      const parts = [`PIN=${user.pin}`];
      if (user.name) parts.push(`Name=${user.name}`);
      if (user.password) parts.push(`Passwd=${user.password}`);
      if (user.card) parts.push(`Card=${user.card}`);
      parts.push(`Pri=${user.privilege}`);

      const commandStr = `DATA USER ${parts.join("\t")}`;
      const cmdId = `CMD_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      await storage.createCommand(deviceSerial, cmdId, commandStr);
      await storage.updateDeviceUserSyncStatus(userId, deviceSerial);
      queued++;
    }

    log(`[USERS] ${queued} users queued for sync to device ${deviceSerial}`, "users");
    res.json({ message: `${queued} usuario(s) encolados para enviar al dispositivo ${deviceSerial}`, queued });
  });

  app.delete("/api/commands", async (_req: Request, res: Response) => {
    await storage.clearCommandHistory();
    res.json({ message: "Historial de comandos borrado" });
  });

  app.post("/api/commands/raw", async (req: Request, res: Response) => {
    const { deviceSerial, rawCommand } = req.body;

    if (!deviceSerial || !rawCommand) {
      res.status(400).json({ message: "Falta el dispositivo o el comando" });
      return;
    }

    const device = await storage.getDeviceBySerial(deviceSerial);
    if (!device) {
      res.status(404).json({ message: "Dispositivo no encontrado" });
      return;
    }

    const cmdId = `CMD_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      const cmd = await storage.createCommand(deviceSerial, cmdId, rawCommand.trim());
      log(`[CMD] Raw command queued for ${deviceSerial}: ${rawCommand.trim()}`, "commands");
      res.json(cmd);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Protocol Logs API
  app.get("/api/protocol-logs", async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 200;
    const device = req.query.device as string | undefined;
    res.json(getProtocolLogs(limit, device));
  });

  app.delete("/api/protocol-logs", async (_req: Request, res: Response) => {
    clearProtocolLogs();
    res.json({ message: "Logs borrados" });
  });

  // Scheduled Tasks API
  app.get("/api/tasks", async (_req: Request, res: Response) => {
    const tasks = await storage.getScheduledTasks();
    res.json(tasks);
  });

  app.post("/api/tasks", async (req: Request, res: Response) => {
    const parsed = insertScheduledTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.message });
      return;
    }
    const data = parsed.data;
    const scheduleError = validateScheduleFields(data);
    if (scheduleError) {
      res.status(400).json({ message: scheduleError });
      return;
    }
    if (data.commandParams) {
      try { JSON.parse(data.commandParams); } catch { res.status(400).json({ message: "commandParams debe ser JSON valido" }); return; }
    }
    try {
      const nextRunAt = computeNextRunAt(data);
      const task = await storage.createScheduledTask({ ...data, nextRunAt });
      res.json(task);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/tasks/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getScheduledTask(id);
    if (!existing) {
      res.status(404).json({ message: "Tarea no encontrada" });
      return;
    }
    const partial = insertScheduledTaskSchema.partial().safeParse(req.body);
    if (!partial.success) {
      res.status(400).json({ message: partial.error.message });
      return;
    }
    const updateData: any = { ...partial.data };
    if (updateData.commandParams) {
      try { JSON.parse(updateData.commandParams); } catch { res.status(400).json({ message: "commandParams debe ser JSON valido" }); return; }
    }
    const merged = { ...existing, ...updateData };
    if (updateData.scheduleType || updateData.runAt || updateData.intervalMinutes || updateData.timeOfDay || updateData.daysOfWeek) {
      updateData.nextRunAt = computeNextRunAt(merged);
    }
    const task = await storage.updateScheduledTask(id, updateData);
    res.json(task);
  });

  app.delete("/api/tasks/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    await storage.deleteScheduledTask(id);
    res.json({ success: true });
  });

  // Scheduler: check for due tasks every 30 seconds
  setInterval(async () => {
    try {
      const now = new Date();
      const dueTasks = await storage.getDueScheduledTasks(now);

      for (const task of dueTasks) {
        try {
          const params = task.commandParams ? JSON.parse(task.commandParams) : undefined;
          const commandStr = buildCommandString(task.commandType, params);
          if (!commandStr) {
            log(`[Scheduler] Invalid command for task "${task.name}": ${task.commandType}`, "scheduler");
            continue;
          }

          const cmdId = `CMD_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          await storage.createCommand(task.deviceSerial, cmdId, commandStr);
          log(`[Scheduler] Task "${task.name}" executed: ${commandStr} -> ${task.deviceSerial}`, "scheduler");

          const nextRunAt = task.scheduleType === "one_time" ? null : computeNextRunAt(task, now);
          await storage.markScheduledTaskRun(task.id, now, nextRunAt);
        } catch (err: any) {
          log(`[Scheduler] Error executing task "${task.name}": ${err.message}`, "scheduler");
        }
      }
    } catch (err: any) {
      log(`[Scheduler] Error checking due tasks: ${err.message}`, "scheduler");
    }
  }, 30000);

  return httpServer;
}
