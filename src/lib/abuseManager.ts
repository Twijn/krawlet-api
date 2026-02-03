import { BlockedIp } from './models/blockedip.model';

/**
 * Configuration for abuse detection thresholds
 */
export const ABUSE_CONFIG = {
  // Consecutive 429s threshold
  MAX_CONSECUTIVE_429S: 15,

  // Sustained traffic threshold (requests within window time while at/near limit)
  SUSTAINED_TRAFFIC_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
  SUSTAINED_TRAFFIC_THRESHOLD: 50, // requests at rate limit within window

  // Burst traffic threshold
  BURST_WINDOW_MS: 1000, // 1 second
  BURST_THRESHOLD: 10, // max requests per second

  // User agent cycling detection
  USER_AGENT_WINDOW_MS: 10 * 60 * 1000, // 10 minutes
  USER_AGENT_THRESHOLD: 5, // different user agents within window

  // Block durations (in minutes)
  INITIAL_BLOCK_DURATION: 15,
  REPEAT_BLOCK_DURATION: 60,
  ESCALATION_BLOCK_COUNT: 2, // escalate to firewall after this many app blocks
};

/**
 * Tracking data for a single IP
 */
interface IpTrackingData {
  // Consecutive 429 tracking
  consecutive429s: number;
  last429At: number | null;

  // Burst tracking (sliding window)
  recentRequests: number[]; // timestamps

  // Sustained traffic tracking
  sustainedRequests: number[];
  sustainedAt429: number;

  // User agent tracking
  userAgents: Map<string, number>; // user agent -> last seen timestamp

  // Block tracking
  wasRecentlyBlocked: boolean;
  lastBlockExpiredAt: number | null;
}

/**
 * In-memory store for IP tracking
 */
const ipTracking = new Map<string, IpTrackingData>();

/**
 * In-memory cache of blocked IPs for fast lookup
 */
const blockedIpCache = new Map<string, { expiresAt: number | null; blockId: string }>();

/**
 * Get or create tracking data for an IP
 */
function getTracking(ip: string): IpTrackingData {
  let data = ipTracking.get(ip);
  if (!data) {
    data = {
      consecutive429s: 0,
      last429At: null,
      recentRequests: [],
      sustainedRequests: [],
      sustainedAt429: 0,
      userAgents: new Map(),
      wasRecentlyBlocked: false,
      lastBlockExpiredAt: null,
    };
    ipTracking.set(ip, data);
  }
  return data;
}

/**
 * Clean old timestamps from an array
 */
function cleanOldTimestamps(timestamps: number[], maxAge: number): number[] {
  const cutoff = Date.now() - maxAge;
  return timestamps.filter((t) => t > cutoff);
}

/**
 * Record a request from an IP
 */
export function recordRequest(ip: string, userAgent: string | undefined, was429: boolean): void {
  const now = Date.now();
  const data = getTracking(ip);

  // Track burst (recent requests in last second)
  data.recentRequests.push(now);
  data.recentRequests = cleanOldTimestamps(data.recentRequests, ABUSE_CONFIG.BURST_WINDOW_MS);

  // Track user agent
  if (userAgent) {
    data.userAgents.set(userAgent, now);
    // Clean old user agents
    for (const [ua, timestamp] of data.userAgents.entries()) {
      if (now - timestamp > ABUSE_CONFIG.USER_AGENT_WINDOW_MS) {
        data.userAgents.delete(ua);
      }
    }
  }

  if (was429) {
    // Track consecutive 429s
    data.consecutive429s += 1;
    data.last429At = now;

    // Track sustained traffic at rate limit
    data.sustainedRequests.push(now);
    data.sustainedRequests = cleanOldTimestamps(
      data.sustainedRequests,
      ABUSE_CONFIG.SUSTAINED_TRAFFIC_WINDOW_MS,
    );
    data.sustainedAt429 = data.sustainedRequests.length;
  } else {
    // Reset consecutive 429 counter on successful request
    data.consecutive429s = 0;
  }
}

/**
 * Check if an IP should be blocked based on abuse patterns
 * Returns block info if should be blocked, null otherwise
 */
export async function checkForAbuse(ip: string): Promise<{
  shouldBlock: boolean;
  reason: string;
  triggerType: 'consecutive_429s' | 'sustained_traffic' | 'burst_traffic' | 'user_agent_cycling';
  metadata?: {
    consecutive429Count?: number;
    requestsPerSecond?: number;
    userAgentCount?: number;
  };
} | null> {
  const data = getTracking(ip);
  const now = Date.now();

  // Check consecutive 429s
  if (data.consecutive429s >= ABUSE_CONFIG.MAX_CONSECUTIVE_429S) {
    return {
      shouldBlock: true,
      reason: `Ignored ${data.consecutive429s} consecutive 429 responses`,
      triggerType: 'consecutive_429s',
      metadata: { consecutive429Count: data.consecutive429s },
    };
  }

  // Check burst traffic
  const recentCount = data.recentRequests.length;
  if (recentCount >= ABUSE_CONFIG.BURST_THRESHOLD) {
    return {
      shouldBlock: true,
      reason: `Burst traffic detected: ${recentCount} requests/second`,
      triggerType: 'burst_traffic',
      metadata: { requestsPerSecond: recentCount },
    };
  }

  // Check sustained traffic near limit
  if (data.sustainedAt429 >= ABUSE_CONFIG.SUSTAINED_TRAFFIC_THRESHOLD) {
    return {
      shouldBlock: true,
      reason: `Sustained traffic at rate limit: ${data.sustainedAt429} requests in ${ABUSE_CONFIG.SUSTAINED_TRAFFIC_WINDOW_MS / 60000} minutes`,
      triggerType: 'sustained_traffic',
    };
  }

  // Check user agent cycling
  const uniqueUserAgents = data.userAgents.size;
  if (uniqueUserAgents >= ABUSE_CONFIG.USER_AGENT_THRESHOLD) {
    return {
      shouldBlock: true,
      reason: `User-Agent cycling detected: ${uniqueUserAgents} different user agents`,
      triggerType: 'user_agent_cycling',
      metadata: { userAgentCount: uniqueUserAgents },
    };
  }

  return null;
}

