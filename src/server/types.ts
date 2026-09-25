/**
 * ============================================================================
 * SERVER ARCHITECTURE & STORAGE TYPES
 * ============================================================================
 */

import { DeviceRoleType, SyncStatus, OperationQueueStatus } from '../types/multiDevice';
import { UserRole } from '../types';

export interface ServerBusinessEntity {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerBranchEntity {
  id: string;
  businessId: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
}

export interface ServerDeviceEntity {
  deviceId: string;
  businessId: string;
  branchId: string;
  deviceName: string;
  deviceRole: DeviceRoleType;
  appVersion: string;
  databaseVersion: number;
  isRegistered: boolean;
  status: 'ACTIVE' | 'REVOKED' | 'PENDING_PAIR';
  registeredAt: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface ServerUserEntity {
  id: string;
  businessId: string;
  branchId: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
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

export interface ServerAuthSession {
  token: string;
  user: ServerUserEntity;
  deviceId: string;
  expiresAt: number;
}
