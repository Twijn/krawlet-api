import { RequestWithId } from '../middleware/requestId';
import { ApiKeyTier } from '../../../lib/models/apikey.model';

export interface RequestApiKey {
  id: string;
  name: string;
  email: string | null;
  tier: ApiKeyTier;
  rateLimit: number;
  isActive: boolean;
  requestCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  mcUuid: string | null;
  mcName: string | null;
  estorageEntityId: string | null;
}

export interface RequestWithRateLimit extends RequestWithId {
  apiKey?: RequestApiKey;
  rateLimit: {
    limit: number;
    remaining: number;
    reset: number;
  };
}
