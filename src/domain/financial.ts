/**
 * Deterministic Financial & Business Calculations Engine for Myanmar ERP
 * 
 * CORE RULES:
 * 1. All monetary values are integer MMK (Myanmar Kyat).
 * 2. No floating-point financial values stored or returned.
 * 3. Rounding is explicit, testable, and consistent.
 * 4. Pure domain functions with zero side effects.
 */

import {
  CommissionRule,
  CommissionType,
  InvoiceItem,
  PaymentRecord,
  CommissionSnapshot,
  StaffLedgerEntry,
  CustomerLedgerEntry,
  CustomerCreditLedger,
  Customer,
  Invoice,
  SessionRecord,
  SessionExtensionRecord,
  SessionPricingRuleType,
} from '../types';

/**
 * Rounds any calculation to nearest integer MMK deterministically.
 * Uses standard round-half-up math.
 */
export function roundMMK(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round(amount);
}

/**
 * Calculates session duration in minutes from ISO timestamps
 */
export function calculateDurationMinutes(startTimeISO: string, endTimeISO?: string): number {
  const start = new Date(startTimeISO).getTime();
  const end = endTimeISO ? new Date(endTimeISO).getTime() : Date.now();
  if (isNaN(start) || isNaN(end) || end < start) {
    return 0;
  }
  return Math.max(0, Math.floor((end - start) / 60000));
}

export interface SessionPricingParams {
  basePriceMMK: number;
  roomSurchargeMMK?: number;
  plannedMinutes: number;
  actualMinutes: number;
  hourlyRateMMK?: number;
  gracePeriodMinutes?: number;
  overtimeBlockMinutes?: number;
  pricingRule?: SessionPricingRuleType;
  extensionsTotalMMK?: number;
}

export interface SessionPricingResult {
  basePriceMMK: number;
  roomSurchargeMMK: number;
  extensionsFeeMMK: number;
  overtimeMinutes: number;
  overtimeFeeMMK: number;
  totalServicePriceMMK: number;
}

/**
 * Calculates deterministic session service pricing with overtime handling and extensions
 */
export function calculateSessionPricing(params: SessionPricingParams): SessionPricingResult {
  const basePrice = Math.max(0, roundMMK(params.basePriceMMK));
  const surcharge = Math.max(0, roundMMK(params.roomSurchargeMMK || 0));
  const extensionsFee = Math.max(0, roundMMK(params.extensionsTotalMMK || 0));
  const grace = params.gracePeriodMinutes ?? 10;
  const block = params.overtimeBlockMinutes ?? 30;
  const hourlyRate = params.hourlyRateMMK ?? 0;

  const planned = Math.max(1, params.plannedMinutes);
  const actual = Math.max(0, params.actualMinutes);
  const overtimeMinutes = Math.max(0, actual - planned);

  let overtimeFeeMMK = 0;
  if (params.pricingRule === 'hourly') {
    // Pure hourly pricing: if actual minutes exceed initial planned, calculate hourly rate
    if (overtimeMinutes > grace && hourlyRate > 0) {
      const blocks = Math.ceil(overtimeMinutes / block);
      const feePerBlock = (hourlyRate * block) / 60;
      overtimeFeeMMK = roundMMK(blocks * feePerBlock);
    }
  } else {
    // Fixed or duration based
    if (overtimeMinutes > grace && hourlyRate > 0) {
      const blocks = Math.ceil(overtimeMinutes / block);
      const feePerBlock = (hourlyRate * block) / 60;
      overtimeFeeMMK = roundMMK(blocks * feePerBlock);
    }
  }

  const totalServicePriceMMK = basePrice + surcharge + extensionsFee + overtimeFeeMMK;

  return {
    basePriceMMK: basePrice,
    roomSurchargeMMK: surcharge,
    extensionsFeeMMK: extensionsFee,
    overtimeMinutes,
    overtimeFeeMMK,
    totalServicePriceMMK,
  };
}

export interface SessionRunningEstimate {
  elapsedMinutes: number;
  totalPlannedMinutes: number;
  isOvertime: boolean;
  overtimeMinutes: number;
  basePriceMMK: number;
  roomSurchargeMMK: number;
  extensionsMMK: number;
  overtimeMMK: number;
  ordersMMK: number;
  totalEstimatedMMK: number;
}

/**
 * Computes live session running charge dynamically derived from persisted timestamps.
 * Does NOT rely on client UI state alone.
 */
export function calculateSessionRunningEstimate(
  session: SessionRecord,
  hourlyRateMMK: number = 0,
  currentTimeISO?: string
): SessionRunningEstimate {
  const elapsedMinutes = calculateDurationMinutes(session.startTime, session.endTime || currentTimeISO);
  
  // Calculate total planned duration including all extensions
  const extensionsDuration = (session.extensions || []).reduce(
    (sum, ext) => sum + Math.max(0, ext.extendedMinutes),
    0
  );
  const totalPlannedMinutes = session.plannedDurationMinutes + extensionsDuration;

  // Calculate sum of all extension fees
  const extensionsMMK = (session.extensions || []).reduce(
    (sum, ext) => sum + Math.max(0, roundMMK(ext.extensionPriceMMK)),
    0
  );

  // Overtime calculation
  const overtimeMinutes = Math.max(0, elapsedMinutes - totalPlannedMinutes);
  const isOvertime = overtimeMinutes > 10; // 10 min grace period

  let overtimeMMK = 0;
  if (isOvertime && hourlyRateMMK > 0) {
    const blocks = Math.ceil(overtimeMinutes / 30);
    overtimeMMK = roundMMK(blocks * ((hourlyRateMMK * 30) / 60));
  }

  // Calculate orders
  const ordersMMK = (session.orderItems || []).reduce(
    (sum, item) => sum + Math.max(0, roundMMK(item.totalPriceMMK)),
    0
  );

  const basePriceMMK = Math.max(0, roundMMK(session.basePriceMMK));
  const roomSurchargeMMK = Math.max(0, roundMMK(session.roomSurchargeMMK || 0));

  const totalEstimatedMMK =
    basePriceMMK + roomSurchargeMMK + extensionsMMK + overtimeMMK + ordersMMK;

  return {
    elapsedMinutes,
    totalPlannedMinutes,
    isOvertime,
    overtimeMinutes,
    basePriceMMK,
    roomSurchargeMMK,
    extensionsMMK,
    overtimeMMK,
    ordersMMK,
    totalEstimatedMMK,
  };
}

