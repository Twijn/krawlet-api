import { RawData, WebSocket } from 'ws';
import { AuthState, ClientMessage, ServerMessage } from './types';

export function logPrefix(
  state: Pick<AuthState, 'connectionId' | 'workerId' | 'remoteAddress'>,
): string {
  const workerPart = state.workerId !== undefined ? ` worker=${state.workerId}` : '';
  const remotePart = state.remoteAddress ? ` ip=${state.remoteAddress}` : '';
  return `[ws:${state.connectionId}${workerPart}${remotePart}]`;
}

export function sendJson(ws: WebSocket, message: ServerMessage): void {
  ws.send(JSON.stringify(message));
}

export function sendError(
  ws: WebSocket,
  code: string,
  message: string,
  id?: string | number,
): void {
  sendJson(ws, {
    id,
    type: 'error',
    payload: {
      code,
      message,
    },
  });
}

export function parseClientMessage(raw: RawData): ClientMessage | null {
  const messageString = typeof raw === 'string' ? raw : raw.toString();

  try {
    return JSON.parse(messageString) as ClientMessage;
  } catch {
    console.warn(`Failed to parse websocket message as JSON: ${messageString.slice(0, 200)}`);
    return null;
  }
}
