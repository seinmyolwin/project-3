/**
 * ============================================================================
 * PHASE 21: LOCAL REAL-TIME EVENT & WEBSOCKET FOUNDATION TYPES
 * ============================================================================
 */

import { UserRole } from '../../types';

export type ServerEventType =
  | 'SESSION_STARTED'
  | 'SESSION_UPDATED'
  | 'SESSION_ENDED'
  | 'ROOM_STATUS_CHANGED'
  | 'PAYMENT_CREATED'
  | 'INVOICE_UPDATED'
  | 'EXPENSE_CREATED'
  | 'CUSTOMER_CREDIT_CREATED'
  | 'CUSTOMER_PAYMENT_CREATED'
  | 'CUSTOMER_BALANCE_UPDATED'
  | 'CASH_CLOSING_CREATED'
  | 'DEVICE_CONNECTED'
  | 'DEVICE_DISCONNECTED';

export interface ServerEvent<T = Record<string, any>> {
  eventId: string;
  eventType: ServerEventType;
  businessId: string;
  branchId: string;
  entityType: string;
  entityId: string;
  operationId?: string;
  version: number;
  timestamp: string;
  sequence: number;
  actorDeviceId?: string;
  actorUserId?: string;
  payload: T;
}

export interface OutboxRecord {
  id: string;
  eventId: string;
  businessId: string;
  branchId: string;
  eventType: ServerEventType;
  entityType: string;
  entityId: string;
  operationId?: string;
  sequence: number;
  payload: string;
  actorDeviceId?: string;
  actorUserId?: string;
  createdAt: string;
  publishedAt?: string;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
}

export interface WebSocketClientContext {
  connectionId: string;
  deviceId: string;
  userId: string;
  businessId: string;
  branchId: string;
  role: UserRole;
  connectedAt: string;
  lastPingAt: number;
  isAlive: boolean;
  subscriptions: Set<string>;
}

export interface ClientToServerMessage {
  type: 'AUTHENTICATE' | 'AUTH' | 'SUBSCRIBE' | 'UNSUBSCRIBE' | 'PING' | 'ACK';
  token?: string;
  branchId?: string;
  lastReceivedSequence?: number;
  eventId?: string;
}

export interface ServerToClientMessage {
  type: 'AUTH_SUCCESS' | 'AUTH_ERROR' | 'EVENT' | 'PONG' | 'SYNC_STATUS' | 'ERROR';
  event?: ServerEvent;
  connectionContext?: {
    connectionId: string;
    deviceId: string;
    userId: string;
    businessId: string;
    branchId: string;
    role: UserRole;
  };
  lastSequence?: number;
  message?: string;
  code?: string;
}
