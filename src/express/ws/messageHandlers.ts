import { ApiKey } from '../../lib/models/apikey.model';
import { RawData, WebSocket } from 'ws';
import { parseClientMessage, sendError, sendJson, logPrefix } from './protocol';
import { authState } from './state';
import { AuthState, ClientAuthMessage, MessageHandler } from './types';
import { workerMessageHandlers } from './workerHandlers';
import { clientMessageHandlers } from './clientHandlers';
import { resolveClientEntityId } from './clientEntity';

function getSocketAuthState(ws: WebSocket, messageId?: string | number): AuthState | null {
  const state = authState.get(ws);
  if (!state) {
    sendError(ws, 'AUTH_STATE_MISSING', 'Socket auth state not initialized', messageId);
    ws.close(1011, 'Server auth state error');
    return null;
  }

  return state;
}

async function handleAuthMessage(ws: WebSocket, parsed: ClientAuthMessage): Promise<void> {
  if (!parsed.token.startsWith('kraw_')) {
    sendError(ws, 'INVALID_TOKEN_FORMAT', 'API key must start with "kraw_"', parsed.id);
    return;
  }

  const hashedKey = ApiKey.hashKey(parsed.token);
  const apiKey = await ApiKey.findOne({
    where: {
      key: hashedKey,
      isActive: true,
    },
  });

  if (!apiKey) {
    sendError(ws, 'INVALID_TOKEN', 'Invalid or inactive API key', parsed.id);
    return;
  }

  const currentState = authState.get(ws);
  if (!currentState) {
    return;
  }

  if (apiKey.tier === 'worker') {
    if (typeof parsed.workerId !== 'number') {
      sendError(
        ws,
        'INVALID_WORKER_ID',
        'Auth message must include a numeric workerId field',
        parsed.id,
      );
      return;
    }

    clearTimeout(currentState.timeoutHandle);
    currentState.authenticated = true;
    currentState.role = 'worker';
    currentState.apiKeyId = apiKey.id;
    currentState.workerId = parsed.workerId;
    currentState.clientEntityId = undefined;
    authState.set(ws, currentState);

    console.log(
      `${logPrefix(currentState)} authenticated as worker key=${apiKey.name} tier=${apiKey.tier} requestId=${parsed.id}`,
    );

    apiKey
      .incrementUsage()
      .catch((err) => console.error('Failed to increment API key usage:', err));

    sendJson(ws, {
      id: parsed.id,
      type: 'auth_ok',
      payload: {
        tier: apiKey.tier,
        name: apiKey.name,
        role: 'worker',
      },
    });
  } else if (apiKey.tier === 'free' || apiKey.tier === 'premium') {
    if (!apiKey.estorageEntityId && !apiKey.mcUuid) {
      sendError(
        ws,
        'NO_ENTITY_LINK',
        'API key is not linked to a Minecraft player or ender storage entity. Ask an admin to provision your key with an entity link.',
        parsed.id,
      );
      return;
    }

    clearTimeout(currentState.timeoutHandle);
    currentState.authenticated = true;
    currentState.role = 'client';
    currentState.apiKeyId = apiKey.id;
    currentState.clientEntityId = (await resolveClientEntityId(apiKey.id)) ?? undefined;
    authState.set(ws, currentState);

    console.log(
      `${logPrefix(currentState)} authenticated as client key=${apiKey.name} tier=${apiKey.tier} requestId=${parsed.id}`,
    );

    apiKey
      .incrementUsage()
      .catch((err) => console.error('Failed to increment API key usage:', err));

    sendJson(ws, {
      id: parsed.id,
      type: 'auth_ok',
      payload: {
        tier: apiKey.tier,
        name: apiKey.name,
        role: 'client',
      },
    });
  } else {
    sendError(
      ws,
      'INVALID_TIER',
      `API key tier '${apiKey.tier}' is not allowed for WebSocket auth`,
      parsed.id,
    );
  }
}

const sharedMessageHandlers: Record<string, MessageHandler> = {
  auth: async (ws, message) => {
    if (!message.token) {
      sendError(ws, 'MISSING_TOKEN', 'Auth message must include a token field', message.id);
      return;
    }

    await handleAuthMessage(ws, message as ClientAuthMessage);
  },
  ping: (ws, message) => {
    sendJson(ws, {
      id: message.id,
      type: 'pong',
      payload: { ts: Date.now() },
    });
  },
};

function resolveHandler(state: AuthState, messageType: string): MessageHandler | undefined {
  if (messageType === 'auth' || messageType === 'ping') {
    return sharedMessageHandlers[messageType];
  }

  if (state.role === 'worker') {
    return workerMessageHandlers[messageType];
  }

  if (state.role === 'client') {
    return clientMessageHandlers[messageType];
  }

  return undefined;
}

export async function handleMessage(ws: WebSocket, raw: RawData): Promise<void> {
  const parsed = parseClientMessage(raw);
  if (!parsed) {
    sendError(ws, 'INVALID_JSON', 'Message must be valid JSON');
    return;
  }

  if (!parsed.type) {
    sendError(ws, 'INVALID_MESSAGE', 'Message must include a type field', parsed.id);
    return;
  }

  if (!parsed.id) {
    sendError(ws, 'MISSING_ID', 'Message must include an id field');
    return;
  }

  const state = getSocketAuthState(ws, parsed.id);
  if (!state) {
    return;
  }

  console.log(
    `${logPrefix(state)} message type=${parsed.type} id=${parsed.id} authenticated=${state.authenticated}`,
  );

  if (!state.authenticated && parsed.type !== 'auth') {
    sendError(
      ws,
      'UNAUTHENTICATED',
      'Authenticate first using { type: "auth", token: "kraw_...", id: "..." }',
      parsed.id,
    );
    return;
  }

  const handler = resolveHandler(state, parsed.type);
  if (!handler) {
    sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${parsed.type}`, parsed.id);
    return;
  }

  await handler(ws, parsed, state);
}
