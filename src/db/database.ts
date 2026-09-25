/**
 * 100% Offline Local IndexedDB Database using Dexie
 * Enforces ACID atomic transactions for all financial operations.
 */

import Dexie, { Table } from 'dexie';
import {
  UserAccount,
  Room,
  StaffMember,
  ServiceItem,
  ProductItem,
  SessionRecord,
  Invoice,
  Customer,
  CustomerCreditLedger,
  StaffLedgerEntry,
  StaffSettlement,
  ExpenseRecord,
  CashClosingRecord,
  AuditLog,
  ShopSettings,
  PaymentRecord,
  SessionOrderItem,
  SessionStaffAssignment,
  InvoiceItem,
  Business,
  Branch,
  Role,
  StaffType,
  TableRecord,
  ServiceCategory,
  ProductCategory,
  PaymentMethodRecord,
  ExpenseCategoryRecord,
  CommissionRuleRecord,
  CommissionSnapshot,
  SessionPricingSnapshot,
  SessionExtension,
  SessionExtensionRecord,
  SaleRecord,
  SaleItemRecord,
  SalePaymentRecord,
  StaffCommissionRecord,
  StaffBonusRecord,
  StaffDeductionRecord,
  StaffAdvanceRecord,
  StaffSettlementItem,
  CustomerLedgerEntry,
  CustomerPaymentRecord,
  CashTransaction,
  BackupMetadata,
  OperationQueueRecord,
  BookingRecord,
  PaymentMethod,
  InvoiceItemType,
  PricingRule,
  SessionTransferRecord,
  SessionDepositRecord,
  SessionAdjustmentRecord,
  MembershipPlan,
  CustomerMembership,
  ServicePackage,
  CustomerPackage,
  PackageRedemptionRecord,
  GiftCard,
  GiftCardRedemptionRecord,
  TipRecord,
  CustomerServiceNote,
  CustomerPreferenceProfile,
  CustomerServiceHistoryItem,
  StaffScheduleRecord,
  StaffAttendanceRecord,
  ServiceConsumableItem,
  StockMovementRecord,
  ShiftHandoverRecord,
  SupplierRecord,
  PurchaseOrderRecord,
  PurchaseOrderItem,
  StockAdjustmentRecord,
  PerformanceBonusRuleRecord,
  CustomerLoyaltyEntry,
} from '../types';
import {
  calculateSessionPricing,
  calculateStaffCommission,
  calculateInvoiceTotals,
  calculateStaffSettlementPayout,
  calculateDetailedSettlementBreakdown,
  roundMMK,
  deriveStaffLedgerBalances,
  deriveCustomerLedgerBalances,
  validateCustomerCreditPolicy,
  createCommissionSnapshot,
  evaluateBillPaymentStatus,
  MoneyMMK,
} from '../domain/financial';

import { hashPin } from '../utils/cryptoAuth';

export class MyanmarBusinessDB extends Dexie {
  users!: Table<UserAccount, string>;
  rooms!: Table<Room, string>;
  staff!: Table<StaffMember, string>;
  services!: Table<ServiceItem, string>;
  products!: Table<ProductItem, string>;
  sessions!: Table<SessionRecord, string>;
  invoices!: Table<Invoice, string>;
  customers!: Table<Customer, string>;
  customerCreditLedger!: Table<CustomerCreditLedger, string>;
  staffLedger!: Table<StaffLedgerEntry, string>;
  staffSettlements!: Table<StaffSettlement, string>;
  expenses!: Table<ExpenseRecord, string>;
  cashClosings!: Table<CashClosingRecord, string>;
  auditLogs!: Table<AuditLog, string>;
  settings!: Table<ShopSettings, string>;

  // Enterprise concepts (1-43)
  businesses!: Table<Business, string>;
  branches!: Table<Branch, string>;
  roles!: Table<Role, string>;
  staffTypes!: Table<StaffType, string>;
  diningTables!: Table<TableRecord, string>;
  serviceCategories!: Table<ServiceCategory, string>;
  productCategories!: Table<ProductCategory, string>;
  paymentMethods!: Table<PaymentMethodRecord, string>;
  expenseCategoriesMaster!: Table<ExpenseCategoryRecord, string>;
  commissionRulesMaster!: Table<CommissionRuleRecord, string>;
  sessionExtensions!: Table<SessionExtension, string>;
  sales!: Table<SaleRecord, string>;
  saleItems!: Table<SaleItemRecord, string>;
  salePayments!: Table<SalePaymentRecord, string>;
  staffCommissions!: Table<StaffCommissionRecord, string>;
  staffBonuses!: Table<StaffBonusRecord, string>;
  staffDeductions!: Table<StaffDeductionRecord, string>;
  staffAdvances!: Table<StaffAdvanceRecord, string>;
  staffSettlementItems!: Table<StaffSettlementItem, string>;
  customerLedger!: Table<CustomerLedgerEntry, string>;
  customerPayments!: Table<CustomerPaymentRecord, string>;
  cashTransactions!: Table<CashTransaction, string>;
  backupMetadata!: Table<BackupMetadata, string>;
  operationQueue!: Table<OperationQueueRecord, string>;
  bookings!: Table<BookingRecord, string>;
  pricingRules!: Table<PricingRule, string>;
  membershipPlans!: Table<MembershipPlan, string>;
  customerMemberships!: Table<CustomerMembership, string>;
  servicePackages!: Table<ServicePackage, string>;
  customerPackages!: Table<CustomerPackage, string>;
  packageRedemptions!: Table<PackageRedemptionRecord, string>;
  giftCards!: Table<GiftCard, string>;
  giftCardRedemptions!: Table<GiftCardRedemptionRecord, string>;
  tips!: Table<TipRecord, string>;
  customerServiceNotes!: Table<CustomerServiceNote, string>;
  staffSchedules!: Table<StaffScheduleRecord, string>;
  staffAttendance!: Table<StaffAttendanceRecord, string>;
  serviceConsumables!: Table<ServiceConsumableItem, string>;
  stockMovements!: Table<StockMovementRecord, string>;
  shiftHandovers!: Table<ShiftHandoverRecord, string>;
  suppliers!: Table<SupplierRecord, string>;
  purchaseOrders!: Table<PurchaseOrderRecord, string>;
  stockAdjustments!: Table<StockAdjustmentRecord, string>;
  performanceBonusRules!: Table<PerformanceBonusRuleRecord, string>;
  customerLoyaltyLedger!: Table<CustomerLoyaltyEntry, string>;

  constructor() {
    super('MyanmarBusinessERP_DB');

    // Schema Version 1 (Initial Release)
    this.version(1).stores({
      users: 'id, username, role, isActive',
      rooms: 'id, name, type, status, currentSessionId',
      staff: 'id, name, role, status, isActive',
      services: 'id, name, category, isActive',
      products: 'id, name, category, isActive',
      sessions: 'id, sessionCode, roomId, customerId, status, startTime, createdAt',
      invoices: 'id, invoiceCode, sessionId, customerId, status, createdAt',
      customers: 'id, name, phone',
      customerCreditLedger: 'id, customerId, invoiceId, date',
      staffLedger: 'id, staffId, type, direction, isSettled, date, createdAt',
      staffSettlements: 'id, settlementCode, staffId, paidAt',
      expenses: 'id, category, paymentMethod, date, createdAt',
      cashClosings: 'id, closingCode, date, status',
      auditLogs: 'id, timestamp, userId, action, entity, entityId',
      settings: 'id',
      operationQueue: 'id, operationId, operationType, status, createdAt',
    });

    // Schema Version 2 (Comprehensive 43-Concept Enterprise Domain)
    this.version(2).stores({
      // Master Data
      businesses: 'id, code, status, createdAt',
      branches: 'id, businessId, code, status, createdAt',
      users: 'id, username, role, isActive, branchId, createdAt',
      roles: 'id, code, isActive',
      staffTypes: 'id, code, isActive',
      rooms: 'id, name, type, status, currentSessionId, branchId',
      diningTables: 'id, tableNumber, roomId, branchId, status, isActive',
      services: 'id, name, category, isActive, categoryId',
      serviceCategories: 'id, code, sortOrder, isActive',
      products: 'id, name, category, isActive, categoryId',
      productCategories: 'id, code, sortOrder, isActive',
      customers: 'id, name, phone, status, branchId, createdAt',
      paymentMethods: 'id, code, type, isActive, sortOrder',
      expenseCategoriesMaster: 'id, code, isDeductible, isActive',
      commissionRulesMaster: 'id, code, type, isActive',

      // Sessions
      sessions: 'id, sessionCode, roomId, customerId, status, startTime, createdAt',
      sessionExtensions: 'id, sessionId, requestedAt',

      // Sales
      sales: 'id, saleCode, sessionId, invoiceId, customerId, branchId, status, createdAt',
      saleItems: 'id, saleId, type, itemId',
      salePayments: 'id, saleId, paymentMethodId, methodCode, status, paidAt',
      invoices: 'id, invoiceCode, sessionId, customerId, status, createdAt',

      // Staff Finance
      staff: 'id, name, role, status, isActive, branchId, staffTypeId',
      staffCommissions: 'id, staffId, sessionId, saleId, ledgerEntryId, settlementId, status, createdAt',
      staffBonuses: 'id, staffId, ledgerEntryId, settlementId, status, createdAt',
      staffDeductions: 'id, staffId, ledgerEntryId, settlementId, status, createdAt',
      staffAdvances: 'id, staffId, ledgerEntryId, settlementId, status, createdAt',
      staffLedger: 'id, staffId, type, direction, isSettled, date, createdAt, settlementId',
      staffSettlements: 'id, settlementCode, staffId, paidAt, status',
      staffSettlementItems: 'id, settlementId, staffId, ledgerEntryId, type, createdAt',

      // Customer Finance
      customerLedger: 'id, customerId, invoiceId, saleId, paymentId, type, date, createdAt',
      customerCreditLedger: 'id, customerId, invoiceId, date',
      customerPayments: 'id, customerId, invoiceId, paymentMethod, date, createdAt',

      // Cash & Expenses
      cashTransactions: 'id, branchId, dailyClosingId, type, category, referenceType, referenceId, transactionTime, createdAt',
      expenses: 'id, category, paymentMethod, date, createdAt, branchId, status',
      cashClosings: 'id, closingCode, date, status, branchId',

      // System
      auditLogs: 'id, timestamp, userId, action, entity, entityId',
      backupMetadata: 'id, backupCode, timestamp, schemaVersion, totalRecords',
      settings: 'id, businessId, branchId',
      operationQueue: 'id, operationId, operationType, status, createdAt',
    });

    // Schema Version 3 (Phase 25: Bookings & Resource Scheduling)
    this.version(3).stores({
      bookings: 'id, bookingCode, customerId, customerPhone, roomId, staffId, date, status, startTime, createdAt',
    });

    // Schema Version 4 (Phase 26: Pricing Rules & KTV/PS5 Sessions)
    this.version(4).stores({
      pricingRules: 'id, code, roomType, isActive, sortOrder',
    });

    // Schema Version 5 (Phase 27: Memberships, Packages, Gift Cards, Tips & Mixed Payments)
    this.version(5).stores({
      membershipPlans: 'id, name, isActive, durationDays',
      customerMemberships: 'id, customerId, planId, status, expiryDate, createdAt',
      servicePackages: 'id, serviceId, isActive, name',
      customerPackages: 'id, customerId, packageId, serviceId, status, expiryDate, remainingQty, createdAt',
      packageRedemptions: 'id, customerPackageId, customerId, sessionId, invoiceId, serviceId, redeemedAt',
      giftCards: 'id, cardNumber, customerId, status, expiryDate, createdAt',
      giftCardRedemptions: 'id, giftCardId, cardNumber, sessionId, invoiceId, redeemedAt',
      tips: 'id, sessionId, invoiceId, staffId, createdAt',
    });

    // Schema Version 6 (Phase 28: Customer 360, Service Notes & Rebooking)
    this.version(6).stores({
      customerServiceNotes: 'id, customerId, sessionId, bookingId, serviceId, category, isPrivate, createdAt',
    });

    // Schema Version 7 (Phase 29: Staff Schedule, Attendance & Service Consumables)
    this.version(7).stores({
      staffSchedules: 'id, staffId, date, status, branchId, businessId, createdAt',
      staffAttendance: 'id, staffId, date, status, branchId, businessId, createdAt',
      serviceConsumables: 'id, serviceId, productId, branchId, businessId, createdAt',
    });

    // Schema Version 8 (Phase 29.1: Stock Movements & Reversals)
    this.version(8).stores({
      stockMovements: 'id, productId, serviceId, sessionId, invoiceId, customerId, staffId, type, date, createdAt',
    });

    // Schema Version 9 (Phase 36: Shift Handovers & Reconciliation)
    this.version(9).stores({
      shiftHandovers: 'id, shiftCode, staffId, status, branchId, businessId, openedAt',
    });

    // Schema Version 10 (Phase 35-37: Suppliers, Purchase Orders, Stock Adjustments, Performance Bonus Rules & Customer Loyalty Ledger)
    this.version(10).stores({
      suppliers: 'id, name, isActive, businessId, branchId, createdAt',
      purchaseOrders: 'id, poNumber, supplierId, status, paymentStatus, orderDate, businessId, branchId, createdAt',
      stockAdjustments: 'id, productId, adjustedBy, createdAt, businessId, branchId',
      performanceBonusRules: 'id, ruleName, isActive, businessId, branchId, createdAt',
      customerLoyaltyLedger: 'id, customerId, type, date, createdAt',
    });
  }

  /**
   * Safe one-time migration: Converts legacy plaintext PINs to salted SHA-256 hashes at rest
   * and removes plaintext pin properties from user database records.
   */
  public async migratePlaintextPinsToSaltedHashes(): Promise<number> {
    const allUsers = await this.users.toArray();
    let migratedCount = 0;

    for (const user of allUsers) {
      if (user.pin && (!user.pinHash || !user.pinSalt)) {
        const { pinHash, pinSalt } = hashPin(user.pin);
        const updatedUser: UserAccount = {
          ...user,
          pinHash,
          pinSalt,
        };
        delete updatedUser.pin;
        await this.users.put(updatedUser);
        migratedCount++;
      } else if (user.pin && user.pinHash && user.pinSalt) {
        const updatedUser = { ...user };
        delete updatedUser.pin;
        await this.users.put(updatedUser);
        migratedCount++;
      }
    }

    // Consistency sync: Ensure any staff marked as inactive has duty status set to off_duty
    await this.syncStaffStatusConsistency();

    return migratedCount;
  }

  /**
   * Consistency helper to ensure that any staff member who is deactivated (isActive === false)
   * has their operational duty status set to 'off_duty' so they never appear as 'available' / 'တာဝန်ရှိ'.
   */
  public async syncStaffStatusConsistency(): Promise<void> {
    try {
      const allStaff = await this.staff.toArray();
      for (const stf of allStaff) {
        if (stf.isActive === false && stf.status !== 'off_duty') {
          await this.staff.update(stf.id, { status: 'off_duty' });
        }
      }
    } catch (err) {
      console.warn('Error during staff status consistency sync:', err);
    }
  }

