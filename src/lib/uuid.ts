import crypto from 'crypto';

export function toValidUuid(rawId?: string | null): string {
  if (!rawId || typeof rawId !== 'string') {
    return '9f2f6062-af23-48fa-abc3-cb2c42f9ec96';
  }
  const trimmed = rawId.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const hash = crypto.createHash('md5').update('tracksphere-dev-' + trimmed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
