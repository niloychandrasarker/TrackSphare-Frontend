import { z } from 'zod';

// ── Auth ─────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  name:     z.string().min(2).max(100),
  email:    z.email(),
  password: z.string().min(8).max(128),
  role:     z.enum(['device_user', 'guardian', 'org_admin']).optional().default('device_user'),
});

export const LoginSchema = z.object({
  email:    z.email(),
  password: z.string().min(1),
});

// ── Device ───────────────────────────────────────────────────────────────────

export const DeviceRegisterSchema = z.object({
  name:           z.string().min(1).max(100).optional(),
  model:          z.string().max(200).optional(),
  androidVersion: z.string().max(50).optional(),
  appVersion:     z.string().max(50).optional(),
});

export const InviteViewerSchema = z.object({
  viewerEmail: z.email(),
  accessType:  z.enum(['viewer', 'admin']).optional().default('viewer'),
});

// ── Location ─────────────────────────────────────────────────────────────────

export const LocationUploadSchema = z.object({
  deviceId:   z.string().uuid(),
  latitude:   z.number().min(-90).max(90),
  longitude:  z.number().min(-180).max(180),
  accuracy:   z.number().positive().optional(),
  altitude:   z.number().optional(),
  speed:      z.number().min(0).optional(),
  recordedAt: z.string().datetime({ offset: true }),
});

export const LocationHistoryQuerySchema = z.object({
  deviceId: z.string().min(1),
  from:     z.string().optional(),
  to:       z.string().optional(),
  limit:    z.coerce.number().int().min(1).max(2000).optional().default(500),
  offset:   z.coerce.number().int().min(0).optional().default(0),
});

// ── Consent ──────────────────────────────────────────────────────────────────

export const ConsentSchema = z.object({
  deviceId:      z.string().uuid(),
  purpose:       z.string().default('location_sharing'),
  policyVersion: z.string().default('1.0'),
});

export type RegisterInput        = z.infer<typeof RegisterSchema>;
export type LoginInput           = z.infer<typeof LoginSchema>;
export type DeviceRegisterInput  = z.infer<typeof DeviceRegisterSchema>;
export type InviteViewerInput    = z.infer<typeof InviteViewerSchema>;
export type LocationUploadInput  = z.infer<typeof LocationUploadSchema>;
export type ConsentInput         = z.infer<typeof ConsentSchema>;
