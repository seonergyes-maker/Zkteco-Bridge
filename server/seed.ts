import { storage } from "./storage";
import { log } from "./index";

export async function seedDatabase() {
  try {
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
