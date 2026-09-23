/**
 * ============================================================================
 * PHASE 31: BOOKING & APPOINTMENT SERVICE MANAGER
 * Handles offline-first booking operations, double booking conflict prevention,
 * active session conflict validation, finite-state transitions, and LAN sync.
 * ============================================================================
 */

import { db } from '../db/database';
import { BookingRecord, BookingStatus } from '../types';
import { syncManager } from './syncManager';
import {
  isTimeOverlapping,
  calculateEndTime,
  validateBookingStateTransition,
  calculateBookingPricing,
} from '../domain/booking';

export interface BookingConflictResult {
  hasConflict: boolean;
  reason?: string;
  conflictingBooking?: BookingRecord;
  conflictingSessionId?: string;
}

export class BookingManager {
  /**
   * Helper to check overlap between two time windows (HH:mm strings)
   */
  public isTimeOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
    return isTimeOverlapping(startA, endA, startB, endB);
  }

  /**
   * Check double-booking conflicts locally in Dexie database
   * Checks both scheduled bookings AND active running sessions.
   */
  public async checkConflict(params: {
    date: string;
    startTime: string;
    endTime: string;
    roomId?: string;
    staffId?: string;
    excludeBookingId?: string;
  }): Promise<BookingConflictResult> {
    // 1. Check against active scheduled bookings
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

    // 2. Check against active running sessions (for today)
    const todayStr = new Date().toISOString().split('T')[0];
    if (params.date === todayStr && (params.roomId || params.staffId)) {
      const activeSessions = await db.sessions
        .filter((s) => s.status === 'active' || s.status === 'started' || s.status === 'extended')
        .toArray();

      for (const s of activeSessions) {
        let sessStartHHMM = '00:00';
        if (s.startTime.includes('T')) {
          sessStartHHMM = s.startTime.split('T')[1].slice(0, 5);
        } else if (s.startTime.includes(':')) {
          sessStartHHMM = s.startTime.slice(0, 5);
        }

        const sessEndHHMM = calculateEndTime(sessStartHHMM, s.plannedDurationMinutes || s.actualDurationMinutes || 60);

        if (this.isTimeOverlapping(sessStartHHMM, sessEndHHMM, params.startTime, params.endTime)) {
          if (params.roomId && s.roomId === params.roomId) {
            return {
              hasConflict: true,
              reason: `အခန်း (${s.roomName || params.roomId}) သည် လက်ရှိတွင် ဝန်ဆောင်မှုပေးနေဆဲဖြစ်ပါသည် (${sessStartHHMM}-${sessEndHHMM})`,
              conflictingSessionId: s.id,
            };
          }

          if (params.staffId && s.assignedStaff) {
            const isStaffBusy = s.assignedStaff.some((st) => st.staffId === params.staffId);
            if (isStaffBusy) {
              return {
                hasConflict: true,
                reason: `ဝန်ထမ်းသည် လက်ရှိ Session တွင် တာဝန်ထမ်းဆောင်နေဆဲဖြစ်ပါသည်`,
                conflictingSessionId: s.id,
              };
            }
          }
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
    price?: number;
    discount?: number;
    finalAmount?: number;
    status?: BookingStatus;
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

    const pricing = calculateBookingPricing(params.price || 0, params.discount || 0);
    const initialStatus: BookingStatus = params.status || 'CONFIRMED';

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
      price: pricing.price,
      discount: pricing.discount,
      finalAmount: params.finalAmount !== undefined ? params.finalAmount : pricing.finalAmount,
      status: initialStatus,
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
      applyServerResultFn: async (result) => {
        const authoritativeBooking = result?.booking || bookingRecord;
        await db.bookings.put(authoritativeBooking);
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
    price?: number;
    discount?: number;
    finalAmount?: number;
    notes?: string;
    status?: BookingStatus;
    updatedBy: string;
  }): Promise<{ success: boolean; booking?: BookingRecord; error?: string }> {
    const existing = await db.bookings.get(params.bookingId);
    if (!existing) {
      return { success: false, error: 'Booking not found' };
    }

    // Validate state transition if status is being changed
    if (params.status && params.status !== existing.status) {
      const transitionValidation = validateBookingStateTransition(existing.status, params.status);
      if (!transitionValidation.valid) {
        return { success: false, error: transitionValidation.error };
      }
    }

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
    const updatedPrice = params.price !== undefined ? params.price : existing.price;
    const updatedDiscount = params.discount !== undefined ? params.discount : existing.discount;
    const pricing = calculateBookingPricing(updatedPrice || 0, updatedDiscount || 0);

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
      price: pricing.price,
      discount: pricing.discount,
      finalAmount: params.finalAmount !== undefined ? params.finalAmount : pricing.finalAmount,
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
      applyServerResultFn: async (result) => {
        const authoritativeBooking = result?.booking || updatedBooking;
        await db.bookings.put(authoritativeBooking);
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
   * Reschedule booking to new date/time or resource
   */
  public async rescheduleBooking(params: {
    bookingId: string;
    newDate: string;
    newStartTime: string;
    newEndTime: string;
    newDurationMinutes?: number;
    newRoomId?: string;
    newRoomName?: string;
    newStaffId?: string;
    newStaffName?: string;
    updatedBy: string;
  }): Promise<{ success: boolean; booking?: BookingRecord; error?: string }> {
    const existing = await db.bookings.get(params.bookingId);
    if (!existing) return { success: false, error: 'Booking not found' };

    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(existing.status)) {
      return { success: false, error: `ပြီးဆုံး သို့မဟုတ် ပယ်ဖျက်ထားသော ဘိုကင်အား အချိန်ပြောင်းခွင့်မပြုပါ` };
    }

    const duration = params.newDurationMinutes || existing.durationMinutes;
    return this.updateBooking({
      bookingId: params.bookingId,
      date: params.newDate,
      startTime: params.newStartTime,
      endTime: params.newEndTime,
      durationMinutes: duration,
      roomId: params.newRoomId ?? existing.roomId,
      roomName: params.newRoomName ?? existing.roomName,
      staffId: params.newStaffId ?? existing.staffId,
      staffName: params.newStaffName ?? existing.staffName,
      updatedBy: params.updatedBy,
    });
  }

  /**
   * Confirm a pending booking
   */
  public async confirmBooking(bookingId: string, confirmedBy: string): Promise<{ success: boolean; error?: string }> {
    const existing = await db.bookings.get(bookingId);
    if (!existing) return { success: false, error: 'Booking not found' };

    const validation = validateBookingStateTransition(existing.status, 'CONFIRMED');
    if (!validation.valid) return { success: false, error: validation.error };

    const now = new Date().toISOString();
    const updated: BookingRecord = {
      ...existing,
      status: 'CONFIRMED',
      updatedAt: now,
    };

    await syncManager.executeMutation({
      operationType: 'BOOKING_CONFIRM',
      entityType: 'BOOKING',
      entityId: bookingId,
      payload: { bookingId },
      applyServerResultFn: async (result) => {
        await db.bookings.update(bookingId, {
          status: 'CONFIRMED',
          updatedAt: result?.updatedAt || new Date().toISOString(),
        });
      },
      offlineMutationFn: async () => {
        await db.bookings.put(updated);
        return { bookingId, status: 'CONFIRMED' };
      },
    });

    return { success: true };
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

    const validation = validateBookingStateTransition(existing.status, 'CANCELLED');
    if (!validation.valid) return { success: false, error: validation.error };

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
      applyServerResultFn: async (result) => {
        await db.bookings.update(params.bookingId, {
          status: 'CANCELLED',
          cancellationReason: params.reason || 'Customer cancelled',
          cancelledBy: params.cancelledBy,
          cancelledAt: result?.cancelledAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      },
      offlineMutationFn: async () => {
        await db.bookings.put(updated);
        return { bookingId: params.bookingId, status: 'CANCELLED' };
      },
    });

    return { success: true };
  }

  /**
   * Mark booking as NO-SHOW
   */
  public async markNoShow(bookingId: string, updatedBy: string): Promise<{ success: boolean; error?: string }> {
    const existing = await db.bookings.get(bookingId);
    if (!existing) return { success: false, error: 'Booking not found' };

    const validation = validateBookingStateTransition(existing.status, 'NO_SHOW');
    if (!validation.valid) return { success: false, error: validation.error };

    const now = new Date().toISOString();
    const updated: BookingRecord = {
      ...existing,
      status: 'NO_SHOW',
      updatedAt: now,
    };

    await syncManager.executeMutation({
      operationType: 'BOOKING_NO_SHOW',
      entityType: 'BOOKING',
      entityId: bookingId,
      payload: { bookingId },
      applyServerResultFn: async (result) => {
        await db.bookings.update(bookingId, {
          status: 'NO_SHOW',
          updatedAt: result?.updatedAt || new Date().toISOString(),
        });
      },
      offlineMutationFn: async () => {
        await db.bookings.put(updated);
        return { bookingId, status: 'NO_SHOW' };
      },
    });

    return { success: true };
  }

  /**
   * Complete booking (marks finished, records completion timestamp and invoice)
   */
  public async completeBooking(params: {
    bookingId: string;
    sessionId?: string;
    invoiceId?: string;
    completedBy: string;
  }): Promise<{ success: boolean; error?: string }> {
    const existing = await db.bookings.get(params.bookingId);
    if (!existing) return { success: false, error: 'Booking not found' };

    const validation = validateBookingStateTransition(existing.status, 'COMPLETED');
    if (!validation.valid) return { success: false, error: validation.error };

    const now = new Date().toISOString();
    const updated: BookingRecord = {
      ...existing,
      status: 'COMPLETED',
      sessionId: params.sessionId || existing.sessionId,
      invoiceId: params.invoiceId || existing.invoiceId,
      completedAt: now,
      updatedAt: now,
    };

    await syncManager.executeMutation({
      operationType: 'BOOKING_COMPLETE',
      entityType: 'BOOKING',
      entityId: params.bookingId,
      payload: {
        bookingId: params.bookingId,
        sessionId: params.sessionId,
        invoiceId: params.invoiceId,
      },
      applyServerResultFn: async (result) => {
        await db.bookings.update(params.bookingId, {
          status: 'COMPLETED',
          sessionId: result?.sessionId || params.sessionId || existing.sessionId,
          invoiceId: result?.invoiceId || params.invoiceId || existing.invoiceId,
          completedAt: result?.completedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      },
      offlineMutationFn: async () => {
        await db.bookings.put(updated);
        return { bookingId: params.bookingId, status: 'COMPLETED' };
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

    const validation = validateBookingStateTransition(existing.status, 'CHECKED_IN');
    if (!validation.valid && existing.status !== 'CHECKED_IN') {
      return { success: false, error: validation.error };
    }

    const now = new Date().toISOString();
    let createdSessionId: string | undefined;

    // Check if active session already exists for this booking to prevent duplicates
    if (existing.sessionId) {
      const activeSess = await db.sessions.get(existing.sessionId);
      if (activeSess && (activeSess.status === 'active' || activeSess.status === 'started' || activeSess.status === 'extended')) {
        createdSessionId = existing.sessionId;
      }
    }

    if (!createdSessionId) {
      const activeSessByBkg = await db.sessions.filter(s => s.bookingId === params.bookingId && (s.status === 'active' || s.status === 'started' || s.status === 'extended')).first();
      if (activeSessByBkg) {
        createdSessionId = activeSessByBkg.id;
      }
    }

    const opResult = await syncManager.executeMutation({
      operationType: 'BOOKING_CHECKIN',
      entityType: 'BOOKING',
      entityId: params.bookingId,
      payload: {
        bookingId: params.bookingId,
        startSession: params.startSession,
        hourlyRateMMK: params.hourlyRateMMK,
      },
      applyServerResultFn: async (result) => {
        if (!result) return;
        const b = await db.bookings.get(params.bookingId);
        if (b) {
          await db.bookings.update(params.bookingId, {
            status: result.status || 'CHECKED_IN',
            sessionId: result.sessionId || b.sessionId,
            checkedInAt: result.checkedInAt || now,
            checkedInBy: params.checkedInBy,
            updatedAt: now,
          });
        }
        if (result.sessionId && existing.roomId) {
          await db.rooms.update(existing.roomId, {
            status: 'occupied',
            currentSessionId: result.sessionId,
          });
        }
      },
      offlineMutationFn: async () => {
        let newStatus: BookingStatus = 'CHECKED_IN';

        if (params.startSession && existing.roomId && !createdSessionId) {
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
            basePriceMMK: params.hourlyRateMMK || existing.finalAmount || existing.price || 0,
            roomSurchargeMMK: 0,
            plannedDurationMinutes: existing.durationMinutes,
            actualDurationMinutes: existing.durationMinutes,
            startTime: now,
            status: 'active',
            bookingId: existing.id,
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
        } else if (createdSessionId) {
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
