/**
 * ============================================================================
 * PHASE 21: LOCAL WEBSOCKET REAL-TIME EVENT BUS & OUTBOX PUBLISHER
 * ============================================================================
 * - 100% Local LAN operation (Zero Internet / Zero Cloud dependencies)
 * - Strict Business & Branch isolation
 * - Role-based event visibility
 * - Outbox publisher (Publish-After-Commit pattern)
 * - Cryptographic event IDs & Monotonic sequence ordering
 * - Dynamic device revocation enforcement & Stale connection cleanup
 * - Heartbeat ping-pong & Server-side presence detection
 */

import { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import {
  ServerEvent,
  ServerEventType,
  WebSocketClientContext,
  ClientToServerMessage,
  ServerToClientMessage,
  OutboxRecord,
} from './types';
import { PersistentSQLiteStorage, serverStorage } from '../storage';
import { activeSessions } from '../routes';
import { UserRole } from '../../types';

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  context?: WebSocketClientContext;
}

export class LocalRealtimeEventBus {
  private wss: WebSocketServer | null = null;
  private storage: PersistentSQLiteStorage;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private outboxDrainInterval: NodeJS.Timeout | null = null;
  private isDrainingOutbox = false;

  constructor(storage: PersistentSQLiteStorage = serverStorage) {
    this.storage = storage;
  }

  public setStorage(storage: PersistentSQLiteStorage): void {
    this.storage = storage;
  }

