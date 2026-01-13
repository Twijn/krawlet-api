import { RequestWithId } from '../middleware/requestId';

export interface RequestWithRateLimit extends RequestWithId {
  apiKey?: {
    id: string;
    tier: string;
    rateLimit: number;
  };
  rateLimit: {
    limit: number;
    remaining: number;
    reset: number;
  };
}
