import { Server as HttpServer } from 'http';
import { RawData, WebSocketServer } from 'ws';
import { handleMessage } from './messageHandlers';
import { logPrefix, sendJson } from './protocol';
import { AUTH_TIMEOUT_MS, authState, getNextConnectionId } from './state';
import { RoutedWebSocket } from './types';
import { requeueTransferForRetry } from './transferQueue';
import { rejectStorageQueriesForWorker } from './storageQuery';

function createWebSocketServer(server: HttpServer, path: string): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

  server.on('upgrade', (req, socket, head) => {
    if (!req.url) {
      socket.destroy();
      return;
    }

    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname !== '/api/v1/ws' && pathname !== '/api/ws') {
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const routedSocket = ws as RoutedWebSocket;
      routedSocket.routePath = pathname;
      wss.emit('connection', routedSocket, req);
    });
  });

  wss.on('connection', (ws: RoutedWebSocket, req) => {
    const resolvedPath = ws.routePath ?? path;
    const connectionId = getNextConnectionId();
    const remoteAddress = req.socket.remoteAddress;

    const timeoutHandle = setTimeout(() => {
      const state = authState.get(ws);
      if (!state || state.authenticated) {
        return;
      }

      console.warn(`${logPrefix(state)} authentication timeout after ${AUTH_TIMEOUT_MS}ms`);

      sendJson(ws, {
        type: 'error',
        payload: {
          code: 'AUTH_TIMEOUT',
          message: 'Socket must authenticate within 5 seconds',
        },
      });
      ws.close(4001, 'Authentication timeout');
    }, AUTH_TIMEOUT_MS);

    authState.set(ws, {
      authenticated: false,
      timeoutHandle,
      currentTask: null,
      currentTaskCancelRequested: false,
      connectionId,
      remoteAddress,
    });

    console.log(`[ws:${connectionId} ip=${remoteAddress}] connected path=${resolvedPath}`);

    sendJson(ws, {
      type: 'hello',
      payload: {
        path: resolvedPath,
        version: 'v1',
        serverTime: new Date().toISOString(),
        authRequired: true,
        authTimeoutMs: AUTH_TIMEOUT_MS,
        workerMessageTypes: [
          'auth',
          'ping',
          'transfer_progress',
          'transfer_complete',
          'transfer_cancelled',
          'transfer_failed',
          'storage_list_result',
        ],
        clientMessageTypes: ['auth', 'ping', 'create_transfer', 'get_transfer', 'cancel_transfer'],
      },
    });

    ws.on('message', (message: RawData) => {
      handleMessage(ws, message).catch((err) => {
        console.error(`WebSocket message handling error (${resolvedPath}):`, err);
        sendJson(ws, {
          type: 'error',
          payload: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to process message',
          },
        });
      });
    });

    ws.on('close', () => {
      const state = authState.get(ws);
      if (!state) {
        return;
      }

      rejectStorageQueriesForWorker(ws);

      if (state.currentTask) {
        console.warn(
          `${logPrefix(state)} disconnected with active transfer ${state.currentTask.id}; transfer will be retried`,
        );

        void requeueTransferForRetry(
          state.currentTask.id,
          `Worker disconnected (connection ${state.connectionId}) before completion`,
        ).catch((err) => {
          console.error(
            `${logPrefix(state)} failed to requeue transfer ${state.currentTask?.id} after disconnect:`,
            err,
          );
        });
      }

      console.log(`${logPrefix(state)} disconnected`);
      clearTimeout(state.timeoutHandle);
      authState.delete(ws);
    });

    ws.on('error', (err: Error) => {
      console.error(`WebSocket error (${resolvedPath}) from ${req.socket.remoteAddress}:`, err);
    });
  });

  wss.on('error', (err) => {
    console.error(`WebSocket server error (${path}):`, err);
  });

  return wss;
}

export function initWebSockets(server: HttpServer): WebSocketServer[] {
  const websocketServer = createWebSocketServer(server, '/api/v1/ws');
  return [websocketServer];
}
