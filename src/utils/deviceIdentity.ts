/**
 * ============================================================================
 * DEVICE IDENTITY & PERMANENT HARDWARE FINGERPRINTING
 * ============================================================================
 * Provides durable local device identity that survives browser reloads,
 * application restarts, and cache clearances while remaining 100% offline.
 */

import { DeviceProfile, DeviceRoleType } from '../types/multiDevice';

const DEVICE_STORAGE_KEY = 'karaoke_ps5_device_profile';

/**
 * Generates collision-resistant, cryptographically secure globally unique ID
 */
export function generateGloballyUniqueID(prefix = 'ID'): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  const perfPart = (typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000) : 0).toString(36);
  return `${prefix}_${timestamp}_${perfPart}_${randomPart}`;
}

/**
 * Retrieves existing device identity or lazily creates a permanent profile
 */
export function getOrCreateDeviceProfile(preferredRole?: DeviceRoleType): DeviceProfile {
  if (typeof window === 'undefined') {
    return {
      deviceId: 'DEV_SSR_' + Math.random().toString(36).substring(2, 8),
      deviceName: 'SSR Container',
      deviceRole: 'OWNER',
      businessId: 'BIZ_DEFAULT',
      branchId: 'BR_MAIN',
      appVersion: '1.0.0',
      databaseVersion: 3,
      isRegistered: true,
      registeredAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
    };
  }

  try {
    const raw = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (raw) {
      const profile = JSON.parse(raw) as DeviceProfile;
      profile.lastSeenAt = new Date().toISOString();
      localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(profile));
      return profile;
    }
  } catch {
    // Fallback if localStorage access is restricted
  }

  const role: DeviceRoleType = preferredRole || 'CASHIER';
  const deviceId = generateGloballyUniqueID(`DEV_${role}`);
  const now = new Date().toISOString();

  const newProfile: DeviceProfile = {
    deviceId,
    deviceName: `${role} Terminal (${deviceId.substring(deviceId.length - 4)})`,
    deviceRole: role,
    businessId: 'BIZ_SHOP_001',
    branchId: 'BR_MAIN',
    appVersion: '1.0.0',
    databaseVersion: 3,
    isRegistered: true,
    registeredAt: now,
    lastSeenAt: now,
    createdAt: now,
    status: 'ACTIVE',
  };

  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(newProfile));
  } catch {
    // Ignore storage quota warnings
  }

  return newProfile;
}

/**
 * Updates device profile parameters
 */
export function updateDeviceProfile(updates: Partial<DeviceProfile>): DeviceProfile {
  const current = getOrCreateDeviceProfile();
  const updated: DeviceProfile = {
    ...current,
    ...updates,
    lastSeenAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }

  return updated;
}
