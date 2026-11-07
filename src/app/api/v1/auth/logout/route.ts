import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { unauthorized, ok, serverError } from '@/lib/responses';

export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) return unauthorized();

    // Revoke all refresh tokens for this user
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [user.sub]
    );

    await writeAuditLog({
      actorUserId: user.sub,
      action: 'user.logout',
      ipAddress: getClientIp(req),
    });

    return ok({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('POST /auth/logout error:', err);
    return serverError();
  }
}
