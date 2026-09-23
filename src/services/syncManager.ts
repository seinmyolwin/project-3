/**
 * Central Sync Manager
 * Manages explicit connectivity states (LOCAL_ONLY, CONNECTING, ONLINE_LAN, SERVER_UNAVAILABLE, SYNC_PENDING, SYNCING, SYNCED, CONFLICT)
 * Coordinates financial mutation dispatching, offline fallback queuing, and realtime event reconciliation.
 */

import { localServerClient, OperationPayload, ProcessOperationResponse } from './localServerClient';
import { realtimeClient } from './realtimeClient';
import { authSession } from './authSession';
import { db } from '../db/database';

export type SyncState =
  | 'LOCAL_ONLY'
  | 'CONNECTING'
  | 'ONLINE_LAN'
  | 'SERVER_UNAVAILABLE'
  | 'SYNC_PENDING'
  | 'SYNCING'
  | 'SYNCED'
  | 'CONFLICT';

export type SyncStateListener = (state: SyncState, details?: { message?: string; pendingCount?: number }) => void;

export class SyncManager {
  private currentState: SyncState = 'LOCAL_ONLY';
  private statusMessage = 'Operating in 100% Offline Single-Device Mode';
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isReconciling = false;
  private pendingQueueCount = 0;

  private stateListeners: Set<SyncStateListener> = new Set();

  constructor() {
    // Listen to WS connection state & sequence gaps
    realtimeClient.onConnectionStateChange((connected) => {
      if (connected) {
        this.updateState('ONLINE_LAN', 'Connected to LAN Server Realtime Bus');
        this.reconcileMissedEvents();
      } else if (this.currentState === 'ONLINE_LAN') {
        this.updateState('SERVER_UNAVAILABLE', 'Lost Connection to LAN Server');
      }
    });

    realtimeClient.onSequenceGap(({ expected, received }) => {
      console.warn(`[SyncManager] Sequence gap (${expected} -> ${received}), triggering event catchup`);
      this.reconcileMissedEvents();
    });
  }

  /**
   * Start health check polling and realtime socket
   */
  public start() {
    this.checkHealth();
    if (!this.healthCheckInterval) {
      this.healthCheckInterval = setInterval(() => {
        this.checkHealth();
      }, 10000); // Check server health every 10s
    }

    if (authSession.isAuthenticated()) {
      realtimeClient.connect();
    }
  }

