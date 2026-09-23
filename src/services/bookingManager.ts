/**
 * ============================================================================
 * PHASE 25: BOOKING & APPOINTMENT SERVICE MANAGER
 * Handles offline-first booking operations, double booking conflict prevention,
 * tablet-friendly scheduling, and LAN synchronization via SyncManager.
 * ============================================================================
 */

import { db } from '../db/database';
import { BookingRecord, BookingStatus } from '../types';
import { syncManager } from './syncManager';

export interface BookingConflictResult {
  hasConflict: boolean;
  reason?: string;
  conflictingBooking?: BookingRecord;
}

export class BookingManager {
  /**
   * Helper to check overlap between two time windows (HH:mm strings or timestamps)
   */
  public isTimeOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
    return startA < endB && endA > startB;
  }

  /**
   * Check double-booking conflicts locally in Dexie database
   */
  public async checkConflict(params: {
    date: string;
    startTime: string;
    endTime: string;
    roomId?: string;
    staffId?: string;
    excludeBookingId?: string;
  }): Promise<BookingConflictResult> {
    const activeBookings = await db.bookings
      .where('date')
      .equals(params.date)
      .filter((b) => ['CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'PENDING'].includes(b.status))
      .toArray();

    for (const b of activeBookings) {
      if (params.excludeBookingId && b.id === params.excludeBookingId) {
        continue;
      }

      if (this.isTimeOverlapping(b.startTime, b.endTime, params.startTime, params.endTime)) {
        if (params.roomId && b.roomId === params.roomId) {
          return {
            hasConflict: true,
            reason: `အခန်း (${b.roomName || params.roomId}) သည် ${b.startTime} မှ ${b.endTime} ထိ ကြိုတင်စာရင်းသွင်းထားပြီးဖြစ်ပါသည်`,
            conflictingBooking: b,
          };
        }

        if (params.staffId && b.staffId === params.staffId) {
          return {
            hasConflict: true,
            reason: `ဝန်ထမ်း (${b.staffName || params.staffId}) သည် ${b.startTime} မှ ${b.endTime} ထိ အခြားဝန်ဆောင်မှုအတွက် တာဝန်ရှိနေပါသည်`,
            conflictingBooking: b,
          };
        }
      }
    }

    return { hasConflict: false };
  }

  /**
   * Create a new booking
   */
  public async createBooking(params: {
    customerId?: string;
    customerName: string;
    customerPhone?: string;
    serviceId?: string;
    serviceName?: string;
    roomId?: string;
    roomName?: string;
    staffId?: string;
    staffName?: string;
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    notes?: string;
    depositAmountMMK?: number;
    depositPaymentMethod?: string;
    businessId?: string;
    branchId?: string;
    createdBy: string;
  }): Promise<{ success: boolean; booking?: BookingRecord; error?: string }> {
    const conflict = await this.checkConflict({
      date: params.date,
      startTime: params.startTime,
      endTime: params.endTime,
      roomId: params.roomId,
      staffId: params.staffId,
    });

    if (conflict.hasConflict) {
      return { success: false, error: conflict.reason };
    }

    const bookingId = `bkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const bookingCode = `BKG-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    const bookingRecord: BookingRecord = {
      id: bookingId,
      bookingCode,
      businessId: params.businessId || 'BIZ_SHOP_001',
      branchId: params.branchId || 'BR_MAIN',
      customerId: params.customerId,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      serviceId: params.serviceId,
      serviceName: params.serviceName,
      roomId: params.roomId,
      roomName: params.roomName,
      staffId: params.staffId,
      staffName: params.staffName,
      date: params.date,
      startTime: params.startTime,
      endTime: params.endTime,
      durationMinutes: params.durationMinutes,
      status: 'CONFIRMED',
      notes: params.notes,
      depositAmountMMK: params.depositAmountMMK || 0,
      depositPaymentMethod: params.depositPaymentMethod,
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    const opResult = await syncManager.executeMutation({
      operationType: 'BOOKING_CREATE',
      entityType: 'BOOKING',
      entityId: bookingId,
      payload: {
        ...bookingRecord,
        bookingId,
      },
      offlineMutationFn: async () => {
        await db.bookings.put(bookingRecord);
        return { booking: bookingRecord };
      },
    });

    return {
      success: true,
      booking: opResult.result?.booking || bookingRecord,
    };
  }

  /**
   * Update an existing booking
   */
  public async updateBooking(params: {
    bookingId: string;
    customerName?: string;
    customerPhone?: string;
    serviceId?: string;
    serviceName?: string;
    roomId?: string;
    roomName?: string;
    staffId?: string;
    staffName?: string;
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    notes?: string;
    status?: BookingStatus;
    updatedBy: string;
  }): Promise<{ success: boolean; booking?: BookingRecord; error?: string }> {
    const conflict = await this.checkConflict({
      date: params.date,
      startTime: params.startTime,
      endTime: params.endTime,
      roomId: params.roomId,
      staffId: params.staffId,
      excludeBookingId: params.bookingId,
    });

    if (conflict.hasConflict) {
      return { success: false, error: conflict.reason };
    }

    const now = new Date().toISOString();
    const existing = await db.bookings.get(params.bookingId);
    if (!existing) {
      return { success: false, error: 'Booking not found' };
    }

    const updatedBooking: BookingRecord = {
      ...existing,
      customerName: params.customerName ?? existing.customerName,
      customerPhone: params.customerPhone ?? existing.customerPhone,
      serviceId: params.serviceId ?? existing.serviceId,
      serviceName: params.serviceName ?? existing.serviceName,
      roomId: params.roomId ?? existing.roomId,
      roomName: params.roomName ?? existing.roomName,
      staffId: params.staffId ?? existing.staffId,
      staffName: params.staffName ?? existing.staffName,
      date: params.date,
      startTime: params.startTime,
      endTime: params.endTime,
      durationMinutes: params.durationMinutes,
      status: params.status ?? existing.status,
      notes: params.notes ?? existing.notes,
      updatedAt: now,
    };

    const opResult = await syncManager.executeMutation({
      operationType: 'BOOKING_UPDATE',
      entityType: 'BOOKING',
      entityId: params.bookingId,
      payload: {
        ...params,
      },
      offlineMutationFn: async () => {
        await db.bookings.put(updatedBooking);
        return { booking: updatedBooking };
      },
    });

    return {
      success: true,
      booking: opResult.result?.booking || updatedBooking,
    };
  }

  /**
   * Cancel booking
   */
  public async cancelBooking(params: {
    bookingId: string;
    reason?: string;
    cancelledBy: string;
  }): Promise<{ success: boolean; error?: string }> {
    const existing = await db.bookings.get(params.bookingId);
    if (!existing) return { success: false, error: 'Booking not found' };

    const now = new Date().toISOString();
    const updated: BookingRecord = {
      ...existing,
      status: 'CANCELLED',
      cancellationReason: params.reason || 'Customer cancelled',
      cancelledBy: params.cancelledBy,
      cancelledAt: now,
      updatedAt: now,
    };

    await syncManager.executeMutation({
      operationType: 'BOOKING_CANCEL',
      entityType: 'BOOKING',
      entityId: params.bookingId,
      payload: {
        bookingId: params.bookingId,
        cancellationReason: params.reason,
      },
      offlineMutationFn: async () => {
        await db.bookings.put(updated);
        return { bookingId: params.bookingId, status: 'CANCELLED' };
      },
    });

    return { success: true };
  }

  /**
   * Check-in booking and optionally start session
   */
  public async checkInBooking(params: {
    bookingId: string;
    startSession?: boolean;
    hourlyRateMMK?: number;
    checkedInBy: string;
  }): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    const existing = await db.bookings.get(params.bookingId);
    if (!existing) return { success: false, error: 'Booking not found' };

    const now = new Date().toISOString();
    let createdSessionId: string | undefined;

    const opResult = await syncManager.executeMutation({
      operationType: 'BOOKING_CHECKIN',
      entityType: 'BOOKING',
      entityId: params.bookingId,
      payload: {
        bookingId: params.bookingId,
        startSession: params.startSession,
        hourlyRateMMK: params.hourlyRateMMK,
      },
      offlineMutationFn: async () => {
        let newStatus: BookingStatus = 'CHECKED_IN';

        if (params.startSession && existing.roomId) {
          createdSessionId = `sess_${Date.now()}`;
          const sessionCode = `SES-${Date.now().toString().slice(-6)}`;

          // Create session in Dexie
          await db.sessions.put({
            id: createdSessionId,
            sessionCode,
            roomId: existing.roomId,
            roomName: existing.roomName || 'Room',
            customerId: existing.customerId,
            customerName: existing.customerName,
            customerPhone: existing.customerPhone,
            serviceId: existing.serviceId || 'srv_default',
            serviceName: existing.serviceName || 'Standard Service',
            basePriceMMK: params.hourlyRateMMK || 0,
            roomSurchargeMMK: 0,
            plannedDurationMinutes: existing.durationMinutes,
            actualDurationMinutes: existing.durationMinutes,
            startTime: now,
            status: 'active',
            assignedStaff: existing.staffId ? [{
              staffId: existing.staffId,
              staffName: existing.staffName || '',
              staffRole: 'therapist',
              commissionType: 'percentage',
              commissionRate: 0,
              commissionAmountMMK: 0,
            }] : [],
            orderItems: [],
            createdAt: now,
            updatedAt: now,
          });

          // Update room to occupied
          await db.rooms.update(existing.roomId, {
            status: 'occupied',
            currentSessionId: createdSessionId,
          });

          newStatus = 'IN_SERVICE';
        }

        const updated: BookingRecord = {
          ...existing,
          status: newStatus,
          sessionId: createdSessionId || existing.sessionId,
          checkedInAt: now,
          checkedInBy: params.checkedInBy,
          updatedAt: now,
        };

        await db.bookings.put(updated);

        return {
          bookingId: params.bookingId,
          status: newStatus,
          sessionId: createdSessionId,
        };
      },
    });

    return {
      success: true,
      sessionId: opResult.result?.sessionId || createdSessionId,
    };
  }
}

export const bookingManager = new BookingManager();
