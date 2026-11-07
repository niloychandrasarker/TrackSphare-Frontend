import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { signAccessToken, signRefreshToken } from '@/lib/auth';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { badRequest, conflict, created, serverError } from '@/lib/responses';
import { RegisterSchema } from '@/validations/schemas';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { name, email, password, role } = parsed.data;

    // Check duplicate email
    const existing = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return conflict('An account with this email already exists');
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await query<{ id: string; name: string; email: string; role: string }>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email.toLowerCase(), password_hash, role]
    );

    const user = result.rows[0];

    // Issue tokens
    const accessToken  = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken(user.id);
    const tokenHash    = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    await writeAuditLog({
      actorUserId: user.id,
      action: 'user.register',
      targetUserId: user.id,
      ipAddress: getClientIp(req),
    });

    return created({
      user:         { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('POST /auth/register error:', err);
    return serverError();
  }
}
