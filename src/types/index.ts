/**
 * Domain types for Myanmar Business Management & Accounting ERP
 * All currency values are represented in integer MMK (Myanmar Kyats).
 * Floating point arithmetic for currency is strictly prohibited.
 */

export type UserRole = 'owner' | 'manager' | 'cashier' | 'receptionist' | 'admin';

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  pin: string; // 4-6 digit offline PIN
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export type RoomType = 'massage_bed' | 'foot_hall' | 'vip_suite' | 'ktv_small' | 'ktv_medium' | 'ktv_large' | 'spa_bath';
export type RoomStatus = 'available' | 'occupied' | 'cleaning' | 'reserved' | 'maintenance';

export interface Room {
  id: string;
  name: string;
  nameMm: string;
  roomNumber?: string;
  type: RoomType;
  hourlyRateMMK: number; // For hourly charging or 0 for flat session
  surchargeMMK: number; // Extra VIP fee if applicable
  basePriceMMK?: number;
  status: RoomStatus;
  currentSessionId?: string;
  capacity: number;
  isActive: boolean;
  maintenanceNotes?: string;
}

export type CommissionType = 'percentage' | 'fixed' | 'percentage_plus_fixed' | 'tiered' | 'service_specific';

export interface CommissionTier {
  minAmountMMK: number;
  maxAmountMMK?: number;
  type: 'percentage' | 'fixed';
  value: number;
}

export interface CommissionRule {
  type: CommissionType;
  value: number; // e.g., 30 for 30%, or 5000 for 5,000 MMK fixed
  fixedBonusMMK?: number; // for percentage_plus_fixed
  tiers?: CommissionTier[]; // for tiered
  version?: number;
  ruleId?: string;
}

export type StaffRole = 'therapist' | 'masseuse' | 'ktv_host' | 'receptionist' | 'cleaner' | 'bartender';
export type StaffStatus = 'available' | 'in_service' | 'off_duty';

export interface StaffMember {
  id: string;
  name: string;
  nameMm?: string;
  phone: string;
  address?: string;
  role: StaffRole;
  staffTypeId?: string;
  status: StaffStatus;
  defaultCommissionRule: CommissionRule;
  commissionRuleId?: string;
  customServiceCommissions?: Record<string, CommissionRule>; // serviceId -> CommissionRule
  isActive: boolean;
  joinedDate: string;
  notes?: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  nameMm?: string;
  category: string;
  categoryId?: string;
  pricingMethod?: 'fixed' | 'hourly' | 'duration_based';
  durationMinutes: number;
  priceMMK: number;
  defaultCommissionRule: CommissionRule;
  commissionRuleId?: string;
  isActive: boolean;
}

export interface ProductItem {
  id: string;
  name: string;
  nameMm?: string;
  sku?: string;
  category: string;
  categoryId?: string;
  costPriceMMK: number;
  sellingPriceMMK: number;
  trackStock?: boolean;
  stockQty: number;
  unit: string;
  unitMm?: string;
  isActive: boolean;
}

export interface SessionStaffAssignment {
  staffId: string;
  staffName: string;
  staffRole: StaffRole;
  // Historical snapshots - MUST NOT be recalculated if staff default changes later
  commissionType: CommissionType;
  commissionRate: number; // 30% or 5,000 MMK
  commissionAmountMMK: number;
}

export interface SessionOrderItem {
  productId: string;
  name: string;
  unitPriceMMK: number;
  costPriceMMK: number;
  quantity: number;
  totalPriceMMK: number;
  addedAt: string;
}

export type SessionPricingRuleType =
  | 'duration_based'
  | 'hourly'
  | 'fixed'
  | 'custom'
  | 'special';

export interface SessionPriceSnapshot {
  pricingRule: SessionPricingRuleType;
  basePriceMMK: number;
  hourlyRateMMK?: number;
  roomSurchargeMMK: number;
  specialPriceMMK?: number;
  ratePer30MinMMK?: number;
  serviceCommissionRateSnapshot?: number;
}

export interface SessionExtensionRecord {
  id: string;
  sessionId: string;
  extendedMinutes: number; // e.g. 30, 60
  extensionPriceMMK: number;
  reason?: string;
  extendedAt: string;
  extendedBy: string;
  staffAllocations?: Array<{
    staffId: string;
    staffName: string;
    commissionAmountMMK: number;
  }>;
}