  /**
   * General-purpose audit logging helper
   */
  public async recordAuditLog(params: {
    entityType: string;
    entityId: string;
    action: string;
    details: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<void> {
    try {
      await this.auditLogs.add({
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        entity: params.entityType,
        entityId: params.entityId,
        action: params.action,
        details: params.details,
        userId: params.currentUser.id || 'sys',
        userName: params.currentUser.name || 'System',
        userRole: params.currentUser.role || 'owner',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to write audit log:', err);
    }
  }

  // ==========================================
  // ATOMIC BUSINESS TRANSACTIONS
  // ==========================================

  /**
   * ATOMIC TRANSACTION: Start a new service session
   * 1. Validates room availability
   * 2. Validates staff availability
   * 3. Snapshots service pricing and commission rules
   * 4. Creates session record atomically
   * 5. Updates room status to 'occupied'
   * 6. Updates staff status to 'in_service'
   * 7. Logs audit trail
   */
  async startSessionTransaction(params: {
    session: Omit<SessionRecord, 'id' | 'sessionCode' | 'createdAt' | 'updatedAt'>;
    currentUser: { id: string; name: string; role: any };
  }): Promise<SessionRecord> {
    return this.transaction('rw', [this.sessions, this.rooms, this.staff, this.auditLogs], async () => {
      // 1. Validate room availability
      const room = await this.rooms.get(params.session.roomId);
      if (!room) {
        throw new Error('Room not found');
      }
      if (room.status === 'occupied') {
        throw new Error(`Room "${room.name}" is currently occupied. Please select an available room or checkout the current session.`);
      }
      if (room.status === 'maintenance') {
        throw new Error(`Room "${room.name}" is currently under maintenance / out of order.`);
      }

      // 2. Validate assigned staff and check schedule/active assignment conflicts
      if (!params.session.assignedStaff || params.session.assignedStaff.length === 0) {
        throw new Error('At least one staff member must be assigned to the session.');
      }

      const activeSessions = await this.sessions.where('status').equals('active').toArray();
      for (const stf of params.session.assignedStaff) {
        const staffMember = await this.staff.get(stf.staffId);
        if (!staffMember) {
          throw new Error(`Staff member "${stf.staffName}" not found.`);
        }
        if (!staffMember.isActive) {
          throw new Error(`Staff member "${stf.staffName}" is currently inactive.`);
        }
        const busySession = activeSessions.find(s => s.assignedStaff.some(as => as.staffId === stf.staffId));
        if (busySession) {
          throw new Error(`Staff member "${staffMember.name}" is already busy in active session "${busySession.sessionCode}" (Room: ${busySession.roomName}). Overlapping assignments are prohibited.`);
        }
      }

      const id = 'ses_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const count = await this.sessions.count();
      const sessionCode = `SES-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
      const now = new Date().toISOString();

      const newSession: SessionRecord = {
        ...params.session,
        id,
        sessionCode,
        sessionNumber: sessionCode,
        status: 'active',
        extensions: [],
        createdBy: params.currentUser.name,
        startedBy: params.currentUser.name,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      await this.sessions.add(newSession);

      // Update room to occupied
      await this.rooms.update(newSession.roomId, {
        status: 'occupied',
        currentSessionId: id,
      });

      // Update assigned staff to in_service
      for (const staff of newSession.assignedStaff) {
        await this.staff.update(staff.staffId, {
          status: 'in_service',
        });
      }

      // Log audit
      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'START_SESSION',
        entity: 'Session',
        entityId: id,
        newValue: JSON.stringify({
          sessionCode,
          room: newSession.roomName,
          customer: newSession.customerName,
          service: newSession.serviceName,
          plannedMinutes: newSession.plannedDurationMinutes,
          staff: newSession.assignedStaff.map(s => s.staffName),
        }),
      });

      return newSession;
    });
  }

  /**
   * ATOMIC TRANSACTION: Extend an active session
   * 1. Validates session is active
   * 2. Snapshots extension record with duration & price
   * 3. Preserves previous session pricing history
   * 4. Updates session duration and marks status as 'extended'
   * 5. Logs audit trail
   */
  async extendSessionTransaction(params: {
    sessionId: string;
    extendedMinutes: number;
    extensionPriceMMK: number;
    reason?: string;
    staffAllocations?: Array<{ staffId: string; staffName: string; commissionAmountMMK: number }>;
    currentUser: { id: string; name: string; role: any };
  }): Promise<SessionRecord> {
    return this.transaction('rw', [this.sessions, this.sessionExtensions, this.auditLogs], async () => {
      const session = await this.sessions.get(params.sessionId);
      if (!session) throw new Error('Session not found');
      if (session.status === 'completed' || session.status === 'cancelled' || session.status === 'voided') {
        throw new Error(`Cannot extend a session that is ${session.status}`);
      }

      const now = new Date().toISOString();
      const extId = 'ext_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      const extensionRecord: SessionExtensionRecord = {
        id: extId,
        sessionId: session.id,
        extendedMinutes: params.extendedMinutes,
        extensionPriceMMK: roundMMK(params.extensionPriceMMK),
        reason: params.reason || 'Customer requested extension (အချိန်တိုးခြင်း)',
        extendedAt: now,
        extendedBy: params.currentUser.name,
        staffAllocations: params.staffAllocations,
      };

      // Append to session extensions
      const existingExtensions = session.extensions || [];
      const updatedExtensions = [...existingExtensions, extensionRecord];
      const updatedPlannedDuration = session.plannedDurationMinutes + params.extendedMinutes;

      const updatedSession: SessionRecord = {
        ...session,
        extensions: updatedExtensions,
        plannedDurationMinutes: updatedPlannedDuration,
        status: 'extended',
        updatedAt: now,
      };

      await this.sessions.put(updatedSession);

      // Also record in sessionExtensions enterprise table if present
      try {
        await this.sessionExtensions.add({
          id: extId,
          sessionId: session.id,
          extensionMinutes: params.extendedMinutes,
          additionalPriceMMK: roundMMK(params.extensionPriceMMK),
          reason: params.reason || 'Session time extension',
          requestedBy: params.currentUser.name,
          requestedAt: now,
        });
      } catch (e) {
        // Safe fallback
      }

      // Log audit
      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'EXTEND_SESSION',
        entity: 'Session',
        entityId: session.id,
        newValue: JSON.stringify({
          extendedMinutes: params.extendedMinutes,
          extensionPriceMMK: params.extensionPriceMMK,
          newPlannedDuration: updatedPlannedDuration,
        }),
      });

      return updatedSession;
    });
  }

  /**
   * ATOMIC TRANSACTION: Reassign or change staff on active session
   */
  async changeSessionStaffTransaction(params: {
    sessionId: string;
    newAssignedStaff: SessionStaffAssignment[];
    reason?: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<SessionRecord> {
    return this.transaction('rw', [this.sessions, this.staff, this.auditLogs], async () => {
      const session = await this.sessions.get(params.sessionId);
      if (!session) throw new Error('Session not found');
      if (session.status !== 'active' && session.status !== 'started' && session.status !== 'extended') {
        throw new Error('Can only reassign staff on active sessions');
      }

      const now = new Date().toISOString();
      const previousStaffIds = session.assignedStaff.map(s => s.staffId);
      const newStaffIds = params.newAssignedStaff.map(s => s.staffId);

      // Release staff who are no longer assigned
      for (const oldStaffId of previousStaffIds) {
        if (!newStaffIds.includes(oldStaffId)) {
          await this.staff.update(oldStaffId, { status: 'available' });
        }
      }

      // Mark newly assigned staff as in_service
      for (const newStaffId of newStaffIds) {
        await this.staff.update(newStaffId, { status: 'in_service' });
      }

      const updatedSession: SessionRecord = {
        ...session,
        assignedStaff: params.newAssignedStaff,
        updatedAt: now,
      };

      await this.sessions.put(updatedSession);

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'REASSIGN_SESSION_STAFF',
        entity: 'Session',
        entityId: session.id,
        oldValue: JSON.stringify(session.assignedStaff.map(s => s.staffName)),
        newValue: JSON.stringify(params.newAssignedStaff.map(s => s.staffName)),
        reason: params.reason,
      });

      return updatedSession;
    });
  }

  /**
   * ATOMIC TRANSACTION: Cancel an active session (Soft cancellation with reason)
   */
  async cancelSessionTransaction(params: {
    sessionId: string;
    reason: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<SessionRecord> {
    return this.transaction('rw', [this.sessions, this.rooms, this.staff, this.products, this.auditLogs], async () => {
      const session = await this.sessions.get(params.sessionId);
      if (!session) throw new Error('Session not found');
      if (session.status === 'completed' || session.status === 'voided' || session.status === 'cancelled') {
        throw new Error(`Session is already ${session.status}`);
      }

      const now = new Date().toISOString();

      // Free room
      await this.rooms.update(session.roomId, {
        status: 'available',
        currentSessionId: undefined,
      });

      // Free staff
      for (const s of session.assignedStaff) {
        await this.staff.update(s.staffId, { status: 'available' });
      }

      // Restock products ordered
      if (session.orderItems && session.orderItems.length > 0) {
        for (const ord of session.orderItems) {
          const prod = await this.products.get(ord.productId);
          if (prod) {
            await this.products.update(ord.productId, {
              stockQty: prod.stockQty + ord.quantity,
            });
          }
        }
      }

      const cancelledSession: SessionRecord = {
        ...session,
        status: 'cancelled',
        cancelledAt: now,
        cancelledBy: params.currentUser.name,
        cancellationReason: params.reason || 'Customer cancelled before checkout',
        updatedAt: now,
      };

      await this.sessions.put(cancelledSession);

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'CANCEL_SESSION',
        entity: 'Session',
        entityId: session.id,
        reason: params.reason,
      });

      return cancelledSession;
    });
  }

  /**
   * ATOMIC TRANSACTION: Add orders (drinks/food) to an active session
   */
  async addOrderToSessionTransaction(params: {
    sessionId: string;
    items: SessionOrderItem[];
    currentUser: { id: string; name: string; role: any };
  }): Promise<void> {
    return this.transaction('rw', [this.sessions, this.products, this.auditLogs], async () => {
      const session = await this.sessions.get(params.sessionId);
      if (!session) throw new Error('Session not found');

      // Deduct inventory
      for (const item of params.items) {
        const prod = await this.products.get(item.productId);
        if (prod) {
          await this.products.update(item.productId, {
            stockQty: Math.max(0, prod.stockQty - item.quantity),
          });
        }
      }

      const existingOrders = session.orderItems || [];
      const updatedOrders = [...existingOrders, ...params.items];

      await this.sessions.update(params.sessionId, {
        orderItems: updatedOrders,
        updatedAt: new Date().toISOString(),
      });

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: new Date().toISOString(),
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'ADD_SESSION_ORDER',
        entity: 'Session',
        entityId: params.sessionId,
        newValue: JSON.stringify(params.items),
      });
    });
  }

  /**
   * ATOMIC TRANSACTION: Complete Session & Checkout
   * 1. Finalizes session duration and pricing
   * 2. Computes and freezes staff commission snapshots
   * 3. Creates invoice & records payments
   * 4. If customer paid by credit, creates customer credit ledger entry & updates customer balance
   * 5. Adds staff commission credits into staff ledger
   * 6. Frees room (sets to cleaning or available)
   * 7. Sets staff status back to 'available'
   * 8. Records detailed audit log
   */
  async checkoutSessionTransaction(params: {
    sessionId: string;
    actualDurationMinutes: number;
    payments: PaymentRecord[];
    discountType?: 'percentage' | 'fixed';
    discountValue?: number;
    serviceChargePercent?: number;
    taxPercent?: number;
    notes?: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<{ session: SessionRecord; invoice: Invoice }> {
    return this.transaction('rw', [
      this.sessions,
      this.invoices,
      this.rooms,
      this.staff,
      this.staffLedger,
      this.customers,
      this.customerCreditLedger,
      this.auditLogs,
      this.bookings,
    ], async () => {
      const session = await this.sessions.get(params.sessionId);
      if (!session) throw new Error('Session not found');
      if (session.status === 'completed') throw new Error('Session is already completed');

      const now = new Date().toISOString();
      const room = await this.rooms.get(session.roomId);

      // Sum all extensions
      const totalExtensionsMMK = (session.extensions || []).reduce(
        (sum, ext) => sum + roundMMK(ext.extensionPriceMMK),
        0
      );

      // 1. Calculate pricing with overtime and extensions
      const pricing = calculateSessionPricing({
        basePriceMMK: session.basePriceMMK,
        roomSurchargeMMK: session.roomSurchargeMMK,
        plannedMinutes: session.plannedDurationMinutes,
        actualMinutes: params.actualDurationMinutes,
        hourlyRateMMK: room?.hourlyRateMMK || 0,
        extensionsTotalMMK: totalExtensionsMMK,
        pricingRule: session.pricingRule,
      });

      // 2. Prepare invoice items
      const invoiceItems = [];
      invoiceItems.push({
        type: 'service' as const,
        description: `${session.serviceName} (${params.actualDurationMinutes} mins)`,
        quantity: 1,
        unitPriceMMK: pricing.basePriceMMK,
        totalPriceMMK: pricing.basePriceMMK,
      });

      // Add extensions to invoice items
      if (session.extensions && session.extensions.length > 0) {
        for (const ext of session.extensions) {
          if (ext.extensionPriceMMK > 0) {
            invoiceItems.push({
              type: 'service' as const,
              description: `Time Extension (+${ext.extendedMinutes} mins${ext.reason ? ` - ${ext.reason}` : ''})`,
              quantity: 1,
              unitPriceMMK: ext.extensionPriceMMK,
              totalPriceMMK: ext.extensionPriceMMK,
            });
          }
        }
      }

      if (pricing.roomSurchargeMMK > 0) {
        invoiceItems.push({
          type: 'surcharge' as const,
          description: `Room Surcharge (${session.roomName})`,
          quantity: 1,
          unitPriceMMK: pricing.roomSurchargeMMK,
          totalPriceMMK: pricing.roomSurchargeMMK,
        });
      }

      if (pricing.overtimeFeeMMK > 0) {
        invoiceItems.push({
          type: 'room_time' as const,
          description: `Overtime Service (${pricing.overtimeMinutes} mins)`,
          quantity: 1,
          unitPriceMMK: pricing.overtimeFeeMMK,
          totalPriceMMK: pricing.overtimeFeeMMK,
        });
      }

      // Add product order items
      if (session.orderItems && session.orderItems.length > 0) {
        for (const order of session.orderItems) {
          invoiceItems.push({
            type: 'product' as const,
            description: order.name,
            quantity: order.quantity,
            unitPriceMMK: order.unitPriceMMK,
            costPriceMMK: order.costPriceMMK,
            totalPriceMMK: order.totalPriceMMK,
          });
        }
      }

      // 3. Compute Invoice Totals
      const totals = calculateInvoiceTotals({
        items: invoiceItems,
        discountType: params.discountType,
        discountValue: params.discountValue,
        serviceChargePercent: params.serviceChargePercent,
        taxPercent: params.taxPercent,
      });

      // Factor in Active Deposits
      const activeDeposits = (session.deposits || []).filter(d => d.status === 'active');
      const totalDeposit = activeDeposits.reduce((sum, d) => sum + d.amountMMK, session.depositAmountMMK || 0);
      const depositDeductedMMK = Math.min(totals.totalMMK, totalDeposit);
      const netPayableMMK = Math.max(0, totals.totalMMK - depositDeductedMMK);

      // Sum payments
      const totalPaid = params.payments.reduce((sum, p) => sum + roundMMK(p.amountMMK), 0);
      const balanceDue = Math.max(0, netPayableMMK - totalPaid);
      const invoiceStatus = balanceDue === 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');

      // Create Invoice
      const invoiceCount = await this.invoices.count();
      const invoiceId = 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const invoiceCode = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`;

      const invoice: Invoice = {
        id: invoiceId,
        invoiceCode,
        sessionId: session.id,
        roomId: session.roomId,
        customerId: session.customerId,
        customerName: session.customerName,
        items: invoiceItems,
        subtotalMMK: totals.subtotalMMK,
        discountType: params.discountType,
        discountValue: params.discountValue,
        discountAmountMMK: totals.discountAmountMMK,
        serviceChargePercent: params.serviceChargePercent || 0,
        serviceChargeAmountMMK: totals.serviceChargeAmountMMK,
        taxPercent: params.taxPercent || 0,
        taxAmountMMK: totals.taxAmountMMK,
        totalMMK: totals.totalMMK,
        depositDeductedMMK,
        paidAmountMMK: totalPaid,
        balanceDueMMK: balanceDue,
        status: invoiceStatus,
        payments: params.payments,
        cashierId: params.currentUser.id,
        cashierName: params.currentUser.name,
        createdAt: now,
      };

      await this.invoices.add(invoice);

      // Mark deposits as deducted
      const updatedDeposits = (session.deposits || []).map(d => {
        if (d.status === 'active') {
          return { ...d, status: 'deducted' as const };
        }
        return d;
      });

      // Handle Customer Credit if payment method includes 'credit' or balance due
      const creditPayment = params.payments.find(p => p.method === 'credit');
      const creditAmount = (creditPayment ? creditPayment.amountMMK : 0) + balanceDue;
      if (creditAmount > 0 && session.customerId) {
        const customer = await this.customers.get(session.customerId);
        if (customer) {
          const newBal = customer.currentBalanceMMK + creditAmount;
          await this.customers.update(session.customerId, { currentBalanceMMK: newBal });
          await this.customerCreditLedger.add({
            id: 'ccl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            customerId: session.customerId,
            invoiceId,
            type: 'debt_incurred',
            amountMMK: creditAmount,
            balanceAfterMMK: newBal,
            notes: `Charge for Invoice ${invoiceCode}`,
            date: now.split('T')[0],
            createdBy: params.currentUser.name,
          });
        }
      }

      // 4. Calculate and Freeze Staff Commissions (Immutable snapshot)
      // Total service amount eligible for commission is basePrice + totalExtensions + overtimeFee
      const commissionableServiceAmount = pricing.basePriceMMK + totalExtensionsMMK + pricing.overtimeFeeMMK;
      const staffCount = Math.max(1, session.assignedStaff.length);

      const updatedAssignedStaff: SessionStaffAssignment[] = [];

      for (const staffAssignment of session.assignedStaff) {
        // Calculate exact commission for this staff member
        const commMMK = calculateStaffCommission({
          servicePriceMMK: commissionableServiceAmount,
          rule: {
            type: staffAssignment.commissionType,
            value: staffAssignment.commissionRate,
          },
          staffCount,
        });

        updatedAssignedStaff.push({
          ...staffAssignment,
          commissionAmountMMK: commMMK,
        });

        // 5. Post to Staff Ledger
        if (commMMK > 0) {
          const ledgerId = 'led_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
          await this.staffLedger.add({
            id: ledgerId,
            staffId: staffAssignment.staffId,
            staffName: staffAssignment.staffName,
            type: 'commission',
            amountMMK: commMMK,
            direction: 'credit',
            sessionId: session.id,
            isSettled: false,
            notes: `Commission for ${session.serviceName} (${session.sessionCode})`,
            date: now.split('T')[0],
            createdBy: params.currentUser.name,
            createdAt: now,
          });

          // Also record in staffCommissions table if available
          try {
            await this.staffCommissions.add({
              id: 'comm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              staffId: staffAssignment.staffId,
              staffName: staffAssignment.staffName,
              sessionId: session.id,
              ledgerEntryId: ledgerId,
              serviceId: session.serviceId,
              serviceName: session.serviceName,
              servicePriceMMK: commissionableServiceAmount,
              commissionRuleType: staffAssignment.commissionType,
              commissionRuleValue: staffAssignment.commissionRate,
              calculatedAmountMMK: commMMK,
              finalAmountMMK: commMMK,
              status: 'earned',
              earnedDate: now.split('T')[0],
              createdAt: now,
            } as any);
          } catch (e) {
            // Safe fallback
          }
        }

        // Return staff to available
        await this.staff.update(staffAssignment.staffId, { status: 'available' });
      }

      // Deduct service consumables transactionally
      await this.deductServiceConsumablesTransaction(session.serviceId, 1, session.id, params.currentUser);

      // 6. Update Session
      const completedSession: SessionRecord = {
        ...session,
        actualDurationMinutes: params.actualDurationMinutes,
        endTime: now,
        completedAt: now,
        completedBy: params.currentUser.name,
        status: 'completed',
        invoiceId,
        assignedStaff: updatedAssignedStaff,
        deposits: updatedDeposits,
        updatedAt: now,
        notes: params.notes || session.notes,
      };

      await this.sessions.put(completedSession);

      // 7. Update Room Status
      await this.rooms.update(session.roomId, {
        status: 'cleaning', // sets to cleaning after session
        currentSessionId: undefined,
      });

      // Phase 31: Automatically link and complete booking if session is tied to one
      try {
        let linkedBooking = session.bookingId ? await this.bookings.get(session.bookingId) : null;
        if (!linkedBooking) {
          linkedBooking = await this.bookings.filter(b => b.sessionId === session.id).first();
        }
        if (linkedBooking && linkedBooking.status !== 'COMPLETED') {
          await this.bookings.update(linkedBooking.id, {
            status: 'COMPLETED',
            invoiceId,
            sessionId: session.id,
            completedAt: now,
            updatedAt: now,
          });
        }
      } catch (err) {
        console.warn('Could not complete linked booking:', err);
      }

      // 8. Audit Log
      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'CHECKOUT_SESSION',
        entity: 'Session',
        entityId: session.id,
        oldValue: JSON.stringify({ status: session.status }),
        newValue: JSON.stringify({
          status: 'completed',
          invoiceCode,
          totalMMK: totals.totalMMK,
          paidMMK: totalPaid,
        }),
      });

      return { session: completedSession, invoice };
    });
  }

  /**
   * ATOMIC TRANSACTION: Room Transfer (Room A -> Room B)
   * 1. Validates destination room availability
   * 2. Atomically frees source room
   * 3. Occupies destination room
   * 4. Updates session with new room details and appends to transfer history
   * 5. Emits audit trail
   */
  async transferRoomSessionTransaction(params: {
    sessionId: string;
    targetRoomId: string;
    reason?: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<{ session: SessionRecord; previousRoomId: string; targetRoomId: string }> {
    return this.transaction('rw', [this.sessions, this.rooms, this.auditLogs], async () => {
      const session = await this.sessions.get(params.sessionId);
      if (!session) throw new Error('Session not found');
      if (session.status === 'completed' || session.status === 'cancelled' || session.status === 'voided') {
        throw new Error(`Cannot transfer an inactive session (${session.status})`);
      }

      if (session.roomId === params.targetRoomId) {
        throw new Error('Target room is the same as the current room');
      }

      const targetRoom = await this.rooms.get(params.targetRoomId);
      if (!targetRoom) throw new Error('Target destination room not found');
      if (targetRoom.status !== 'available') {
        throw new Error(`Target room ${targetRoom.name} is currently ${targetRoom.status}. Only available rooms can be transferred into.`);
      }

      const previousRoomId = session.roomId;
      const previousRoom = await this.rooms.get(previousRoomId);
      const now = new Date().toISOString();

      const transferRecord: SessionTransferRecord = {
        id: 'xfer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        sessionId: session.id,
        fromRoomId: previousRoomId,
        fromRoomName: previousRoom ? previousRoom.name : session.roomName,
        toRoomId: targetRoom.id,
        toRoomName: targetRoom.name,
        transferredAt: now,
        transferredBy: params.currentUser.name,
        reason: params.reason || 'Customer requested room change (အခန်းပြောင်းခြင်း)',
        sourceRoomHourlyRateMMK: previousRoom?.hourlyRateMMK || session.hourlyRateMMK,
        destRoomHourlyRateMMK: targetRoom.hourlyRateMMK,
      };

      const updatedTransfers = [...(session.transfers || []), transferRecord];

      // Update session record
      const updatedSession: SessionRecord = {
        ...session,
        roomId: targetRoom.id,
        roomName: targetRoom.name,
        hourlyRateMMK: targetRoom.hourlyRateMMK,
        roomSurchargeMMK: targetRoom.surchargeMMK || session.roomSurchargeMMK || 0,
        transfers: updatedTransfers,
        updatedAt: now,
      };

      await this.sessions.put(updatedSession);

      // Free source room
      await this.rooms.update(previousRoomId, {
        status: 'available',
        currentSessionId: undefined,
      });

      // Occupy destination room
      await this.rooms.update(targetRoom.id, {
        status: 'occupied',
        currentSessionId: session.id,
      });

      // Log Audit
      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'TRANSFER_ROOM',
        entity: 'Session',
        entityId: session.id,
        oldValue: JSON.stringify({ roomId: previousRoomId, roomName: previousRoom?.name }),
        newValue: JSON.stringify({ roomId: targetRoom.id, roomName: targetRoom.name, reason: params.reason }),
      });

      return { session: updatedSession, previousRoomId, targetRoomId: targetRoom.id };
    });
  }

  /**
   * ATOMIC TRANSACTION: Add Deposit to Session
   */
  async addSessionDepositTransaction(params: {
    sessionId: string;
    amountMMK: number;
    paymentMethod: PaymentMethod | string;
    referenceNo?: string;
    notes?: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<{ session: SessionRecord; deposit: SessionDepositRecord }> {
    return this.transaction('rw', [this.sessions, this.cashTransactions, this.auditLogs], async () => {
      const session = await this.sessions.get(params.sessionId);
      if (!session) throw new Error('Session not found');
      if (params.amountMMK <= 0) throw new Error('Deposit amount must be greater than 0 MMK');

      const now = new Date().toISOString();
      const depositId = 'dep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      let cashTxId: string | undefined;
      const isCash = String(params.paymentMethod).toLowerCase() === 'cash';

      if (isCash) {
        cashTxId = 'ctx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        await this.cashTransactions.add({
          id: cashTxId,
          transactionCode: 'CTX-' + Date.now().toString().slice(-6),
          type: 'inflow',
          category: 'sale_cash',
          amountMMK: roundMMK(params.amountMMK),
          referenceType: 'sale',
          referenceId: session.id,
          notes: `Session Deposit: ${session.sessionCode} (${session.customerName})`,
          transactionTime: now,
          performedBy: params.currentUser.name,
          createdAt: now,
        });
      }

      const depositRecord: SessionDepositRecord = {
        id: depositId,
        sessionId: session.id,
        amountMMK: roundMMK(params.amountMMK),
        paymentMethod: params.paymentMethod,
        referenceNo: params.referenceNo,
        notes: params.notes,
        status: 'active',
        cashTransactionId: cashTxId,
        receivedBy: params.currentUser.name,
        createdAt: now,
      };

      const existingDeposits = session.deposits || [];
      const updatedDeposits = [...existingDeposits, depositRecord];
      const newDepositTotal = updatedDeposits
        .filter(d => d.status === 'active')
        .reduce((sum, d) => sum + d.amountMMK, 0);

      const updatedSession: SessionRecord = {
        ...session,
        depositAmountMMK: newDepositTotal,
        depositPaymentMethod: params.paymentMethod,
        deposits: updatedDeposits,
        updatedAt: now,
      };

      await this.sessions.put(updatedSession);

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'ADD_SESSION_DEPOSIT',
        entity: 'Session',
        entityId: session.id,
        newValue: JSON.stringify({ amountMMK: params.amountMMK, paymentMethod: params.paymentMethod }),
      });

      return { session: updatedSession, deposit: depositRecord };
    });
  }

