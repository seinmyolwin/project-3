/**
 * Local Server REST API Client
 * Handles HTTP requests to server endpoints with authentication headers and error handling.
 */

import { authSession } from './authSession';

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  appVersion?: string;
  dbReady: boolean;
  dbPath: string;
  activeSessions: number;
  uptimeSeconds: number;
}

export interface OperationPayload {
  operationId: string;
  deviceId?: string;
  businessId: string;
  branchId: string;
  operationType: 'SESSION_START' | 'SESSION_END' | 'PAYMENT' | 'EXPENSE' | 'CUSTOMER_CREDIT' | 'CASH_CLOSING' | string;
  entityType?: string;
  entityId?: string;
  payload: Record<string, any>;
}

export interface ProcessOperationResponse {
  status: 'PROCESSED' | 'ALREADY_PROCESSED';
  operationId: string;
  result: any;
  replayed?: boolean;
  processedAt: string;
}

export interface SyncEventsResponse {
  success: boolean;
  businessId: string;
  branchId: string;
  sinceSequence: number;
  latestSequence: number;
  count: number;
  events: Array<{
    sequenceNumber: number;
    eventId: string;
    businessId: string;
    branchId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    payload: any;
    createdAt: string;
  }>;
}

export interface SyncStatusResponse {
  success: boolean;
  businessId: string;
  branchId: string;
  latestSequence: number;
  pendingOutboxCount: number;
  serverTime: string;
}

export class LocalServerClient {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = authSession.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.message || data.error || `HTTP ${response.status}`);
        (error as any).status = response.status;
        (error as any).code = data.error;
        (error as any).data = data;
        throw error;
      }

      return data as T;
    } catch (err: any) {
      if (err.status) throw err;
      // Network failure
      const netError = new Error('Server unavailable or network error');
      (netError as any).status = 0;
      (netError as any).code = 'NETWORK_ERROR';
      throw netError;
    }
  }

  /**
   * Health Check (/api/health)
   */
  public async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/api/health');
  }

  /**
   * Login (/api/auth/login)
   */
  public async login(username: string, password: string, deviceId?: string) {
    const devId = deviceId || authSession.getOrCreateDeviceId();
    const res = await this.request<{
      success: boolean;
      token: string;
      user: any;
      expiresAt: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, deviceId: devId }),
    });

    if (res.success && res.token) {
      authSession.setSession({
        token: res.token,
        user: res.user,
        deviceId: devId,
        expiresAt: res.expiresAt,
      });
    }

    return res;
  }

  /**
   * Logout (/api/auth/logout)
   */
  public async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      // Ignore logout network error
    } finally {
      authSession.clearSession();
    }
  }

  /**
   * Get Current User (/api/auth/me)
   */
  public async getMe() {
    return this.request<{ user: any; deviceId: string }>('/api/auth/me');
  }

  /**
   * Device Registration (/api/devices/register)
   */
  public async registerDevice(data: {
    deviceId: string;
    businessId: string;
    branchId: string;
    deviceName?: string;
    deviceRole?: string;
    appVersion?: string;
    databaseVersion?: number;
  }) {
    return this.request('/api/devices/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Device Pairing (/api/devices/pair)
   */
  public async pairDevice(deviceId: string, pairingCode: string, deviceInfo?: any) {
    return this.request('/api/devices/pair', {
      method: 'POST',
      body: JSON.stringify({ deviceId, pairingCode, deviceInfo }),
    });
  }

  /**
   * Generate Pairing Code (/api/devices/pairing-codes)
   */
  public async createPairingCode(roleAllowed = 'CASHIER', expiresInMinutes = 60) {
    return this.request<{ success: boolean; pairingCode: string; expiresInMinutes: number }>('/api/devices/pairing-codes', {
      method: 'POST',
      body: JSON.stringify({ roleAllowed, expiresInMinutes }),
    });
  }

  /**
   * Process Financial Server Operation (/api/operations/process)
   */
  public async processOperation(payload: OperationPayload): Promise<ProcessOperationResponse> {
    return this.request<ProcessOperationResponse>('/api/operations/process', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get Sync Events (/api/sync/events)
   */
  public async getSyncEvents(sinceSequence = 0, branchId?: string): Promise<SyncEventsResponse> {
    const params = new URLSearchParams({ sinceSequence: String(sinceSequence) });
    if (branchId) params.append('branchId', branchId);
    return this.request<SyncEventsResponse>(`/api/sync/events?${params.toString()}`);
  }

  /**
   * Get Sync Status (/api/sync/status)
   */
  public async getSyncStatus(branchId?: string): Promise<SyncStatusResponse> {
    const params = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return this.request<SyncStatusResponse>(`/api/sync/status${params}`);
  }

  /**
   * Realtime Presence (/api/realtime/presence)
   */
  public async getRealtimePresence() {
    return this.request<{ success: boolean; onlineCount: number; clients: any[] }>('/api/realtime/presence');
  }

  /**
   * Reset Room Status (/api/rooms/:roomId/reset)
   */
  public async resetRoomStatus(roomId: string) {
    return this.request<{ success: boolean; message: string }>(`/api/rooms/${roomId}/reset`, {
      method: 'POST',
    });
  }
}

export const localServerClient = new LocalServerClient();
