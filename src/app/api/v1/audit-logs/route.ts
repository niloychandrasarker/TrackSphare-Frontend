import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { unauthorized, forbidden, serverError, ok } from '@/lib/responses';

// GET /api/v1/audit-logs?limit=50&offset=0
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();
    if (!['super_admin', 'org_admin'].includes(auth.role)) return forbidden();

    const limit  = Math.min(parseInt(req.nextUrl.searchParams.get('limit')  ?? '50'), 200);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0');

    const [logsResult, countResult] = await Promise.all([
      query<{
        id: number; actor_user_id: string | null; action: string;
        target_device_id: string | null; target_user_id: string | null;
        metadata: unknown; ip_address: string | null; created_at: Date;
      }>(
        `SELECT id, actor_user_id, action, target_device_id, target_user_id,
                metadata, ip_address, created_at
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      query<{ count: string }>('SELECT COUNT(*) AS count FROM audit_logs'),
    ]);

    return ok({
      logs:  logsResult.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0'),
    });
  } catch (err) {
    console.error('GET /audit-logs error:', err);
    return serverError();
  }
}