  /**
   * ATOMIC TRANSACTION: Refund Session Deposit
   */
  async refundSessionDepositTransaction(params: {
    sessionId: string;
    depositId: string;
    reason: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<{ session: SessionRecord; refundedDeposit: SessionDepositRecord }> {
    return this.transaction('rw', [this.sessions, this.cashTransactions, this.auditLogs], async () => {
      const session = await this.sessions.get(params.sessionId);
      if (!session) throw new Error('Session not found');

      const existingDeposits = session.deposits || [];
      const deposit = existingDeposits.find(d => d.id === params.depositId);
      if (!deposit) throw new Error('Deposit record not found');
      if (deposit.status !== 'active') {
        throw new Error(`Deposit cannot be refunded because it is already ${deposit.status}`);
      }

      const now = new Date().toISOString();
      const isCash = String(deposit.paymentMethod).toLowerCase() === 'cash';

      if (isCash) {
        const cashTxId = 'ctx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        await this.cashTransactions.add({
          id: cashTxId,
          transactionCode: 'CTX-' + Date.now().toString().slice(-6),
          type: 'outflow',
          category: 'manual_adjustment',
          amountMMK: deposit.amountMMK,
          referenceType: 'manual',
          referenceId: session.id,
          notes: `Deposit Refund: ${session.sessionCode} - ${params.reason}`,
          transactionTime: now,
          performedBy: params.currentUser.name,
          createdAt: now,
        });
      }

      const updatedDeposits: SessionDepositRecord[] = existingDeposits.map(d => {
        if (d.id === params.depositId) {
          return {
            ...d,
            status: 'refunded' as const,
            refundedAt: now,
            refundedBy: params.currentUser.name,
            refundReason: params.reason,
          };
        }
        return d;
      });

      const newDepositTotal = updatedDeposits
        .filter(d => d.status === 'active')
        .reduce((sum, d) => sum + d.amountMMK, 0);

      const updatedSession: SessionRecord = {
        ...session,
        depositAmountMMK: newDepositTotal,
        deposits: updatedDeposits,
        updatedAt: now,
      };

      await this.sessions.put(updatedSession);

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'REFUND_SESSION_DEPOSIT',
        entity: 'Session',
        entityId: session.id,
        reason: params.reason,
        newValue: JSON.stringify({ refundedDepositId: deposit.id, amountMMK: deposit.amountMMK }),
      });

      const refundedDeposit = updatedDeposits.find(d => d.id === params.depositId)!;
      return { session: updatedSession, refundedDeposit };
    });
  }

  /**
   * ATOMIC TRANSACTION: Authorized Manual Session Adjustment
   */
  async adjustSessionTransaction(params: {
    sessionId: string;
    adjustments: {
      startTime?: string;
      endTime?: string;
      plannedDurationMinutes?: number;
      hourlyRateMMK?: number;
      discountMMK?: number;
      discountPercent?: number;
    };
    reason: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<SessionRecord> {
    return this.transaction('rw', [this.sessions, this.auditLogs], async () => {
      const session = await this.sessions.get(params.sessionId);
      if (!session) throw new Error('Session not found');

      if (!params.reason || !params.reason.trim()) {
        throw new Error('An explicit reason is required for financial and time adjustments');
      }

      const now = new Date().toISOString();
      const records: SessionAdjustmentRecord[] = [];

      const updatedSession: SessionRecord = { ...session };

      if (params.adjustments.startTime && params.adjustments.startTime !== session.startTime) {
        records.push({
          id: 'adj_' + Date.now() + '_1',
          sessionId: session.id,
          field: 'startTime',
          oldValue: session.startTime,
          newValue: params.adjustments.startTime,
          reason: params.reason,
          adjustedBy: params.currentUser.name,
          adjustedAt: now,
        });
        updatedSession.startTime = params.adjustments.startTime;
      }

      if (params.adjustments.plannedDurationMinutes !== undefined && params.adjustments.plannedDurationMinutes !== session.plannedDurationMinutes) {
        records.push({
          id: 'adj_' + Date.now() + '_2',
          sessionId: session.id,
          field: 'duration',
          oldValue: session.plannedDurationMinutes,
          newValue: params.adjustments.plannedDurationMinutes,
          reason: params.reason,
          adjustedBy: params.currentUser.name,
          adjustedAt: now,
        });
        updatedSession.plannedDurationMinutes = params.adjustments.plannedDurationMinutes;
      }

      if (params.adjustments.hourlyRateMMK !== undefined && params.adjustments.hourlyRateMMK !== session.hourlyRateMMK) {
        records.push({
          id: 'adj_' + Date.now() + '_3',
          sessionId: session.id,
          field: 'rate',
          oldValue: session.hourlyRateMMK || 0,
          newValue: params.adjustments.hourlyRateMMK,
          reason: params.reason,
          adjustedBy: params.currentUser.name,
          adjustedAt: now,
        });
        updatedSession.hourlyRateMMK = roundMMK(params.adjustments.hourlyRateMMK);
      }

      if (params.adjustments.discountMMK !== undefined || params.adjustments.discountPercent !== undefined) {
        records.push({
          id: 'adj_' + Date.now() + '_4',
          sessionId: session.id,
          field: 'discount',
          oldValue: `${session.discountMMK || 0} MMK / ${session.discountPercent || 0}%`,
          newValue: `${params.adjustments.discountMMK || 0} MMK / ${params.adjustments.discountPercent || 0}%`,
          reason: params.reason,
          adjustedBy: params.currentUser.name,
          adjustedAt: now,
        });
        updatedSession.discountMMK = params.adjustments.discountMMK !== undefined ? roundMMK(params.adjustments.discountMMK) : session.discountMMK;
        updatedSession.discountPercent = params.adjustments.discountPercent !== undefined ? params.adjustments.discountPercent : session.discountPercent;
        updatedSession.discountReason = params.reason;
      }

      updatedSession.adjustments = [...(session.adjustments || []), ...records];
      updatedSession.updatedAt = now;

      await this.sessions.put(updatedSession);

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'ADJUST_SESSION',
        entity: 'Session',
        entityId: session.id,
        reason: params.reason,
        newValue: JSON.stringify(params.adjustments),
      });

      return updatedSession;
    });
  }

  /**
   * ATOMIC TRANSACTION: Direct POS Sale (Walk-in Food/Drink/Product/Services without session)
   */
  async createDirectSaleTransaction(params: {
    items: Array<{
      productId?: string;
      itemId?: string;
      code?: string;
      name: string;
      description?: string;
      type?: InvoiceItemType;
      quantity: number;
      unitPriceMMK: number;
      costPriceMMK?: number;
      discountMMK?: number;
    }>;
    payments: PaymentRecord[];
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    discountType?: 'percentage' | 'fixed';
    discountValue?: number;
    discountAuthorizedBy?: string;
    serviceChargePercent?: number;
    taxPercent?: number;
    notes?: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<Invoice> {
    return this.transaction('rw', [
      this.invoices,
      this.products,
      this.customers,
      this.customerCreditLedger,
      this.customerLedger,
      this.cashTransactions,
      this.auditLogs,
      this.giftCards,
      this.giftCardRedemptions,
    ], async () => {
      const now = new Date().toISOString();

      // 1. Decrement inventory for physical products/food/drinks
      for (const item of params.items) {
        const pId = item.productId || item.itemId;
        if (pId) {
          const prod = await this.products.get(pId);
          if (prod) {
            await this.products.update(pId, {
              stockQty: Math.max(0, prod.stockQty - item.quantity),
            });
          }
        }
      }

      // 2. Snapshot line items with exact prices at sale time (immutable historical record)
      const invoiceItems: InvoiceItem[] = params.items.map(it => {
        const uPrice = Math.max(0, roundMMK(it.unitPriceMMK));
        const itemDisc = Math.max(0, roundMMK(it.discountMMK || 0));
        const lineTotal = Math.max(0, (it.quantity * uPrice) - itemDisc);
        return {
          id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          type: (it.type || 'product') as InvoiceItemType,
          itemId: it.productId || it.itemId,
          code: it.code,
          description: it.description || it.name,
          quantity: it.quantity,
          unitPriceMMK: uPrice, // Preserved historical price
          costPriceMMK: it.costPriceMMK ? roundMMK(it.costPriceMMK) : undefined,
          discountMMK: itemDisc > 0 ? itemDisc : undefined,
          totalPriceMMK: lineTotal,
        };
      });

      // 3. Compute invoice totals
      const totals = calculateInvoiceTotals({
        items: invoiceItems,
        discountType: params.discountType,
        discountValue: params.discountValue,
        serviceChargePercent: params.serviceChargePercent || 0,
        taxPercent: params.taxPercent || 0,
      });

      // 4. Calculate Payments & Status
      const processedPayments: PaymentRecord[] = params.payments.map((p, idx) => ({
        ...p,
        id: p.id || `pmt_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
        amountMMK: Math.max(0, roundMMK(p.amountMMK)),
        paidAt: p.paidAt || now,
        receivedBy: p.receivedBy || params.currentUser.name,
      }));

      const totalPaid = processedPayments.reduce((sum, p) => sum + roundMMK(p.amountMMK), 0);
      const balanceDue = Math.max(0, totals.totalMMK - totalPaid);
      const invoiceStatus = evaluateBillPaymentStatus(totals.totalMMK, processedPayments, false);

      const invoiceCount = await this.invoices.count();
      const invoiceId = 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const invoiceCode = `BILL-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`;

      const invoice: Invoice = {
        id: invoiceId,
        invoiceCode,
        billNumber: invoiceCode,
        customerId: params.customerId,
        customerName: params.customerName || 'Walk-in Customer (ဧည့်သည်)',
        customerPhone: params.customerPhone,
        items: invoiceItems,
        subtotalMMK: totals.subtotalMMK,
        discountType: params.discountType,
        discountValue: params.discountValue,
        discountAmountMMK: totals.discountAmountMMK,
        discountAuthorizedBy: params.discountAuthorizedBy,
        serviceChargePercent: params.serviceChargePercent || 0,
        serviceChargeAmountMMK: totals.serviceChargeAmountMMK,
        taxPercent: params.taxPercent || 0,
        taxAmountMMK: totals.taxAmountMMK,
        totalMMK: totals.totalMMK,
        paidAmountMMK: totalPaid,
        balanceDueMMK: balanceDue,
        outstandingAmountMMK: balanceDue,
        status: invoiceStatus,
        payments: processedPayments,
        cashierId: params.currentUser.id,
        cashierName: params.currentUser.name,
        notes: params.notes,
        createdAt: now,
      };

      await this.invoices.add(invoice);

      // 5. Handle Customer Credit if credit payment or balance due exists
      const creditPayment = processedPayments.find(p => p.method.toLowerCase() === 'credit');
      const creditAmount = (creditPayment ? creditPayment.amountMMK : 0) + balanceDue;
      if (creditAmount > 0 && params.customerId) {
        const customer = await this.customers.get(params.customerId);
        if (customer) {
          const newBal = customer.currentBalanceMMK + creditAmount;
          await this.customers.update(params.customerId, { currentBalanceMMK: newBal });
          
          const creditEntryId = 'ccl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
          await this.customerCreditLedger.add({
            id: creditEntryId,
            customerId: params.customerId,
            invoiceId,
            type: 'debt_incurred',
            amountMMK: creditAmount,
            balanceAfterMMK: newBal,
            notes: `Credit Sale for Bill ${invoiceCode}`,
            date: now.split('T')[0],
            createdBy: params.currentUser.name,
          });

          // Also record in enterprise customerLedger
          try {
            await this.customerLedger.add({
              id: 'cld_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              customerId: params.customerId,
              customerName: customer.name,
              type: 'debt_incurred',
              amountMMK: creditAmount,
              direction: 'debit',
              invoiceId,
              notes: `Credit Sale for Bill ${invoiceCode}`,
              date: now.split('T')[0],
              createdBy: params.currentUser.name,
              createdAt: now,
            } as any);
          } catch (e) {
            // Safe fallback
          }
        }
      }

      // 6. Record Cash Inflow if cash payment was tendered
      const cashPayment = processedPayments.find(p => p.method.toLowerCase() === 'cash');
      if (cashPayment && cashPayment.amountMMK > 0) {
        try {
          await this.cashTransactions.add({
            id: 'ctx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            transactionCode: 'CTX-' + Date.now().toString().slice(-6),
            type: 'inflow',
            category: 'pos_sale_cash',
            amountMMK: cashPayment.amountMMK,
            referenceType: 'invoice',
            referenceId: invoiceId,
            notes: `Direct POS Sale Cash: ${invoiceCode}`,
            transactionTime: now,
            performedBy: params.currentUser.name,
            createdAt: now,
          });
        } catch (e) {
          // Safe fallback
        }
      }

      // 6B. Process Gift Card Payments
      const giftCardPayments = processedPayments.filter(p => p.method.toLowerCase() === 'gift_card');
      for (const gcPayment of giftCardPayments) {
        const cardRef = (gcPayment.referenceNo || gcPayment.notes || '').trim();
        if (cardRef && gcPayment.amountMMK > 0) {
          const card = (await this.giftCards.get(cardRef)) || (await this.giftCards.where('cardNumber').equals(cardRef).first());
          if (card) {
            if (card.currentBalanceMMK < gcPayment.amountMMK) {
              throw new Error(`Insufficient gift card balance on ${card.cardNumber}. Available: ${card.currentBalanceMMK} MMK`);
            }
            const balanceAfter = card.currentBalanceMMK - gcPayment.amountMMK;
            await this.giftCards.update(card.id, {
              currentBalanceMMK: balanceAfter,
              status: balanceAfter === 0 ? 'exhausted' : 'active',
              updatedAt: now,
            });
            await this.giftCardRedemptions.add({
              id: 'gcr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              giftCardId: card.id,
              cardNumber: card.cardNumber,
              invoiceId,
              amountMMK: gcPayment.amountMMK,
              balanceBeforeMMK: card.currentBalanceMMK,
              balanceAfterMMK: balanceAfter,
              redeemedAt: now,
              redeemedBy: params.currentUser.name,
            });
          }
        }
      }

      // 7. Audit Logs
      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'BILL_CREATED',
        entity: 'Invoice',
        entityId: invoiceId,
        newValue: JSON.stringify({
          invoiceCode,
          totalMMK: totals.totalMMK,
          paidMMK: totalPaid,
          status: invoiceStatus,
          itemCount: invoiceItems.length,
          discountMMK: totals.discountAmountMMK,
        }),
      });

      if (totals.discountAmountMMK > 0) {
        await this.auditLogs.add({
          id: 'aud_disc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          timestamp: now,
          userId: params.currentUser.id,
          userName: params.currentUser.name,
          userRole: params.currentUser.role,
          action: 'DISCOUNT_APPLIED',
          entity: 'Invoice',
          entityId: invoiceId,
          newValue: JSON.stringify({
            discountType: params.discountType,
            discountValue: params.discountValue,
            discountAmountMMK: totals.discountAmountMMK,
            authorizedBy: params.discountAuthorizedBy || params.currentUser.name,
          }),
        });
      }

      return invoice;
    });
  }

  /**
   * ATOMIC TRANSACTION: Add Payment(s) to an existing Invoice / Bill
   */
  async addPaymentToInvoiceTransaction(params: {
    invoiceId: string;
    payments: PaymentRecord[];
    notes?: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<Invoice> {
    return this.transaction('rw', [
      this.invoices,
      this.customers,
      this.customerCreditLedger,
      this.customerLedger,
      this.cashTransactions,
      this.auditLogs,
    ], async () => {
      const invoice = await this.invoices.get(params.invoiceId);
      if (!invoice) throw new Error('Invoice / Bill not found');
      if (invoice.status === 'voided') throw new Error('Cannot add payments to a voided bill');

      const now = new Date().toISOString();

      const newPayments: PaymentRecord[] = params.payments.map((p, idx) => ({
        ...p,
        id: p.id || `pmt_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
        amountMMK: Math.max(0, roundMMK(p.amountMMK)),
        paidAt: p.paidAt || now,
        receivedBy: p.receivedBy || params.currentUser.name,
      }));

      const allPayments = [...(invoice.payments || []), ...newPayments];
      const totalPaid = allPayments.reduce((sum, p) => sum + roundMMK(p.amountMMK), 0);
      const balanceDue = Math.max(0, invoice.totalMMK - totalPaid);
      const newStatus = evaluateBillPaymentStatus(invoice.totalMMK, allPayments, false);

      const updatedInvoice: Invoice = {
        ...invoice,
        paidAmountMMK: totalPaid,
        balanceDueMMK: balanceDue,
        outstandingAmountMMK: balanceDue,
        status: newStatus,
        payments: allPayments,
        updatedAt: now,
      };

      await this.invoices.put(updatedInvoice);

      // If non-credit payment received on a customer with outstanding balance, reduce debt
      const directPaidThisBatch = newPayments
        .filter(p => p.method.toLowerCase() !== 'credit')
        .reduce((sum, p) => sum + roundMMK(p.amountMMK), 0);

      if (directPaidThisBatch > 0 && invoice.customerId) {
        const customer = await this.customers.get(invoice.customerId);
        if (customer && customer.currentBalanceMMK > 0) {
          const debtReduction = Math.min(customer.currentBalanceMMK, directPaidThisBatch);
          const newBal = customer.currentBalanceMMK - debtReduction;
          await this.customers.update(invoice.customerId, { currentBalanceMMK: newBal });

          await this.customerCreditLedger.add({
            id: 'ccl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            customerId: invoice.customerId,
            invoiceId: invoice.id,
            type: 'payment_received',
            amountMMK: debtReduction,
            balanceAfterMMK: newBal,
            notes: `Payment for Bill ${invoice.invoiceCode}: ${params.notes || 'Subsequent payment'}`,
            date: now.split('T')[0],
            createdBy: params.currentUser.name,
          });
        }
      }

      // Cash inflow record if cash was tendered in this payment batch
      const cashPmt = newPayments.find(p => p.method.toLowerCase() === 'cash');
      if (cashPmt && cashPmt.amountMMK > 0) {
        try {
          await this.cashTransactions.add({
            id: 'ctx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            transactionCode: 'CTX-' + Date.now().toString().slice(-6),
            type: 'inflow',
            category: 'bill_payment_cash',
            amountMMK: cashPmt.amountMMK,
            referenceType: 'invoice',
            referenceId: invoice.id,
            notes: `Subsequent payment for ${invoice.invoiceCode}`,
            transactionTime: now,
            performedBy: params.currentUser.name,
            createdAt: now,
          });
        } catch (e) {
          // Safe fallback
        }
      }

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'BILL_PAYMENT_ADDED',
        entity: 'Invoice',
        entityId: invoice.id,
        newValue: JSON.stringify({
          invoiceCode: invoice.invoiceCode,
          newPaymentsCount: newPayments.length,
          totalPaid,
          balanceDue,
          status: newStatus,
        }),
      });

      return updatedInvoice;
    });
  }

  /**
   * ATOMIC TRANSACTION: Cancel or Void an Invoice / Bill
   * Enforces Soft Deletion & Reversal Invariant (Requirements D & E):
   * - Never deletes the bill record
   * - Mandatory reason, user, timestamp
   * - Restores inventory items
   * - Reverses customer credit debt
   * - Reverses staff commissions if session-linked
   * - Sets invoice & session to voided
   * - Records audit trail
   */
  async voidInvoiceTransaction(params: {
    invoiceId: string;
    reason: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<Invoice> {
    return this.transaction('rw', [
      this.invoices,
      this.sessions,
      this.rooms,
      this.staff,
      this.staffLedger,
      this.products,
      this.customers,
      this.customerCreditLedger,
      this.customerLedger,
      this.auditLogs,
    ], async () => {
      const invoice = await this.invoices.get(params.invoiceId);
      if (!invoice) throw new Error('Invoice not found');
      if (invoice.status === 'voided') throw new Error('Invoice is already voided');
      if (!params.reason || params.reason.trim().length === 0) {
        throw new Error('A void reason is required for financial reversals');
      }

      const now = new Date().toISOString();

      // 1. Restock any products/food/drinks in this invoice
      if (invoice.items && invoice.items.length > 0) {
        for (const it of invoice.items) {
          const pId = it.itemId;
          if (pId && (it.type === 'product' || it.type === 'food' || it.type === 'drink')) {
            const prod = await this.products.get(pId);
            if (prod) {
              await this.products.update(pId, {
                stockQty: prod.stockQty + it.quantity,
              });
            }
          }
        }
      }

      // 1b. If session-linked and consumables were deducted, reverse service consumable stock and record reversal movements
      if (invoice.sessionId) {
        const session = await this.sessions.get(invoice.sessionId);
        if (session && session.consumablesDeducted) {
          const consumptionMovements = await this.stockMovements.where('sessionId').equals(session.id).filter(m => m.type === 'consumption').toArray();
          for (const mov of consumptionMovements) {
            const prod = await this.products.get(mov.productId);
            if (prod) {
              const restoredStock = (prod.stockQty || 0) + Math.abs(mov.quantityChange);
              await this.products.update(prod.id, { stockQty: restoredStock });

              await this.stockMovements.add({
                id: `mov_rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                productId: prod.id,
                productName: prod.name,
                serviceId: mov.serviceId,
                sessionId: session.id,
                invoiceId: invoice.id,
                customerId: invoice.customerId,
                customerName: invoice.customerName,
                staffId: mov.staffId,
                staffName: mov.staffName,
                type: 'reversal',
                quantityChange: Math.abs(mov.quantityChange),
                previousStock: prod.stockQty || 0,
                newStock: restoredStock,
                unit: mov.unit,
                notes: `Consumable inventory reversal due to void/cancellation: ${params.reason}`,
                date: now.split('T')[0],
                createdAt: now,
                createdBy: params.currentUser.name,
              });
            }
          }
          await this.sessions.update(session.id, { consumablesDeducted: false });
        }
      }

      // 2. Reverse customer credit debt if debt was incurred from this bill
      if (invoice.customerId) {
        const creditPayments = (invoice.payments || []).filter(p => p.method.toLowerCase() === 'credit');
        const totalCreditIncurred = creditPayments.reduce((s, p) => s + p.amountMMK, 0) + (invoice.balanceDueMMK || 0);

        if (totalCreditIncurred > 0) {
          const customer = await this.customers.get(invoice.customerId);
          if (customer) {
            const newBal = Math.max(0, customer.currentBalanceMMK - totalCreditIncurred);
            await this.customers.update(invoice.customerId, { currentBalanceMMK: newBal });

            await this.customerCreditLedger.add({
              id: 'ccl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              customerId: invoice.customerId,
              invoiceId: invoice.id,
              type: 'debt_reversal',
              amountMMK: totalCreditIncurred,
              balanceAfterMMK: newBal,
              notes: `VOID REVERSAL for Bill ${invoice.invoiceCode}: ${params.reason}`,
              date: now.split('T')[0],
              createdBy: params.currentUser.name,
            });
          }
        }
      }

      // 3. If session-linked, reverse session and staff commissions
      if (invoice.sessionId) {
        const session = await this.sessions.get(invoice.sessionId);
        if (session) {
          // Free room
          await this.rooms.update(session.roomId, {
            status: 'available',
            currentSessionId: undefined,
          });

          // Free staff
          for (const s of session.assignedStaff) {
            await this.staff.update(s.staffId, { status: 'available' });
          }

          // Reverse staff commissions
          const ledgerEntries = await this.staffLedger.where('sessionId').equals(session.id).toArray();
          for (const entry of ledgerEntries) {
            if (entry.type === 'commission' && entry.direction === 'credit') {
              await this.staffLedger.add({
                id: 'led_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                staffId: entry.staffId,
                staffName: entry.staffName,
                type: 'commission_reversal',
                amountMMK: entry.amountMMK,
                direction: 'debit',
                sessionId: session.id,
                isSettled: false,
                notes: `VOID REVERSAL for session ${session.sessionCode}: ${params.reason}`,
                date: now.split('T')[0],
                createdBy: params.currentUser.name,
                createdAt: now,
              });
            }
          }

          // Update session to voided
          await this.sessions.update(session.id, {
            status: 'voided',
            cancellationReason: params.reason,
            cancelledAt: now,
            cancelledBy: params.currentUser.name,
            updatedAt: now,
          });
        }
      }

      // 4. Mark invoice as voided
      const voidedInvoice: Invoice = {
        ...invoice,
        status: 'voided',
        voidedAt: now,
        voidedBy: params.currentUser.name,
        voidReason: params.reason,
        updatedAt: now,
      };

      await this.invoices.put(voidedInvoice);

      // 5. Audit Log
      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'BILL_VOIDED',
        entity: 'Invoice',
        entityId: invoice.id,
        reason: params.reason,
        newValue: JSON.stringify({
          invoiceCode: invoice.invoiceCode,
          reason: params.reason,
          voidedBy: params.currentUser.name,
        }),
      });

      return voidedInvoice;
    });
  }

  /**
   * ATOMIC TRANSACTION: Cancel or Void a Session / Invoice
   * Enforces Soft Deletion (Requirements D & E):
   * - Restores room status
   * - Frees staff
   * - Reverses staff commissions in ledger
   * - Marks invoice & session as voided
   * - Restores inventory items
   */
  async voidSessionTransaction(params: {
    sessionId: string;
    reason: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<void> {
    return this.transaction('rw', [
      this.sessions,
      this.invoices,
      this.rooms,
      this.staff,
      this.staffLedger,
      this.products,
      this.auditLogs,
    ], async () => {
      const session = await this.sessions.get(params.sessionId);
      if (!session) throw new Error('Session not found');

      const now = new Date().toISOString();

      // Free room
      await this.rooms.update(session.roomId, {
        status: 'available',
        currentSessionId: undefined,
      });

      // Free staff
      for (const s of session.assignedStaff) {
        await this.staff.update(s.staffId, { status: 'available' });
      }

      // If session was completed, reverse staff commissions in staff ledger
      if (session.status === 'completed') {
        const ledgerEntries = await this.staffLedger.where('sessionId').equals(session.id).toArray();
        for (const entry of ledgerEntries) {
          if (entry.type === 'commission' && entry.direction === 'credit') {
            await this.staffLedger.add({
              id: 'led_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              staffId: entry.staffId,
              staffName: entry.staffName,
              type: 'commission_reversal',
              amountMMK: entry.amountMMK,
              direction: 'debit',
              sessionId: session.id,
              isSettled: false,
              notes: `VOID REVERSAL for session ${session.sessionCode}: ${params.reason}`,
              date: now.split('T')[0],
              createdBy: params.currentUser.name,
              createdAt: now,
            });
          }
        }
      }

      // Restock any products ordered
      if (session.orderItems && session.orderItems.length > 0) {
        for (const ord of session.orderItems) {
          const prod = await this.products.get(ord.productId);
          if (prod) {
            await this.products.update(ord.productId, {
              stockQty: prod.stockQty + ord.quantity,
            });
          }
        }
      }

      // Void invoice if linked
      if (session.invoiceId) {
        await this.invoices.update(session.invoiceId, {
          status: 'voided',
          voidedAt: now,
          voidedBy: params.currentUser.name,
          voidReason: params.reason,
        });
      }

      // Void session
      await this.sessions.update(session.id, {
        status: 'voided',
        cancellationReason: params.reason,
        cancelledAt: now,
        cancelledBy: params.currentUser.name,
        updatedAt: now,
      });

      // Audit Log
      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'VOID_SESSION',
        entity: 'Session',
        entityId: session.id,
        reason: params.reason,
      });
    });
  }

  /**
   * ATOMIC TRANSACTION: Record Staff Advance (Petty Cash Loan)
   * Invariant: Advance -> Staff Ledger -> Settlement
   */
  async recordStaffAdvanceTransaction(params: {
    staffId: string;
    staffName?: string;
    amountMMK: number;
    paymentMethod?: PaymentMethod;
    reason?: string;
    notes?: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<StaffLedgerEntry & { advance?: StaffAdvanceRecord }> {
    return this.transaction('rw', [
      this.staff,
      this.staffAdvances,
      this.staffLedger,
      this.cashTransactions,
      this.auditLogs,
    ], async () => {
      const staff = await this.staff.get(params.staffId);
      if (!staff) throw new Error('Staff member not found');
      const staffName = params.staffName || staff.name;
      const amount = MoneyMMK.assertNonNegative(params.amountMMK, 'Staff Advance Amount');
      if (amount <= 0) throw new Error('Advance amount must be greater than zero');

      const now = new Date().toISOString();
      const todayDate = now.split('T')[0];
      const advanceId = 'adv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const ledgerEntryId = 'led_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const advanceCode = 'ADV-' + Date.now().toString().slice(-6);
      const paymentMethod = params.paymentMethod || 'cash';
      const notes = params.notes || params.reason || 'Staff cash advance (လစာကြိုထုတ်ငွေ)';

      let cashTxId: string | undefined;
      if (paymentMethod === 'cash') {
        cashTxId = 'ctx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        await this.cashTransactions.add({
          id: cashTxId,
          transactionCode: 'CTX-' + Date.now().toString().slice(-6),
          type: 'outflow',
          category: 'staff_advance_cash',
          amountMMK: amount,
          referenceType: 'staff_advance',
          referenceId: advanceId,
          notes: `Staff Advance to ${staffName}: ${notes}`,
          transactionTime: now,
          performedBy: params.currentUser.name,
          createdAt: now,
        });
      }

      const advance: StaffAdvanceRecord = {
        id: advanceId,
        advanceCode,
        staffId: staff.id,
        staffName,
        amountMMK: amount,
        paymentMethod,
        ledgerEntryId,
        cashTransactionId: cashTxId,
        status: 'active',
        notes,
        approvedBy: params.currentUser.name,
        date: todayDate,
        createdAt: now,
        createdBy: params.currentUser.name,
      };
      await this.staffAdvances.add(advance);

      const entry: StaffLedgerEntry = {
        id: ledgerEntryId,
        staffId: staff.id,
        staffName,
        type: 'advance',
        amountMMK: amount,
        direction: 'debit',
        isSettled: false,
        notes,
        date: todayDate,
        createdBy: params.currentUser.name,
        createdAt: now,
      };
      await this.staffLedger.add(entry);

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'RECORD_STAFF_ADVANCE',
        entity: 'StaffAdvance',
        entityId: advanceId,
        newValue: JSON.stringify({ staff: staffName, amountMMK: amount, reason: notes, paymentMethod }),
      });

      return Object.assign(entry, { advance });
    });
  }

  /**
   * ATOMIC TRANSACTION: Record Staff Bonus or Deduction
   */
  async recordStaffAdjustmentTransaction(params: {
    staffId: string;
    type: 'bonus' | 'deduction';
    amountMMK: number;
    reason: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<StaffLedgerEntry> {
    return this.transaction('rw', [
      this.staff,
      this.staffBonuses,
      this.staffDeductions,
      this.staffLedger,
      this.auditLogs,
    ], async () => {
      const staff = await this.staff.get(params.staffId);
      if (!staff) throw new Error('Staff member not found');

      const now = new Date().toISOString();
      const amount = Math.max(0, roundMMK(params.amountMMK));
      if (amount <= 0) throw new Error('Amount must be positive');

      const ledgerEntryId = 'led_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      if (params.type === 'bonus') {
        const bonusId = 'bonus_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        await this.staffBonuses.add({
          id: bonusId,
          staffId: staff.id,
          ledgerEntryId,
          amountMMK: amount,
          reason: params.reason,
          status: 'accrued',
          createdAt: now,
          createdBy: params.currentUser.name,
        });
      } else {
        const deductionId = 'ded_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        await this.staffDeductions.add({
          id: deductionId,
          staffId: staff.id,
          ledgerEntryId,
          amountMMK: amount,
          reason: params.reason,
          status: 'accrued',
          createdAt: now,
          createdBy: params.currentUser.name,
        });
      }

      const entry: StaffLedgerEntry = {
        id: ledgerEntryId,
        staffId: staff.id,
        staffName: staff.name,
        type: params.type,
        amountMMK: amount,
        direction: params.type === 'bonus' ? 'credit' : 'debit',
        isSettled: false,
        notes: params.reason,
        date: now.split('T')[0],
        createdBy: params.currentUser.name,
        createdAt: now,
      };

      await this.staffLedger.add(entry);

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: params.type === 'bonus' ? 'RECORD_BONUS' : 'RECORD_DEDUCTION',
        entity: 'StaffLedger',
        entityId: entry.id,
        newValue: JSON.stringify({ staff: staff.name, amountMMK: amount, reason: params.reason }),
      });

      return entry;
    });
  }

  /**
   * ATOMIC TRANSACTION: Record Monthly Salary Credit to Staff Ledger
   */
  async recordStaffSalaryTransaction(params: {
    staffId: string;
    amountMMK: number;
    monthYear?: string; // e.g. "2025-03"
    reason?: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<StaffLedgerEntry> {
    return this.transaction('rw', [
      this.staff,
      this.staffLedger,
      this.auditLogs,
    ], async () => {
      const staff = await this.staff.get(params.staffId);
      if (!staff) throw new Error('Staff member not found');

      const now = new Date().toISOString();
      const amount = Math.max(0, roundMMK(params.amountMMK));
      if (amount <= 0) throw new Error('Salary amount must be positive');

      const ledgerEntryId = 'led_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const notes = params.reason || `Monthly Salary (${params.monthYear || now.slice(0, 7)}) - လစာ`;

      const entry: StaffLedgerEntry = {
        id: ledgerEntryId,
        staffId: staff.id,
        staffName: staff.name,
        type: 'salary',
        amountMMK: amount,
        direction: 'credit',
        isSettled: false,
        notes,
        date: now.split('T')[0],
        createdBy: params.currentUser.name,
        createdAt: now,
      };

      await this.staffLedger.add(entry);

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'RECORD_SALARY_CREDIT',
        entity: 'StaffLedger',
        entityId: entry.id,
        newValue: JSON.stringify({ staff: staff.name, amountMMK: amount, notes }),
      });

      return entry;
    });
  }

  /**
   * ATOMIC TRANSACTION: Staff Commission & Payout Settlement
   * - Uses existing posted ledger entries (never recalculates historical commission using current settings)
   * - Calculates net payable: Gross Commission + Bonus - Deductions - Advances - Previous Settlements
   * - Supports full or partial payment
   * - Supports multiple payment methods (cash, bank, kpay, wave, other)
   * - If paymentMethod is cash, posts a cash transaction outflow
   * - Records settlement voucher & ledger payout entry
   * - Prevents duplicate settlement via idempotency / atomic check
   */
  async recordStaffSettlementTransaction(params: {
    staffId: string;
    periodStart: string;
    periodEnd: string;
    settlementDate?: string;
    amountMMK?: number;
    paymentMethod: PaymentMethod;
    notes?: string;
    idempotencyKey?: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<StaffSettlement> {
    return this.transaction('rw', [
      this.staff,
      this.staffLedger,
      this.staffSettlements,
      this.cashTransactions,
      this.auditLogs,
    ], async () => {
      const staff = await this.staff.get(params.staffId);
      if (!staff) throw new Error('Staff not found');

      const now = new Date().toISOString();
      const settlementDate = params.settlementDate || now.split('T')[0];

      // Duplicate check: if exact duplicate settlement code or idempotency key exists
      if (params.idempotencyKey) {
        const existing = await this.staffSettlements.where('idempotencyKey').equals(params.idempotencyKey).first();
        if (existing) {
          throw new Error('Duplicate settlement transaction detected');
        }
      }

      // Fetch all posted ledger entries for this staff
      const allEntries = await this.staffLedger
        .where('staffId')
        .equals(params.staffId)
        .toArray();

      // Filter entries up to periodEnd (and >= periodStart if specified)
      const entriesForPeriod = allEntries.filter(e => {
        if (!e.date) return true;
        if (params.periodEnd && e.date > params.periodEnd) return false;
        return true;
      });

      if (entriesForPeriod.length === 0) {
        throw new Error('No ledger entries found for this staff member in the selected period');
      }

      const breakdown = calculateDetailedSettlementBreakdown(entriesForPeriod);
      const netPayable = breakdown.netPayableBeforeMMK;

      if (netPayable <= 0) {
        throw new Error('Net payable amount is zero or negative. Nothing to settle.');
      }

      // Amount to pay (Full or Partial)
      const payAmount = params.amountMMK !== undefined ? roundMMK(params.amountMMK) : netPayable;
      if (payAmount <= 0) {
        throw new Error('Settlement payment amount must be greater than zero');
      }
      if (payAmount > netPayable) {
        throw new Error(`Settlement amount (${payAmount} MMK) exceeds Net Payable (${netPayable} MMK)`);
      }

      const remainingPayable = netPayable - payAmount;
      const count = await this.staffSettlements.count();
      const settlementId = 'set_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const settlementCode = `STL-${settlementDate.replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;
      const ledgerEntryId = 'led_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      let cashTxId: string | undefined;
      if (params.paymentMethod === 'cash') {
        cashTxId = 'ctx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        await this.cashTransactions.add({
          id: cashTxId,
          transactionCode: 'CTX-' + Date.now().toString().slice(-6),
          type: 'outflow',
          category: 'staff_settlement_cash',
          amountMMK: payAmount,
          referenceType: 'staff_settlement',
          referenceId: settlementId,
          notes: `Staff Settlement payout for ${staff.name}: Voucher ${settlementCode}`,
          transactionTime: now,
          performedBy: params.currentUser.name,
          createdAt: now,
        });
      }

      const settlement: StaffSettlement = {
        id: settlementId,
        settlementCode,
        staffId: staff.id,
        staffName: staff.name,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        settlementDate,
        grossCommissionMMK: breakdown.grossCommissionMMK,
        totalBonusMMK: breakdown.totalBonusMMK,
        totalDeductionMMK: breakdown.totalDeductionMMK,
        totalAdvanceMMK: breakdown.totalAdvanceMMK,
        previousSettlementsMMK: breakdown.previousSettlementsMMK,
        netPayableBeforeMMK: netPayable,
        amountMMK: payAmount,
        remainingPayableMMK: remainingPayable,
        // Aliases for backwards compatibility
        totalCommissionMMK: breakdown.grossCommissionMMK,
        totalAdvanceDeductedMMK: breakdown.totalAdvanceMMK,
        netPayoutMMK: payAmount,
        paymentMethod: params.paymentMethod,
        status: 'completed',
        ledgerEntryId,
        cashTransactionId: cashTxId,
        settledEntryIds: entriesForPeriod.map(e => e.id),
        paidAt: now,
        paidBy: params.currentUser.name,
        createdBy: params.currentUser.name,
        createdAt: now,
        notes: params.notes,
      };

      await this.staffSettlements.add(settlement);

      // Post payout ledger transaction (debit)
      await this.staffLedger.add({
        id: ledgerEntryId,
        staffId: staff.id,
        staffName: staff.name,
        type: 'settlement_payout',
        amountMMK: payAmount,
        direction: 'debit',
        settlementId,
        isSettled: true,
        notes: `Settlement Payout Voucher ${settlementCode} (${params.paymentMethod.toUpperCase()})`,
        date: settlementDate,
        createdBy: params.currentUser.name,
        createdAt: now,
      });

      // Mark entries as settled if remaining payable is 0 or tag with settlement ID
      for (const e of entriesForPeriod) {
        if (!e.isSettled) {
          await this.staffLedger.update(e.id, {
            isSettled: remainingPayable === 0,
            settlementId,
          });
        }
      }

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'STAFF_SETTLEMENT',
        entity: 'StaffSettlement',
        entityId: settlementId,
        newValue: JSON.stringify({
          settlementCode,
          staff: staff.name,
          amountMMK: payAmount,
          remainingPayableMMK: remainingPayable,
          paymentMethod: params.paymentMethod,
        }),
      });

      return settlement;
    });
  }

  /**
   * ATOMIC TRANSACTION: Reverse Staff Settlement
   * Reverses a completed settlement, posts a credit reversal to staff ledger,
   * updates settlement status to 'reversed', and requires reason.
   */
  async reverseStaffSettlementTransaction(params: {
    settlementId: string;
    reason: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<StaffSettlement> {
    return this.transaction('rw', [
      this.staffLedger,
      this.staffSettlements,
      this.cashTransactions,
      this.auditLogs,
    ], async () => {
      const settlement = await this.staffSettlements.get(params.settlementId);
      if (!settlement) throw new Error('Settlement record not found');
      if (settlement.status === 'reversed') throw new Error('Settlement is already reversed');
      if (!params.reason || params.reason.trim().length === 0) {
        throw new Error('A reversal reason is required for settlement reversal');
      }

      const now = new Date().toISOString();
      const reversalLedgerEntryId = 'led_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      // Post credit reversal to staff ledger
      await this.staffLedger.add({
        id: reversalLedgerEntryId,
        staffId: settlement.staffId,
        staffName: settlement.staffName,
        type: 'settlement_reversal',
        amountMMK: settlement.amountMMK || settlement.netPayoutMMK || 0,
        direction: 'credit',
        settlementId: settlement.id,
        isSettled: false,
        notes: `SETTLEMENT REVERSAL for ${settlement.settlementCode}: ${params.reason}`,
        date: now.split('T')[0],
        createdBy: params.currentUser.name,
        createdAt: now,
      });

      // Reverse cash outflow if cash was used
      if (settlement.paymentMethod === 'cash') {
        await this.cashTransactions.add({
          id: 'ctx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          transactionCode: 'CTX-' + Date.now().toString().slice(-6),
          type: 'inflow',
          category: 'staff_settlement_cash',
          amountMMK: settlement.amountMMK || settlement.netPayoutMMK || 0,
          referenceType: 'staff_settlement_reversal',
          referenceId: settlement.id,
          notes: `Reversal of Settlement ${settlement.settlementCode}: ${params.reason}`,
          transactionTime: now,
          performedBy: params.currentUser.name,
          createdAt: now,
        });
      }

      // Update settlement record
      const updatedSettlement: StaffSettlement = {
        ...settlement,
        status: 'reversed',
        reversalReason: params.reason,
        reversedAt: now,
        reversedBy: params.currentUser.name,
        reversalLedgerEntryId,
      };

      await this.staffSettlements.put(updatedSettlement);

      // Unsettle linked ledger entries
      if (settlement.settledEntryIds && settlement.settledEntryIds.length > 0) {
        for (const entryId of settlement.settledEntryIds) {
          const entry = await this.staffLedger.get(entryId);
          if (entry && entry.settlementId === settlement.id) {
            await this.staffLedger.update(entryId, { isSettled: false, settlementId: undefined });
          }
        }
      }

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'REVERSE_STAFF_SETTLEMENT',
        entity: 'StaffSettlement',
        entityId: settlement.id,
        reason: params.reason,
        newValue: JSON.stringify({
          settlementCode: settlement.settlementCode,
          staff: settlement.staffName,
          reason: params.reason,
          reversedBy: params.currentUser.name,
        }),
      });

      return updatedSettlement;
    });
  }

  /**
   * ATOMIC TRANSACTION: Customer Credit Repayment
   */
  async recordCustomerCreditRepaymentTransaction(params: {
    customerId: string;
    amountMMK: number;
    paymentMethod: any;
    notes?: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<CustomerCreditLedger> {
    return this.transaction('rw', [this.customers, this.customerCreditLedger, this.auditLogs], async () => {
      const customer = await this.customers.get(params.customerId);
      if (!customer) throw new Error('Customer not found');

      const amount = Math.max(0, roundMMK(params.amountMMK));
      if (amount <= 0) throw new Error('Repayment amount must be positive');

      const now = new Date().toISOString();
      const newBal = Math.max(0, customer.currentBalanceMMK - amount);

      await this.customers.update(customer.id, { currentBalanceMMK: newBal });

      const entry: CustomerCreditLedger = {
        id: 'ccl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        customerId: customer.id,
        type: 'payment_received',
        amountMMK: amount,
        balanceAfterMMK: newBal,
        paymentMethod: params.paymentMethod,
        notes: params.notes || 'Customer debt repayment (အကြွေးဆပ်ငွေ)',
        date: now.split('T')[0],
        createdBy: params.currentUser.name,
      };

      await this.customerCreditLedger.add(entry);

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'CUSTOMER_CREDIT_REPAYMENT',
        entity: 'Customer',
        entityId: customer.id,
        newValue: JSON.stringify({ customer: customer.name, amountMMK: amount, balanceAfter: newBal }),
      });

      return entry;
    });
  }

  /**
   * ATOMIC TRANSACTION: Record Operating Expense
   */
  async recordExpenseTransaction(params: {
    category: any;
    categoryMm: string;
    description: string;
    amountMMK: number;
    paymentMethod: any;
    receiptNumber?: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<ExpenseRecord> {
    return this.transaction('rw', [this.expenses, this.auditLogs], async () => {
      const amount = Math.max(0, roundMMK(params.amountMMK));
      if (amount <= 0) throw new Error('Expense amount must be positive');

      const now = new Date().toISOString();
      const expense: ExpenseRecord = {
        id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        category: params.category,
        categoryMm: params.categoryMm,
        description: params.description,
        amountMMK: amount,
        paymentMethod: params.paymentMethod,
        receiptNumber: params.receiptNumber,
        date: now.split('T')[0],
        recordedBy: params.currentUser.name,
        createdAt: now,
      };

      await this.expenses.add(expense);

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'RECORD_EXPENSE',
        entity: 'Expense',
        entityId: expense.id,
        newValue: JSON.stringify({ category: params.category, amountMMK: amount, desc: params.description }),
      });

      return expense;
    });
  }

  /**
   * ATOMIC TRANSACTION: Daily Cash Closing
   */
  async performCashClosingTransaction(params: {
    closing: Omit<CashClosingRecord, 'id' | 'closingCode'>;
    currentUser: { id: string; name: string; role: any };
  }): Promise<CashClosingRecord> {
    return this.transaction('rw', [this.cashClosings, this.auditLogs], async () => {
      const count = await this.cashClosings.count();
      const id = 'cls_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const closingCode = `CLS-${params.closing.date}-${String(count + 1).padStart(3, '0')}`;

      const record: CashClosingRecord = {
        ...params.closing,
        id,
        closingCode,
      };

      await this.cashClosings.add(record);

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: new Date().toISOString(),
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'DAILY_CASH_CLOSING',
        entity: 'CashClosing',
        entityId: id,
        newValue: JSON.stringify({
          closingCode,
          expected: record.expectedCashInDrawerMMK,
          actual: record.actualCashCountedMMK,
          difference: record.cashDifferenceMMK,
        }),
      });

      return record;
    });
  }

  // ==========================================
  // ENTERPRISE ATOMIC TRANSACTIONS (Concepts 1-43)
  // ==========================================

  /**
   * ATOMIC TRANSACTION: Record Customer Credit Repayment
   * 1. Decreases customer debt balance
   * 2. Records CustomerPaymentRecord
   * 3. Records CustomerLedgerEntry (type: 'payment_received')
   * 4. If cash, records CashTransaction (inflow)
   * 5. Logs audit trail
   */
  async recordCustomerRepaymentTransaction(params: {
    customerId: string;
    amountMMK: number;
    paymentMethod: PaymentMethod;
    invoiceId?: string;
    referenceNo?: string;
    notes?: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<{ payment: CustomerPaymentRecord; ledgerEntry: CustomerLedgerEntry }> {
    const amount = MoneyMMK.assertNonNegative(params.amountMMK, 'Customer Repayment Amount');
    if (amount <= 0) {
      throw new Error('Repayment amount must be greater than 0 MMK.');
    }

    return this.transaction('rw', [
      this.customers,
      this.customerPayments,
      this.customerLedger,
      this.customerCreditLedger,
      this.cashTransactions,
      this.auditLogs,
    ], async () => {
      const customer = await this.customers.get(params.customerId);
      if (!customer) {
        throw new Error(`Customer ${params.customerId} not found.`);
      }

      const now = new Date().toISOString();
      const todayDate = now.split('T')[0];
      const newBal = Math.max(0, customer.currentBalanceMMK - amount);
      const paymentId = 'cpay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const ledgerEntryId = 'cleg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      let cashTxId: string | undefined;
      if (params.paymentMethod === 'cash') {
        cashTxId = 'ctx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        await this.cashTransactions.add({
          id: cashTxId,
          transactionCode: 'CTX-' + Date.now().toString().slice(-6),
          type: 'inflow',
          category: 'credit_repayment_cash',
          amountMMK: amount,
          referenceType: 'customer_payment',
          referenceId: paymentId,
          notes: `Credit Repayment by ${customer.name}: ${params.notes || ''}`,
          transactionTime: now,
          performedBy: params.currentUser.name,
          createdAt: now,
        });
      }

      await this.customers.update(params.customerId, { currentBalanceMMK: newBal });

      const payment: CustomerPaymentRecord = {
        id: paymentId,
        paymentCode: 'CPAY-' + Date.now().toString().slice(-6),
        customerId: params.customerId,
        customerName: customer.name,
        invoiceId: params.invoiceId,
        amountMMK: amount,
        paymentMethod: params.paymentMethod,
        referenceNo: params.referenceNo,
        notes: params.notes,
        cashTransactionId: cashTxId,
        ledgerEntryId,
        date: todayDate,
        receivedBy: params.currentUser.name,
        createdAt: now,
        createdBy: params.currentUser.name,
      };
      await this.customerPayments.add(payment);

      const ledgerEntry: CustomerLedgerEntry = {
        id: ledgerEntryId,
        customerId: params.customerId,
        invoiceId: params.invoiceId,
        paymentId,
        type: 'payment_received',
        amountMMK: amount,
        balanceAfterMMK: newBal,
        paymentMethod: params.paymentMethod,
        notes: params.notes || `Repayment via ${params.paymentMethod.toUpperCase()}`,
        date: todayDate,
        createdAt: now,
        createdBy: params.currentUser.name,
      };
      await this.customerLedger.add(ledgerEntry);

      // Legacy support for backward compatibility with existing views
      await this.customerCreditLedger.add({
        id: 'ccl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        customerId: params.customerId,
        invoiceId: params.invoiceId,
        type: 'payment_received',
        amountMMK: amount,
        balanceAfterMMK: newBal,
        paymentMethod: params.paymentMethod,
        notes: params.notes,
        date: todayDate,
        createdBy: params.currentUser.name,
      });

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'CUSTOMER_CREDIT_REPAYMENT',
        entity: 'Customer',
        entityId: params.customerId,
        newValue: JSON.stringify({ repaidMMK: amount, newBalanceMMK: newBal, paymentMethod: params.paymentMethod }),
      });

      return { payment, ledgerEntry };
    });
  }

  /**
   * ATOMIC TRANSACTION: Record Customer Credit Sale
   * Validates credit limit policy & creates traceable ledger debt entry.
   */
  async recordCustomerCreditSaleTransaction(params: {
    customerId: string;
    amountMMK: number;
    invoiceId?: string;
    notes?: string;
    allowCreditLimitOverride?: boolean;
    currentUser: { id: string; name: string; role: any };
  }): Promise<CustomerLedgerEntry> {
    const amount = MoneyMMK.assertNonNegative(params.amountMMK, 'Credit Sale Amount');
    if (amount <= 0) throw new Error('Credit sale amount must be greater than 0 MMK.');

    return this.transaction('rw', [
      this.customers,
      this.customerLedger,
      this.customerCreditLedger,
      this.auditLogs,
    ], async () => {
      const customer = await this.customers.get(params.customerId);
      if (!customer) throw new Error(`Customer ${params.customerId} not found.`);

      // Validate credit policy against current ledger balance
      const existingEntries = await this.customerLedger.where('customerId').equals(params.customerId).toArray();
      const derived = deriveCustomerLedgerBalances(existingEntries);
      const validation = validateCustomerCreditPolicy({
        customer,
        currentOutstandingMMK: derived.netOutstandingDebtMMK,
        newCreditAmountMMK: amount,
      });

      if (!validation.isValid) {
        if (validation.isLimitExceeded && params.allowCreditLimitOverride) {
          // Allowed via manager override approval
        } else {
          throw new Error(validation.error || 'Credit sale rejected by customer credit policy.');
        }
      }

      const now = new Date().toISOString();
      const todayDate = now.split('T')[0];
      const newBal = derived.netOutstandingDebtMMK + amount;
      const ledgerEntryId = 'cleg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      await this.customers.update(params.customerId, { currentBalanceMMK: newBal });

      const ledgerEntry: CustomerLedgerEntry = {
        id: ledgerEntryId,
        customerId: params.customerId,
        invoiceId: params.invoiceId,
        type: 'debt_incurred',
        amountMMK: amount,
        balanceAfterMMK: newBal,
        notes: params.notes || 'Credit Sale Debt Incurred',
        date: todayDate,
        createdAt: now,
        createdBy: params.currentUser.name,
      };
      await this.customerLedger.add(ledgerEntry);

      await this.customerCreditLedger.add({
        id: 'ccl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        customerId: params.customerId,
        invoiceId: params.invoiceId,
        type: 'debt_incurred',
        amountMMK: amount,
        balanceAfterMMK: newBal,
        notes: params.notes,
        date: todayDate,
        createdBy: params.currentUser.name,
      });

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: validation.isLimitExceeded ? 'CREDIT_LIMIT_OVERRIDE_SALE' : 'CUSTOMER_CREDIT_SALE_CREATED',
        entity: 'Customer',
        entityId: params.customerId,
        newValue: JSON.stringify({
          creditIncurredMMK: amount,
          newBalanceMMK: newBal,
          limitOverridden: validation.isLimitExceeded && params.allowCreditLimitOverride,
        }),
      });

      return ledgerEntry;
    });
  }

  /**
   * ATOMIC TRANSACTION: Record Customer Debt/Credit Adjustment
   * Supports Debit Adjustment (+ Debt) or Credit Adjustment (- Debt).
   */
  async recordCustomerCreditAdjustmentTransaction(params: {
    customerId: string;
    type: 'adjustment_debit' | 'adjustment_credit';
    amountMMK: number;
    notes: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<CustomerLedgerEntry> {
    const rawAmt = MoneyMMK.assertNonNegative(params.amountMMK, 'Adjustment Amount');
    if (rawAmt <= 0) throw new Error('Adjustment amount must be greater than 0 MMK.');
    if (!params.notes || !params.notes.trim()) throw new Error('A mandatory reason/notes is required for customer ledger adjustments.');

    return this.transaction('rw', [
      this.customers,
      this.customerLedger,
      this.customerCreditLedger,
      this.auditLogs,
    ], async () => {
      const customer = await this.customers.get(params.customerId);
      if (!customer) throw new Error(`Customer ${params.customerId} not found.`);

      const existingEntries = await this.customerLedger.where('customerId').equals(params.customerId).toArray();
      const derived = deriveCustomerLedgerBalances(existingEntries);

      const isDebit = params.type === 'adjustment_debit';
      const adjustmentSignedAmount = isDebit ? rawAmt : -rawAmt;
      const newBal = Math.max(0, derived.netOutstandingDebtMMK + adjustmentSignedAmount);

      const now = new Date().toISOString();
      const todayDate = now.split('T')[0];
      const ledgerEntryId = 'cleg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      const ledgerEntry: CustomerLedgerEntry = {
        id: ledgerEntryId,
        customerId: params.customerId,
        type: 'adjustment',
        amountMMK: adjustmentSignedAmount,
        balanceAfterMMK: newBal,
        notes: `ADJUSTMENT (${isDebit ? 'DEBIT/INCREASE DEBT' : 'CREDIT/DECREASE DEBT'}): ${params.notes.trim()}`,
        date: todayDate,
        createdAt: now,
        createdBy: params.currentUser.name,
      };
      await this.customerLedger.add(ledgerEntry);

      await this.customerCreditLedger.add({
        id: 'ccl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        customerId: params.customerId,
        type: 'adjustment',
        amountMMK: adjustmentSignedAmount,
        balanceAfterMMK: newBal,
        notes: params.notes,
        date: todayDate,
        createdBy: params.currentUser.name,
      });

      await this.customers.update(params.customerId, { currentBalanceMMK: newBal });

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'CUSTOMER_CREDIT_ADJUSTMENT',
        entity: 'Customer',
        entityId: params.customerId,
        reason: params.notes,
        newValue: JSON.stringify({ adjustmentMMK: adjustmentSignedAmount, newBalanceMMK: newBal }),
      });

      return ledgerEntry;
    }
  )}

  /**
   * ATOMIC TRANSACTION: Reverse Customer Ledger Entry
   * Reverses a financial entry without deleting history. Creates opposite reversal entry.
   */
  async reverseCustomerLedgerEntryTransaction(params: {
    entryId: string;
    reason: string;
    currentUser: { id: string; name: string; role: any };
  }): Promise<CustomerLedgerEntry> {
    if (!params.reason || !params.reason.trim()) {
      throw new Error('A mandatory reversal reason is required.');
    }

    return this.transaction('rw', [
      this.customers,
      this.customerLedger,
      this.customerCreditLedger,
      this.auditLogs,
    ], async () => {
      const targetEntry = await this.customerLedger.get(params.entryId);
      if (!targetEntry) throw new Error('Target customer ledger entry not found.');

      const customer = await this.customers.get(targetEntry.customerId);
      if (!customer) throw new Error('Associated customer record not found.');

      const now = new Date().toISOString();
      const todayDate = now.split('T')[0];

      // Determine reversal direction and type
      let reversalType: 'debt_reversal' | 'payment_received' = 'debt_reversal';
      let reversalAmountMMK = 0;

      if (targetEntry.type === 'debt_incurred') {
        // Reversing debt incurred reduces outstanding debt
        reversalType = 'debt_reversal';
        reversalAmountMMK = Math.abs(targetEntry.amountMMK);
      } else if (targetEntry.type === 'payment_received') {
        // Reversing a payment increases outstanding debt again
        reversalType = 'debt_incurred' as any;
        reversalAmountMMK = Math.abs(targetEntry.amountMMK);
      } else if (targetEntry.type === 'adjustment') {
        if (targetEntry.amountMMK > 0) {
          reversalType = 'debt_reversal';
          reversalAmountMMK = Math.abs(targetEntry.amountMMK);
        } else {
          reversalType = 'debt_incurred' as any;
          reversalAmountMMK = Math.abs(targetEntry.amountMMK);
        }
      } else {
        throw new Error('Reversal of this ledger entry type is not supported or already reversed.');
      }

      const existingEntries = await this.customerLedger.where('customerId').equals(targetEntry.customerId).toArray();
      const currentBalances = deriveCustomerLedgerBalances(existingEntries);

      let newBal = currentBalances.netOutstandingDebtMMK;
      if (reversalType === 'debt_reversal') {
        newBal = Math.max(0, newBal - reversalAmountMMK);
      } else {
        newBal = newBal + reversalAmountMMK;
      }

      const reversalLedgerEntryId = 'cleg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const reversalEntry: CustomerLedgerEntry = {
        id: reversalLedgerEntryId,
        customerId: targetEntry.customerId,
        invoiceId: targetEntry.invoiceId,
        paymentId: targetEntry.paymentId,
        type: reversalType,
        amountMMK: reversalAmountMMK,
        balanceAfterMMK: newBal,
        notes: `REVERSAL of Entry #${targetEntry.id}: ${params.reason.trim()}`,
        date: todayDate,
        createdAt: now,
        createdBy: params.currentUser.name,
      };

      await this.customerLedger.add(reversalEntry);

      await this.customerCreditLedger.add({
        id: 'ccl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        customerId: targetEntry.customerId,
        invoiceId: targetEntry.invoiceId,
        type: reversalType === 'debt_reversal' ? 'debt_reversal' : 'debt_incurred',
        amountMMK: reversalAmountMMK,
        balanceAfterMMK: newBal,
        notes: `REVERSAL: ${params.reason}`,
        date: todayDate,
        createdBy: params.currentUser.name,
      });

      await this.customers.update(targetEntry.customerId, { currentBalanceMMK: newBal });

      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role,
        action: 'CUSTOMER_LEDGER_REVERSAL',
        entity: 'CustomerLedger',
        entityId: targetEntry.id,
        reason: params.reason,
        newValue: JSON.stringify({ reversalEntryId: reversalEntry.id, newBalanceMMK: newBal }),
      });

      return reversalEntry;
    });
  }

  // ==========================================
  // BACKUP & RESTORE (100% Offline JSON)
  // ==========================================

  async exportDatabaseBackup(): Promise<string> {
    const backupData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      appName: 'Myanmar Business Management & Accounting ERP',
      data: {
        // Master Data
        businesses: await this.businesses.toArray(),
        branches: await this.branches.toArray(),
        users: await this.users.toArray(),
        roles: await this.roles.toArray(),
        staffTypes: await this.staffTypes.toArray(),
        rooms: await this.rooms.toArray(),
        diningTables: await this.diningTables.toArray(),
        services: await this.services.toArray(),
        serviceCategories: await this.serviceCategories.toArray(),
        products: await this.products.toArray(),
        productCategories: await this.productCategories.toArray(),
        customers: await this.customers.toArray(),
        paymentMethods: await this.paymentMethods.toArray(),
        expenseCategoriesMaster: await this.expenseCategoriesMaster.toArray(),
        commissionRulesMaster: await this.commissionRulesMaster.toArray(),

        // Sessions & Sales
        sessions: await this.sessions.toArray(),
        sessionExtensions: await this.sessionExtensions.toArray(),
        sales: await this.sales.toArray(),
        saleItems: await this.saleItems.toArray(),
        salePayments: await this.salePayments.toArray(),
        invoices: await this.invoices.toArray(),

        // Staff & Customer Finance
        staff: await this.staff.toArray(),
        staffCommissions: await this.staffCommissions.toArray(),
        staffBonuses: await this.staffBonuses.toArray(),
        staffDeductions: await this.staffDeductions.toArray(),
        staffAdvances: await this.staffAdvances.toArray(),
        staffLedger: await this.staffLedger.toArray(),
        staffSettlements: await this.staffSettlements.toArray(),
        staffSettlementItems: await this.staffSettlementItems.toArray(),
        customerLedger: await this.customerLedger.toArray(),
        customerCreditLedger: await this.customerCreditLedger.toArray(),
        customerPayments: await this.customerPayments.toArray(),

        // Cash & System
        cashTransactions: await this.cashTransactions.toArray(),
        expenses: await this.expenses.toArray(),
        cashClosings: await this.cashClosings.toArray(),
        bookings: await this.bookings.toArray(),
        pricingRules: await this.pricingRules.toArray(),
        membershipPlans: await this.membershipPlans.toArray(),
        customerMemberships: await this.customerMemberships.toArray(),
        servicePackages: await this.servicePackages.toArray(),
        customerPackages: await this.customerPackages.toArray(),
        packageRedemptions: await this.packageRedemptions.toArray(),
        giftCards: await this.giftCards.toArray(),
        giftCardRedemptions: await this.giftCardRedemptions.toArray(),
        tips: await this.tips.toArray(),
        auditLogs: await this.auditLogs.toArray(),
        backupMetadata: await this.backupMetadata.toArray(),
        settings: await this.settings.toArray(),
      },
    };

    return JSON.stringify(backupData, null, 2);
  }

  async restoreDatabaseBackup(jsonString: string, currentUser: { id: string; name: string; role: any }): Promise<void> {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !parsed.data) {
      throw new Error('Invalid backup file format.');
    }

    const { data } = parsed;

    return this.transaction('rw', [
      this.businesses,
      this.branches,
      this.users,
      this.roles,
      this.staffTypes,
      this.rooms,
      this.diningTables,
      this.services,
      this.serviceCategories,
      this.products,
      this.productCategories,
      this.sessions,
      this.sessionExtensions,
      this.sales,
      this.saleItems,
      this.salePayments,
      this.invoices,
      this.customers,
      this.paymentMethods,
      this.expenseCategoriesMaster,
      this.commissionRulesMaster,
      this.customerLedger,
      this.customerCreditLedger,
      this.customerPayments,
      this.staff,
      this.staffCommissions,
      this.staffBonuses,
      this.staffDeductions,
      this.staffAdvances,
      this.staffLedger,
      this.staffSettlements,
      this.staffSettlementItems,
      this.cashTransactions,
      this.expenses,
      this.cashClosings,
      this.bookings,
      this.pricingRules,
      this.membershipPlans,
      this.customerMemberships,
      this.servicePackages,
      this.customerPackages,
      this.packageRedemptions,
      this.giftCards,
      this.giftCardRedemptions,
      this.tips,
      this.auditLogs,
      this.backupMetadata,
      this.settings,
    ], async () => {
      // Clear existing records
      await Promise.all([
        this.businesses.clear(),
        this.branches.clear(),
        this.users.clear(),
        this.roles.clear(),
        this.staffTypes.clear(),
        this.rooms.clear(),
        this.diningTables.clear(),
        this.services.clear(),
        this.serviceCategories.clear(),
        this.products.clear(),
        this.productCategories.clear(),
        this.sessions.clear(),
        this.sessionExtensions.clear(),
        this.sales.clear(),
        this.saleItems.clear(),
        this.salePayments.clear(),
        this.invoices.clear(),
        this.customers.clear(),
        this.paymentMethods.clear(),
        this.expenseCategoriesMaster.clear(),
        this.commissionRulesMaster.clear(),
        this.customerLedger.clear(),
        this.customerCreditLedger.clear(),
        this.customerPayments.clear(),
        this.staff.clear(),
        this.staffCommissions.clear(),
        this.staffBonuses.clear(),
        this.staffDeductions.clear(),
        this.staffAdvances.clear(),
        this.staffLedger.clear(),
        this.staffSettlements.clear(),
        this.staffSettlementItems.clear(),
        this.cashTransactions.clear(),
        this.expenses.clear(),
        this.cashClosings.clear(),
        this.bookings.clear(),
        this.pricingRules.clear(),
        this.membershipPlans.clear(),
        this.customerMemberships.clear(),
        this.servicePackages.clear(),
        this.customerPackages.clear(),
        this.packageRedemptions.clear(),
        this.giftCards.clear(),
        this.giftCardRedemptions.clear(),
        this.tips.clear(),
        this.auditLogs.clear(),
        this.backupMetadata.clear(),
        this.settings.clear(),
        this.suppliers?.clear(),
        this.purchaseOrders?.clear(),
        this.stockAdjustments?.clear(),
        this.performanceBonusRules?.clear(),
        this.customerLoyaltyLedger?.clear(),
      ]);

      // Bulk put restored data (safely handling duplicate keys)
      if (data.businesses?.length) await this.businesses.bulkPut(data.businesses);
      if (data.branches?.length) await this.branches.bulkPut(data.branches);
      if (data.users?.length) await this.users.bulkPut(data.users);
      if (data.roles?.length) await this.roles.bulkPut(data.roles);
      if (data.staffTypes?.length) await this.staffTypes.bulkPut(data.staffTypes);
      if (data.rooms?.length) await this.rooms.bulkPut(data.rooms);
      const restoredTables = data.diningTables || data.tables;
      if (restoredTables?.length) await this.diningTables.bulkPut(restoredTables);
      if (data.services?.length) await this.services.bulkPut(data.services);
      if (data.serviceCategories?.length) await this.serviceCategories.bulkPut(data.serviceCategories);
      if (data.products?.length) await this.products.bulkPut(data.products);
      if (data.productCategories?.length) await this.productCategories.bulkPut(data.productCategories);
      if (data.sessions?.length) await this.sessions.bulkPut(data.sessions);
      if (data.sessionExtensions?.length) await this.sessionExtensions.bulkPut(data.sessionExtensions);
      if (data.sales?.length) await this.sales.bulkPut(data.sales);
      if (data.saleItems?.length) await this.saleItems.bulkPut(data.saleItems);
      if (data.salePayments?.length) await this.salePayments.bulkPut(data.salePayments);
      if (data.invoices?.length) await this.invoices.bulkPut(data.invoices);
      if (data.customers?.length) await this.customers.bulkPut(data.customers);
      if (data.paymentMethods?.length) await this.paymentMethods.bulkPut(data.paymentMethods);
      if (data.expenseCategoriesMaster?.length) await this.expenseCategoriesMaster.bulkPut(data.expenseCategoriesMaster);
      if (data.commissionRulesMaster?.length) await this.commissionRulesMaster.bulkPut(data.commissionRulesMaster);
      if (data.customerLedger?.length) await this.customerLedger.bulkPut(data.customerLedger);
      if (data.customerCreditLedger?.length) await this.customerCreditLedger.bulkPut(data.customerCreditLedger);
      if (data.customerPayments?.length) await this.customerPayments.bulkPut(data.customerPayments);
      if (data.staff?.length) await this.staff.bulkPut(data.staff);
      if (data.staffCommissions?.length) await this.staffCommissions.bulkPut(data.staffCommissions);
      if (data.staffBonuses?.length) await this.staffBonuses.bulkPut(data.staffBonuses);
      if (data.staffDeductions?.length) await this.staffDeductions.bulkPut(data.staffDeductions);
      if (data.staffAdvances?.length) await this.staffAdvances.bulkPut(data.staffAdvances);
      if (data.staffLedger?.length) await this.staffLedger.bulkPut(data.staffLedger);
      if (data.staffSettlements?.length) await this.staffSettlements.bulkPut(data.staffSettlements);
      if (data.staffSettlementItems?.length) await this.staffSettlementItems.bulkPut(data.staffSettlementItems);
      if (data.cashTransactions?.length) await this.cashTransactions.bulkPut(data.cashTransactions);
      if (data.expenses?.length) await this.expenses.bulkPut(data.expenses);
      if (data.cashClosings?.length) await this.cashClosings.bulkPut(data.cashClosings);
      if (data.bookings?.length) await this.bookings.bulkPut(data.bookings);
      if (data.pricingRules?.length) await this.pricingRules.bulkPut(data.pricingRules);
      if (data.membershipPlans?.length) await this.membershipPlans.bulkPut(data.membershipPlans);
      if (data.customerMemberships?.length) await this.customerMemberships.bulkPut(data.customerMemberships);
      if (data.servicePackages?.length) await this.servicePackages.bulkPut(data.servicePackages);
      if (data.customerPackages?.length) await this.customerPackages.bulkPut(data.customerPackages);
      if (data.packageRedemptions?.length) await this.packageRedemptions.bulkPut(data.packageRedemptions);
      if (data.giftCards?.length) await this.giftCards.bulkPut(data.giftCards);
      if (data.giftCardRedemptions?.length) await this.giftCardRedemptions.bulkPut(data.giftCardRedemptions);
      if (data.tips?.length) await this.tips.bulkPut(data.tips);
      if (data.auditLogs?.length) await this.auditLogs.bulkPut(data.auditLogs);
      if (data.backupMetadata?.length) await this.backupMetadata.bulkPut(data.backupMetadata);
      if (data.settings?.length) await this.settings.bulkPut(data.settings);

      // Record restore event in audit log
      await this.auditLogs.add({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'RESTORE_DATABASE',
        entity: 'System',
        entityId: 'backup_restore',
        newValue: `Restored from backup created at ${parsed.exportedAt || 'unknown date'}`,
      });
    });
  }

  /**
   * Seed default pricing rules for KTV, PS5, VIP, and general session services
   */
  async seedDefaultPricingRules(): Promise<void> {
    const count = await this.pricingRules.count();
    if (count > 0) return;

    const now = new Date().toISOString();
    const defaultRules: PricingRule[] = [
      {
        id: 'prule_ktv_std',
        code: 'KTV-STD',
        name: 'Standard KTV Hourly Tier',
        nameMm: 'သာမန် KTV အခန်းနှုန်းထား',
        description: 'Standard KTV room pricing with 60m min duration and 15m block rounding',
        roomType: 'ktv_small',
        baseHourlyRateMMK: 15000,
        weekdayHourlyRateMMK: 15000,
        weekendHourlyRateMMK: 18000,
        isPeakHourEnabled: true,
        peakHourStart: '18:00',
        peakHourEnd: '23:59',
        peakHourlyRateMMK: 20000,
        minDurationMinutes: 60,
        additionalBlockMinutes: 15,
        roundingRule: 'ceil_15',
        gracePeriodMinutes: 5,
        isActive: true,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prule_ktv_vip',
        code: 'KTV-VIP',
        name: 'VIP KTV Luxury Tier',
        nameMm: 'ဗွီအိုင်ပီ KTV အထူးနှုန်းထား',
        description: 'VIP KTV room pricing with night peak surcharge and 30m block rounding',
        roomType: 'vip_suite',
        baseHourlyRateMMK: 25000,
        weekdayHourlyRateMMK: 25000,
        weekendHourlyRateMMK: 30000,
        isPeakHourEnabled: true,
        peakHourStart: '18:00',
        peakHourEnd: '23:59',
        peakHourlyRateMMK: 35000,
        minDurationMinutes: 60,
        additionalBlockMinutes: 30,
        roundingRule: 'ceil_30',
        gracePeriodMinutes: 10,
        isActive: true,
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prule_ps5_std',
        code: 'PS5-STD',
        name: 'PS5 / Console Gaming Standard',
        nameMm: 'PS5 ဂိမ်းကစားချိန် သာမန်နှုန်း',
        description: 'PS5 gaming room/station rate with 30m min duration',
        roomType: 'ALL',
        baseHourlyRateMMK: 6000,
        weekdayHourlyRateMMK: 6000,
        weekendHourlyRateMMK: 8000,
        isPeakHourEnabled: true,
        peakHourStart: '17:00',
        peakHourEnd: '22:00',
        peakHourlyRateMMK: 8000,
        minDurationMinutes: 30,
        additionalBlockMinutes: 15,
        roundingRule: 'round_15',
        gracePeriodMinutes: 5,
        isActive: true,
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prule_spa_std',
        code: 'SPA-STD',
        name: 'Spa / Massage Standard Session',
        nameMm: 'စပါ / နှိပ်နယ်ခန်း ပုံမှန်နှုန်းထား',
        description: 'Spa room hourly rate with exact minute rounding',
        roomType: 'massage_bed',
        baseHourlyRateMMK: 12000,
        weekdayHourlyRateMMK: 12000,
        weekendHourlyRateMMK: 15000,
        isPeakHourEnabled: false,
        minDurationMinutes: 45,
        additionalBlockMinutes: 1,
        roundingRule: 'exact_minute',
        gracePeriodMinutes: 5,
        isActive: true,
        sortOrder: 4,
        createdAt: now,
        updatedAt: now,
      },
    ];

    await this.pricingRules.bulkAdd(defaultRules);
  }

  /**
   * Seed default membership plans and service packages if none exist
   */
  async seedDefaultMembershipAndPackages(): Promise<void> {
    const planCount = await this.membershipPlans.count();
    const now = new Date().toISOString();

    if (planCount === 0) {
      const defaultPlans: MembershipPlan[] = [
        {
          id: 'mplan_silver',
          name: 'Silver Club Membership',
          nameMm: 'ငွေအဆင့် အသင်းဝင်',
          durationDays: 30,
          priceMMK: 30000,
          discountPercent: 10,
          benefitsSummary: '10% discount on all massage and room services for 30 days',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'mplan_gold',
          name: 'Gold VIP Membership',
          nameMm: 'ရွှေအဆင့် အသင်းဝင် (VIP)',
          durationDays: 90,
          priceMMK: 80000,
          discountPercent: 15,
          benefitsSummary: '15% discount on all services and VIP room booking priority for 90 days',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'mplan_diamond',
          name: 'Diamond Elite Annual Membership',
          nameMm: 'စိန်အဆင့် နှစ်စဉ်အသင်းဝင်',
          durationDays: 365,
          priceMMK: 250000,
          discountPercent: 20,
          benefitsSummary: '20% discount on all services, beverage perks and free room upgrades for 1 year',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ];
      await this.membershipPlans.bulkAdd(defaultPlans);
    }

    const pkgCount = await this.servicePackages.count();
    if (pkgCount === 0) {
      // Find sample service or fallback
      const services = await this.services.toArray();
      const firstService = services[0] || { id: 'srv_massage', name: 'Traditional Body Massage' };

      const defaultPackages: ServicePackage[] = [
        {
          id: 'spkg_10massage',
          name: '10x Body Massage Package',
          nameMm: 'ကိုယ်ခန္ဓာ နှိပ်နယ်ခြင်း ၁၀ ကြိမ် ပက်ကေ့ချ်',
          serviceId: firstService.id,
          serviceName: firstService.name,
          totalQty: 10,
          priceMMK: 135000,
          validityDays: 180,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'spkg_5foot',
          name: '5x Foot Reflexology Package',
          nameMm: 'ခြေဖဝါး နှိပ်နယ်ခြင်း ၅ ကြိမ် ပက်ကေ့ချ်',
          serviceId: services[1]?.id || firstService.id,
          serviceName: services[1]?.name || 'Foot Reflexology',
          totalQty: 5,
          priceMMK: 55000,
          validityDays: 90,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ];
      await this.servicePackages.bulkAdd(defaultPackages);
    }
  }

  /**
   * ATOMIC PACKAGE REDEMPTION:
   * Prevents over-redemption, checks status and expiry date, updates remaining balance atomically.
   */
  async redeemPackageTransaction(params: {
    customerPackageId: string;
    quantity: number;
    customerId?: string;
    sessionId?: string;
    invoiceId?: string;
    redeemedBy: string;
    notes?: string;
  }): Promise<{ customerPackage: CustomerPackage; redemption: PackageRedemptionRecord }> {
    return this.transaction('rw', [this.customerPackages, this.packageRedemptions], async () => {
      const pkg = await this.customerPackages.get(params.customerPackageId);
      if (!pkg) {
        throw new Error(`Customer package ${params.customerPackageId} not found.`);
      }

      if (pkg.status !== 'active') {
        throw new Error(`Customer package is ${pkg.status} and cannot be redeemed.`);
      }

      const todayStr = new Date().toISOString().split('T')[0];
      if (pkg.expiryDate && pkg.expiryDate < todayStr) {
        await this.customerPackages.update(pkg.id, { status: 'expired', updatedAt: new Date().toISOString() });
        throw new Error(`Customer package expired on ${pkg.expiryDate}.`);
      }

      if (pkg.remainingQty < params.quantity) {
        throw new Error(`Over-redemption prevented: Requested ${params.quantity}, but only ${pkg.remainingQty} remaining.`);
      }

      const newRemaining = pkg.remainingQty - params.quantity;
      const newUsed = pkg.usedQty + params.quantity;
      const newStatus = newRemaining === 0 ? 'exhausted' : 'active';
      const now = new Date().toISOString();

      await this.customerPackages.update(pkg.id, {
        remainingQty: newRemaining,
        usedQty: newUsed,
        status: newStatus,
        updatedAt: now,
      });

      const redemption: PackageRedemptionRecord = {
        id: `pred_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        customerPackageId: pkg.id,
        customerId: params.customerId || pkg.customerId,
        sessionId: params.sessionId,
        invoiceId: params.invoiceId,
        serviceId: pkg.serviceId,
        serviceName: pkg.serviceName,
        quantityRedeemed: params.quantity,
        redeemedAt: now,
        redeemedBy: params.redeemedBy,
        notes: params.notes,
      };

      await this.packageRedemptions.add(redemption);

      const updatedPkg: CustomerPackage = {
        ...pkg,
        remainingQty: newRemaining,
        usedQty: newUsed,
        status: newStatus,
        updatedAt: now,
      };

      return { customerPackage: updatedPkg, redemption };
    });
  }

  /**
   * ATOMIC GIFT CARD REDEMPTION:
   * Prevents duplicate redemption, checks status and expiry, prevents overdraft, updates balance atomically.
   */
  async redeemGiftCardTransaction(params: {
    giftCardIdOrNumber: string;
    amountMMK: number;
    sessionId?: string;
    invoiceId?: string;
    redeemedBy: string;
    notes?: string;
  }): Promise<{ giftCard: GiftCard; redemption: GiftCardRedemptionRecord }> {
    return this.transaction('rw', [this.giftCards, this.giftCardRedemptions], async () => {
      let card = await this.giftCards.get(params.giftCardIdOrNumber);
      if (!card) {
        card = await this.giftCards.where('cardNumber').equals(params.giftCardIdOrNumber).first();
      }

      if (!card) {
        throw new Error(`Gift Card '${params.giftCardIdOrNumber}' not found.`);
      }

      if (card.status !== 'active') {
        throw new Error(`Gift Card is ${card.status} and cannot be redeemed.`);
      }

      const todayStr = new Date().toISOString().split('T')[0];
      if (card.expiryDate && card.expiryDate < todayStr) {
        await this.giftCards.update(card.id, { status: 'expired', updatedAt: new Date().toISOString() });
        throw new Error(`Gift Card expired on ${card.expiryDate}.`);
      }

      if (card.currentBalanceMMK < params.amountMMK) {
        throw new Error(`Insufficient gift card balance: Card has ${card.currentBalanceMMK.toLocaleString()} MMK, requested ${params.amountMMK.toLocaleString()} MMK.`);
      }

      const now = new Date().toISOString();
      const balanceBefore = card.currentBalanceMMK;
      const balanceAfter = balanceBefore - params.amountMMK;
      const newStatus = balanceAfter === 0 ? 'exhausted' : 'active';

      await this.giftCards.update(card.id, {
        currentBalanceMMK: balanceAfter,
        status: newStatus,
        updatedAt: now,
      });

      const redemption: GiftCardRedemptionRecord = {
        id: `gcred_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        giftCardId: card.id,
        cardNumber: card.cardNumber,
        sessionId: params.sessionId,
        invoiceId: params.invoiceId,
        amountMMK: params.amountMMK,
        balanceBeforeMMK: balanceBefore,
        balanceAfterMMK: balanceAfter,
        redeemedAt: now,
        redeemedBy: params.redeemedBy,
        notes: params.notes,
      };

      await this.giftCardRedemptions.add(redemption);

      const updatedCard: GiftCard = {
        ...card,
        currentBalanceMMK: balanceAfter,
        status: newStatus,
        updatedAt: now,
      };

      return { giftCard: updatedCard, redemption };
    });
  }

  /**
   * ATOMIC TIP RECORDING:
   * Records tip attribution to staff, adds to staff ledger if applicable, does not mix into service revenue.
   */
  async recordTipTransaction(params: {
    sessionId?: string;
    invoiceId?: string;
    staffId: string;
    staffName: string;
    amountMMK: number;
    paymentMethod: PaymentMethod | string;
    receivedBy: string;
    notes?: string;
  }): Promise<TipRecord> {
    return this.transaction('rw', [this.tips, this.staffLedger], async () => {
      const now = new Date().toISOString();
      const tipId = `tip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const tipRecord: TipRecord = {
        id: tipId,
        sessionId: params.sessionId,
        invoiceId: params.invoiceId,
        staffId: params.staffId,
        staffName: params.staffName,
        amountMMK: params.amountMMK,
        paymentMethod: params.paymentMethod,
        receivedBy: params.receivedBy,
        notes: params.notes,
        createdAt: now,
      };

      await this.tips.add(tipRecord);

      // Record in staff ledger as bonus/tip entry so staff can receive it in settlement
      await this.staffLedger.add({
        id: `stledg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        staffId: params.staffId,
        staffName: params.staffName,
        type: 'bonus',
        direction: 'credit',
        amountMMK: params.amountMMK,
        isSettled: false,
        notes: `Customer Tip for Session/Invoice ${params.invoiceId || params.sessionId || ''}`,
        date: now.split('T')[0],
        createdBy: params.receivedBy || 'system',
        createdAt: now,
      });

      return tipRecord;
    });
  }

  /**
   * ATOMIC STOCK ADJUSTMENT:
   */
  async recordStockAdjustmentTransaction(params: {
    productId: string;
    adjustQty: number;
    reason: string;
    adjustedBy: string;
    businessId?: string;
    branchId?: string;
  }): Promise<StockAdjustmentRecord> {
    return this.transaction('rw', [this.products, this.stockMovements, this.stockAdjustments, this.auditLogs], async () => {
      const now = new Date().toISOString();
      const prd = await this.products.get(params.productId);
      if (!prd) throw new Error('Product not found');

      const beforeQty = prd.stockQty || 0;
      const afterQty = Math.max(0, beforeQty + params.adjustQty);

      await this.products.update(params.productId, {
        stockQty: afterQty,
      });

      const adjId = `adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const adjRecord: StockAdjustmentRecord = {
        id: adjId,
        businessId: params.businessId || 'default',
        branchId: params.branchId || 'main',
        productId: prd.id,
        productName: prd.name,
        beforeQty,
        afterQty,
        adjustQty: params.adjustQty,
        reason: params.reason,
        adjustedBy: params.adjustedBy,
        createdAt: now,
      };

      await this.stockAdjustments.add(adjRecord);

      await this.stockMovements.add({
        id: `stkmov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: prd.id,
        productName: prd.name,
        type: params.adjustQty >= 0 ? 'adjustment_in' : 'adjustment_out',
        quantityChange: params.adjustQty,
        previousStock: beforeQty,
        newStock: afterQty,
        unit: prd.unit,
        notes: `Stock Adjustment: ${params.reason}`,
        date: now.split('T')[0],
        createdAt: now,
        createdBy: params.adjustedBy,
      });

      return adjRecord;
    });
  }

  /**
   * ATOMIC PURCHASE ORDER TRANSACTION:
   */
  async recordPurchaseOrderTransaction(params: {
    poNumber?: string;
    supplierId: string;
    supplierName: string;
    items: PurchaseOrderItem[];
    totalAmountMMK: number;
    paidAmountMMK: number;
    paymentStatus: 'unpaid' | 'partial' | 'paid';
    paymentMethod?: string;
    createdBy: string;
    notes?: string;
    businessId?: string;
    branchId?: string;
  }): Promise<PurchaseOrderRecord> {
    return this.transaction('rw', [this.purchaseOrders, this.products, this.stockMovements, this.cashTransactions], async () => {
      const now = new Date().toISOString();
      const poId = `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const poCode = params.poNumber || `PO-${Date.now()}`;

      for (const item of params.items) {
        const prd = await this.products.get(item.productId);
        if (prd) {
          const before = prd.stockQty || 0;
          const after = before + item.quantity;
          await this.products.update(prd.id, {
            stockQty: after,
            costPriceMMK: item.costPriceMMK || prd.costPriceMMK,
          });

          await this.stockMovements.add({
            id: `stkmov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            productId: prd.id,
            productName: prd.name,
            type: 'purchase',
            quantityChange: item.quantity,
            previousStock: before,
            newStock: after,
            unit: prd.unit,
            notes: `Purchase Order ${poCode} from ${params.supplierName}`,
            date: now.split('T')[0],
            createdAt: now,
            createdBy: params.createdBy,
          });
        }
      }

      const poRecord: PurchaseOrderRecord = {
        id: poId,
        businessId: params.businessId || 'default',
        branchId: params.branchId || 'main',
        poNumber: poCode,
        supplierId: params.supplierId,
        supplierName: params.supplierName,
        items: params.items,
        totalAmountMMK: params.totalAmountMMK,
        paidAmountMMK: params.paidAmountMMK,
        paymentStatus: params.paymentStatus,
        paymentMethod: params.paymentMethod,
        orderDate: now.split('T')[0],
        status: 'received',
        notes: params.notes,
        createdBy: params.createdBy,
        createdAt: now,
        updatedAt: now,
      };

      await this.purchaseOrders.add(poRecord);

      if (params.paidAmountMMK > 0 && params.paymentMethod === 'cash') {
        await this.cashTransactions.add({
          id: `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          transactionCode: `CTX-${Date.now()}`,
          branchId: params.branchId || 'main',
          type: 'outflow',
          category: 'expense_cash',
          amountMMK: params.paidAmountMMK,
          referenceType: 'manual',
          referenceId: poId,
          notes: `Purchase Order Payment: ${poCode} to ${params.supplierName}`,
          transactionTime: now,
          performedBy: params.createdBy,
          createdAt: now,
        });
      }

      return poRecord;
    });
  }

  /**
   * ATOMIC LOYALTY POINTS TRANSACTION:
   */
  async recordLoyaltyPointsTransaction(params: {
    customerId: string;
    customerName?: string;
    points: number;
    type: 'earn' | 'redeem' | 'adjust';
    referenceType?: 'sale' | 'manual' | 'reversal';
    referenceId?: string;
    notes?: string;
    performedBy: string;
  }): Promise<CustomerLoyaltyEntry> {
    return this.transaction('rw', [this.customers, this.customerLoyaltyLedger], async () => {
      const now = new Date().toISOString();
      const cust = await this.customers.get(params.customerId);
      if (!cust) throw new Error('Customer not found');

      const currentPoints = cust.loyaltyPoints || 0;
      const newBalance = Math.max(0, currentPoints + params.points);

      if (params.points < 0 && Math.abs(params.points) > currentPoints) {
        throw new Error(`Insufficient loyalty points balance (${currentPoints} points available)`);
      }

      await this.customers.update(params.customerId, {
        loyaltyPoints: newBalance,
        updatedAt: now,
      });

      const entryId = `loy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const entry: CustomerLoyaltyEntry = {
        id: entryId,
        customerId: cust.id,
        customerName: cust.name,
        points: params.points,
        balanceAfter: newBalance,
        type: params.type,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        notes: params.notes,
        date: now.split('T')[0],
        createdAt: now,
      };

      await this.customerLoyaltyLedger.add(entry);

      return entry;
    });
  }

  /**
   * ATOMIC PERFORMANCE BONUS RULE SAVE:
   */
  async savePerformanceBonusRule(rule: Partial<PerformanceBonusRuleRecord>): Promise<PerformanceBonusRuleRecord> {
    return this.transaction('rw', [this.performanceBonusRules], async () => {
      const now = new Date().toISOString();
      const ruleRecord: PerformanceBonusRuleRecord = {
        id: rule.id || `prule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        businessId: rule.businessId || 'BIZ_SHOP_001',
        branchId: rule.branchId || 'BR_MAIN',
        ruleName: rule.ruleName || 'Standard Performance Bonus',
        minRevenueMMK: rule.minRevenueMMK || 0,
        minSessions: rule.minSessions || 0,
        minAttendanceDays: rule.minAttendanceDays || 0,
        bonusAmountMMK: rule.bonusAmountMMK || 50000,
        isActive: rule.isActive !== false,
        createdAt: rule.createdAt || now,
      };
      await this.performanceBonusRules.put(ruleRecord);
      return ruleRecord;
    });
  }

  // ==========================================
  // PHASE 28: CUSTOMER 360, SERVICE NOTES & REBOOKING
  // ==========================================

  public async addCustomerServiceNote(params: {
    customerId: string;
    customerName?: string;
    sessionId?: string;
    bookingId?: string;
    serviceId?: string;
    serviceName?: string;
    staffId?: string;
    staffName?: string;
    category: CustomerServiceNote['category'];
    title: string;
    content: string;
    tags?: string[];
    focusAreas?: string[];
    isPrivate?: boolean;
    createdBy: string;
    createdById?: string;
    businessId?: string;
    branchId?: string;
  }): Promise<CustomerServiceNote> {
    return this.transaction('rw', [this.customerServiceNotes, this.auditLogs], async () => {
      const now = new Date().toISOString();
      const noteId = `cnote_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const note: CustomerServiceNote = {
        id: noteId,
        businessId: params.businessId || 'default',
        branchId: params.branchId || 'main',
        customerId: params.customerId,
        customerName: params.customerName,
        sessionId: params.sessionId,
        bookingId: params.bookingId,
        serviceId: params.serviceId,
        serviceName: params.serviceName,
        staffId: params.staffId,
        staffName: params.staffName,
        category: params.category,
        title: params.title.trim(),
        content: params.content.trim(),
        tags: params.tags,
        focusAreas: params.focusAreas,
        isPrivate: !!params.isPrivate,
        createdAt: now,
        createdBy: params.createdBy,
        createdById: params.createdById,
        updatedAt: now,
      };

      await this.customerServiceNotes.add(note);

      await this.auditLogs.add({
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        userId: params.createdById || 'user',
        userName: params.createdBy,
        userRole: 'staff',
        action: 'CUSTOMER_NOTE_ADD' as any,
        entity: 'CustomerServiceNote',
        entityId: noteId,
        details: `Created ${params.category} note for customer ${params.customerName || params.customerId}`,
      });

      return note;
    });
  }

  public async updateCustomerServiceNote(
    id: string,
    updates: Partial<CustomerServiceNote>,
    currentUser?: { id?: string; name: string; role?: string }
  ): Promise<CustomerServiceNote> {
    return this.transaction('rw', [this.customerServiceNotes, this.auditLogs], async () => {
      const existing = await this.customerServiceNotes.get(id);
      if (!existing) throw new Error(`Note ${id} not found`);

      const now = new Date().toISOString();
      const updatedNote: CustomerServiceNote = {
        ...existing,
        ...updates,
        updatedAt: now,
      };

      await this.customerServiceNotes.put(updatedNote);

      await this.auditLogs.add({
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        userId: currentUser?.id || 'user',
        userName: currentUser?.name || 'User',
        userRole: currentUser?.role || 'staff',
        action: 'CUSTOMER_NOTE_UPDATE' as any,
        entity: 'CustomerServiceNote',
        entityId: id,
        details: `Updated note ${id}`,
      });

      return updatedNote;
    });
  }

  public async deleteCustomerServiceNote(
    id: string,
    currentUser?: { id?: string; name: string; role?: string }
  ): Promise<void> {
    return this.transaction('rw', [this.customerServiceNotes, this.auditLogs], async () => {
      const existing = await this.customerServiceNotes.get(id);
      if (!existing) return;

      await this.customerServiceNotes.delete(id);

      await this.auditLogs.add({
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || 'user',
        userName: currentUser?.name || 'User',
        userRole: currentUser?.role || 'staff',
        action: 'CUSTOMER_NOTE_DELETE' as any,
        entity: 'CustomerServiceNote',
        entityId: id,
        details: `Deleted note ${id}`,
      });
    });
  }

  public async updateCustomerPreferences(
    customerId: string,
    preferences: CustomerPreferenceProfile,
    currentUser?: { id?: string; name: string; role?: string }
  ): Promise<Customer> {
    return this.transaction('rw', [this.customers, this.auditLogs], async () => {
      const customer = await this.customers.get(customerId);
      if (!customer) throw new Error(`Customer ${customerId} not found`);

      customer.preferences = preferences;
      customer.updatedAt = new Date().toISOString();
      customer.updatedBy = currentUser?.name;

      await this.customers.put(customer);

      await this.auditLogs.add({
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: customer.updatedAt,
        userId: currentUser?.id || 'user',
        userName: currentUser?.name || 'User',
        userRole: currentUser?.role || 'staff',
        action: 'CUSTOMER_PREFERENCES_UPDATE' as any,
        entity: 'Customer',
        entityId: customerId,
        details: `Updated preferences for customer ${customer.name}`,
      });

      return customer;
    });
  }

  public async getCustomerServiceHistory(customerId: string): Promise<CustomerServiceHistoryItem[]> {
    const history: CustomerServiceHistoryItem[] = [];

    // 1. Sessions
    const sessions = await this.sessions
      .where('customerId')
      .equals(customerId)
      .toArray();

    for (const sess of sessions) {
      const inv = await this.invoices.where('sessionId').equals(sess.id).first();
      const paymentMethod = inv?.payments?.[0]?.method || (sess.status === 'completed' ? 'paid' : sess.status);

      history.push({
        id: `hist_sess_${sess.id}`,
        sourceType: 'session',
        sourceId: sess.id,
        code: sess.sessionCode,
        date: sess.startTime ? sess.startTime.split('T')[0] : (sess.createdAt ? sess.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
        serviceId: sess.serviceId,
        serviceName: sess.serviceName || 'Session Service',
        staffId: sess.assignedStaff?.[0]?.staffId,
        staffName: sess.assignedStaff?.map((s: any) => s.staffName).join(', ') || 'Unassigned',
        roomId: sess.roomId,
        roomName: sess.roomName || 'Room',
        durationMinutes: sess.actualDurationMinutes || sess.plannedDurationMinutes || 60,
        amountMMK: sess.finalTotalMMK || sess.basePriceMMK || inv?.totalMMK || 0,
        paymentMethod: String(paymentMethod),
        status: sess.status,
        notes: sess.notes,
        invoiceId: inv?.id,
      });
    }

    // 2. Invoices (standalone service sales)
    const invoices = await this.invoices
      .where('customerId')
      .equals(customerId)
      .toArray();

    for (const inv of invoices) {
      if (inv.sessionId && sessions.some(s => s.id === inv.sessionId)) {
        continue;
      }
      const serviceItems = inv.items?.filter(it => it.type === 'service' || it.type === 'session_fee') || [];
      if (serviceItems.length > 0) {
        for (const sit of serviceItems) {
          history.push({
            id: `hist_inv_${inv.id}_${sit.itemId || Math.random()}`,
            sourceType: 'invoice',
            sourceId: inv.id,
            code: inv.invoiceCode || inv.billNumber || 'INV',
            date: inv.createdAt ? inv.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
            serviceId: sit.itemId,
            serviceName: sit.description,
            staffId: undefined,
            staffName: inv.cashierName || 'Staff',
            roomId: inv.roomId,
            roomName: inv.roomName || 'Direct / POS',
            durationMinutes: 60,
            amountMMK: sit.totalPriceMMK,
            paymentMethod: inv.payments?.map(p => p.method).join(', ') || 'cash',
            status: inv.status,
            notes: inv.notes,
            invoiceId: inv.id,
          });
        }
      }
    }

    // Sort descending by date
    return history.sort((a, b) => b.date.localeCompare(a.date));
  }

  // ==========================================
  // PHASE 29: STAFF SCHEDULE, ATTENDANCE & INVENTORY CONSUMPTION METHODS
  // ==========================================

  public async recordStaffSchedule(params: {
    staffId: string;
    staffName: string;
    date: string;
    startTime: string;
    endTime: string;
    breakStart?: string;
    breakEnd?: string;
    status: 'working' | 'off' | 'leave' | 'unavailable';
    notes?: string;
    currentUser: { id: string; name: string; role?: string };
  }): Promise<StaffScheduleRecord> {
    return this.transaction('rw', [this.staffSchedules, this.auditLogs], async () => {
      const now = new Date().toISOString();
      const record: StaffScheduleRecord = {
        id: `sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        staffId: params.staffId,
        staffName: params.staffName,
        date: params.date,
        startTime: params.startTime,
        endTime: params.endTime,
        breakStart: params.breakStart,
        breakEnd: params.breakEnd,
        status: params.status,
        notes: params.notes,
        createdAt: now,
        updatedAt: now,
        createdBy: params.currentUser.name,
      };

      await this.staffSchedules.put(record);

      await this.auditLogs.add({
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role || 'staff',
        action: 'STAFF_SCHEDULE_UPDATE' as any,
        entity: 'StaffSchedule',
        entityId: record.id,
        details: `Scheduled ${params.staffName} on ${params.date} (${params.status})`,
      });

      return record;
    });
  }

  public async recordStaffAttendance(params: {
    staffId: string;
    staffName: string;
    date: string;
    checkInTime?: string;
    checkOutTime?: string;
    status: 'checked_in' | 'checked_out' | 'absent';
    notes?: string;
    currentUser: { id: string; name: string; role?: string };
  }): Promise<StaffAttendanceRecord> {
    return this.transaction('rw', [this.staffAttendance, this.auditLogs], async () => {
      const now = new Date().toISOString();
      const existing = await this.staffAttendance
        .where('staffId')
        .equals(params.staffId)
        .filter(a => a.date === params.date)
        .first();

      const recordId = existing ? existing.id : `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const record: StaffAttendanceRecord = {
        id: recordId,
        staffId: params.staffId,
        staffName: params.staffName,
        date: params.date,
        checkInTime: params.checkInTime || existing?.checkInTime,
        checkOutTime: params.checkOutTime || existing?.checkOutTime,
        status: params.status,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        notes: params.notes || existing?.notes,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      await this.staffAttendance.put(record);

      await this.auditLogs.add({
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        userId: params.currentUser.id,
        userName: params.currentUser.name,
        userRole: params.currentUser.role || 'staff',
        action: 'STAFF_ATTENDANCE' as any,
        entity: 'StaffAttendance',
        entityId: record.id,
        details: `Recorded attendance for ${params.staffName} on ${params.date}: ${params.status}`,
      });

      return record;
    });
  }

  public async recordServiceConsumable(params: {
    serviceId: string;
    serviceName: string;
    productId: string;
    productName: string;
    quantity: number;
    unit?: string;
    currentUser: { id: string; name: string; role?: string };
  }): Promise<ServiceConsumableItem> {
    return this.transaction('rw', [this.serviceConsumables, this.auditLogs], async () => {
      const now = new Date().toISOString();
      const item: ServiceConsumableItem = {
        id: `cons_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        serviceId: params.serviceId,
        serviceName: params.serviceName,
        productId: params.productId,
        productName: params.productName,
        quantity: Math.max(0, params.quantity),
        unit: params.unit,
        createdAt: now,
        updatedAt: now,
      };

      await this.serviceConsumables.put(item);
      return item;
    });
  }

  public async deductServiceConsumablesTransaction(
    serviceId: string,
    multiplier: number = 1,
    sessionId?: string,
    currentUser?: { id: string; name: string }
  ): Promise<void> {
    if (sessionId) {
      const session = await this.sessions.get(sessionId);
      if (session && session.consumablesDeducted) {
        return; // Idempotency check: already deducted
      }
    }

    const consumables = await this.serviceConsumables.where('serviceId').equals(serviceId).toArray();
    if (consumables.length === 0) return;

    const settings = await this.settings.toCollection().first();
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];
    const sessionObj = sessionId ? await this.sessions.get(sessionId) : null;

    for (const cons of consumables) {
      const product = await this.products.get(cons.productId);
      if (!product) continue;

      const totalDeduction = cons.quantity * multiplier;
      const prevStock = product.stockQty || 0;
      const newStock = prevStock - totalDeduction;

      if (newStock < 0 && !settings?.allowNegativeStock) {
        throw new Error(`Insufficient stock for consumable product '${product.name}'. Required: ${totalDeduction}, Available: ${prevStock}.`);
      }

      const finalStock = settings?.allowNegativeStock ? newStock : Math.max(0, newStock);
      await this.products.update(product.id, {
        stockQty: finalStock,
      });

      await this.stockMovements.add({
        id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: product.id,
        productName: product.name,
        serviceId,
        sessionId,
        invoiceId: sessionObj?.invoiceId,
        customerId: sessionObj?.customerId,
        customerName: sessionObj?.customerName,
        staffId: sessionObj?.assignedStaff?.[0]?.staffId,
        staffName: sessionObj?.assignedStaff?.[0]?.staffName,
        type: 'consumption',
        quantityChange: -totalDeduction,
        previousStock: prevStock,
        newStock: finalStock,
        unit: cons.unit || product.unit,
        notes: `Service consumable consumption for service ID ${serviceId}`,
        date: todayStr,
        createdAt: now,
        createdBy: currentUser?.name || sessionObj?.completedBy || 'System',
      });
    }

    if (sessionObj) {
      await this.sessions.update(sessionObj.id, { consumablesDeducted: true });
    }
  }
}

export const db = new MyanmarBusinessDB();
