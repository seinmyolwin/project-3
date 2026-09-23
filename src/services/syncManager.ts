/**
 * Central Sync Manager
 * Manages explicit connectivity states (LOCAL_ONLY, CONNECTING, ONLINE_LAN, SERVER_UNAVAILABLE, SYNC_PENDING, SYNCING, SYNCED, CONFLICT)
 * Implements strict Source-of-Truth partitioning:
 * - LAN Mode: Server SQLite is Authoritative. Dexie is local read cache only. Server commits first -> Result updates Dexie cache. Offline mutations are NEVER executed on server success.
 * - Offline Mode: Dexie is local authoritative store. Mutations write to Dexie and are queued in db.operationQueue for later idempotent server replay.
 */

import { localServerClient, OperationPayload, ProcessOperationResponse } from './localServerClient';
import { realtimeClient } from './realtimeClient';
import { authSession } from './authSession';
import { db } from '../db/database';
import { OperationQueueRecord } from '../types';

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

export interface ExecuteMutationParams<TResult = any> {
  operationType: 'SESSION_START' | 'SESSION_END' | 'PAYMENT' | 'EXPENSE' | 'CUSTOMER_CREDIT' | 'CASH_CLOSING' | string;
  entityType?: string;
  entityId?: string;
  payload: Record<string, any>;
  /**
   * Executed ONLY when in Offline Mode / Server Unreachable.
   * Modifies local Dexie financial tables.
   */
  offlineMutationFn: () => Promise<TResult>;
  /**
   * Executed ONLY when LAN Server Authoritative Transaction Succeeds.
   * Updates local Dexie read cache from server result without duplicating transactions.
   */
  applyServerResultFn?: (serverResult: any) => Promise<void>;
  /**
   * Backwards compatible legacy alias for offlineMutationFn
   */
  localFallbackFn?: () => Promise<TResult>;
}

