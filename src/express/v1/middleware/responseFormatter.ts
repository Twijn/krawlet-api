import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/responses';

declare global {
  namespace Express {
    interface Response {
      success<T>(data: T, statusCode?: number): void;
      error(code: string, message: string, statusCode?: number, details?: unknown): void;
    }
  }
}

export const responseFormatterMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = (req as any).startTime || Date.now();
  const requestId = (req as any).id || 'unknown';

  res.success = function <T>(data: T, statusCode = 200) {
    const elapsed = Date.now() - startTime;

    const response: ApiResponse<T> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        elapsed,
        version: 'v1',
        requestId: requestId,
      },
    };

    return this.status(statusCode).json(response);
  };

  res.error = function (code: string, message: string, statusCode = 500, details?: unknown) {
    const elapsed = Date.now() - startTime;

    const response: ApiResponse = {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        elapsed,
        version: 'v1',
        requestId: requestId,
      },
    };

    console.error(`[${requestId}] Error ${code}: ${message}`);

    return this.status(statusCode).json(response);
  };

  next();
};
