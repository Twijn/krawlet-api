export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Resource-specific errors
  PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
  SHOP_NOT_FOUND = 'SHOP_NOT_FOUND',
  TURTLE_NOT_FOUND = 'TURTLE_NOT_FOUND',
  INVALID_API_KEY = 'INVALID_API_KEY',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

export class ApiException extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiException';
  }
}