  /**
   * Attach WebSocket Server to existing Node HTTP server
   */
  public attach(server: HttpServer): void {
    if (this.wss) return;

    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws: ExtendedWebSocket, req: IncomingMessage) => {
      this.handleNewConnection(ws, req);
    });

    // Heartbeat: 30s interval
    this.heartbeatInterval = setInterval(() => {
      this.pingHeartbeat();
    }, 30000);

    // Periodic outbox catch-up drain: every 1s
    this.outboxDrainInterval = setInterval(() => {
      this.drainOutbox().catch(err => {
        console.error('[EventBus] Error draining outbox:', err);
      });
    }, 1000);

    console.log('[EventBus] Local WebSocket server attached on /ws (100% Local LAN)');
  }

  /**
   * Handle incoming WebSocket connection
   */
  private handleNewConnection(ws: ExtendedWebSocket, req: IncomingMessage): void {
    ws.isAlive = true;

    // Check query params for instant token authentication
    const url = req.url || '';
    const queryMatch = url.match(/[?&]token=([^&]+)/);
    const queryToken = queryMatch ? decodeURIComponent(queryMatch[1]) : null;

    if (queryToken) {
      const authResult = this.authenticateSocket(ws, queryToken);
      if (!authResult.success) {
        ws.send(JSON.stringify({
          type: 'AUTH_ERROR',
          code: authResult.code,
          message: authResult.message,
        } as ServerToClientMessage));
        ws.close(4001, authResult.message);
        return;
      }
    }

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (rawData: string | Buffer) => {
      try {
        const text = rawData.toString();
        const msg = JSON.parse(text) as ClientToServerMessage;
        this.handleClientMessage(ws, msg);
      } catch (err: any) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          code: 'MALFORMED_MESSAGE',
          message: 'Expected valid JSON message object',
        } as ServerToClientMessage));
      }
    });

    ws.on('close', () => {
      if (ws.context) {
        this.emitDevicePresenceEvent(ws.context, 'DEVICE_DISCONNECTED');
      }
    });

    ws.on('error', (err) => {
      console.warn('[EventBus] Socket error:', err.message);
    });
  }

  /**
   * Authenticate WebSocket connection with session token
   */
  public authenticateSocket(ws: ExtendedWebSocket, token: string): { success: boolean; code?: string; message?: string } {
    const session = activeSessions.get(token);
    if (!session) {
      return { success: false, code: 'INVALID_TOKEN', message: 'Token is invalid or not found' };
    }

    if (Date.now() > session.expiresAt) {
      activeSessions.delete(token);
      return { success: false, code: 'TOKEN_EXPIRED', message: 'Token has expired' };
    }

    // Verify device status in persistent SQLite DB
    const device = this.storage.getDevice(session.deviceId);
    if (device && device.status === 'REVOKED') {
      return { success: false, code: 'DEVICE_REVOKED', message: 'Device is revoked from shop network' };
    }

    const connectionId = 'conn_' + crypto.randomBytes(8).toString('hex');
    const user = session.user;

    const subscriptions = new Set<string>();
    subscriptions.add(user.branchId);
    if (user.role === 'owner') {
      subscriptions.add('*'); // Owner has access to all branches
    }

    ws.context = {
      connectionId,
      deviceId: session.deviceId,
      userId: user.id,
      businessId: user.businessId,
      branchId: user.branchId,
      role: user.role,
      connectedAt: new Date().toISOString(),
      lastPingAt: Date.now(),
      isAlive: true,
      subscriptions,
    };

    const latestSeq = this.storage.getLatestSequence(user.businessId, user.branchId);

    ws.send(JSON.stringify({
      type: 'AUTH_SUCCESS',
      connectionContext: {
        connectionId: ws.context.connectionId,
        deviceId: ws.context.deviceId,
        userId: ws.context.userId,
        businessId: ws.context.businessId,
        branchId: ws.context.branchId,
        role: ws.context.role,
      },
      lastSequence: latestSeq,
      message: 'Authenticated successfully',
    } as ServerToClientMessage));

    // Emit presence event
    this.emitDevicePresenceEvent(ws.context, 'DEVICE_CONNECTED');

    return { success: true };
  }

  /**
   * Handle incoming client control messages
   */
  private handleClientMessage(ws: ExtendedWebSocket, msg: ClientToServerMessage): void {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'PING') {
      ws.isAlive = true;
      ws.send(JSON.stringify({ type: 'PONG' } as ServerToClientMessage));
      return;
    }

    if (msg.type === 'AUTHENTICATE' || msg.type === 'AUTH') {
      if (!msg.token) {
        ws.send(JSON.stringify({
          type: 'AUTH_ERROR',
          code: 'MISSING_TOKEN',
          message: 'Token is required for authentication',
        } as ServerToClientMessage));
        return;
      }
      const auth = this.authenticateSocket(ws, msg.token);
      if (!auth.success) {
        ws.send(JSON.stringify({
          type: 'AUTH_ERROR',
          code: auth.code,
          message: auth.message,
        } as ServerToClientMessage));
        ws.close(4001, auth.message);
      }
      return;
    }

    // All subsequent actions require authenticated socket
    if (!ws.context) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        code: 'UNAUTHENTICATED',
        message: 'Socket must be authenticated before sending commands',
      } as ServerToClientMessage));
      return;
    }

    // Check if device was revoked in the meantime
    const device = this.storage.getDevice(ws.context.deviceId);
    if (device && device.status === 'REVOKED') {
      ws.send(JSON.stringify({
        type: 'ERROR',
        code: 'DEVICE_REVOKED',
        message: 'Device access has been revoked.',
      } as ServerToClientMessage));
      ws.close(4003, 'Device revoked');
      return;
    }

    if (msg.type === 'SUBSCRIBE') {
      if (msg.branchId) {
        // Only owners or staff assigned to that branch can subscribe
        if (ws.context.role === 'owner' || ws.context.branchId === msg.branchId) {
          ws.context.subscriptions.add(msg.branchId);
        }
      }
      return;
    }

    if (msg.type === 'UNSUBSCRIBE') {
      if (msg.branchId && msg.branchId !== ws.context.branchId) {
        ws.context.subscriptions.delete(msg.branchId);
      }
      return;
    }

    if (msg.type === 'ACK') {
      // Client acknowledged receipt of eventId
      return;
    }
  }

  /**
   * Check role-based event visibility
   */
  private isEventPermittedForRole(role: UserRole, eventType: ServerEventType): boolean {
    if (role === 'owner' || role === 'manager') {
      return true; // Full access
    }

    if (role === 'cashier') {
      // Cashiers see operational events, payments, customer credits, closings
      return eventType !== 'EXPENSE_CREATED';
    }

    if (role === 'receptionist') {
      // Receptionists see rooms, sessions, and payments
      return [
        'SESSION_STARTED',
        'SESSION_UPDATED',
        'SESSION_ENDED',
        'ROOM_STATUS_CHANGED',
        'PAYMENT_CREATED',
        'INVOICE_UPDATED',
        'DEVICE_CONNECTED',
        'DEVICE_DISCONNECTED',
      ].includes(eventType);
    }

    return false;
  }

  /**
   * Drain and publish pending events from the SQLite outbox
   */
  public async drainOutbox(): Promise<number> {
    if (this.isDrainingOutbox) return 0;
    this.isDrainingOutbox = true;

    try {
      const pendingEvents = this.storage.getPendingOutboxEvents(50);
      if (pendingEvents.length === 0) {
        this.isDrainingOutbox = false;
        return 0;
      }

      for (const record of pendingEvents) {
        let payloadObj: any = {};
        try {
          payloadObj = JSON.parse(record.payload);
        } catch {
          payloadObj = record.payload;
        }

        const serverEvent: ServerEvent = {
          eventId: record.eventId,
          eventType: record.eventType,
          businessId: record.businessId,
          branchId: record.branchId,
          entityType: record.entityType,
          entityId: record.entityId,
          operationId: record.operationId,
          version: 1,
          timestamp: record.createdAt,
          sequence: record.sequence,
          actorDeviceId: record.actorDeviceId,
          actorUserId: record.actorUserId,
          payload: payloadObj,
        };

        this.broadcastEvent(serverEvent);
        this.storage.markOutboxEventPublished(record.eventId);
      }

      this.isDrainingOutbox = false;
      return pendingEvents.length;
    } catch (err) {
      this.isDrainingOutbox = false;
      throw err;
    }
  }

  /**
   * Broadcast an event to matching connected clients
   */
  public broadcastEvent(event: ServerEvent): void {
    if (!this.wss) return;

    const eventJson = JSON.stringify({
      type: 'EVENT',
      event,
    } as ServerToClientMessage);

    this.wss.clients.forEach((client) => {
      const extWs = client as ExtendedWebSocket;
      if (extWs.readyState !== WebSocket.OPEN || !extWs.context) return;

      // 1. Business Isolation: NEVER cross business boundary
      if (extWs.context.businessId !== event.businessId) {
        return;
      }

      // 2. Branch Isolation
      const isSubscribedToBranch =
        extWs.context.subscriptions.has('*') ||
        extWs.context.subscriptions.has(event.branchId) ||
        extWs.context.branchId === event.branchId;

      if (!isSubscribedToBranch) {
        return;
      }

      // 3. Role-Based Visibility
      if (!this.isEventPermittedForRole(extWs.context.role, event.eventType)) {
        return;
      }

      // 4. Send Event
      try {
        extWs.send(eventJson);
      } catch (err: any) {
        console.warn(`[EventBus] Failed to send event ${event.eventId} to conn ${extWs.context.connectionId}:`, err.message);
      }
    });
  }

  /**
   * Emit device presence events
   */
  private emitDevicePresenceEvent(context: WebSocketClientContext, eventType: 'DEVICE_CONNECTED' | 'DEVICE_DISCONNECTED'): void {
    const event: ServerEvent = {
      eventId: crypto.randomUUID(),
      eventType,
      businessId: context.businessId,
      branchId: context.branchId,
      entityType: 'DEVICE',
      entityId: context.deviceId,
      version: 1,
      timestamp: new Date().toISOString(),
      sequence: 0,
      actorDeviceId: context.deviceId,
      actorUserId: context.userId,
      payload: {
        deviceId: context.deviceId,
        role: context.role,
        status: eventType === 'DEVICE_CONNECTED' ? 'ONLINE' : 'OFFLINE',
      },
    };

    this.broadcastEvent(event);
  }

  /**
   * Revoke device access actively across all open WebSocket connections
   */
  public revokeDeviceConnections(deviceId: string): void {
    if (!this.wss) return;

    this.wss.clients.forEach((client) => {
      const extWs = client as ExtendedWebSocket;
      if (extWs.context && extWs.context.deviceId === deviceId) {
        extWs.send(JSON.stringify({
          type: 'ERROR',
          code: 'DEVICE_REVOKED',
          message: 'Your device access has been revoked by the administrator.',
        } as ServerToClientMessage));
        extWs.close(4003, 'Device revoked');
      }
    });
  }

  /**
   * Heartbeat Ping/Pong
   */
  private pingHeartbeat(): void {
    if (!this.wss) return;

    this.wss.clients.forEach((client) => {
      const extWs = client as ExtendedWebSocket;
      if (!extWs.isAlive) {
        // Connection dead, terminate
        if (extWs.context) {
          this.emitDevicePresenceEvent(extWs.context, 'DEVICE_DISCONNECTED');
        }
        return extWs.terminate();
      }

      extWs.isAlive = false;
      extWs.ping();
    });
  }

  /**
   * Get connected clients for a business
   */
  public getConnectedClients(businessId: string): Array<{
    connectionId: string;
    deviceId: string;
    userId: string;
    branchId: string;
    role: UserRole;
    connectedAt: string;
  }> {
    if (!this.wss) return [];
    const list: any[] = [];
    this.wss.clients.forEach((client) => {
      const extWs = client as ExtendedWebSocket;
      if (extWs.readyState === WebSocket.OPEN && extWs.context && extWs.context.businessId === businessId) {
        list.push({
          connectionId: extWs.context.connectionId,
          deviceId: extWs.context.deviceId,
          userId: extWs.context.userId,
          branchId: extWs.context.branchId,
          role: extWs.context.role,
          connectedAt: extWs.context.connectedAt,
        });
      }
    });
    return list;
  }

  /**
   * Clean shutdown of WebSocket server and timers
   */
  public closeAll(reason = 'Server closing'): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.outboxDrainInterval) clearInterval(this.outboxDrainInterval);
    if (this.wss) {
      this.wss.clients.forEach((client) => {
        try {
          client.close(1001, reason);
        } catch {}
      });
    }
  }

  public close(): Promise<void> {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.outboxDrainInterval) clearInterval(this.outboxDrainInterval);

    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.clients.forEach((client) => {
          try {
            client.terminate();
          } catch {}
        });
        this.wss.close(() => {
          this.wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export const realtimeEventBus = new LocalRealtimeEventBus();