/**
 * Calculates extension fee and staff allocations deterministically
 */
export function calculateExtensionPricing(params: {
  extendedMinutes: number;
  baseServicePriceMMK: number;
  plannedMinutes: number;
  hourlyRateMMK?: number;
  customPriceMMK?: number;
}): number {
  if (params.customPriceMMK !== undefined && params.customPriceMMK >= 0) {
    return roundMMK(params.customPriceMMK);
  }

  const { extendedMinutes, baseServicePriceMMK, plannedMinutes, hourlyRateMMK } = params;
  if (hourlyRateMMK && hourlyRateMMK > 0) {
    return roundMMK((hourlyRateMMK * extendedMinutes) / 60);
  }

  // Pro-rate from base service price if planned duration > 0
  if (plannedMinutes > 0 && baseServicePriceMMK > 0) {
    return roundMMK((baseServicePriceMMK * extendedMinutes) / plannedMinutes);
  }

  return 0;
}

export interface CommissionCalculationParams {
  servicePriceMMK: number;
  rule: CommissionRule;
  serviceOverrideRule?: CommissionRule;
  additionalBonusMMK?: number;
  deductionMMK?: number;
  staffAllocationPercent?: number;
  staffAllocationFixedMMK?: number;
  staffCount?: number;
}

export interface DetailedCommissionResult {
  calculationBaseMMK: number;
  commissionType: CommissionType;
  appliedPercentage?: number;
  baseCommissionMMK: number;
  fixedBonusMMK: number;
  additionalBonusMMK: number;
  deductionMMK: number;
  grossCommissionMMK: number;
  netCommissionMMK: number;
  roundingAdjustmentMMK: number;
  ruleId?: string;
  ruleVersion?: number;
}

/**
 * PRODUCTION-GRADE COMMISSION FORMULA ENGINE:
 * Explicit Formula: (calculationBaseMMK × percentage) + fixedBonus + additionalBonus − deductions = netCommissionMMK
 * Zero floating point leakage, all values integer MMK.
 */
export function calculateDetailedCommission(params: CommissionCalculationParams): DetailedCommissionResult {
  const calculationBaseMMK = Math.max(0, roundMMK(params.servicePriceMMK));
  const activeRule = params.serviceOverrideRule || params.rule;
  const staffCount = Math.max(1, params.staffCount || 1);
  const additionalBonusMMK = Math.max(0, roundMMK(params.additionalBonusMMK || 0));
  const deductionMMK = Math.max(0, roundMMK(params.deductionMMK || 0));

  let baseCommissionMMK = 0;
  let fixedBonusMMK = 0;
  let appliedPercentage: number | undefined = undefined;

  switch (activeRule.type) {
    case 'percentage': {
      const validPercent = Math.max(0, Math.min(100, activeRule.value));
      appliedPercentage = validPercent;
      baseCommissionMMK = roundMMK((calculationBaseMMK * validPercent) / 100);
      break;
    }
    case 'fixed': {
      baseCommissionMMK = Math.max(0, roundMMK(activeRule.value));
      break;
    }
    case 'percentage_plus_fixed': {
      const validPercent = Math.max(0, Math.min(100, activeRule.value));
      appliedPercentage = validPercent;
      baseCommissionMMK = roundMMK((calculationBaseMMK * validPercent) / 100);
      fixedBonusMMK = Math.max(0, roundMMK(activeRule.fixedBonusMMK || 0));
      break;
    }
    case 'tiered': {
      if (activeRule.tiers && activeRule.tiers.length > 0) {
        const matchingTier = activeRule.tiers.find(t => {
          const meetsMin = calculationBaseMMK >= t.minAmountMMK;
          const meetsMax = t.maxAmountMMK === undefined || t.maxAmountMMK === null || calculationBaseMMK <= t.maxAmountMMK;
          return meetsMin && meetsMax;
        }) || activeRule.tiers[activeRule.tiers.length - 1];

        if (matchingTier.type === 'percentage') {
          const validPercent = Math.max(0, Math.min(100, matchingTier.value));
          appliedPercentage = validPercent;
          baseCommissionMMK = roundMMK((calculationBaseMMK * validPercent) / 100);
        } else {
          baseCommissionMMK = Math.max(0, roundMMK(matchingTier.value));
        }
      } else {
        baseCommissionMMK = Math.max(0, roundMMK(activeRule.value));
      }
      break;
    }
    case 'service_specific': {
      const validPercent = Math.max(0, Math.min(100, activeRule.value));
      appliedPercentage = validPercent;
      baseCommissionMMK = roundMMK((calculationBaseMMK * validPercent) / 100);
      fixedBonusMMK = Math.max(0, roundMMK(activeRule.fixedBonusMMK || 0));
      break;
    }
    default:
      baseCommissionMMK = Math.max(0, roundMMK(activeRule.value));
  }

  // Handle explicit custom allocations for multi-staff
  if (params.staffAllocationPercent !== undefined && params.staffAllocationPercent >= 0) {
    const allocPercent = Math.min(100, params.staffAllocationPercent);
    baseCommissionMMK = roundMMK((baseCommissionMMK * allocPercent) / 100);
  } else if (params.staffAllocationFixedMMK !== undefined && params.staffAllocationFixedMMK >= 0) {
    baseCommissionMMK = roundMMK(params.staffAllocationFixedMMK);
  } else if (staffCount > 1) {
    baseCommissionMMK = roundMMK(baseCommissionMMK / staffCount);
  }

  const grossCommissionMMK = Math.max(0, baseCommissionMMK + fixedBonusMMK + additionalBonusMMK);
  const netCommissionMMK = Math.max(0, grossCommissionMMK - deductionMMK);

  return {
    calculationBaseMMK,
    commissionType: activeRule.type,
    appliedPercentage,
    baseCommissionMMK,
    fixedBonusMMK,
    additionalBonusMMK,
    deductionMMK,
    grossCommissionMMK,
    netCommissionMMK,
    roundingAdjustmentMMK: 0,
    ruleId: activeRule.ruleId,
    ruleVersion: activeRule.version || 1,
  };
}

