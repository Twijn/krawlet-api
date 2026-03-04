/**
 * Utility to check if an IP should be ignored from rate limiting and blocking
 *
 * Set the RATE_LIMIT_IGNORE_IPS environment variable to a comma-separated list
 * of IP addresses that should bypass rate limiting and abuse blocking.
 *
 * Example: RATE_LIMIT_IGNORE_IPS=192.168.1.100,10.0.0.1
 */

// Parse the ignore list once on module load
const ignoredIps: Set<string> = new Set();

const envValue = process.env.RATE_LIMIT_IGNORE_IPS;
if (envValue) {
  envValue
    .split(',')
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0)
    .forEach((ip) => {
      ignoredIps.add(ip);
      // Also add normalized IPv6 localhost if IPv4 localhost is included
      if (ip === '127.0.0.1') {
        ignoredIps.add('::1');
      }
      if (ip === '::1') {
        ignoredIps.add('127.0.0.1');
      }
    });

  if (ignoredIps.size > 0) {
    console.log(`[Rate Limiter] Ignoring IPs: ${Array.from(ignoredIps).join(', ')}`);
  }
}

/**
 * Check if an IP address should be ignored from rate limiting and blocking
 * @param ip The IP address to check
 * @returns true if the IP should be ignored
 */
export function isIgnoredIp(ip: string): boolean {
  return ignoredIps.has(ip);
}
