import { query } from './db';
import { JwtPayload } from './auth';

export type AuditAction =
  | 'user.register'
  | 'user.login'
  | 'user.logout'
  | 'device.register'
  | 'device.revoke'
  | 'sharing.start'
  | 'sharing.stop'
  | 'location.upload'
  | 'location.read_latest'
  | 'location.read_history'
  | 'viewer.invite'
  | 'viewer.revoke'
  | 'consent.grant'
  | 'consent.revoke'
  | 'admin.location_read';

interface AuditOptions {
  actorUserId?: string;
  action: AuditAction;
  targetDeviceId?: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function writeAuditLog(opts: AuditOptions) {
  try {
    await query(
      `INSERT INTO audit_logs
         (actor_user_id, action, target_device_id, target_user_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        opts.actorUserId ?? null,
        opts.action,
        opts.targetDeviceId ?? null,
        opts.targetUserId ?? null,
        opts.metadata ? JSON.stringify(opts.metadata) : null,
        opts.ipAddress ?? null,
      ]
    );
  } catch (err) {
    // Audit log failure must never crash the main request
    console.error('Audit log write failed:', err);
  }
}

export function getClientIp(req: Request): string | undefined {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    undefined
  );
}