export interface MutationExecutionResult<TResult = any> {
  success: boolean;
  result: TResult;
  isOfflineFallback: boolean;
  serverProcessed?: boolean;
}

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
        this.reconcileOfflineOperationQueue();
      } else if (this.currentState === 'ONLINE_LAN' || this.currentState === 'SYNCED') {
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

    if (authSession.isLanAuthenticated()) {
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
          if (authSession.isLanAuthenticated()) {
            realtimeClient.connect();
            this.reconcileMissedEvents();
            this.reconcileOfflineOperationQueue();
          }
        }
        return true;
      } else {
        this.updateState('SERVER_UNAVAILABLE', 'LAN Server reported degraded/error health');
        return false;
      }
    } catch (err) {
      if (this.currentState === 'ONLINE_LAN' || this.currentState === 'SYNCED') {
        this.updateState('SERVER_UNAVAILABLE', 'LAN Server unreachable');
      }
      return false;
    }
  }

  /**
   * Reconcile Missed Events from Server (/api/sync/events)
   */
  public async reconcileMissedEvents() {
    if (this.isReconciling || !authSession.isLanAuthenticated()) return;
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
   * Reconcile Offline Operations Queue by replaying to Server
   */
  public async reconcileOfflineOperationQueue(): Promise<{ synced: number; failed: number }> {
    if (!authSession.isLanAuthenticated() || (this.currentState !== 'ONLINE_LAN' && this.currentState !== 'SYNCED')) {
      return { synced: 0, failed: 0 };
    }

    try {
      if (!db.operationQueue) return { synced: 0, failed: 0 };
      const pendingOps = await db.operationQueue.where('status').equals('PENDING').toArray();
      if (!pendingOps || pendingOps.length === 0) {
        this.pendingQueueCount = 0;
        return { synced: 0, failed: 0 };
      }

      let synced = 0;
      let failed = 0;
      this.updateState('SYNCING', `Replaying ${pendingOps.length} offline operations to server...`);

      for (const op of pendingOps) {
        try {
          await localServerClient.processOperation({
            operationId: op.operationId,
            businessId: op.businessId,
            branchId: op.branchId,
            deviceId: op.deviceId,
            operationType: op.operationType,
            entityType: op.entityType,
            entityId: op.entityId,
            payload: op.payload,
          });

          await db.operationQueue.update(op.id, {
            status: 'SYNCED',
            syncedAt: new Date().toISOString(),
          });
          synced++;
        } catch (err: any) {
          if (err.status === 409) {
            // Idempotency conflict / already handled
            await db.operationQueue.update(op.id, {
              status: 'CONFLICT',
              lastError: err.message,
            });
          } else {
            await db.operationQueue.update(op.id, {
              retryCount: (op.retryCount || 0) + 1,
              lastError: err.message,
            });
          }
          failed++;
        }
      }

      const remainingCount = await db.operationQueue.where('status').equals('PENDING').count();
      this.pendingQueueCount = remainingCount;

      if (remainingCount === 0) {
        this.updateState('SYNCED', 'All offline operations synchronized to server');
      } else {
        this.updateState('SYNC_PENDING', `${remainingCount} operations pending sync`, { pendingCount: remainingCount });
      }

      return { synced, failed };
    } catch (err: any) {
      console.warn('[SyncManager] Error in offline queue reconciliation:', err.message);
      return { synced: 0, failed: 0 };
    }
  }

  /**
   * Process Financial Mutation Operation
   * Enforces strict Source-of-Truth Rules:
   * - LAN Mode: Server commits transaction first -> Result updates Dexie read cache. (Offline mutation is NOT executed!)
   * - Offline Mode: Dexie executes transaction -> Operation logged to operationQueue for future replay.
   */
  public async executeMutation<TResult = any>(params: ExecuteMutationParams<TResult>): Promise<MutationExecutionResult<TResult>> {
    const session = authSession.getSession();
    const isOnlineLan = (this.currentState === 'ONLINE_LAN' || this.currentState === 'SYNCED') && authSession.isLanAuthenticated();
    const operationId = 'op_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const offlineFn = params.offlineMutationFn || params.localFallbackFn;

    // 1. LAN MODE EXECUTION
    if (isOnlineLan && session) {
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

        // Apply server result to local Dexie read cache (DO NOT execute offline transaction!)
        if (params.applyServerResultFn) {
          await params.applyServerResultFn(serverRes.result);
        } else {
          await this.applyServerResultToLocalCache(params.operationType, params.payload, serverRes.result);
        }

        this.updateState('ONLINE_LAN', 'Operation committed to authoritative server');

        return {
          success: true,
          result: serverRes.result as TResult,
          isOfflineFallback: false,
          serverProcessed: true,
        };
      } catch (err: any) {
        console.warn(`[SyncManager] Server operation ${params.operationType} error:`, err.message);

        // Security / Validation Rejections from server must NOT be bypassed
        if (err.status === 409) {
          this.updateState('CONFLICT', err.message || 'Operation conflict on server');
          throw err;
        }

        if (err.status === 401 || err.status === 403 || err.status === 422) {
          throw err;
        }

        // Only on actual network disconnection / server unavailable, fall back to offline mode
        this.updateState('SERVER_UNAVAILABLE', 'Server unavailable. Executing offline local transaction.');
      }
    }

    // 2. OFFLINE MODE EXECUTION
    if (!offlineFn) {
      throw new Error('No offline fallback transaction provided for operation: ' + params.operationType);
    }

    const localResult = await offlineFn();

    // Durable queue recording
    try {
      if (db.operationQueue) {
        const queueRecord: OperationQueueRecord = {
          id: 'opq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          operationId,
          operationType: params.operationType,
          businessId: authSession.getBusinessId(),
          branchId: authSession.getBranchId(),
          deviceId: authSession.getDeviceId(),
          entityType: params.entityType || 'GENERAL',
          entityId: params.entityId || 'N/A',
          payload: params.payload,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          retryCount: 0,
        };
        await db.operationQueue.put(queueRecord);
      }
    } catch (qErr) {
      console.warn('[SyncManager] Error writing to operationQueue:', qErr);
    }

    this.pendingQueueCount++;
    this.updateState('SYNC_PENDING', `Operation completed locally (Offline Mode)`, { pendingCount: this.pendingQueueCount });

    return {
      success: true,
      result: localResult,
      isOfflineFallback: true,
      serverProcessed: false,
    };
  }

  /**
   * Backwards compatible legacy alias
   */
  public async executeFinancialMutation(params: {
    operationType: string;
    entityType?: string;
    entityId?: string;
    payload: Record<string, any>;
    localFallbackFn: () => Promise<any>;
    applyServerResultFn?: (serverResult: any) => Promise<void>;
  }): Promise<MutationExecutionResult> {
    return this.executeMutation({
      operationType: params.operationType,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload,
      offlineMutationFn: params.localFallbackFn,
      applyServerResultFn: params.applyServerResultFn,
    });
  }

  /**
   * Default cache updater for server operation results
   */
  private async applyServerResultToLocalCache(operationType: string, payload: any, result: any) {
    try {
      if (!result) return;
      if (operationType === 'SESSION_START' && result.roomId && result.sessionId) {
        await db.rooms.update(result.roomId, {
          status: 'occupied',
          currentSessionId: result.sessionId,
        });
      } else if (operationType === 'SESSION_END' && result.roomId) {
        await db.rooms.update(result.roomId, {
          status: 'available',
          currentSessionId: undefined,
        });
      } else if (operationType === 'BOOKING_CREATE' && result.booking) {
        await db.bookings.put(result.booking);
      } else if (operationType === 'BOOKING_UPDATE' && result.booking) {
        await db.bookings.put(result.booking);
      } else if (operationType === 'BOOKING_CONFIRM' && (payload.bookingId || result.bookingId)) {
        const id = payload.bookingId || result.bookingId;
        await db.bookings.update(id, {
          status: 'CONFIRMED',
          updatedAt: result.updatedAt || new Date().toISOString(),
        });
      } else if (operationType === 'BOOKING_CANCEL' && (payload.bookingId || result.bookingId)) {
        const id = payload.bookingId || result.bookingId;
        await db.bookings.update(id, {
          status: 'CANCELLED',
          cancellationReason: payload.cancellationReason || payload.reason,
          cancelledAt: result.cancelledAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else if (operationType === 'BOOKING_CHECKIN' && (payload.bookingId || result.bookingId)) {
        const id = payload.bookingId || result.bookingId;
        await db.bookings.update(id, {
          status: result.status || 'CHECKED_IN',
          sessionId: result.sessionId,
          checkedInAt: result.checkedInAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        if (result.sessionId && payload.roomId) {
          await db.rooms.update(payload.roomId, {
            status: 'occupied',
            currentSessionId: result.sessionId,
          });
        }
      } else if (operationType === 'BOOKING_NO_SHOW' && (payload.bookingId || result.bookingId)) {
        const id = payload.bookingId || result.bookingId;
        await db.bookings.update(id, {
          status: 'NO_SHOW',
          updatedAt: result.updatedAt || new Date().toISOString(),
        });
      } else if (operationType === 'BOOKING_COMPLETE' && (payload.bookingId || result.bookingId)) {
        const id = payload.bookingId || result.bookingId;
        await db.bookings.update(id, {
          status: 'COMPLETED',
          sessionId: result.sessionId || payload.sessionId,
          invoiceId: result.invoiceId || payload.invoiceId,
          completedAt: result.completedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      // Ignore cache update errors
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

        case 'SESSION_EXTENDED':
        case 'SESSION_UPDATED': {
          if (payload.session) {
            await db.sessions.put(payload.session);
          } else if (payload.sessionId && payload.newDurationMinutes !== undefined) {
            const sess = await db.sessions.get(payload.sessionId);
            if (sess) {
              await db.sessions.update(payload.sessionId, {
                actualDurationMinutes: payload.newDurationMinutes,
                finalTotalMMK: payload.newTotalFeeMMK ?? sess.finalTotalMMK,
              });
            }
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
          if (payload.sessionId && (payload.endTime || payload.status)) {
            const sess = await db.sessions.get(payload.sessionId);
            if (sess) {
              await db.sessions.update(payload.sessionId, {
                status: payload.status || 'completed',
                endTime: payload.endTime || new Date().toISOString(),
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
              currentSessionId: payload.activeSessionId ?? payload.currentSessionId,
            });
          }
          break;
        }

        case 'SALE_CREATED': {
          if (payload.sale) {
            await db.sales.put(payload.sale);
          }
          break;
        }

        case 'PAYMENT_CREATED':
        case 'INVOICE_UPDATED': {
          if (payload.invoice) {
            await db.invoices.put(payload.invoice);
          } else if (payload.invoiceId && payload.paymentStatus) {
            const inv = await db.invoices.get(payload.invoiceId);
            if (inv) {
              await db.invoices.update(payload.invoiceId, {
                status: payload.paymentStatus,
                paidAmountMMK: payload.paidMMK ?? inv.paidAmountMMK,
                balanceDueMMK: Math.max(0, inv.totalMMK - (payload.paidMMK ?? inv.paidAmountMMK)),
              });
            }
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
          } else if (payload.customerId && payload.outstandingBalanceMMK !== undefined) {
            const cust = await db.customers.get(payload.customerId);
            if (cust) {
              await db.customers.update(payload.customerId, {
                currentBalanceMMK: payload.outstandingBalanceMMK,
              });
            }
          }
          if (payload.customerLedgerEntry) {
            await db.customerLedger.put(payload.customerLedgerEntry);
          }
          if (payload.customerCreditLedger) {
            await db.customerCreditLedger.put(payload.customerCreditLedger);
          }
          break;
        }

        case 'STAFF_ADVANCE_CREATED':
        case 'STAFF_LEDGER_UPDATED': {
          if (payload.staffLedgerEntry) {
            await db.staffLedger.put(payload.staffLedgerEntry);
          }
          break;
        }

        case 'STAFF_SETTLEMENT_CREATED': {
          if (payload.settlement) {
            await db.staffSettlements.put(payload.settlement);
          }
          break;
        }

        case 'STOCK_UPDATED': {
          if (payload.productId && payload.stockQty !== undefined) {
            const prod = await db.products.get(payload.productId);
            if (prod) {
              await db.products.update(payload.productId, {
                stockQty: payload.stockQty,
              });
            }
          }
          break;
        }

        case 'BOOKING_CREATED':
        case 'BOOKING_UPDATED': {
          if (payload.booking) {
            await db.bookings.put(payload.booking);
          }
          break;
        }

        case 'BOOKING_CONFIRMED': {
          if (payload.bookingId) {
            const b = await db.bookings.get(payload.bookingId);
            if (b) {
              await db.bookings.update(payload.bookingId, {
                status: 'CONFIRMED',
                updatedAt: payload.updatedAt || new Date().toISOString(),
              });
            }
          }
          break;
        }

        case 'BOOKING_CANCELLED': {
          if (payload.bookingId) {
            const b = await db.bookings.get(payload.bookingId);
            if (b) {
              await db.bookings.update(payload.bookingId, {
                status: 'CANCELLED',
                cancellationReason: payload.cancellationReason,
                cancelledBy: payload.cancelledBy,
                cancelledAt: payload.cancelledAt,
              });
            }
          }
          break;
        }

        case 'BOOKING_CHECKED_IN': {
          if (payload.bookingId) {
            const b = await db.bookings.get(payload.bookingId);
            if (b) {
              await db.bookings.update(payload.bookingId, {
                status: payload.status || 'CHECKED_IN',
                sessionId: payload.sessionId,
                checkedInAt: payload.checkedInAt,
                checkedInBy: payload.checkedInBy,
              });
            }
          }
          break;
        }

        case 'BOOKING_NO_SHOW': {
          if (payload.bookingId) {
            const b = await db.bookings.get(payload.bookingId);
            if (b) {
              await db.bookings.update(payload.bookingId, {
                status: 'NO_SHOW',
                updatedAt: payload.updatedAt || new Date().toISOString(),
              });
            }
          }
          break;
        }

        case 'BOOKING_COMPLETED': {
          if (payload.bookingId) {
            const b = await db.bookings.get(payload.bookingId);
            if (b) {
              await db.bookings.update(payload.bookingId, {
                status: 'COMPLETED',
                sessionId: payload.sessionId || b.sessionId,
                invoiceId: payload.invoiceId || b.invoiceId,
                completedAt: payload.completedAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
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

        // ==========================================
        // PHASE 27: REALTIME EVENT HANDLERS
        // ==========================================

        case 'MEMBERSHIP_PLAN_CREATED':
        case 'MEMBERSHIP_PLAN_UPDATED': {
          if (payload.planId) {
            await db.membershipPlans.put({
              id: payload.planId,
              businessId: event.businessId || payload.businessId || 'default',
              branchId: event.branchId || payload.branchId || 'main',
              name: payload.name,
              nameMm: payload.nameMm,
              durationDays: payload.durationDays,
              priceMMK: payload.priceMMK,
              discountPercent: payload.discountPercent || 0,
              benefitsSummary: payload.benefitsSummary,
              isActive: payload.isActive !== false,
              createdAt: payload.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          break;
        }

        case 'MEMBERSHIP_PURCHASED': {
          if (payload.membershipId) {
            await db.customerMemberships.put({
              id: payload.membershipId,
              businessId: event.businessId || payload.businessId || 'default',
              branchId: event.branchId || payload.branchId || 'main',
              customerId: payload.customerId,
              customerName: payload.customerName,
              customerPhone: payload.customerPhone,
              planId: payload.planId,
              planName: payload.planName,
              startDate: payload.startDate,
              expiryDate: payload.expiryDate,
              discountPercent: payload.discountPercent || 0,
              paidAmountMMK: payload.priceMMK || payload.paidAmountMMK || 0,
              paymentMethod: payload.paymentMethod || 'cash',
              status: payload.status || 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          break;
        }

        case 'SERVICE_PACKAGE_CREATED':
        case 'SERVICE_PACKAGE_UPDATED': {
          if (payload.packageId) {
            await db.servicePackages.put({
              id: payload.packageId,
              businessId: event.businessId || payload.businessId || 'default',
              branchId: event.branchId || payload.branchId || 'main',
              name: payload.name,
              nameMm: payload.nameMm,
              serviceId: payload.serviceId,
              serviceName: payload.serviceName,
              totalQty: payload.totalQty,
              priceMMK: payload.priceMMK,
              validityDays: payload.validityDays,
              isActive: payload.isActive !== false,
              createdAt: payload.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          break;
        }

        case 'PACKAGE_PURCHASED': {
          if (payload.customerPackageId) {
            await db.customerPackages.put({
              id: payload.customerPackageId,
              businessId: event.businessId || payload.businessId || 'default',
              branchId: event.branchId || payload.branchId || 'main',
              customerId: payload.customerId,
              customerName: payload.customerName || '',
              customerPhone: payload.customerPhone,
              packageId: payload.packageId || '',
              packageName: payload.packageName,
              serviceId: payload.serviceId || '',
              serviceName: payload.serviceName || '',
              purchasedQty: payload.totalQty || payload.purchasedQty,
              usedQty: 0,
              remainingQty: payload.remainingQty ?? payload.totalQty,
              expiryDate: payload.expiryDate,
              purchasePriceMMK: payload.purchasePriceMMK,
              paymentMethod: payload.paymentMethod || 'cash',
              status: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          break;
        }

        case 'PACKAGE_REDEEMED': {
          if (payload.customerPackageId) {
            const pkg = await db.customerPackages.get(payload.customerPackageId);
            if (pkg) {
              await db.customerPackages.update(payload.customerPackageId, {
                remainingQty: payload.remainingQty,
                usedQty: payload.usedQty,
                status: payload.status,
                updatedAt: new Date().toISOString(),
              });
            }
          }
          if (payload.redemptionId) {
            await db.packageRedemptions.put({
              id: payload.redemptionId,
              businessId: event.businessId || payload.businessId || 'default',
              branchId: event.branchId || payload.branchId || 'main',
              customerPackageId: payload.customerPackageId,
              customerId: payload.customerId || '',
              sessionId: payload.sessionId,
              invoiceId: payload.invoiceId,
              serviceId: payload.serviceId || '',
              serviceName: payload.packageName || payload.serviceName || '',
              quantityRedeemed: payload.quantityRedeemed || 1,
              redeemedAt: new Date().toISOString(),
              redeemedBy: payload.redeemedBy || 'Staff',
            });
          }
          break;
        }

        case 'GIFT_CARD_ISSUED': {
          if (payload.giftCardId) {
            await db.giftCards.put({
              id: payload.giftCardId,
              businessId: event.businessId || payload.businessId || 'default',
              branchId: event.branchId || payload.branchId || 'main',
              cardNumber: payload.cardNumber,
              initialAmountMMK: payload.initialAmountMMK,
              currentBalanceMMK: payload.currentBalanceMMK,
              customerId: payload.customerId,
              customerName: payload.customerName,
              issueDate: payload.issueDate || new Date().toISOString().split('T')[0],
              expiryDate: payload.expiryDate,
              issuedBy: payload.issuedBy || 'Staff',
              status: payload.status || 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          break;
        }

        case 'GIFT_CARD_REDEEMED': {
          if (payload.giftCardId) {
            const gc = await db.giftCards.get(payload.giftCardId);
            if (gc) {
              await db.giftCards.update(payload.giftCardId, {
                currentBalanceMMK: payload.balanceAfterMMK,
                status: payload.status,
                updatedAt: new Date().toISOString(),
              });
            }
          }
          if (payload.redemptionId) {
            await db.giftCardRedemptions.put({
              id: payload.redemptionId,
              businessId: event.businessId || payload.businessId || 'default',
              branchId: event.branchId || payload.branchId || 'main',
              giftCardId: payload.giftCardId,
              cardNumber: payload.cardNumber,
              sessionId: payload.sessionId,
              invoiceId: payload.invoiceId,
              amountMMK: payload.amountMMK,
              balanceBeforeMMK: payload.balanceBeforeMMK,
              balanceAfterMMK: payload.balanceAfterMMK,
              redeemedAt: new Date().toISOString(),
              redeemedBy: payload.redeemedBy || 'Staff',
            });
          }
          break;
        }

        case 'TIP_RECORDED': {
          if (payload.tipId) {
            await db.tips.put({
              id: payload.tipId,
              businessId: event.businessId || payload.businessId || 'default',
              branchId: event.branchId || payload.branchId || 'main',
              sessionId: payload.sessionId,
              invoiceId: payload.invoiceId,
              staffId: payload.staffId,
              staffName: payload.staffName,
              amountMMK: payload.amountMMK,
              paymentMethod: payload.paymentMethod || 'cash',
              receivedBy: payload.receivedBy || 'Staff',
              createdAt: new Date().toISOString(),
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

  public getPendingQueueCount(): number {
    return this.pendingQueueCount;
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
