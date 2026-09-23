/**
 * Deterministic Pricing Engine for KTV / PS5 / Gaming Lounge & Service Rooms
 * 
 * Supports configurable pricing rules:
 * - Room hourly rate
 * - Weekday / Weekend rates
 * - Day / Night / Peak / Off-peak rate windows
 * - Minimum duration enforcement
 * - Additional minute / block calculation
 * - Configurable rounding rules (ceil_15, round_15, ceil_30, round_half_hour, ceil_60, exact_minute)
 * - Grace periods
 * - Manual adjustments and percentage/fixed discounts
 * - Deposit deductions and live balance due calculation
 * 
 * Pure domain logic with 100% deterministic integer MMK calculations.
 */

import {
  PricingRule,
  PricingRoundingRule,
  SessionRecord,
  SessionOrderItem,
  Room,
} from '../types';
import { roundMMK, calculateDurationMinutes } from './financial';

export interface SessionPricingCalculationParams {
  startTime: string; // ISO string
  endTime?: string; // ISO string (defaults to now if omitted)
  pricingRule?: PricingRule;
  fallbackHourlyRateMMK?: number;
  fallbackBasePriceMMK?: number;
  roomSurchargeMMK?: number;
  extensionsTotalMMK?: number;
  manualAdjustmentMinutes?: number;
  manualRateOverrideMMK?: number;
  discountPercent?: number;
  discountFixedMMK?: number;
  orderItems?: SessionOrderItem[];
  depositAmountMMK?: number;
}

export interface DetailedSessionPricingResult {
  rawElapsedMinutes: number;
  adjustedElapsedMinutes: number;
  billableMinutes: number;
  minDurationMinutes: number;
  appliedRoundingRule: PricingRoundingRule;
  
  // Rate details
  isWeekend: boolean;
  isPeakHour: boolean;
  rateSource: 'manual_override' | 'peak_rate' | 'weekend_rate' | 'weekday_rate' | 'base_rate' | 'fallback_rate';
  appliedHourlyRateMMK: number;
  
  // Breakdown
  roomTimeFeeMMK: number;
  roomSurchargeMMK: number;
  extensionsFeeMMK: number;
  orderItemsTotalMMK: number;
  grossSubtotalMMK: number;
  
  // Discount breakdown
  discountPercent: number;
  discountFromPercentMMK: number;
  discountFixedMMK: number;
  totalDiscountMMK: number;
  
  // Totals & Deposit
  netTotalMMK: number;
  depositAmountMMK: number;
  depositDeductedMMK: number;
  balanceDueMMK: number; // Amount remaining to be paid
  isPaymentDue: boolean; // True if balanceDueMMK > 0
}

/**
 * Applies rounding rule to calculate billable minutes from raw elapsed minutes.
 */
export function applyDurationRounding(
  minutes: number,
  rule: PricingRoundingRule = 'exact_minute',
  minDurationMinutes: number = 0,
  additionalBlockMinutes: number = 1
): number {
  let adjusted = Math.max(0, minutes);
  
  // Apply minimum duration floor
  if (minDurationMinutes > 0 && adjusted > 0) {
    adjusted = Math.max(minDurationMinutes, adjusted);
  }

  if (adjusted <= 0) return 0;

  switch (rule) {
    case 'ceil_15':
      return Math.ceil(adjusted / 15) * 15;
    case 'round_15':
      return Math.round(adjusted / 15) * 15;
    case 'ceil_30':
      return Math.ceil(adjusted / 30) * 30;
    case 'round_half_hour':
      return Math.round(adjusted / 30) * 30;
    case 'ceil_60':
      return Math.ceil(adjusted / 60) * 60;
    case 'exact_minute':
    default:
      if (additionalBlockMinutes > 1) {
        return Math.ceil(adjusted / additionalBlockMinutes) * additionalBlockMinutes;
      }
      return Math.round(adjusted);
  }
}

/**
 * Checks if a given timestamp falls within peak hours (e.g. 18:00 to 23:59 or past midnight)
 */
