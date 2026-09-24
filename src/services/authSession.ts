/**
 * Auth Session Storage
 * Stores minimal authenticated session token & user info without keeping plaintext passwords/PINs.
 */

/**
 * Auth Session Storage
 * Stores minimal authenticated session token & user info without keeping plaintext passwords/PINs.
 * Distinguishes between authoritative LAN sessions and safe OFFLINE local sessions.
 */

import { UserAccount, UserRole } from '../types';

export interface AuthSessionUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  businessId: string;
  branchId: string;
}

export type AuthMode = 'LAN_AUTHENTICATED' | 'OFFLINE_LOCAL' | 'ANONYMOUS';

export interface AuthSessionData {
  mode: AuthMode;
  token?: string;
  user: AuthSessionUser;
  deviceId: string;
  expiresAt?: string;
}

const SESSION_STORAGE_KEY = 'shwe_auth_session_data';
const DEVICE_ID_KEY = 'shwe_lan_device_id';

export class AuthSessionManager {
  private static instance: AuthSessionManager;
  private memorySession: AuthSessionData | null = null;
  private memoryDeviceId: string | null = null;

  private constructor() {}

  public static getInstance(): AuthSessionManager {
    if (!AuthSessionManager.instance) {
      AuthSessionManager.instance = new AuthSessionManager();
    }
    return AuthSessionManager.instance;
  }

  /**
   * Get persistent device ID or generate a unique client device ID
   */
  public getOrCreateDeviceId(): string {
    try {
      if (typeof localStorage !== 'undefined') {
        let deviceId = localStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) {
          deviceId = 'DEV_CLIENT_' + Math.random().toString(36).substring(2, 10).toUpperCase();
          localStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
        return deviceId;
      }
    } catch {
      // Ignore storage access error
    }

    if (!this.memoryDeviceId) {
      this.memoryDeviceId = 'DEV_CLIENT_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    }
    return this.memoryDeviceId;
  }

  /**
   * Save active LAN authenticated session
   */
  public setLanSession(params: {
    token: string;
    user: {
      id: string;
      username?: string;
      name: string;
      role: UserRole;
      businessId?: string;
      branchId?: string;
    };
    deviceId?: string;
    expiresAt?: string;
  }): void {
    const deviceId = params.deviceId || this.getOrCreateDeviceId();
    const data: AuthSessionData = {
      mode: 'LAN_AUTHENTICATED',
      token: params.token,
      deviceId,
      expiresAt: params.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      user: {
        id: params.user.id,
        username: params.user.username || params.user.id,
        name: params.user.name,
        role: params.user.role,
        businessId: params.user.businessId || 'BIZ_SHOP_001',
        branchId: params.user.branchId || 'BR_MAIN',
      },
    };
    this.saveToStorage(data);
  }

  /**
   * Helper alias for getSession()
   */
  public getLanSession(): AuthSessionData | null {
    return this.getSession();
  }

  /**
   * Helper alias for saving LAN session
   */
  public saveLanSession(token: string, user: UserAccount, ttlMs = 24 * 60 * 60 * 1000): void {
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    this.setLanSession({
      token,
      user,
      expiresAt,
    });
  }

  /**
   * Save active Offline Local session
   */
  public setOfflineSession(user: UserAccount, deviceId?: string): void {
    const devId = deviceId || this.getOrCreateDeviceId();
    const data: AuthSessionData = {
      mode: 'OFFLINE_LOCAL',
      deviceId: devId,
      user: {
        id: user.id,
        username: user.username || user.id,
        name: user.name,
        role: user.role,
        businessId: 'BIZ_SHOP_001',
        branchId: 'BR_MAIN',
      },
    };
    this.saveToStorage(data);
  }

  private saveToStorage(data: AuthSessionData): void {
    this.memorySession = data;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
      }
      if (data.deviceId && typeof localStorage !== 'undefined') {
        localStorage.setItem(DEVICE_ID_KEY, data.deviceId);
      }
    } catch {
      // Memory fallback active
    }
  }

  /**
   * Get active session
   */
  public getSession(): AuthSessionData | null {
    let data: AuthSessionData | null = this.memorySession;
    try {
      if (typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (raw) {
          data = JSON.parse(raw);
        }
      }
    } catch {
      data = this.memorySession;
    }

    if (!data) return null;

    // Expiry check for LAN session tokens
    if (data.mode === 'LAN_AUTHENTICATED' && data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
      this.clearSession();
      return null;
    }

    return data;
  }

  /**
   * Get active token (only present in LAN_AUTHENTICATED mode)
   */
  public getToken(): string | null {
    const session = this.getSession();
    return session && session.mode === 'LAN_AUTHENTICATED' ? (session.token || null) : null;
  }

  public getAuthMode(): AuthMode {
    const session = this.getSession();
    return session ? session.mode : 'ANONYMOUS';
  }

  public isLanAuthenticated(): boolean {
    const session = this.getSession();
    return Boolean(session && session.mode === 'LAN_AUTHENTICATED' && session.token);
  }

  public isOfflineMode(): boolean {
    const session = this.getSession();
    return Boolean(session && session.mode === 'OFFLINE_LOCAL');
  }

  public isAuthenticated(): boolean {
    return this.getSession() !== null;
  }

  public getBusinessId(): string {
    const session = this.getSession();
    return session?.user?.businessId || 'BIZ_SHOP_001';
  }

  public getBranchId(): string {
    const session = this.getSession();
    return session?.user?.branchId || 'BR_MAIN';
  }

  public getDeviceId(): string {
    const session = this.getSession();
    return session?.deviceId || this.getOrCreateDeviceId();
  }

  public getUser(): AuthSessionUser | null {
    const session = this.getSession();
    return session ? session.user : null;
  }

  public getIsServerConnected(): boolean {
    return this.getSession() !== null || this.getToken() !== null;
  }

  /**
   * Clear authenticated session (logout)
   */
  public clearSession(): void {
    this.memorySession = null;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage access errors in headless/node environments
    }
  }
}

export const authSession = AuthSessionManager.getInstance();

