/**
 * Auth Session Storage
 * Stores minimal authenticated session token & user info without keeping plaintext passwords/PINs.
 */

export interface AuthSessionUser {
  id: string;
  username: string;
  name: string;
  role: 'owner' | 'manager' | 'cashier' | 'receptionist';
  businessId: string;
  branchId: string;
}

export interface AuthSessionData {
  token: string;
  user: AuthSessionUser;
  deviceId: string;
  expiresAt: string;
}

const SESSION_STORAGE_KEY = 'shwe_auth_session_data';
const DEVICE_ID_KEY = 'shwe_lan_device_id';

export class AuthSessionManager {
  private static instance: AuthSessionManager;

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
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = 'DEV_CLIENT_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }

  /**
   * Save active session
   */
  public setSession(data: AuthSessionData): void {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
      // Also persist device ID
      if (data.deviceId) {
        localStorage.setItem(DEVICE_ID_KEY, data.deviceId);
      }
    } catch (err) {
      console.error('[AuthSession] Error saving session:', err);
    }
  }

  /**
   * Get active session
   */
  public getSession(): AuthSessionData | null {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const data: AuthSessionData = JSON.parse(raw);

      // Expiry check
      if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
        this.clearSession();
        return null;
      }

      return data;
    } catch (err) {
      return null;
    }
  }

  /**
   * Get active token
   */
  public getToken(): string | null {
    const session = this.getSession();
    return session ? session.token : null;
  }

  /**
   * Check if session is authenticated and valid
   */
  public isAuthenticated(): boolean {
    return this.getSession() !== null;
  }

  /**
   * Clear authenticated session (logout)
   */
  public clearSession(): void {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (err) {
      console.error('[AuthSession] Error clearing session:', err);
    }
  }
}

export const authSession = AuthSessionManager.getInstance();