/**
 * Calculates staff commission deterministically (returns net payable commission MMK integer)
 */
export function calculateStaffCommission(params: CommissionCalculationParams): number {
  return calculateDetailedCommission(params).netCommissionMMK;
}

export interface MultiStaffAllocationResult {
  staffId: string;
  staffName: string;
  allocationMode: 'percentage' | 'fixed' | 'equal';
  allocatedAmountMMK: number;
  detailedResult: DetailedCommissionResult;
}

/**
 * Calculates multi-staff allocations supporting percentage mode, fixed mode, and equal split pool.
 * Prevents allocations from exceeding commissionable pool unless explicitly configured.
 */
export function calculateMultiStaffCommissionAllocations(params: {
  servicePriceMMK: number;
  rule: CommissionRule;
  staffMembers: Array<{
    staffId: string;
    staffName: string;
    rule?: CommissionRule;
    serviceOverrideRule?: CommissionRule;
    allocationMode?: 'percentage' | 'fixed' | 'equal';
    allocationPercent?: number; // e.g. 60
    allocationFixedMMK?: number; // e.g. 30,000
    additionalBonusMMK?: number;
    deductionMMK?: number;
  }>;
  allowExceed?: boolean;
}): MultiStaffAllocationResult[] {
  const servicePrice = Math.max(0, roundMMK(params.servicePriceMMK));
  const staffList = params.staffMembers;
  if (!staffList || staffList.length === 0) return [];

  // Total base pool before split
  const defaultDetail = calculateDetailedCommission({ servicePriceMMK: servicePrice, rule: params.rule, staffCount: 1 });
  const poolBaseMMK = defaultDetail.baseCommissionMMK;

  // Check total percentage allocations
  const isCustomPercent = staffList.some(s => s.allocationMode === 'percentage' || (s.allocationPercent !== undefined && s.allocationPercent > 0));
  const isCustomFixed = staffList.some(s => s.allocationMode === 'fixed' || (s.allocationFixedMMK !== undefined && s.allocationFixedMMK > 0));

  if (isCustomPercent) {
    const totalPct = staffList.reduce((s, st) => s + (st.allocationPercent || 0), 0);
    if (totalPct > 100 && !params.allowExceed) {
      throw new Error(`Total percentage allocation (${totalPct}%) exceeds 100% maximum limit.`);
    }
  }

  if (isCustomFixed) {
    const totalFixed = staffList.reduce((s, st) => s + (st.allocationFixedMMK || 0), 0);
    if (totalFixed > poolBaseMMK && poolBaseMMK > 0 && !params.allowExceed) {
      throw new Error(`Total fixed allocation (${totalFixed} MMK) exceeds calculated pool (${poolBaseMMK} MMK).`);
    }
  }

  const results: MultiStaffAllocationResult[] = [];

  if (!isCustomPercent && !isCustomFixed) {
    // Equal split pool with integer remainder distribution
    const poolSplits = splitCommissionPool(poolBaseMMK, staffList.length);
    staffList.forEach((st, idx) => {
      const allocatedAmountMMK = poolSplits[idx];
      const detail = calculateDetailedCommission({
        servicePriceMMK: servicePrice,
        rule: st.rule || params.rule,
        serviceOverrideRule: st.serviceOverrideRule,
        additionalBonusMMK: st.additionalBonusMMK,
        deductionMMK: st.deductionMMK,
        staffAllocationFixedMMK: allocatedAmountMMK,
        staffCount: 1,
      });
      results.push({
        staffId: st.staffId,
        staffName: st.staffName,
        allocationMode: 'equal',
        allocatedAmountMMK: detail.netCommissionMMK,
        detailedResult: detail,
      });
    });
  } else {
    staffList.forEach(st => {
      const mode = st.allocationMode || (st.allocationPercent !== undefined ? 'percentage' : (st.allocationFixedMMK !== undefined ? 'fixed' : 'equal'));
      const detail = calculateDetailedCommission({
        servicePriceMMK: servicePrice,
        rule: st.rule || params.rule,
        serviceOverrideRule: st.serviceOverrideRule,
        additionalBonusMMK: st.additionalBonusMMK,
        deductionMMK: st.deductionMMK,
        staffAllocationPercent: mode === 'percentage' ? st.allocationPercent : undefined,
        staffAllocationFixedMMK: mode === 'fixed' ? st.allocationFixedMMK : undefined,
        staffCount: 1,
      });
      results.push({
        staffId: st.staffId,
        staffName: st.staffName,
        allocationMode: mode,
        allocatedAmountMMK: detail.netCommissionMMK,
        detailedResult: detail,
      });
    });
  }

  return results;
}

/**
 * Creates an immutable CommissionSnapshot instance for historical persistence
 */
export function createCommissionSnapshot(params: {
  staffId: string;
  staffName?: string;
  sessionId?: string;
  saleId?: string;
  invoiceId?: string;
  serviceId?: string;
  rule: CommissionRule;
  calculationBaseMMK: number;
  detailedResult: DetailedCommissionResult;
  createdBy: string;
}): CommissionSnapshot {
  const now = new Date().toISOString();
  const d = params.detailedResult;
  return {
    id: 'snap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    staffId: params.staffId,
    staffName: params.staffName,
    sessionId: params.sessionId,
    saleId: params.saleId,
    invoiceId: params.invoiceId,
    serviceId: params.serviceId,
    ruleId: params.rule.ruleId,
    ruleVersion: params.rule.version || 1,
    commissionType: d.commissionType,
    calculationBaseMMK: d.calculationBaseMMK,
    percentage: d.appliedPercentage,
    fixedAmountMMK: params.rule.type === 'fixed' ? params.rule.value : undefined,
    fixedBonusMMK: d.fixedBonusMMK,
    additionalBonusMMK: d.additionalBonusMMK,
    deductionMMK: d.deductionMMK,
    tiers: params.rule.tiers,
    calculatedCommissionMMK: d.baseCommissionMMK,
    grossCommissionMMK: d.grossCommissionMMK,
    netCommissionMMK: d.netCommissionMMK,
    rounding: 'integer_round_half_up',
    roundingResultMMK: d.netCommissionMMK,
    status: 'accrued',
    appliedAt: now,
    createdAt: now,
    createdBy: params.createdBy,
  };
}

