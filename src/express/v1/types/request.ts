import { RequestWithId } from '../middleware/requestId';

export interface RequestWithRateLimit extends RequestWithId {
  apiKey?: {
    id: string;
    name: string;
    email: string | null;
    tier: string;
    rateLimit: number;
    isActive: boolean;
    requestCount: number;
    lastUsedAt: Date | null;
    createdAt: Date;
  };
  rateLimit: {
    limit: number;
    remaining: number;
    reset: number;
  };
}
