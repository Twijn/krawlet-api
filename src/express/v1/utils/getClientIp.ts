import { Request } from 'express';

const TRUSTED_PROXY_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function getRemoteAddress(req: Request): string | null {
  return req.socket.remoteAddress || null;
}

function isTrustedProxy(req: Request): boolean {
  const remoteAddress = getRemoteAddress(req);
  return remoteAddress !== null && TRUSTED_PROXY_ADDRESSES.has(remoteAddress);
}

/**
 * Extract the real client IP address, handling proxies
 *
 * Priority order:
 * 1. X-Real-IP (trusted reverse proxies only)
 * 2. X-Forwarded-For (trusted reverse proxies only, uses first IP)
 * 3. req.ip (Express default)
 * 4. req.socket.remoteAddress (fallback)
 *
 * @param req Express request object
 * @returns Client IP address
 */
export function getClientIp(req: Request): string {
  if (isTrustedProxy(req)) {
    // Check X-Real-IP only when the immediate peer is our trusted reverse proxy.
    const realIp = req.get('x-real-ip');
    if (realIp) {
      return realIp;
    }

    // Check X-Forwarded-For only when the immediate peer is our trusted reverse proxy.
    // The first IP is the original client, rest are proxies.
    const forwardedFor = req.get('x-forwarded-for');
    if (forwardedFor) {
      const ips = forwardedFor.split(',').map((ip) => ip.trim());
      if (ips[0]) {
        return ips[0];
      }
    }
  }

  // Fall back to Express's req.ip
  if (req.ip) {
    return req.ip;
  }

  // Last resort: socket remote address
  return getRemoteAddress(req) || 'unknown';
}
