import { WebSocket } from 'ws';
import { AuthState } from './types';

export const AUTH_TIMEOUT_MS = 5000;
export const authState = new Map<WebSocket, AuthState>();

let nextConnectionId = 1;

export function getNextConnectionId(): number {
  const connectionId = nextConnectionId;
  nextConnectionId += 1;
  return connectionId;
}
