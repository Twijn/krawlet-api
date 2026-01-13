import { Request } from 'express';

/**
 * Extract the real client IP address, handling Cloudflare and other proxies
 *
 * Priority order:
 * 1. CF-Connecting-IP (Cloudflare's real client IP)
 * 2. X-Real-IP (nginx/other reverse proxies)
 * 3. X-Forwarded-For (standard proxy header, uses first IP)
 * 4. req.ip (Express default)
 * 5. req.socket.remoteAddress (fallback)
 *
 * @param req Express request object
 * @returns Client IP address
 */
export function getClientIp(req: Request): string {
  // Cloudflare sets CF-Connecting-IP header with the real client IP
  const cfIp = req.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp;
  }

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