  /**
   * Stop health check polling and disconnect socket
   */
  public stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    realtimeClient.disconnect();
  }

  /**
   * Check Server Health (/api/health)
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const health = await localServerClient.getHealth();
      if (health && health.status === 'ok') {
        if (this.currentState === 'LOCAL_ONLY' || this.currentState === 'SERVER_UNAVAILABLE') {
          this.updateState('ONLINE_LAN', 'Connected to LAN Server');
          if (authSession.isAuthenticated()) {
            realtimeClient.connect();
            this.reconcileMissedEvents();
          }
        }
        return true;
      } else {
        this.updateState('SERVER_UNAVAILABLE', 'LAN Server reported degraded/error health');
        return false;
      }
    } catch (err) {
      if (this.currentState === 'ONLINE_LAN') {
        this.updateState('SERVER_UNAVAILABLE', 'LAN Server unreachable');
      }
      return false;
    }
  }

  /**
   * Reconcile Missed Events from Server (/api/sync/events)
   */
  public async reconcileMissedEvents() {
    if (this.isReconciling || !authSession.isAuthenticated()) return;
    this.isReconciling = true;

    try {
      const session = authSession.getSession();
      if (!session) return;

      const lastSeq = realtimeClient.getLastSequence();
      const response = await localServerClient.getSyncEvents(lastSeq, session.user.branchId);

      if (response && response.success && response.events.length > 0) {
        console.log(`[SyncManager] Reconciled ${response.events.length} missed events from server`);
        
        for (const ev of response.events) {
          await this.applyServerEventToLocalCache(ev);
        }

        if (response.latestSequence > lastSeq) {
          realtimeClient.setLastSequence(response.latestSequence);
        }
      }

      if (this.pendingQueueCount === 0) {
        this.updateState('SYNCED', 'All server events up to date');
        setTimeout(() => {
          if (this.currentState === 'SYNCED') {
            this.updateState('ONLINE_LAN', 'Connected to LAN Server');
          }
        }, 3000);
      }
    } catch (err: any) {
      console.warn('[SyncManager] Error reconciling missed events:', err.message);
    } finally {
      this.isReconciling = false;
    }
  }

  /**
   * Process Financial Mutation Operation
   * Uses authoritative server if ONLINE_LAN, or local Dexie transaction fallback if offline
   */
  public async executeFinancialMutation(params: {
    operationType: 'SESSION_START' | 'SESSION_END' | 'PAYMENT' | 'EXPENSE' | 'CUSTOMER_CREDIT' | 'CASH_CLOSING' | string;
    entityType?: string;
    entityId?: string;
    payload: Record<string, any>;
    localFallbackFn: () => Promise<any>;
  }): Promise<{ success: boolean; result: any; isOfflineFallback: boolean; serverProcessed?: boolean }> {
    const session = authSession.getSession();
    const isOnline = (this.currentState === 'ONLINE_LAN' || this.currentState === 'SYNCED') && !!session;

    const operationId = 'op_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

    if (isOnline && session) {
      try {
        this.updateState('SYNCING', `Processing ${params.operationType} on server...`);

        const opPayload: OperationPayload = {
          operationId,
          businessId: session.user.businessId,
          branchId: session.user.branchId,
          deviceId: session.deviceId,
          operationType: params.operationType,
          entityType: params.entityType || 'GENERAL',
          entityId: params.entityId || 'N/A',
          payload: params.payload,
        };

        const serverRes: ProcessOperationResponse = await localServerClient.processOperation(opPayload);

        // Update local Dexie state from server authoritative execution
        const localResult = await params.localFallbackFn();

        this.updateState('ONLINE_LAN', 'Operation processed on server');

        return {
          success: true,
          result: serverRes.result || localResult,
          isOfflineFallback: false,
          serverProcessed: true,
        };
      } catch (err: any) {
        console.warn(`[SyncManager] Server operation ${params.operationType} failed:`, err.message);

        if (err.status === 409) {
          // Conflict
          this.updateState('CONFLICT', err.message || 'Operation conflict on server');
          throw err;
        }

        if (err.status === 403 || err.status === 401 || err.status === 422) {
          // Business rule or authorization failure from server
          throw err;
        }

        // Server unreachable or network error: fall back to local Dexie
        this.updateState('SERVER_UNAVAILABLE', 'Server unreachable. Applying local offline fallback.');
      }
    }

    // Single-device offline fallback or server unavailable
    try {
      const localResult = await params.localFallbackFn();
      
      this.pendingQueueCount++;
      this.updateState('SYNC_PENDING', `Operation completed locally (Offline Mode)`, { pendingCount: this.pendingQueueCount });

      return {
        success: true,
        result: localResult,
        isOfflineFallback: true,
        serverProcessed: false,
      };
    } catch (localErr) {
      throw localErr;
    }
  }

  /**
   * Apply incoming realtime server event to Dexie local read cache
   */
  public async applyServerEventToLocalCache(event: any) {
    if (!event || !event.eventType) return;

    try {
      const payload = event.payload || {};

      switch (event.eventType) {
        case 'SESSION_STARTED': {
          if (payload.sessionId && payload.roomId) {
            const room = await db.rooms.get(payload.roomId);
            if (room) {
              await db.rooms.update(payload.roomId, {
                status: 'occupied',
                currentSessionId: payload.sessionId,
              });
            }
          }
          if (payload.session) {
            await db.sessions.put(payload.session);
          }
          break;
        }

        case 'SESSION_UPDATED': {
          if (payload.session) {
            await db.sessions.put(payload.session);
          }
          if (payload.roomId && payload.status) {
            await db.rooms.update(payload.roomId, {
              status: payload.status,
              currentSessionId: payload.sessionId,
            });
          }
          break;
        }

        case 'SESSION_ENDED': {
          if (payload.roomId) {
            const room = await db.rooms.get(payload.roomId);
            if (room) {
              await db.rooms.update(payload.roomId, {
                status: 'available',
                currentSessionId: undefined,
              });
            }
          }
          if (payload.sessionId && payload.endTime) {
            const sess = await db.sessions.get(payload.sessionId);
            if (sess) {
              await db.sessions.update(payload.sessionId, {
                status: 'completed',
                endTime: payload.endTime,
                finalTotalMMK: payload.finalTotalMMK ?? sess.finalTotalMMK,
              });
            }
          }
          break;
        }

        case 'ROOM_STATUS_CHANGED': {
          if (payload.roomId && payload.status) {
            await db.rooms.update(payload.roomId, {
              status: payload.status,
              currentSessionId: payload.currentSessionId,
            });
          }
          break;
        }

        case 'PAYMENT_CREATED':
        case 'INVOICE_UPDATED': {
          if (payload.invoice) {
            await db.invoices.put(payload.invoice);
          }
          if (payload.sale) {
            await db.sales.put(payload.sale);
          }
          if (payload.cashTransaction) {
            await db.cashTransactions.put(payload.cashTransaction);
          }
          break;
        }

        case 'EXPENSE_CREATED': {
          if (payload.expense) {
            await db.expenses.put(payload.expense);
          }
          if (payload.cashTransaction) {
            await db.cashTransactions.put(payload.cashTransaction);
          }
          break;
        }

        case 'CUSTOMER_CREDIT_CREATED':
        case 'CUSTOMER_PAYMENT_CREATED':
        case 'CUSTOMER_BALANCE_UPDATED': {
          if (payload.customer) {
            await db.customers.put(payload.customer);
          }
          if (payload.customerLedgerEntry) {
            await db.customerLedger.put(payload.customerLedgerEntry);
          }
          if (payload.customerCreditLedger) {
            await db.customerCreditLedger.put(payload.customerCreditLedger);
          }
          break;
        }

        case 'CASH_CLOSING_CREATED': {
          if (payload.cashClosing) {
            await db.cashClosings.put(payload.cashClosing);
          }
          break;
        }

        case 'ROOM_RESET': {
          if (payload.roomId) {
            await db.rooms.update(payload.roomId, {
              status: 'available',
              currentSessionId: undefined,
            });
          }
          break;
        }

        default:
          break;
      }
    } catch (err: any) {
      console.warn('[SyncManager] Error applying server event to local cache:', err.message);
    }
  }

  // State Management & Subscriptions
  public getState(): SyncState {
    return this.currentState;
  }

  public getStatusMessage(): string {
    return this.statusMessage;
  }

  public onStateChange(listener: SyncStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.currentState, { message: this.statusMessage, pendingCount: this.pendingQueueCount });
    return () => this.stateListeners.delete(listener);
  }

  private updateState(newState: SyncState, message: string, details?: { pendingCount?: number }) {
    this.currentState = newState;
    this.statusMessage = message;
    this.stateListeners.forEach(listener => {
      try {
        listener(newState, { message, pendingCount: details?.pendingCount ?? this.pendingQueueCount });
      } catch (err) {
        console.error('[SyncManager] Listener error:', err);
      }
    });
  }
}

export const syncManager = new SyncManager();
