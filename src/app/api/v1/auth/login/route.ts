import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { signAccessToken, signRefreshToken } from '@/lib/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { badRequest, unauthorized, serverError, ok } from '@/lib/responses';
import { LoginSchema } from '@/validations/schemas';
import { User } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { email, password } = parsed.data;

    const result = await query<User>(
      `SELECT id, name, email, password_hash, role, status
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    const user = result.rows[0];
    if (!user) {
      return unauthorized('Invalid email or password');
    }

    if (user.status !== 'active') {
      return unauthorized('Account is suspended or deleted');
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return unauthorized('Invalid email or password');
    }

    const accessToken  = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken(user.id);
    const tokenHash    = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Revoke old tokens and issue new one
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [user.id]
    );
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    await writeAuditLog({
      actorUserId: user.id,
      action: 'user.login',
      ipAddress: getClientIp(req),
    });

    return ok({
      user:         { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    return serverError();
  }
}