export function isPeakTime(
  timestampISO: string,
  peakStart: string = '18:00',
  peakEnd: string = '23:59'
): boolean {
  try {
    const d = new Date(timestampISO);
    if (isNaN(d.getTime())) return false;
    
    const [startH, startM] = peakStart.split(':').map(Number);
    const [endH, endM] = peakEnd.split(':').map(Number);
    
    const currentMinutes = d.getHours() * 60 + d.getMinutes();
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    if (startMinutes <= endMinutes) {
      // Normal range, e.g. 18:00 to 23:00
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Overnight range, e.g. 22:00 to 04:00
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  } catch {
    return false;
  }
}

/**
 * Authoritative Deterministic Pricing Calculation for a Session
 */
export function calculateSessionPricingFromRule(
  params: SessionPricingCalculationParams
): DetailedSessionPricingResult {
  const {
    startTime,
    endTime,
    pricingRule,
    fallbackHourlyRateMMK = 0,
    fallbackBasePriceMMK = 0,
    roomSurchargeMMK = 0,
    extensionsTotalMMK = 0,
    manualAdjustmentMinutes = 0,
    manualRateOverrideMMK,
    discountPercent = 0,
    discountFixedMMK = 0,
    orderItems = [],
    depositAmountMMK = 0,
  } = params;

  // 1. Calculate Elapsed Duration
  const rawElapsed = calculateDurationMinutes(startTime, endTime);
  const adjustedElapsed = Math.max(0, rawElapsed + manualAdjustmentMinutes);

  // 2. Rounding & Minimum Duration
  const minDuration = pricingRule?.minDurationMinutes || 0;
  const roundingRule: PricingRoundingRule = pricingRule?.roundingRule || 'exact_minute';
  const block = pricingRule?.additionalBlockMinutes || 1;

  const billableMinutes = applyDurationRounding(
    adjustedElapsed,
    roundingRule,
    minDuration,
    block
  );

  // 3. Resolve Rate
  const startDate = new Date(startTime);
  const dayOfWeek = isNaN(startDate.getTime()) ? 1 : startDate.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let isPeakHour = false;
  if (pricingRule?.isPeakHourEnabled && pricingRule.peakHourStart && pricingRule.peakHourEnd) {
    isPeakHour = isPeakTime(startTime, pricingRule.peakHourStart, pricingRule.peakHourEnd);
  }

  let rateSource: DetailedSessionPricingResult['rateSource'] = 'base_rate';
  let appliedHourlyRateMMK = 0;

  if (manualRateOverrideMMK !== undefined && manualRateOverrideMMK >= 0) {
    rateSource = 'manual_override';
    appliedHourlyRateMMK = roundMMK(manualRateOverrideMMK);
  } else if (pricingRule) {
    if (isPeakHour && pricingRule.peakHourlyRateMMK && pricingRule.peakHourlyRateMMK > 0) {
      rateSource = 'peak_rate';
      appliedHourlyRateMMK = roundMMK(pricingRule.peakHourlyRateMMK);
    } else if (isWeekend && pricingRule.weekendHourlyRateMMK && pricingRule.weekendHourlyRateMMK > 0) {
      rateSource = 'weekend_rate';
      appliedHourlyRateMMK = roundMMK(pricingRule.weekendHourlyRateMMK);
    } else if (!isWeekend && pricingRule.weekdayHourlyRateMMK && pricingRule.weekdayHourlyRateMMK > 0) {
      rateSource = 'weekday_rate';
      appliedHourlyRateMMK = roundMMK(pricingRule.weekdayHourlyRateMMK);
    } else if (pricingRule.baseHourlyRateMMK > 0) {
      rateSource = 'base_rate';
      appliedHourlyRateMMK = roundMMK(pricingRule.baseHourlyRateMMK);
    } else {
      rateSource = 'fallback_rate';
      appliedHourlyRateMMK = roundMMK(fallbackHourlyRateMMK);
    }
  } else {
    rateSource = 'fallback_rate';
    appliedHourlyRateMMK = roundMMK(fallbackHourlyRateMMK);
  }

  // 4. Calculate Room Time Fee
  let roomTimeFeeMMK = 0;
  if (appliedHourlyRateMMK > 0) {
    roomTimeFeeMMK = roundMMK((appliedHourlyRateMMK * billableMinutes) / 60);
  } else if (fallbackBasePriceMMK > 0) {
    roomTimeFeeMMK = roundMMK(fallbackBasePriceMMK);
  }

  // 5. Items, Surcharges & Extensions
  const validSurcharge = Math.max(0, roundMMK(roomSurchargeMMK));
  const validExtensions = Math.max(0, roundMMK(extensionsTotalMMK));
  const orderItemsTotalMMK = orderItems.reduce(
    (sum, item) => sum + Math.max(0, roundMMK(item.totalPriceMMK)),
    0
  );

  const grossSubtotalMMK = roomTimeFeeMMK + validSurcharge + validExtensions + orderItemsTotalMMK;

  // 6. Discounts (Combines rule discounts and manual overrides safely)
  const appliedDiscountPct = Math.max(
    0,
    Math.min(100, discountPercent || pricingRule?.discountPercent || 0)
  );
  const appliedDiscountFixed = Math.max(
    0,
    roundMMK(discountFixedMMK || pricingRule?.discountFixedMMK || 0)
  );

  const discountFromPercentMMK = roundMMK((grossSubtotalMMK * appliedDiscountPct) / 100);
  const totalDiscountMMK = Math.min(
    grossSubtotalMMK,
    discountFromPercentMMK + appliedDiscountFixed
  );

  // 7. Net Total & Deposit Deductions
  const netTotalMMK = Math.max(0, grossSubtotalMMK - totalDiscountMMK);
  const validDeposit = Math.max(0, roundMMK(depositAmountMMK));
  const depositDeductedMMK = Math.min(netTotalMMK, validDeposit);
  const balanceDueMMK = Math.max(0, netTotalMMK - depositDeductedMMK);

  return {
    rawElapsedMinutes: rawElapsed,
    adjustedElapsedMinutes: adjustedElapsed,
    billableMinutes,
    minDurationMinutes: minDuration,
    appliedRoundingRule: roundingRule,
    isWeekend,
    isPeakHour,
    rateSource,
    appliedHourlyRateMMK,
    roomTimeFeeMMK,
    roomSurchargeMMK: validSurcharge,
    extensionsFeeMMK: validExtensions,
    orderItemsTotalMMK,
    grossSubtotalMMK,
    discountPercent: appliedDiscountPct,
    discountFromPercentMMK,
    discountFixedMMK: appliedDiscountFixed,
    totalDiscountMMK,
    netTotalMMK,
    depositAmountMMK: validDeposit,
    depositDeductedMMK,
    balanceDueMMK,
    isPaymentDue: balanceDueMMK > 0,
  };
}

/**
 * Computes live session running estimate from a persisted session object
 */
export function deriveLiveSessionPricing(
  session: SessionRecord,
  room?: Room,
  pricingRule?: PricingRule,
  currentTimeISO?: string
): DetailedSessionPricingResult {
  const extensionsTotal = (session.extensions || []).reduce(
    (sum, ext) => sum + Math.max(0, ext.extensionPriceMMK),
    0
  );

  // Calculate sum of active deposits
  const totalDeposits = (session.deposits || [])
    .filter(d => d.status === 'active')
    .reduce((sum, d) => sum + Math.max(0, d.amountMMK), session.depositAmountMMK || 0);

  return calculateSessionPricingFromRule({
    startTime: session.startTime,
    endTime: session.endTime || currentTimeISO || new Date().toISOString(),
    pricingRule: session.pricingRuleConfig || pricingRule,
    fallbackHourlyRateMMK: session.hourlyRateMMK || session.priceSnapshot?.hourlyRateMMK || room?.hourlyRateMMK || 0,
    fallbackBasePriceMMK: session.basePriceMMK,
    roomSurchargeMMK: session.roomSurchargeMMK || room?.surchargeMMK || 0,
    extensionsTotalMMK: extensionsTotal,
    discountPercent: session.discountPercent || 0,
    discountFixedMMK: session.discountMMK || 0,
    orderItems: session.orderItems || [],
    depositAmountMMK: totalDeposits,
  });
}