export type SessionStatus =
  | 'started'
  | 'active'
  | 'extended'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'voided';

export interface SessionRecord {
  id: string;
  sessionCode: string; // e.g. "SES-2026-0001"
  sessionNumber?: string; // alias for display
  roomId: string;
  roomName: string;
  tableId?: string;
  tableName?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  serviceId: string;
  serviceName: string;
  pricingRule?: SessionPricingRuleType;
  priceSnapshot?: SessionPriceSnapshot;
  basePriceMMK: number;
  roomSurchargeMMK: number;
  plannedDurationMinutes: number;
  actualDurationMinutes: number;
  startTime: string;
  endTime?: string;
  status: SessionStatus;
  assignedStaff: SessionStaffAssignment[];
  extensions?: SessionExtensionRecord[];
  orderItems: SessionOrderItem[];
  notes?: string;
  invoiceId?: string;
  createdBy?: string;
  startedBy?: string;
  completedBy?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  voidReason?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod =
  | 'cash'
  | 'kpay'
  | 'wave'
  | 'cbpay'
  | 'ayapay'
  | 'bank'
  | 'other'
  | 'credit'
  | 'CASH'
  | 'KBZ_PAY'
  | 'WAVE'
  | 'BANK'
  | 'OTHER'
  | 'CREDIT';

export interface PaymentRecord {
  id: string;
  method: PaymentMethod;
  amountMMK: number;
  tenderedMMK?: number;
  changeMMK?: number;
  referenceNo?: string;
  notes?: string;
  receivedBy?: string;
  paidAt?: string;
}

export type InvoiceStatus =
  | 'unpaid'
  | 'paid'
  | 'partial'
  | 'credit'
  | 'voided'
  | 'UNPAID'
  | 'PAID'
  | 'PARTIAL'
  | 'CREDIT'
  | 'VOIDED';

export type InvoiceItemType =
  | 'session_fee'
  | 'service'
  | 'product'
  | 'food'
  | 'drink'
  | 'room_time'
  | 'surcharge'
  | 'overtime'
  | 'other';

export interface InvoiceItem {
  id?: string;
  type: InvoiceItemType;
  itemId?: string;
  code?: string;
  description: string;
  quantity: number;
  unitPriceMMK: number; // Historical snapshot price at moment of sale
  costPriceMMK?: number;
  discountMMK?: number;
  totalPriceMMK: number;
}

export interface Invoice {
  id: string;
  invoiceCode: string; // e.g. "INV-2026-0001" or "BILL-2026-0001"
  billNumber?: string; // alias for invoiceCode
  sessionId?: string;
  sessionCode?: string;
  roomId?: string;
  roomName?: string;
  tableId?: string;
  tableName?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotalMMK: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmountMMK: number;
  discountAuthorizedBy?: string;
  serviceChargePercent: number;
  serviceChargeAmountMMK: number;
  taxPercent: number;
  taxAmountMMK: number;
  totalMMK: number;
  paidAmountMMK: number;
  balanceDueMMK: number;
  outstandingAmountMMK?: number; // alias for balanceDueMMK
  status: InvoiceStatus;
  payments: PaymentRecord[];
  cashierId: string;
  cashierName: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

export interface Customer {
  id: string;
  name: string;
  nameMm?: string;
  phone: string;
  notes?: string;
  creditAllowed?: boolean;
  creditLimitMMK: number;
  currentBalanceMMK: number; // Positive = owes money (debt)
  status?: 'active' | 'inactive';
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CustomerCreditLedger {
  id: string;
  customerId: string;
  invoiceId?: string;
  type: 'debt_incurred' | 'payment_received' | 'debt_reversal' | 'adjustment';
  amountMMK: number;
  balanceAfterMMK: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
  date: string;
  createdBy: string;
}

export type StaffLedgerType = 
  | 'commission' 
  | 'bonus' 
  | 'deduction' 
  | 'advance' 
  | 'payout'
  | 'settlement_payout'
  | 'settlement_reversal'
  | 'commission_reversal';

export interface StaffLedgerEntry {
  id: string;
  staffId: string;
  staffName: string;
  type: StaffLedgerType;
  amountMMK: number; // Always positive integer
  direction: 'credit' | 'debit'; // credit: shop owes staff (+); debit: staff owes shop/paid (-)
  sessionId?: string;
  settlementId?: string; // Links to settlement voucher once paid out
  isSettled: boolean;
  notes: string;
  date: string;
  createdBy: string;
  createdAt: string;
}

export interface StaffSettlement {
  id: string;
  settlementCode: string; // e.g. "SET-2026-001"
  staffId: string;
  staffName: string;
  periodStart: string;
  periodEnd: string;
  settlementDate?: string;
  grossCommissionMMK?: number;
  totalCommissionMMK: number;
  totalBonusMMK: number;
  totalDeductionMMK: number;
  totalAdvanceMMK?: number;
  totalAdvanceDeductedMMK: number;
  previousSettlementsMMK?: number;
  netPayableBeforeMMK?: number;
  amountMMK?: number;
  netPayoutMMK: number;
  remainingPayableMMK?: number;
  paymentMethod: PaymentMethod;
  settledEntryIds: string[];
  ledgerEntryId?: string;
  cashTransactionId?: string;
  status?: 'completed' | 'reversed';
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  reversalLedgerEntryId?: string;
  paidAt: string;
  paidBy: string;
  createdBy?: string;
  createdAt?: string;
  notes?: string;
}

export type ExpenseCategory = 
  | 'laundry_towels'
  | 'massage_oils_cosmetics'
  | 'generator_fuel'
  | 'electricity_water'
  | 'shop_rent'
  | 'staff_meals'
  | 'cleaning_supplies'
  | 'maintenance'
  | 'beverage_stock_purchase'
  | 'misc';

export interface ExpenseRecord {
  id: string;
  category: ExpenseCategory;
  categoryMm: string;
  description: string;
  amountMMK: number;
  paymentMethod: PaymentMethod;
  receiptNumber?: string;
  date: string;
  recordedBy: string;
  createdAt: string;
}

export interface CashClosingRecord {
  id: string;
  closingCode: string; // e.g. "CLS-2026-09-18"
  date: string;
  shift: 'morning' | 'evening' | 'full_day';
  openedAt: string;
  closedAt: string;
  openedBy: string;
  closedBy: string;
  openingCashFloatMMK: number;
  
