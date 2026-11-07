import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';

export interface JwtPayload {
  sub: string;      // user id
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions);
}

export function signRefreshToken(userId: string) {
  const expiresInDays = parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS ?? '30', 10);
  return jwt.sign({ sub: userId }, REFRESH_SECRET, {
    expiresIn: `${expiresInDays}d`,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string };
}

/**
 * Extract and verify the Bearer token from the Authorization header.
 * Returns the decoded payload or null if missing / invalid.
 */
export function getAuthUser(req: NextRequest): JwtPayload | null {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}
