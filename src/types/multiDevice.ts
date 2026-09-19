/**
 * ============================================================================
 * PHASE 20.5 — MULTI-DEVICE & LOCAL SERVER DOMAIN TYPES
 * ============================================================================
 */

import { UserRole } from './index';

export type DeviceRoleType = 'CASHIER' | 'MANAGER' | 'OWNER' | 'FRONT_DESK' | 'STAFF' | 'OTHER';

export type SyncStatus =
  | 'LOCAL_ONLY'
  | 'PENDING_SYNC'
  | 'SYNCING'
  | 'SYNCED'
  | 'SYNC_FAILED'
  | 'CONFLICT'
  | 'REQUIRES_REVIEW';

export type OperationQueueStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SYNCED'
  | 'FAILED'
  | 'CONFLICT'
  | 'REQUIRES_REVIEW';

export interface DeviceProfile {
  deviceId: string;
  deviceName: string;
  deviceRole: DeviceRoleType;
  businessId: string;
  branchId: string;
  appVersion: string;
  databaseVersion: number;
  isRegistered: boolean;
  registeredAt: string;
  lastSeenAt: string;
  createdAt: string;
  serverUrl?: string;
  status?: 'ACTIVE' | 'REVOKED' | 'PENDING_PAIR';
}

export interface OperationQueueRecord {
  operationId: string;
  deviceId: string;
  businessId: string;
  branchId: string;
  entityType: string;
  entityId: string;
  operationType:
    | 'SESSION_START'
    | 'SESSION_COMPLETE'
    | 'PAYMENT'
    | 'EXPENSE'
    | 'CUSTOMER_CREDIT'
    | 'CUSTOMER_PAYMENT'
    | 'STAFF_ADVANCE'
    | 'STAFF_SETTLEMENT'
    | 'CASH_CLOSING'
    | 'CREATE'
    | 'UPDATE'
    | 'CANCEL'
    | 'VOID'
    | 'REVERSE'
    | 'CLOSE'
    | 'REOPEN';
  payload: any;
  createdAt: string;
  attemptCount: number;
  lastAttemptAt?: string;
  status: OperationQueueStatus;
  error?: string;
}

export interface ServerIdempotencyRecord {
  operationId: string;
  deviceId: string;
  businessId: string;
  branchId: string;
  operationType: string;
  entityType: string;
  entityId: string;
  requestHash: string;
  status: 'PROCESSED' | 'FAILED' | 'REJECTED';
  result?: any;
  error?: string;
  createdAt: string;
  processedAt: string;
}

export interface ServerAuditRecord {
  auditId: string;
  businessId: string;
  branchId: string;
  userId: string;
  userName: string;
  deviceId: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  reason?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, any>;
}

export interface PairingCodeRecord {
  code: string;
  businessId: string;
  branchId: string;
  roleAllowed: DeviceRoleType;
  expiresAt: string;
  isUsed: boolean;
  createdBy: string;
}