  // Inflows
  cashSalesTotalMMK: number;
  cashCreditRepaymentsMMK: number;
  
  // Outflows
  cashExpensesMMK: number;
  cashStaffAdvancesMMK: number;
  cashStaffSettlementsMMK: number;
  
  // Reconciled Cash
  expectedCashInDrawerMMK: number;
  actualCashCountedMMK: number;
  cashDifferenceMMK: number; // surplus positive, shortage negative
  differenceReason?: string;
  
  // Non-cash transactions
  kpayTotalMMK: number;
  waveTotalMMK: number;
  cbpayTotalMMK: number;
  ayapayTotalMMK: number;
  creditSalesTotalMMK: number;
  
  // Summary
  totalGrossRevenueMMK: number;
  totalExpensesMMK: number;
  netCashFlowMMK: number;
  
  status: 'open' | 'closed';
  notes?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole | string;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  ipAddress?: string;
}

export interface ShopSettings {
  id: string;
  businessId?: string;
  branchId?: string;
  shopName: string;
  shopNameMm: string;
  phone: string;
  address: string;
  addressMm: string;
  taxPercent: number;
  serviceChargePercent: number;
  allowNegativeStock: boolean;
  requirePinForVoid: boolean;
  requirePinForDiscount?: boolean;
  maxDiscountPercentWithoutPin?: number;
  receiptFooterNote: string;
  receiptFooterNoteMm: string;
  currencySymbol: string;
  roundingRule?: 'round_half_up' | 'floor' | 'ceil';
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// ==========================================
// ENTERPRISE DOMAIN CONCEPTS (1 to 43)
// ==========================================

// 1. Business
export interface Business {
  id: string; // Primary key e.g. "biz_001"
  code: string; // Unique business code
  name: string;
  nameMm?: string;
  taxRegistrationNumber?: string;
  contactPhone: string;
  contactEmail?: string;
  baseCurrency: 'MMK';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

// 2. Branch
export interface Branch {
  id: string; // Primary key e.g. "br_001"
  businessId: string; // Foreign key -> Business.id
  code: string;
  name: string;
  nameMm?: string;
  address: string;
  addressMm?: string;
  phone: string;
  isMainBranch: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

// 4. Role & 5. Permission
export type SystemPermission =
  | 'session:create'
  | 'session:update'
  | 'session:void'
  | 'session:extend'
  | 'sale:create'
  | 'sale:void'
  | 'staff:manage'
  | 'commission:manage'
  | 'staff:settle'
  | 'advance:issue'
  | 'cash:close'
  | 'expense:create'
  | 'reports:view'
  | 'settings:update'
  | 'audit:view'
  | 'backup:export'
  | 'backup:restore';

export interface Role {
  id: string; // Primary key e.g. "role_cashier"
  code: string;
  name: string;
  description?: string;
  permissions: SystemPermission[];
  isSystemRole: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

// 7. Staff Type
export interface StaffType {
  id: string; // Primary key e.g. "stt_therapist"
  code: string;
  name: string;
  nameMm?: string;
  description?: string;
  defaultCommissionType: CommissionType;
  defaultCommissionValue: number;
  baseSalaryMMK?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

// 9. Table (for KTV, Bar, Dining or Foot Lounges)
export interface TableRecord {
  id: string; // Primary key e.g. "tbl_ktv1"
  branchId?: string; // Foreign key -> Branch.id
  roomId?: string; // Optional Foreign key -> Room.id
  tableNumber: string;
  name: string;
  nameMm?: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  currentSessionId?: string; // Foreign key -> Session.id
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

// 11. Service Category
export interface ServiceCategory {
  id: string; // Primary key e.g. "scat_massage"
  code: string;
  name: string;
  nameMm: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

// 13. Product Category
export interface ProductCategory {
  id: string; // Primary key e.g. "pcat_drink"
  code: string;
  name: string;
  nameMm: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

// 15. Payment Method
export interface PaymentMethodRecord {
  id: string; // Primary key e.g. "pm_cash"
  code: PaymentMethod; // 'cash' | 'kpay' | 'wave' | 'cbpay' | 'ayapay' | 'credit'
  name: string;
  nameMm: string;
  type: 'cash' | 'digital_wallet' | 'bank_transfer' | 'credit';
  accountNumber?: string;
  accountName?: string;
  qrCodeData?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

// 16. Expense Category Master Record
export interface ExpenseCategoryRecord {
  id: string; // Primary key e.g. "ecat_fuel"
  code: string;
  name: string;
  nameMm: string;
  isDeductible: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

// 17. Commission Rule Master Record
export interface CommissionRuleRecord {
  id: string; // Primary key e.g. "crule_35pct"
  code: string;
  name: string;
  type: CommissionType; // 'percentage' | 'fixed' | 'percentage_plus_fixed' | 'tiered'
  percentage?: number; // e.g. 35
  fixedAmountMMK?: number; // e.g. 7000
  fixedBonusMMK?: number; // e.g. 2000 for percentage_plus_fixed
  tiers?: CommissionTier[]; // for tiered rules
  version: number; // Increment on each edit for version safety
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export type StaffBonusType = 'session_bonus' | 'sales_bonus' | 'performance_bonus' | 'manual_bonus';
export type StaffDeductionType = 'manual_deduction' | 'approved_deduction' | 'advance_repayment' | 'other_deduction';
export type StaffAllocationMode = 'percentage' | 'fixed' | 'equal';

export interface MultiStaffAllocationInput {
  staffId: string;
  staffName: string;
  allocationMode: StaffAllocationMode;
  allocationPercent?: number; // e.g. 60 for 60%
  allocationFixedMMK?: number; // e.g. 30000
}

// 20. Commission Snapshot (IMMUTABLE HISTORICAL RECORD)
export interface CommissionSnapshot {
  id?: string;
  staffId: string;
  staffName?: string;
  sessionId?: string;
  saleId?: string;
  invoiceId?: string;
  serviceId?: string;
  ruleId?: string; // Foreign key -> CommissionRuleRecord.id
  ruleName?: string;
  ruleVersion?: number;
  commissionType: CommissionType;
  calculationBaseMMK: number;
  percentage?: number;
  fixedAmountMMK?: number;
  fixedBonusMMK?: number;
  additionalBonusMMK?: number;
  deductionMMK?: number;
  tiers?: CommissionTier[];
  calculatedCommissionMMK: number;
  grossCommissionMMK: number;
  netCommissionMMK: number;
  rounding: 'integer_round_half_up' | string;
  roundingResultMMK: number;
  status: 'accrued' | 'approved' | 'settled' | 'reversed' | 'voided';
  appliedAt?: string;
  createdAt: string;
  createdBy: string;
}

// 20. Session Pricing Snapshot (IMMUTABLE)
export interface SessionPricingSnapshot {
  serviceBasePriceMMK: number;
  roomHourlyRateMMK: number;
  roomSurchargeMMK: number;
  plannedMinutes: number;
  actualMinutes: number;
  gracePeriodMinutes: number;
  overtimeBlockMinutes: number;
  overtimeMinutes: number;
  overtimeFeeMMK: number;
  totalServicePriceMMK: number;
  capturedAt: string;
}

// 22. Session Extension
export interface SessionExtension {
  id: string; // Primary key e.g. "ext_001"
  sessionId: string; // Foreign key -> SessionRecord.id
  extensionMinutes: number;
  additionalPriceMMK: number;
  reason?: string;
  requestedAt: string;
  requestedBy: string;
}

// 23. Sale Master Record
export type SaleType = 'session' | 'direct_pos';
export type SaleStatus = 'completed' | 'cancelled' | 'voided';

export interface SaleRecord {
  id: string; // Primary key e.g. "sale_001"
  saleCode: string; // e.g. "SALE-2026-0001"
  branchId?: string; // Foreign key -> Branch.id
  type: SaleType;
  sessionId?: string; // Optional Foreign key -> SessionRecord.id
  invoiceId?: string; // Foreign key -> Invoice.id
  customerId?: string; // Optional Foreign key -> Customer.id
  customerName: string;
  subtotalMMK: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmountMMK: number;
  serviceChargePercent: number;
  serviceChargeAmountMMK: number;
  taxPercent: number;
  taxAmountMMK: number;
  totalMMK: number;
  paidAmountMMK: number;
  balanceDueMMK: number;
  status: SaleStatus;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

// 24. Sale Item Record
export interface SaleItemRecord {
  id: string; // Primary key e.g. "sitem_001"
  saleId: string; // Foreign key -> SaleRecord.id
  type: 'service' | 'product' | 'room_time' | 'surcharge' | 'overtime';
  itemId?: string; // Foreign key -> ServiceItem.id or ProductItem.id
  code?: string;
  description: string;
  quantity: number;
  unitPriceMMK: number;
  costPriceMMK: number;
  totalPriceMMK: number;
  createdAt: string;
}

// 25. Sale Payment Record
export interface SalePaymentRecord {
  id: string; // Primary key e.g. "spay_001"
  saleId: string; // Foreign key -> SaleRecord.id
  paymentMethodId?: string; // Foreign key -> PaymentMethodRecord.id
  methodCode: PaymentMethod;
  amountMMK: number;
  tenderedMMK?: number;
  changeMMK?: number;
  referenceNo?: string;
  notes?: string;
  status: 'completed' | 'reversed';
  paidAt: string;
  receivedBy: string;
}

// 27. Staff Commission Record (Accrued item linking to ledger)
export interface StaffCommissionRecord {
  id: string; // Primary key e.g. "stfcom_001"
  staffId: string; // Foreign key -> StaffMember.id
  sessionId?: string; // Foreign key -> SessionRecord.id
  saleId?: string; // Foreign key -> SaleRecord.id
  serviceId?: string; // Foreign key -> ServiceItem.id
  commissionRuleId?: string; // Foreign key -> CommissionRuleRecord.id
  ledgerEntryId: string; // Foreign key -> StaffLedgerEntry.id
  settlementId?: string; // Foreign key -> StaffSettlement.id
  calculationBaseMMK: number;
  ruleSnapshot: CommissionSnapshot;
  amountMMK: number;
  status: 'accrued' | 'settled' | 'voided';
  createdAt: string;
  createdBy: string;
}

// 28. Staff Bonus
export interface StaffBonusRecord {
  id: string; // Primary key e.g. "bonus_001"
  staffId: string; // Foreign key -> StaffMember.id
  ledgerEntryId: string; // Foreign key -> StaffLedgerEntry.id
  settlementId?: string; // Foreign key -> StaffSettlement.id
  amountMMK: number;
  reason: string;
  status: 'accrued' | 'settled' | 'voided';
  createdAt: string;
  createdBy: string;
}

// 29. Staff Deduction
export interface StaffDeductionRecord {
  id: string; // Primary key e.g. "ded_001"
  staffId: string; // Foreign key -> StaffMember.id
  ledgerEntryId: string; // Foreign key -> StaffLedgerEntry.id
  settlementId?: string; // Foreign key -> StaffSettlement.id
  amountMMK: number;
  reason: string;
  status: 'accrued' | 'settled' | 'voided';
  createdAt: string;
  createdBy: string;
}

// 30. Staff Advance Record (Traceable: Advance -> Staff Ledger -> Settlement)
export interface StaffAdvanceRecord {
  id: string; // Primary key e.g. "adv_001"
  advanceCode: string; // e.g. "ADV-2026-0001"
  staffId: string; // Foreign key -> StaffMember.id
  staffName: string;
  amountMMK: number;
  paymentMethod: PaymentMethod;
  ledgerEntryId: string; // Foreign key -> StaffLedgerEntry.id
  settlementId?: string; // Foreign key -> StaffSettlement.id (populated when settled)
  cashTransactionId?: string; // Foreign key -> CashTransaction.id (if paid via cash)
  status: 'active' | 'settled' | 'voided';
  notes?: string;
  approvedBy: string;
  date: string;
  createdAt: string;
  createdBy: string;
}

// 33. Staff Settlement Item
export interface StaffSettlementItem {
  id: string; // Primary key e.g. "sitem_001"
  settlementId: string; // Foreign key -> StaffSettlement.id
  staffId: string; // Foreign key -> StaffMember.id
  ledgerEntryId: string; // Foreign key -> StaffLedgerEntry.id
  type: StaffLedgerType;
  description: string;
  amountMMK: number;
  direction: 'credit' | 'debit';
  createdAt: string;
}

// 34. Customer Ledger Entry
export interface CustomerLedgerEntry {
  id: string; // Primary key e.g. "cleg_001"
  customerId: string; // Foreign key -> Customer.id
  invoiceId?: string; // Optional Foreign key -> Invoice.id
  saleId?: string; // Optional Foreign key -> SaleRecord.id
  paymentId?: string; // Optional Foreign key -> CustomerPaymentRecord.id
  type: 'debt_incurred' | 'payment_received' | 'debt_reversal' | 'adjustment';
  amountMMK: number;
  balanceAfterMMK: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
  date: string;
  createdAt: string;
  createdBy: string;
}

// 36. Customer Payment
export interface CustomerPaymentRecord {
  id: string; // Primary key e.g. "cpay_001"
  paymentCode: string; // e.g. "CPAY-2026-0001"
  customerId: string; // Foreign key -> Customer.id
  customerName: string;
  invoiceId?: string; // Optional specific invoice
  branchId?: string;
  amountMMK: number;
  paymentMethod: PaymentMethod;
  referenceNo?: string;
  notes?: string;
  cashTransactionId?: string; // Foreign key -> CashTransaction.id (if paid in cash)
  ledgerEntryId?: string; // Foreign key -> CustomerLedgerEntry.id
  date: string;
  receivedBy: string;
  createdAt: string;
  createdBy: string;
}

// 37. Cash Transaction Record
export type CashTransactionType = 'inflow' | 'outflow';
export type CashTransactionCategory =
  | 'sale_cash'
  | 'pos_sale_cash'
  | 'credit_repayment_cash'
  | 'bill_payment_cash'
  | 'expense_cash'
  | 'staff_advance_cash'
  | 'staff_settlement_cash'
  | 'opening_float'
  | 'cash_drop'
  | 'manual_adjustment';

export interface CashTransaction {
  id: string; // Primary key e.g. "ctx_001"
  transactionCode: string; // e.g. "CTX-2026-0001"
  branchId?: string; // Foreign key -> Branch.id
  dailyClosingId?: string; // Foreign key -> CashClosingRecord.id (when closing shift)
  type: CashTransactionType;
  category: CashTransactionCategory;
  amountMMK: number;
  referenceType: 'sale' | 'invoice' | 'customer_payment' | 'expense' | 'staff_advance' | 'staff_settlement' | 'staff_settlement_reversal' | 'daily_closing' | 'manual';
  referenceId?: string;
  notes?: string;
  transactionTime: string;
  performedBy: string;
  createdAt: string;
}

// 42. Backup Metadata Record
export interface BackupMetadata {
  id: string; // Primary key e.g. "bak_001"
  backupCode: string; // e.g. "BAK-20260918-2126"
  timestamp: string;
  schemaVersion: number;
  appVersion: string;
  tableRecordCounts: Record<string, number>;
  totalRecords: number;
  dataChecksum: string;
  fileSizeBytes: number;
  exportedBy: string;
  notes?: string;
}

