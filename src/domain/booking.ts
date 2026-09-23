/**
 * ============================================================================
 * PHASE 31: BOOKING, APPOINTMENT & RESOURCE SCHEDULING DOMAIN LOGIC
 * Pure business functions for conflict validation, state transitions,
 * duration/time calculations, and pricing rules.
 * ============================================================================
 */

import { BookingRecord, BookingStatus } from '../types';

export interface BookingConflictCheckParams {
  date: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  roomId?: string;
  roomName?: string;
  staffId?: string;
  staffName?: string;
  excludeBookingId?: string;
}

export interface BookingConflictResult {
  hasConflict: boolean;
  reason?: string;
  conflictingBooking?: BookingRecord;
  conflictingSessionId?: string;
}

/**
 * Check whether two time intervals overlap (open interval comparison)
 * E.g., 10:00-11:00 does NOT overlap with 11:00-12:00, but DOES overlap with 10:30-11:30
 */
export function isTimeOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB;
}

/**
 * Calculate end time string (HH:mm) given start time and duration in minutes
 */
export function calculateEndTime(startTime: string, durationMinutes: number): string {
  if (!startTime || !startTime.includes(':')) return '11:00';
  const [h, m] = startTime.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '11:00';
  const totalMinutes = h * 60 + m + (durationMinutes > 0 ? durationMinutes : 60);
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

/**
 * Strict Finite-State Machine for Booking Lifecycle
 * 
 * PENDING    -> CONFIRMED, CANCELLED, NO_SHOW
 * CONFIRMED  -> CHECKED_IN, IN_SERVICE, CANCELLED, NO_SHOW
 * CHECKED_IN -> IN_SERVICE, CANCELLED, NO_SHOW, COMPLETED
 * IN_SERVICE -> COMPLETED, CANCELLED
 * COMPLETED  -> Terminal (No transitions allowed)
 * CANCELLED  -> Terminal (No transitions allowed)
 * NO_SHOW    -> Terminal (No transitions allowed)
 */
export const ALLOWED_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['CHECKED_IN', 'IN_SERVICE', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['IN_SERVICE', 'CANCELLED', 'NO_SHOW', 'COMPLETED'],
  IN_SERVICE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/**
 * Validate state transition
 */
export function isValidBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return true;
  const allowed = ALLOWED_BOOKING_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/**
 * Validate booking state transition with human-readable error
 */
export function validateBookingStateTransition(
  currentStatus: BookingStatus,
  targetStatus: BookingStatus
): { valid: boolean; error?: string } {
  if (currentStatus === targetStatus) {
    return { valid: true };
  }

  if (isValidBookingTransition(currentStatus, targetStatus)) {
    return { valid: true };
  }

  const errorMessages: Record<string, string> = {
    'CANCELLED->CHECKED_IN': 'ပယ်ဖျက်ပြီးသော ဘိုကင်အား Check-in ဝင်ခွင့်မပြုပါ (Cancelled booking cannot be checked in)',
    'COMPLETED->IN_SERVICE': 'ပြီးဆုံးပြီးသော ဘိုကင်အား ဝန်ဆောင်မှု ပြန်ဖွင့်ခွင့်မပြုပါ (Completed booking cannot be restarted)',
    'NO_SHOW->CHECKED_IN': 'မလာရောက်ကြောင်း သတ်မှတ်ပြီးသော ဘိုကင်အား Check-in မပြုနိုင်ပါ (No-show booking cannot be checked in)',
  };

  const key = `${currentStatus}->${targetStatus}`;
  const customMsg = errorMessages[key];
  return {
    valid: false,
    error: customMsg || `Invalid booking state transition from ${currentStatus} to ${targetStatus}`,
  };
}

/**
 * Pure conflict detection against an existing list of bookings and running sessions
 */
export function checkResourceConflictsPure(
  params: BookingConflictCheckParams,
  existingBookings: BookingRecord[],
  activeSessions?: Array<{
    id: string;
    roomId: string;
    roomName?: string;
    startTime: string; // ISO or HH:mm
    durationMinutes: number;
    assignedStaff?: Array<{ staffId: string; staffName?: string }>;
  }>
): BookingConflictResult {
  // 1. Check against active/scheduled bookings
  for (const b of existingBookings) {
    if (params.excludeBookingId && b.id === params.excludeBookingId) continue;
    if (b.date !== params.date) continue;
    if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(b.status)) continue;

    if (isTimeOverlapping(b.startTime, b.endTime, params.startTime, params.endTime)) {
      if (params.roomId && b.roomId === params.roomId) {
        return {
          hasConflict: true,
          reason: `အခန်း (${b.roomName || params.roomId}) သည် ${b.startTime} မှ ${b.endTime} ထိ အခြားဘိုကင် ရှိနေပါသည် (Room already booked)`,
          conflictingBooking: b,
        };
      }

      if (params.staffId && b.staffId === params.staffId) {
        return {
          hasConflict: true,
          reason: `ဝန်ထမ်း (${b.staffName || params.staffId}) သည် ${b.startTime} မှ ${b.endTime} ထိ အခြားဝန်ဆောင်မှုအတွက် တာဝန်ရှိနေပါသည် (Staff already scheduled)`,
          conflictingBooking: b,
        };
      }
    }
  }

  // 2. Check against active running sessions (for today)
  if (activeSessions && activeSessions.length > 0) {
    for (const sess of activeSessions) {
      // Calculate session time window
      let sessStartHHMM = '00:00';
      if (sess.startTime.includes('T')) {
        sessStartHHMM = sess.startTime.split('T')[1].slice(0, 5);
      } else if (sess.startTime.includes(':')) {
        sessStartHHMM = sess.startTime.slice(0, 5);
      }

      const sessEndHHMM = calculateEndTime(sessStartHHMM, sess.durationMinutes || 60);

      if (isTimeOverlapping(sessStartHHMM, sessEndHHMM, params.startTime, params.endTime)) {
        if (params.roomId && sess.roomId === params.roomId) {
          return {
            hasConflict: true,
            reason: `အခန်း (${sess.roomName || params.roomId}) သည် လက်ရှိတွင် ဝန်ဆောင်မှုပေးနေဆဲဖြစ်ပါသည် (${sessStartHHMM}-${sessEndHHMM}) (Active session in room)`,
            conflictingSessionId: sess.id,
          };
        }

        if (params.staffId && sess.assignedStaff) {
          const isStaffBusy = sess.assignedStaff.some(st => st.staffId === params.staffId);
          if (isStaffBusy) {
            return {
              hasConflict: true,
              reason: `ဝန်ထမ်းသည် လက်ရှိတွင် Session တွင် တာဝန်ထမ်းဆောင်နေဆဲဖြစ်ပါသည် (Staff currently in active session)`,
              conflictingSessionId: sess.id,
            };
          }
        }
      }
    }
  }

  return { hasConflict: false };
}

/**
 * Calculate booking financial summary
 */
export function calculateBookingPricing(
  basePriceMMK: number,
  discountMMK: number = 0
): { price: number; discount: number; finalAmount: number } {
  const price = Math.max(0, Math.round(basePriceMMK || 0));
  const discount = Math.max(0, Math.min(price, Math.round(discountMMK || 0)));
  const finalAmount = Math.max(0, price - discount);
  return { price, discount, finalAmount };
}
