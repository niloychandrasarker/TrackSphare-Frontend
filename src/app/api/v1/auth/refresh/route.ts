import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/lib/auth';
import { badRequest, unauthorized, serverError, ok } from '@/lib/responses';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { refreshToken } = body;
    if (!refreshToken || typeof refreshToken !== 'string') {
      return badRequest('refreshToken is required');
    }

    let payload: { sub: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return unauthorized('Invalid or expired refresh token');
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const result = await query<{ id: string; user_id: string; expires_at: Date; revoked_at: Date | null }>(
      `SELECT id, user_id, expires_at, revoked_at
       FROM refresh_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    const stored = result.rows[0];
    if (!stored || stored.revoked_at || stored.expires_at < new Date()) {
      return unauthorized('Refresh token is invalid, revoked or expired');
    }

    // Get current user
    const userResult = await query<{ id: string; email: string; role: string; status: string }>(
      'SELECT id, email, role, status FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = userResult.rows[0];
    if (!user || user.status !== 'active') {
      return unauthorized('User not found or account inactive');
    }

    // Rotate: revoke old, issue new
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [stored.id]);

    const newAccessToken  = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const newRefreshToken = signRefreshToken(user.id);
    const newTokenHash    = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt       = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, newTokenHash, expiresAt]
    );

    return ok({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('POST /auth/refresh error:', err);
    return serverError();
  }
}
