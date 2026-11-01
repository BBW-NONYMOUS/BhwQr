// Edge Function request schemas. Mirrors packages/types/src/schemas.ts (Edge Functions cannot
// import workspace packages at deploy time); the shapes must stay identical.
import { z } from "npm:zod@4.6.7";

export const KIOSK_QR_PREFIX = "BHWQR1:";
export const PERSONAL_QR_PREFIX = "BHWPQR1:";

export const scanRequestSchema = z.object({
  token: z.string().startsWith(KIOSK_QR_PREFIX).max(1024),
  deviceId: z.uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000),
  isMocked: z.boolean().optional(),
  selfiePath: z.string().max(200).optional(),
  appVersion: z.string().max(20).optional(),
});
export type ScanRequest = z.infer<typeof scanRequestSchema>;

export const bindDeviceRequestSchema = z.object({
  deviceId: z.uuid(),
  platform: z.enum(["android", "ios"]),
  model: z.string().trim().max(100).nullable(),
  appVersion: z.string().trim().max(20),
});

export const issueQrRequestSchema = z.object({ stationId: z.uuid() });

export const personalQrRequestSchema = z.object({ deviceId: z.uuid() });

export const fallbackScanRequestSchema = z.object({
  token: z.string().startsWith(PERSONAL_QR_PREFIX).max(1024),
  stationId: z.uuid(),
});

export const heartbeatRequestSchema = z.object({
  stationId: z.uuid(),
  appVersion: z.string().max(20),
  clientNow: z.number(),
  lastTokenAt: z.number().nullable(),
});

export const logErrorRequestSchema = z.object({
  source: z.enum(["kiosk", "mobile", "web"]),
  severity: z.enum(["info", "warning", "error", "critical"]),
  message: z.string().trim().min(1).max(1000),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const deviceSyncRequestSchema = z.object({
  stationId: z.uuid(),
  terminalSerial: z.string().min(1).max(100),
  events: z
    .array(
      z.object({
        eventId: z.uuid(),
        bhwIdNumber: z.string().trim().min(3).max(30),
        occurredAt: z.iso.datetime({ offset: true }),
        direction: z.enum(["in", "out", "auto"]).default("auto"),
      }),
    )
    .min(1)
    .max(500),
});

export const dtrPdfRequestSchema = z.object({
  employeeId: z.uuid().optional(),
  year: z.number().int().min(2024).max(2100),
  month: z.number().int().min(1).max(12),
});

export interface KioskTokenPayload {
  v: 1;
  sid: string;
  n: string;
  iat: number;
  exp: number;
}

export interface PersonalTokenPayload {
  v: 1;
  eid: string;
  n: string;
  iat: number;
  exp: number;
}
