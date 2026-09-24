/**
 * ============================================================================
 * PHASE 21: LOCAL REAL-TIME EVENT & WEBSOCKET FOUNDATION TYPES
 * ============================================================================
 */

import { UserRole } from '../../types';

export type ServerEventType =
  | 'SESSION_STARTED'
  | 'SESSION_EXTENDED'
  | 'SESSION_UPDATED'
  | 'SESSION_ENDED'
  | 'ROOM_STATUS_CHANGED'
  | 'SALE_CREATED'
  | 'PAYMENT_CREATED'
  | 'INVOICE_UPDATED'
  | 'EXPENSE_CREATED'
  | 'CUSTOMER_CREDIT_CREATED'
  | 'CUSTOMER_PAYMENT_CREATED'
  | 'CUSTOMER_BALANCE_UPDATED'
  | 'STAFF_ADVANCE_CREATED'
  | 'STAFF_LEDGER_UPDATED'
  | 'STAFF_SETTLEMENT_CREATED'
  | 'STAFF_SETTLEMENT_REVERSED'
  | 'STOCK_UPDATED'
  | 'SERVICE_ADDED'
  | 'PRODUCT_ADDED'
  | 'PAYMENT_UPDATED'
  | 'PAYMENT_DUE'
  | 'SESSION_CHECKED_OUT'
  | 'ROOM_AVAILABLE'
  | 'ROOM_TRANSFERRED'
  | 'SESSION_PAUSED'
  | 'SESSION_RESUMED'
  | 'BOOKING_CREATED'
  | 'BOOKING_UPDATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_RESCHEDULED'
  | 'BOOKING_STARTED'
  | 'BOOKING_COMPLETED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_CHECKED_IN'
  | 'BOOKING_NO_SHOW'
  | 'ROOM_AVAILABILITY_CHANGED'
  | 'SETUP_WIZARD_COMPLETED'
  | 'STAFF_AVAILABILITY_CHANGED'
  | 'CASH_CLOSING_CREATED'
  | 'DEVICE_CONNECTED'
  | 'DEVICE_DISCONNECTED'
  | 'MEMBERSHIP_PLAN_CREATED'
  | 'MEMBERSHIP_PLAN_UPDATED'
  | 'MEMBERSHIP_PURCHASED'
  | 'MEMBERSHIP_CANCELLED'
  | 'SERVICE_PACKAGE_CREATED'
  | 'SERVICE_PACKAGE_UPDATED'
  | 'PACKAGE_PURCHASED'
  | 'PACKAGE_REDEEMED'
  | 'PACKAGE_CANCELLED'
  | 'GIFT_CARD_ISSUED'
  | 'GIFT_CARD_REDEEMED'
  | 'GIFT_CARD_VOIDED'
  | 'TIP_RECORDED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_NOTE_CREATED'
  | 'CUSTOMER_NOTE_UPDATED'
  | 'CUSTOMER_NOTE_DELETED'
  | 'STAFF_CLOCK_IN'
  | 'STAFF_CLOCK_OUT'
  | 'SHIFT_OPENED'
  | 'SHIFT_CLOSED'
  | 'SERVICE_CONSUMABLES_DEDUCTED'
  | 'STOCK_MOVEMENT_RECORDED'
  | 'STAFF_PAYROLL_CALCULATED';

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
