import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { unauthorized, notFound, ok, serverError } from '@/lib/responses';

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();

    const result = await query<{ id: string; name: string; email: string; role: string; status: string; created_at: Date }>(
      'SELECT id, name, email, role, status, created_at FROM users WHERE id = $1',
      [auth.sub]
    );
    const user = result.rows[0];
    if (!user) return notFound('User not found');

    return ok(user);
  } catch (err) {
    console.error('GET /auth/me error:', err);
    return serverError();
  }
}