/**
 * Check if an IP should be escalated to firewall level
 */
export async function shouldEscalateToFirewall(ip: string): Promise<boolean> {
  const previousCount = await BlockedIp.getPreviousBlockCount(ip);
  return previousCount >= ABUSE_CONFIG.ESCALATION_BLOCK_COUNT;
}

/**
 * Block an IP based on abuse detection
 */
export async function blockIpForAbuse(
  ip: string,
  reason: string,
  triggerType: 'consecutive_429s' | 'sustained_traffic' | 'burst_traffic' | 'user_agent_cycling',
  metadata?: {
    consecutive429Count?: number;
    requestsPerSecond?: number;
    userAgentCount?: number;
  },
): Promise<BlockedIp> {
  const shouldEscalate = await shouldEscalateToFirewall(ip);

  let block: BlockedIp;
  if (shouldEscalate) {
    // Escalate to firewall level
    block = await BlockedIp.escalateToFirewall(
      ip,
      `Repeat offender (escalated): ${reason}`,
      'repeat_offender',
    );
    console.log(`[AbuseManager] Escalated IP to firewall level: ${ip}`);
  } else {
    // App-level block with duration based on previous blocks
    const previousCount = await BlockedIp.getPreviousBlockCount(ip);
    const duration =
      previousCount > 0 ? ABUSE_CONFIG.REPEAT_BLOCK_DURATION : ABUSE_CONFIG.INITIAL_BLOCK_DURATION;

    block = await BlockedIp.blockAtAppLevel(ip, reason, triggerType, duration, metadata);
    console.log(`[AbuseManager] Blocked IP at app level for ${duration}min: ${ip} - ${reason}`);
  }

  // Update cache
  blockedIpCache.set(ip, {
    expiresAt: block.expiresAt ? block.expiresAt.getTime() : null,
    blockId: block.id,
  });

  // Reset tracking data
  resetTracking(ip);

  return block;
}

/**
 * Reset tracking data for an IP (after blocking)
 */
export function resetTracking(ip: string): void {
  const data = getTracking(ip);
  data.consecutive429s = 0;
  data.recentRequests = [];
  data.sustainedRequests = [];
  data.sustainedAt429 = 0;
  data.userAgents.clear();
  data.wasRecentlyBlocked = true;
  data.lastBlockExpiredAt = null;
}

/**
 * Check if an IP is blocked (fast in-memory check first, then DB)
 */
export async function isIpBlocked(ip: string): Promise<BlockedIp | null> {
  const now = Date.now();

  // Check cache first
  const cached = blockedIpCache.get(ip);
  if (cached) {
    // Check if expired
    if (cached.expiresAt && now > cached.expiresAt) {
      blockedIpCache.delete(ip);
    } else {
      // Still blocked, fetch from DB to record the attempt
      const block = await BlockedIp.isBlocked(ip);
      return block;
    }
  }

  // Check DB
  const block = await BlockedIp.isBlocked(ip);
  if (block) {
    // Update cache
    blockedIpCache.set(ip, {
      expiresAt: block.expiresAt ? block.expiresAt.getTime() : null,
      blockId: block.id,
    });
  }

  return block;
}

/**
 * Remove an IP from the block cache (when manually unblocked)
 */
export function removeFromCache(ip: string): void {
  blockedIpCache.delete(ip);
}

/**
 * Clean up old tracking data periodically
 */
function cleanupTrackingData(): void {
  const now = Date.now();
  const maxIdleTime = 30 * 60 * 1000; // 30 minutes of no activity

  for (const [ip, data] of ipTracking.entries()) {
    // Check if there's been any recent activity
    const lastActivity = Math.max(
      data.last429At || 0,
      data.recentRequests[data.recentRequests.length - 1] || 0,
    );

    if (now - lastActivity > maxIdleTime) {
      // Clean up stale data
      if (
        data.consecutive429s === 0 &&
        data.recentRequests.length === 0 &&
        data.sustainedRequests.length === 0 &&
        data.userAgents.size === 0
      ) {
        ipTracking.delete(ip);
      }
    }
  }
}

// Clean up tracking data every 5 minutes
setInterval(cleanupTrackingData, 5 * 60 * 1000);

/**
 * Get abuse detection statistics for monitoring
 */
export function getAbuseStats(): {
  trackedIps: number;
  cachedBlocks: number;
  config: typeof ABUSE_CONFIG;
} {
  return {
    trackedIps: ipTracking.size,
    cachedBlocks: blockedIpCache.size,
    config: ABUSE_CONFIG,
  };
}
