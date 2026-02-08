import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ApiKey, ApiKeyTier } from './models/apikey.model';

/**
 * Middleware to authenticate requests using API keys with specific tier requirements.
 * This is used for internal endpoints that require specific API key tiers.
 *
 * @param allowedTiers - Array of API key tiers that are allowed to access this endpoint
 * @returns Express middleware function
 */
export function authenticateApiKeyTier(...allowedTiers: ApiKeyTier[]): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        error: 'Authorization header missing or invalid',
      });
    }

    const rawKey = authHeader.substring(7);

    try {
      // Hash the key and look it up
      const hashedKey = ApiKey.hashKey(rawKey);
      const apiKey = await ApiKey.findOne({ where: { key: hashedKey } });

      if (!apiKey) {
        return res.status(401).json({
          ok: false,
          error: 'Invalid API key',
        });
      }

      if (!apiKey.isActive) {
        return res.status(403).json({
          ok: false,
          error: 'API key is inactive',
        });
      }

      if (!allowedTiers.includes(apiKey.tier)) {
        return res.status(403).json({
          ok: false,
          error: `API key tier '${apiKey.tier}' is not authorized for this endpoint. Allowed tiers: ${allowedTiers.join(', ')}`,
        });
      }

      // Update usage stats
      await apiKey.incrementUsage();

      // Attach the API key to the request for downstream use
      (req as Request & { apiKey?: ApiKey }).apiKey = apiKey;

      next();
    } catch (error) {
      console.error('Error authenticating API key:', error);
      return res.status(500).json({
        ok: false,
        error: 'Internal server error during authentication',
      });
    }
  };
}

export default authenticateApiKeyTier;
