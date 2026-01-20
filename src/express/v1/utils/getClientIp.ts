import { Request } from 'express';

/**
 * Extract the real client IP address, handling proxies
 *
 * Priority order:
 * 1. X-Real-IP (nginx/other reverse proxies)
 * 2. X-Forwarded-For (standard proxy header, uses first IP)
 * 3. req.ip (Express default)
 * 4. req.socket.remoteAddress (fallback)
 *
 * @param req Express request object
 * @returns Client IP address
 */
export function getClientIp(req: Request): string {
  // Check X-Real-IP (used by nginx and others)
  const realIp = req.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Check X-Forwarded-For (standard header, comma-separated list)
  // The first IP is the original client, rest are proxies
  const forwardedFor = req.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map((ip) => ip.trim());
    if (ips[0]) {
      return ips[0];
    }
  }

  // Fall back to Express's req.ip
  if (req.ip) {
    return req.ip;
  }

  // Last resort: socket remote address
  return req.socket.remoteAddress || 'unknown';
}
