import { RawTransfer } from '../../lib/models';
import { WebSocket } from 'ws';

export type ClientMessage = {
  id: string | number;
  type: string;
  token?: string;
  workerId?: number;
  payload?: unknown;
};

export type ClientAuthMessage = ClientMessage & {
  type: 'auth';
  token: string;
  workerId: number;
};

export type TransferUpdateMessage = ClientMessage & {
  id: string;
  type: 'transfer_progress' | 'transfer_failed' | 'transfer_complete';
  totalMoved?: number;
  reason?: string;
  workerId?: number;
  requestedQuantity?: number;
  itemName?: string;
  elapsedMs?: number;
};

export type ServerMessage = {
  id?: string | number;
  type: string;
  payload?: unknown;
};

export type RoutedWebSocket = WebSocket & {
  routePath?: string;
};

export type AuthState = {
  authenticated: boolean;
  timeoutHandle: NodeJS.Timeout;
  currentTask: RawTransfer | null;
  connectionId: number;
  remoteAddress?: string;
  apiKeyId?: string;
  workerId?: number;
};

export type MessageHandler = (
  ws: WebSocket,
  message: ClientMessage,
  state: AuthState,
) => Promise<void> | void;