/**
 * Splits a fixed commission pool among multiple staff ensuring zero integer loss
 */
export function splitCommissionPool(totalCommissionMMK: number, staffCount: number): number[] {
  if (staffCount <= 0) return [];
  const base = Math.floor(totalCommissionMMK / staffCount);
  let remainder = totalCommissionMMK % staffCount;
  const result: number[] = [];
  for (let i = 0; i < staffCount; i++) {
    result.push(base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
  }
  return result;
}

export interface InvoiceCalculationParams {
  items: InvoiceItem[];
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  serviceChargePercent?: number;
  taxPercent?: number;
}

export interface InvoiceCalculationResult {
  subtotalMMK: number;
  discountAmountMMK: number;
  subtotalAfterDiscountMMK: number;
  serviceChargeAmountMMK: number;
  taxAmountMMK: number;
  totalMMK: number;
}

/**
 * Calculates invoice totals deterministically: subtotal, discount, service charge, tax, final total.
 * Invariant: Discount can NEVER exceed subtotal, and total is never negative.
 */
export function calculateInvoiceTotals(params: InvoiceCalculationParams): InvoiceCalculationResult {
  const subtotalMMK = params.items.reduce((sum, item) => {
    const qty = Math.max(0, item.quantity);
    const price = Math.max(0, roundMMK(item.unitPriceMMK));
    const itemDiscount = Math.max(0, roundMMK(item.discountMMK || 0));
    const lineTotal = Math.max(0, (qty * price) - itemDiscount);
    return sum + lineTotal;
  }, 0);

  let discountAmountMMK = 0;
  if (params.discountType && params.discountValue && params.discountValue > 0) {
    if (params.discountType === 'percentage') {
      const pct = Math.max(0, Math.min(100, params.discountValue));
      discountAmountMMK = roundMMK((subtotalMMK * pct) / 100);
    } else {
      discountAmountMMK = Math.min(subtotalMMK, Math.max(0, roundMMK(params.discountValue)));
    }
  }

  const subtotalAfterDiscountMMK = Math.max(0, subtotalMMK - discountAmountMMK);

  const scPct = Math.max(0, params.serviceChargePercent || 0);
  const serviceChargeAmountMMK = roundMMK((subtotalAfterDiscountMMK * scPct) / 100);

  const taxPct = Math.max(0, params.taxPercent || 0);
  const taxableBasis = subtotalAfterDiscountMMK + serviceChargeAmountMMK;
  const taxAmountMMK = roundMMK((taxableBasis * taxPct) / 100);

  const totalMMK = Math.max(0, taxableBasis + taxAmountMMK);

  return {
    subtotalMMK,
    discountAmountMMK,
    subtotalAfterDiscountMMK,
    serviceChargeAmountMMK,
    taxAmountMMK,
    totalMMK,
  };
}

/**
 * Validates discount parameters and computes safe discount amount.
 * Prevents invalid negative totals.
 */
export function validateDiscount(
  subtotalOrParams: number | { subtotalMMK: number; discountType?: 'percentage' | 'fixed'; discountValue?: number },
  discountTypeParam?: 'percentage' | 'fixed',
  discountValueParam?: number
): { discountAmountMMK: number; isValid: boolean; error?: string } {
  let subtotalMMK = 0;
  let discountType: 'percentage' | 'fixed' | undefined = 'percentage';
  let discountValue: number | undefined = 0;

  if (typeof subtotalOrParams === 'object' && subtotalOrParams !== null) {
    subtotalMMK = subtotalOrParams.subtotalMMK;
    discountType = subtotalOrParams.discountType;
    discountValue = subtotalOrParams.discountValue;
  } else {
    subtotalMMK = subtotalOrParams;
    discountType = discountTypeParam;
    discountValue = discountValueParam;
  }

  if (!discountValue || discountValue <= 0) {
    if (typeof discountValue === 'number' && discountValue < 0) {
      return { discountAmountMMK: 0, isValid: false, error: 'Discount value cannot be negative.' };
    }
    return { discountAmountMMK: 0, isValid: true };
  }
  if (discountType === 'percentage') {
    if (discountValue > 100) {
      return { discountAmountMMK: subtotalMMK, isValid: false, error: 'Percentage discount cannot exceed 100%.' };
    }
    const amount = roundMMK((subtotalMMK * discountValue) / 100);
    return { discountAmountMMK: Math.min(subtotalMMK, amount), isValid: true };
  } else {
    const amount = roundMMK(discountValue);
    if (amount > subtotalMMK) {
      return { discountAmountMMK: subtotalMMK, isValid: false, error: 'Fixed discount cannot exceed bill subtotal.' };
    }
    return { discountAmountMMK: amount, isValid: true };
  }
}

/**
 * Calculates change amount for cash payments
 */
export function calculatePaymentChange(totalMMK: number, tenderedMMK: number): { changeMMK: number; isSufficient: boolean } {
  const total = Math.max(0, roundMMK(totalMMK));
  const tendered = Math.max(0, roundMMK(tenderedMMK));
  const changeMMK = Math.max(0, tendered - total);
  const isSufficient = tendered >= total;
  return { changeMMK, isSufficient };
}

/**
 * Evaluates payment status across UNPAID, PARTIAL, PAID, CREDIT, VOIDED
 */
export function evaluateBillPaymentStatus(
  totalOrParams:
    | number
    | {
        totalMMK: number;
        directPaidMMK?: number;
        creditDebtMMK?: number;
        payments?: PaymentRecord[];
        isVoided?: boolean;
      },
  paymentsParam?: PaymentRecord[],
  isVoidedParam: boolean = false
): 'unpaid' | 'partial' | 'paid' | 'credit' | 'voided' {
  let totalMMK = 0;
  let isVoided = false;
  let totalDirectPaid = 0;
  let totalCredit = 0;

  if (typeof totalOrParams === 'object' && totalOrParams !== null) {
    totalMMK = Math.max(0, roundMMK(totalOrParams.totalMMK));
    isVoided = !!totalOrParams.isVoided;

    if (totalOrParams.payments) {
      totalDirectPaid = totalOrParams.payments
        .filter(p => p.method.toLowerCase() !== 'credit')
        .reduce((sum, p) => sum + Math.max(0, roundMMK(p.amountMMK)), 0);
      totalCredit = totalOrParams.payments
        .filter(p => p.method.toLowerCase() === 'credit')
        .reduce((sum, p) => sum + Math.max(0, roundMMK(p.amountMMK)), 0);
    } else {
      totalDirectPaid = Math.max(0, roundMMK(totalOrParams.directPaidMMK || 0));
      totalCredit = Math.max(0, roundMMK(totalOrParams.creditDebtMMK || 0));
    }
  } else {
    totalMMK = Math.max(0, roundMMK(totalOrParams));
    isVoided = isVoidedParam;
    const payments = paymentsParam || [];
    totalDirectPaid = payments
      .filter(p => p.method.toLowerCase() !== 'credit')
      .reduce((sum, p) => sum + Math.max(0, roundMMK(p.amountMMK)), 0);
    totalCredit = payments
      .filter(p => p.method.toLowerCase() === 'credit')
      .reduce((sum, p) => sum + Math.max(0, roundMMK(p.amountMMK)), 0);
  }

  if (isVoided) return 'voided';
  if (totalMMK === 0) return 'paid';

  const totalCombined = totalDirectPaid + totalCredit;

  if (totalCombined >= totalMMK) {
    if (totalCredit > 0 && totalDirectPaid < totalMMK) {
      return 'credit';
    }
    return 'paid';
  }

  if (totalCombined > 0) {
    return 'partial';
  }

  return 'unpaid';
}

/**
 * Calculates sum of payments, split breakdown, and remaining balance due
 */
export function calculatePaymentSummary(
  firstArg: number | PaymentRecord[],
  secondArg?: number | PaymentRecord[]
): {
  paidAmountMMK: number;
  creditAmountMMK: number;
  directPaidAmountMMK: number;
  totalAllocatedMMK: number;
  creditDebtMMK: number;
  directPaidMMK: number;
  balanceDueMMK: number;
  isFullyPaid: boolean;
  status: 'unpaid' | 'partial' | 'paid' | 'credit' | 'voided';
  breakdown: Record<string, number>;
} {
  let total = 0;
  let payments: PaymentRecord[] = [];

  if (typeof firstArg === 'number') {
    total = Math.max(0, roundMMK(firstArg));
    payments = (Array.isArray(secondArg) ? secondArg : []) as PaymentRecord[];
  } else if (Array.isArray(firstArg)) {
    payments = firstArg;
    total = typeof secondArg === 'number' ? Math.max(0, roundMMK(secondArg)) : 0;
  }

  const breakdown: Record<string, number> = {
    cash: 0,
    kpay: 0,
    wave: 0,
    bank: 0,
    credit: 0,
    other: 0,
  };

  payments.forEach(p => {
    const m = (p.method || 'other').toLowerCase();
    const amt = Math.max(0, roundMMK(p.amountMMK));
    breakdown[m] = (breakdown[m] || 0) + amt;
  });

  const directPaidAmountMMK = Object.entries(breakdown)
    .filter(([k]) => k !== 'credit')
    .reduce((sum, [, v]) => sum + v, 0);

  const creditAmountMMK = breakdown.credit || 0;
  const paidAmountMMK = directPaidAmountMMK + creditAmountMMK;
  const balanceDueMMK = Math.max(0, total - paidAmountMMK);
  const isFullyPaid = total > 0 ? paidAmountMMK >= total : true;
  const status = evaluateBillPaymentStatus(total, payments, false);

  return {
    paidAmountMMK,
    creditAmountMMK,
    directPaidAmountMMK,
    totalAllocatedMMK: paidAmountMMK,
    creditDebtMMK: creditAmountMMK,
    directPaidMMK: directPaidAmountMMK,
    balanceDueMMK,
    isFullyPaid,
    status,
    breakdown,
  };
}

export interface StaffLedgerTotals {
  totalCommissionsMMK: number;
  totalBonusesMMK: number;
  totalDeductionsMMK: number;
  totalAdvancesMMK: number;
  totalSettlementsPaidMMK: number;
  netPayableBalanceMMK: number; // Current amount shop owes the staff
}

/**
 * Computes exact staff ledger balance from entries.
 * Credits (shop owes staff): commissions, bonuses.
 * Debits (staff owes shop or shop paid staff): deductions, advances, settlements paid.
 */
export function calculateStaffLedgerTotals(entries: Array<{
  type: string;
  amountMMK: number;
  direction?: 'credit' | 'debit';
  isSettled?: boolean;
}>): StaffLedgerTotals {
  let totalCommissionsMMK = 0;
  let totalBonusesMMK = 0;
  let totalDeductionsMMK = 0;
  let totalAdvancesMMK = 0;
  let totalSettlementsPaidMMK = 0;

  for (const entry of entries) {
    const amt = Math.max(0, roundMMK(entry.amountMMK));
    switch (entry.type) {
      case 'commission':
        totalCommissionsMMK += amt;
        break;
      case 'commission_reversal':
        totalCommissionsMMK = Math.max(0, totalCommissionsMMK - amt);
        break;
      case 'bonus':
        totalBonusesMMK += amt;
        break;
      case 'deduction':
        totalDeductionsMMK += amt;
        break;
      case 'advance':
        totalAdvancesMMK += amt;
        break;
      case 'settlement_payout':
      case 'payout':
        totalSettlementsPaidMMK += amt;
        break;
      case 'settlement_reversal':
        totalSettlementsPaidMMK = Math.max(0, totalSettlementsPaidMMK - amt);
        break;
    }
  }

  // Net payable = (Commissions + Bonuses) - (Deductions + Advances + Settlements)
  const totalCredits = totalCommissionsMMK + totalBonusesMMK;
  const totalDebits = totalDeductionsMMK + totalAdvancesMMK + totalSettlementsPaidMMK;
  const netPayableBalanceMMK = totalCredits - totalDebits;

  return {
    totalCommissionsMMK,
    totalBonusesMMK,
    totalDeductionsMMK,
    totalAdvancesMMK,
    totalSettlementsPaidMMK,
    netPayableBalanceMMK,
  };
}

export interface DetailedSettlementBreakdown {
  grossCommissionMMK: number;
  totalBonusMMK: number;
  totalDeductionMMK: number;
  totalAdvanceMMK: number;
  previousSettlementsMMK: number;
  netPayableBeforeMMK: number;
  totalEarnedMMK: number;
  totalPaidMMK: number;
  outstandingBalanceMMK: number;
}

/**
 * Computes exact breakdown for staff settlement using posted ledger entries.
 * Does NOT recalculate historical commission using current settings.
 */
export function calculateDetailedSettlementBreakdown(
  entries: Array<{
    type: string;
    amountMMK: number;
    direction?: 'credit' | 'debit';
    date?: string;
  }>,
  filterOptions?: { periodStart?: string; periodEnd?: string }
): DetailedSettlementBreakdown {
  let filtered = entries;
  if (filterOptions?.periodStart) {
    filtered = filtered.filter(e => !e.date || e.date >= filterOptions.periodStart!);
  }
  if (filterOptions?.periodEnd) {
    filtered = filtered.filter(e => !e.date || e.date <= filterOptions.periodEnd!);
  }

  const totals = calculateStaffLedgerTotals(filtered);
  const totalEarnedMMK = totals.totalCommissionsMMK + totals.totalBonusesMMK;
  const previousSettlementsMMK = totals.totalSettlementsPaidMMK;
  const netPayableBeforeMMK = totals.netPayableBalanceMMK;

  return {
    grossCommissionMMK: totals.totalCommissionsMMK,
    totalBonusMMK: totals.totalBonusesMMK,
    totalDeductionMMK: totals.totalDeductionsMMK,
    totalAdvanceMMK: totals.totalAdvancesMMK,
    previousSettlementsMMK,
    netPayableBeforeMMK,
    totalEarnedMMK,
    totalPaidMMK: previousSettlementsMMK,
    outstandingBalanceMMK: netPayableBeforeMMK,
  };
}

export interface SettlementCalculationResult {
  unsettledCommissionsMMK: number;
  unsettledBonusesMMK: number;
  unsettledDeductionsMMK: number;
  unsettledAdvancesMMK: number;
  netPayoutMMK: number;
}

/**
 * Calculates net payout for a batch of unsettled staff ledger items
 */
export function calculateStaffSettlementPayout(unsettledEntries: Array<{
  type: string;
  amountMMK: number;
  isSettled?: boolean;
}>): SettlementCalculationResult {
  let commissions = 0;
  let bonuses = 0;
  let deductions = 0;
  let advances = 0;

  for (const entry of unsettledEntries) {
    if (entry.isSettled) continue;
    const amt = Math.max(0, roundMMK(entry.amountMMK));
    if (entry.type === 'commission') commissions += amt;
    else if (entry.type === 'bonus') bonuses += amt;
    else if (entry.type === 'deduction') deductions += amt;
    else if (entry.type === 'advance') advances += amt;
  }

  const netPayoutMMK = Math.max(0, (commissions + bonuses) - (deductions + advances));

  return {
    unsettledCommissionsMMK: commissions,
    unsettledBonusesMMK: bonuses,
    unsettledDeductionsMMK: deductions,
    unsettledAdvancesMMK: advances,
    netPayoutMMK,
  };
}

export interface CashClosingCalculationParams {
  openingCashFloatMMK: number;
  cashSalesTotalMMK: number;
  cashCreditRepaymentsMMK: number;
  cashExpensesMMK: number;
  cashStaffAdvancesMMK: number;
  cashStaffSettlementsMMK: number;
  actualCashCountedMMK: number;
}

export interface CashClosingCalculationResult {
  totalCashInflowMMK: number;
  totalCashOutflowMMK: number;
  expectedCashInDrawerMMK: number;
  actualCashCountedMMK: number;
  cashDifferenceMMK: number; // positive = surplus, negative = shortage
  isBalanced: boolean;
}

/**
 * Reconciles cash drawer for daily shift closing
 */
export function calculateCashClosing(params: CashClosingCalculationParams): CashClosingCalculationResult {
  const opening = Math.max(0, roundMMK(params.openingCashFloatMMK));
  const sales = Math.max(0, roundMMK(params.cashSalesTotalMMK));
  const creditRepayments = Math.max(0, roundMMK(params.cashCreditRepaymentsMMK));
  const expenses = Math.max(0, roundMMK(params.cashExpensesMMK));
  const advances = Math.max(0, roundMMK(params.cashStaffAdvancesMMK));
  const settlements = Math.max(0, roundMMK(params.cashStaffSettlementsMMK));
  const counted = Math.max(0, roundMMK(params.actualCashCountedMMK));

  const totalCashInflowMMK = sales + creditRepayments;
  const totalCashOutflowMMK = expenses + advances + settlements;

  // Expected in drawer = Opening Float + Inflows - Outflows
  const expectedCashInDrawerMMK = opening + totalCashInflowMMK - totalCashOutflowMMK;
  const cashDifferenceMMK = counted - expectedCashInDrawerMMK;
  const isBalanced = cashDifferenceMMK === 0;

  return {
    totalCashInflowMMK,
    totalCashOutflowMMK,
    expectedCashInDrawerMMK,
    actualCashCountedMMK: counted,
    cashDifferenceMMK,
    isBalanced,
  };
}

/**
 * Formats integer MMK amount with standard thousand separators.
 * E.g. 150000 -> "150,000 MMK" or with Burmese digits if requested.
 */
export function formatMMK(amount: number, useBurmeseDigits: boolean = false): string {
  const rounded = roundMMK(amount);
  const formatted = rounded.toLocaleString('en-US');
  if (!useBurmeseDigits) {
    return `${formatted} MMK`;
  }
  const burmeseDigits = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
  const mmText = formatted.replace(/[0-9]/g, (digit) => burmeseDigits[parseInt(digit, 10)]);
  return `${mmText} ကျပ်`;
}

// ====================================================
// SAFE MONETARY OPERATIONS (Integer MMK Policy)
// ====================================================

export const MoneyMMK = {
  add(...amounts: number[]): number {
    return amounts.reduce((acc, curr) => roundMMK(acc) + roundMMK(curr), 0);
  },
  subtract(minuend: number, subtrahend: number): number {
    return roundMMK(minuend) - roundMMK(subtrahend);
  },
  multiply(amount: number, factor: number): number {
    return roundMMK(roundMMK(amount) * factor);
  },
  percentage(base: number, percent: number): number {
    return roundMMK((roundMMK(base) * percent) / 100);
  },
  assertNonNegative(amount: number, label: string = 'Amount'): number {
    const val = roundMMK(amount);
    if (val < 0) {
      throw new Error(`[MonetaryInvariantViolation] ${label} cannot be negative. Received: ${val} MMK`);
    }
    return val;
  },
};

// ====================================================
// DERIVED STAFF LEDGER BALANCES
// ====================================================

export interface StaffDerivedBalances {
  totalCreditMMK: number; // Shop owes staff (Commissions, Bonuses, Adjustments)
  totalDebitMMK: number;  // Staff owes shop or already received (Advances, Deductions, Payouts)
  netLifetimeBalanceMMK: number; // totalCredit - totalDebit
  unsettledCommissionsMMK: number;
  unsettledBonusesMMK: number;
  unsettledDeductionsMMK: number;
  unsettledAdvancesMMK: number;
  netUnsettledPayableMMK: number; // (Commissions + Bonuses) - (Deductions + Advances)
}

/**
 * Derives staff financial balances strictly from immutable ledger entries.
 * Does NOT trust any manually stored mutable balance field.
 */
export function deriveStaffLedgerBalances(entries: StaffLedgerEntry[]): StaffDerivedBalances {
  let totalCredit = 0;
  let totalDebit = 0;
  let unsettledCommissions = 0;
  let unsettledBonuses = 0;
  let unsettledDeductions = 0;
  let unsettledAdvances = 0;

  for (const entry of entries) {
    const amount = Math.max(0, roundMMK(entry.amountMMK));

    if (entry.direction === 'credit') {
      totalCredit += amount;
    } else if (entry.direction === 'debit') {
      totalDebit += amount;
    }

    if (!entry.isSettled) {
      switch (entry.type) {
        case 'commission':
          unsettledCommissions += amount;
          break;
        case 'bonus':
          unsettledBonuses += amount;
          break;
        case 'deduction':
          unsettledDeductions += amount;
          break;
        case 'advance':
          unsettledAdvances += amount;
          break;
      }
    }
  }

  const netLifetime = totalCredit - totalDebit;
  const netUnsettledPayable = (unsettledCommissions + unsettledBonuses) - (unsettledDeductions + unsettledAdvances);

  return {
    totalCreditMMK: totalCredit,
    totalDebitMMK: totalDebit,
    netLifetimeBalanceMMK: netLifetime,
    unsettledCommissionsMMK: unsettledCommissions,
    unsettledBonusesMMK: unsettledBonuses,
    unsettledDeductionsMMK: unsettledDeductions,
    unsettledAdvancesMMK: unsettledAdvances,
    netUnsettledPayableMMK: netUnsettledPayable,
  };
}

// ====================================================
// DERIVED CUSTOMER CREDIT BALANCES & POLICY ENGINE
// ====================================================

export interface CustomerDerivedBalance {
  totalDebtIncurredMMK: number;
  totalPaymentReceivedMMK: number;
  netOutstandingDebtMMK: number;
}

/**
 * Derives customer credit debt strictly from immutable customer ledger entries.
 * Does NOT rely on an editable balance field as source of truth.
 */
export function deriveCustomerLedgerBalances(
  entries: (CustomerLedgerEntry | CustomerCreditLedger)[]
): CustomerDerivedBalance {
  let totalDebtIncurred = 0;
  let totalPaymentReceived = 0;

  for (const entry of entries) {
    const amount = Math.max(0, roundMMK(entry.amountMMK));
    if (entry.type === 'debt_incurred') {
      totalDebtIncurred += amount;
    } else if (entry.type === 'payment_received' || entry.type === 'debt_reversal') {
      totalPaymentReceived += amount;
    } else if ((entry.type as string) === 'credit_reversal') {
      // Reversal of a credit sale or debt
      totalPaymentReceived += amount;
    } else if (entry.type === 'adjustment') {
      if (amount >= 0) {
        totalDebtIncurred += amount;
      } else {
        totalPaymentReceived += Math.abs(amount);
      }
    }
  }

  const netOutstandingDebtMMK = Math.max(0, totalDebtIncurred - totalPaymentReceived);

  return {
    totalDebtIncurredMMK: totalDebtIncurred,
    totalPaymentReceivedMMK: totalPaymentReceived,
    netOutstandingDebtMMK,
  };
}

export interface CreditPolicyValidationResult {
  isValid: boolean;
  isLimitExceeded: boolean;
  isCreditDisallowed: boolean;
  currentOutstandingMMK: number;
  newCreditAmountMMK: number;
  projectedOutstandingMMK: number;
  creditLimitMMK: number;
  error?: string;
  warning?: string;
}

/**
 * Validates customer credit sale eligibility against credit limit and policy rules.
 */
export function validateCustomerCreditPolicy(params: {
  customer: Customer;
  currentOutstandingMMK: number;
  newCreditAmountMMK: number;
}): CreditPolicyValidationResult {
  const currentOutstandingMMK = Math.max(0, roundMMK(params.currentOutstandingMMK));
  const newCreditAmountMMK = Math.max(0, roundMMK(params.newCreditAmountMMK));
  const projectedOutstandingMMK = currentOutstandingMMK + newCreditAmountMMK;
  const creditLimitMMK = Math.max(0, roundMMK(params.customer.creditLimitMMK || 0));

  if (params.customer.creditAllowed === false) {
    return {
      isValid: false,
      isLimitExceeded: false,
      isCreditDisallowed: true,
      currentOutstandingMMK,
      newCreditAmountMMK,
      projectedOutstandingMMK,
      creditLimitMMK,
      error: `Credit sales are disabled for customer '${params.customer.name}'.`,
    };
  }

  const isLimitExceeded = creditLimitMMK > 0 && projectedOutstandingMMK > creditLimitMMK;

  if (isLimitExceeded) {
    return {
      isValid: false,
      isLimitExceeded: true,
      isCreditDisallowed: false,
      currentOutstandingMMK,
      newCreditAmountMMK,
      projectedOutstandingMMK,
      creditLimitMMK,
      error: `Credit limit exceeded for ${params.customer.name}. Limit: ${formatMMK(creditLimitMMK)}, Outstanding after sale: ${formatMMK(projectedOutstandingMMK)}. Manager override required.`,
      warning: `Projected outstanding (${formatMMK(projectedOutstandingMMK)}) exceeds credit limit (${formatMMK(creditLimitMMK)}).`,
    };
  }

  return {
    isValid: true,
    isLimitExceeded: false,
    isCreditDisallowed: false,
    currentOutstandingMMK,
    newCreditAmountMMK,
    projectedOutstandingMMK,
    creditLimitMMK,
  };
}

export interface CustomerAgingBucket {
  customerId: string;
  customerName: string;
  phone: string;
  creditLimitMMK: number;
  currentOutstandingMMK: number;
  bucket0to30MMK: number;
  bucket31to60MMK: number;
  bucket61to90MMK: number;
  bucketOver90MMK: number;
}

export interface CustomerAgingReportSummary {
  customersCountWithDebt: number;
  totalOutstandingMMK: number;
  totalBucket0to30MMK: number;
  totalBucket31to60MMK: number;
  totalBucket61to90MMK: number;
  totalBucketOver90MMK: number;
  customerBreakdowns: CustomerAgingBucket[];
}

/**
 * Calculates Customer Debt Aging Breakdown (0–30 days, 31–60 days, 61–90 days, 90+ days)
 * based on ledger entry timestamps / invoice dates.
 */
export function calculateCustomerAgingReport(params: {
  customers: Customer[];
  ledgerEntries: (CustomerLedgerEntry | CustomerCreditLedger)[];
  asOfDateISO?: string;
}): CustomerAgingReportSummary {
  const asOf = params.asOfDateISO ? new Date(params.asOfDateISO) : new Date();
  const asOfTime = asOf.getTime();

  let totalOutstandingMMK = 0;
  let totalBucket0to30MMK = 0;
  let totalBucket31to60MMK = 0;
  let totalBucket61to90MMK = 0;
  let totalBucketOver90MMK = 0;

  const customerBreakdowns: CustomerAgingBucket[] = [];

  for (const cust of params.customers) {
    const custEntries = params.ledgerEntries.filter(e => e.customerId === cust.id);
    const balances = deriveCustomerLedgerBalances(custEntries);

    if (balances.netOutstandingDebtMMK <= 0) {
      continue; // Skip customers with zero debt
    }

    let remainingDebtToBucket = balances.netOutstandingDebtMMK;
    let b0to30 = 0;
    let b31to60 = 0;
    let b61to90 = 0;
    let bOver90 = 0;

    // Filter debt-increasing entries sorted from newest to oldest
    const debtEntries = custEntries
      .filter(e => e.type === 'debt_incurred' || (e.type === 'adjustment' && e.amountMMK > 0))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (const entry of debtEntries) {
      if (remainingDebtToBucket <= 0) break;

      const entryAmt = Math.max(0, roundMMK(entry.amountMMK));
      const allocatedToThisEntry = Math.min(entryAmt, remainingDebtToBucket);
      remainingDebtToBucket -= allocatedToThisEntry;

      const entryDate = new Date(entry.date);
      const diffDays = Math.floor((asOfTime - entryDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        b0to30 += allocatedToThisEntry;
      } else if (diffDays <= 60) {
        b31to60 += allocatedToThisEntry;
      } else if (diffDays <= 90) {
        b61to90 += allocatedToThisEntry;
      } else {
        bOver90 += allocatedToThisEntry;
      }
    }

    // Any remaining debt not mapped to specific entries falls into 0–30 bucket as default
    if (remainingDebtToBucket > 0) {
      b0to30 += remainingDebtToBucket;
    }

    customerBreakdowns.push({
      customerId: cust.id,
      customerName: cust.name,
      phone: cust.phone || '-',
      creditLimitMMK: cust.creditLimitMMK || 0,
      currentOutstandingMMK: balances.netOutstandingDebtMMK,
      bucket0to30MMK: b0to30,
      bucket31to60MMK: b31to60,
      bucket61to90MMK: b61to90,
      bucketOver90MMK: bOver90,
    });

    totalOutstandingMMK += balances.netOutstandingDebtMMK;
    totalBucket0to30MMK += b0to30;
    totalBucket31to60MMK += b31to60;
    totalBucket61to90MMK += b61to90;
    totalBucketOver90MMK += bOver90;
  }

  return {
    customersCountWithDebt: customerBreakdowns.length,
    totalOutstandingMMK,
    totalBucket0to30MMK,
    totalBucket31to60MMK,
    totalBucket61to90MMK,
    totalBucketOver90MMK,
    customerBreakdowns: customerBreakdowns.sort((a, b) => b.currentOutstandingMMK - a.currentOutstandingMMK),
  };
}
