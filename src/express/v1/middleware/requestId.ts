import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { createLogger } from '#lib/logger';

const log = createLogger('HTTP');

export interface RequestWithId extends Request {
  id: string;
  requestId: string; // Alias for consistency
  startTime: number;
}

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  (req as RequestWithId).id = requestId;
  (req as RequestWithId).requestId = requestId; // Set alias
  (req as RequestWithId).startTime = Date.now();

  res.setHeader('X-Request-ID', requestId);

  log.info(`[${requestId}] ${req.method} ${req.path}`);

  next();
};
