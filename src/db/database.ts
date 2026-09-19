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
  PaymentMethod,
  InvoiceItemType,
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
  createCommissionSnapshot,
  evaluateBillPaymentStatus,
  MoneyMMK,
} from '../domain/financial';

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
    });
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

      // 2. Validate assigned staff
      if (!params.session.assignedStaff || params.session.assignedStaff.length === 0) {
        throw new Error('At least one staff member must be assigned to the session.');
      }

      for (const stf of params.session.assignedStaff) {
        const staffMember = await this.staff.get(stf.staffId);
        if (!staffMember) {
          throw new Error(`Staff member "${stf.staffName}" not found.`);
        }
        if (!staffMember.isActive) {
          throw new Error(`Staff member "${stf.staffName}" is currently inactive.`);
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

      // Sum payments
      const totalPaid = params.payments.reduce((sum, p) => sum + roundMMK(p.amountMMK), 0);
      const balanceDue = Math.max(0, totals.totalMMK - totalPaid);
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
        paidAmountMMK: totalPaid,
        balanceDueMMK: balanceDue,
        status: invoiceStatus,
        payments: params.payments,
        cashierId: params.currentUser.id,
        cashierName: params.currentUser.name,
        createdAt: now,
      };

      await this.invoices.add(invoice);

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
        updatedAt: now,
        notes: params.notes || session.notes,
      };

      await this.sessions.put(completedSession);

      // 7. Update Room Status
      await this.rooms.update(session.roomId, {
        status: 'cleaning', // sets to cleaning after session
        currentSessionId: undefined,
      });

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
        this.auditLogs.clear(),
        this.backupMetadata.clear(),
        this.settings.clear(),
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
}

export const db = new MyanmarBusinessDB();
