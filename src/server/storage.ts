/**
 * ============================================================================
 * PHASE 20.5: PERSISTENT SQLITE DATABASE ENGINE & FINANCIAL SERVER BOUNDARY
 * ============================================================================
 * True persistent embedded SQLite database engine using sql.js with:
 * - WAL & disk synchronization
 * - Deterministic schema migrations
 * - ACID transactions (atomic commits & rollbacks)
 * - Canonical SHA-256 request hashing
 * - Real financial operation execution
 * - Concurrency conflict detection & locking
 * - Backup and restore engine
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { runtimeConfig } from './config';
import {
  ServerBusinessEntity,
  ServerBranchEntity,
  ServerDeviceEntity,
  ServerUserEntity,
  ServerIdempotencyRecord,
  ServerAuditRecord,
} from './types';
import { PairingCodeRecord } from '../types/multiDevice';
import { OutboxRecord, ServerEvent, ServerEventType } from './realtime/types';

let SQL: SqlJsStatic | null = null;

export class PersistentSQLiteStorage {
  private db: Database | null = null;
  private dbFilePath: string;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(customPath?: string) {
    this.dbFilePath = customPath || runtimeConfig.databasePath;
    const parentDir = path.dirname(this.dbFilePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
  }

  public getDatabasePath(): string {
    return this.dbFilePath;
  }

  public isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized && this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (!SQL) {
        // Support loading wasm from local directory in standalone executable or packaged environments
        let wasmBinary: Buffer | undefined;
        const potentialWasmPaths = [
          typeof __dirname !== 'undefined' ? path.join(__dirname, 'sql-wasm.wasm') : '',
          path.join(process.cwd(), 'dist', 'sql-wasm.wasm'),
          path.join(process.cwd(), 'bin', 'sql-wasm.wasm'),
          path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
        ].filter(Boolean);
        for (const p of potentialWasmPaths) {
          if (fs.existsSync(p)) {
            try {
              wasmBinary = fs.readFileSync(p);
              break;
            } catch {}
          }
        }

        if (wasmBinary) {
          const arrayBuffer = wasmBinary.buffer.slice(
            wasmBinary.byteOffset,
            wasmBinary.byteOffset + wasmBinary.byteLength
          ) as ArrayBuffer;
          SQL = await initSqlJs({ wasmBinary: arrayBuffer });
        } else {
          SQL = await initSqlJs();
        }
      }

      if (this.dbFilePath !== ':memory:' && fs.existsSync(this.dbFilePath)) {
        try {
          const fileBuffer = fs.readFileSync(this.dbFilePath);
          this.db = new SQL.Database(fileBuffer);
        } catch (err) {
          console.warn('[PersistentSQLiteStorage] Failed to open existing sqlite file, recreating.', err);
          this.db = new SQL.Database();
        }
      } else {
        this.db = new SQL.Database();
      }

      this.runMigrations();
      this.flushToDisk();
      this.isInitialized = true;
    })();

    return this.initPromise;
  }

  /**
   * Deterministic Schema Migrations
   */
  private runMigrations(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const result = this.db.exec(`SELECT MAX(version) as max_ver FROM schema_migrations`);
    const currentVersion = (result.length > 0 && result[0].values[0][0]) ? Number(result[0].values[0][0]) : 0;

    if (currentVersion < 1) {
      this.db.run(`
        -- 1. Businesses & Branches
        CREATE TABLE IF NOT EXISTS businesses (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          owner_name TEXT NOT NULL,
          phone TEXT NOT NULL,
          address TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS branches (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          name TEXT NOT NULL,
          code TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          FOREIGN KEY (business_id) REFERENCES businesses(id)
        );

        -- 2. Devices
        CREATE TABLE IF NOT EXISTS devices (
          device_id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          device_name TEXT NOT NULL,
          device_role TEXT NOT NULL,
          app_version TEXT NOT NULL,
          database_version INTEGER NOT NULL,
          is_registered INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          registered_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        -- 3. Pairing Codes (Dynamic & Time-Limited)
        CREATE TABLE IF NOT EXISTS pairing_codes (
          code TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          role_allowed TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          is_used INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL
        );

        -- 4. Users (With Hashed Passwords)
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          username TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );

        -- 5. Rooms
        CREATE TABLE IF NOT EXISTS rooms (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'available',
          hourly_rate_mmk INTEGER NOT NULL,
          surcharge_mmk INTEGER NOT NULL DEFAULT 0,
          active_session_id TEXT,
          updated_at TEXT NOT NULL
        );

        -- 6. Sessions
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          room_id TEXT NOT NULL,
          room_name TEXT NOT NULL,
          customer_name TEXT,
          start_time TEXT NOT NULL,
          end_time TEXT,
          duration_minutes INTEGER NOT NULL,
          total_fee_mmk INTEGER NOT NULL,
          status TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        -- 7. Invoices & Payments
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          invoice_number TEXT NOT NULL,
          customer_id TEXT,
          customer_name TEXT,
          room_id TEXT,
          subtotal_mmk INTEGER NOT NULL,
          discount_mmk INTEGER NOT NULL DEFAULT 0,
          total_mmk INTEGER NOT NULL,
          paid_mmk INTEGER NOT NULL DEFAULT 0,
          payment_status TEXT NOT NULL,
          payment_method TEXT NOT NULL,
          date TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        -- 8. Expenses
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT NOT NULL,
          amount_mmk INTEGER NOT NULL,
          payment_method TEXT NOT NULL,
          date TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        -- 9. Customers & Ledger
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT,
          credit_limit_mmk INTEGER NOT NULL DEFAULT 100000,
          credit_allowed INTEGER NOT NULL DEFAULT 1,
          outstanding_balance_mmk INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS customer_ledger (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount_mmk INTEGER NOT NULL,
          balance_after_mmk INTEGER NOT NULL,
          reference_id TEXT,
          notes TEXT,
          date TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        -- 10. Cash Closings (Enforces Unique Date per Business + Branch)
        CREATE TABLE IF NOT EXISTS cash_closings (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          date TEXT NOT NULL,
          opening_cash_mmk INTEGER NOT NULL,
          cash_sales_mmk INTEGER NOT NULL,
          debt_repayments_mmk INTEGER NOT NULL,
          cash_expenses_mmk INTEGER NOT NULL,
          expected_cash_mmk INTEGER NOT NULL,
          actual_cash_mmk INTEGER NOT NULL,
          discrepancy_mmk INTEGER NOT NULL,
          status TEXT NOT NULL,
          closed_by TEXT NOT NULL,
          closed_at TEXT NOT NULL,
          UNIQUE(business_id, branch_id, date)
        );

        -- 11. Server-Side Idempotency Records
        CREATE TABLE IF NOT EXISTS idempotency_records (
          operation_id TEXT PRIMARY KEY,
          device_id TEXT NOT NULL,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          request_hash TEXT NOT NULL,
          status TEXT NOT NULL,
          result_json TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL,
          processed_at TEXT NOT NULL
        );

        -- 12. Server Audit Logs
        CREATE TABLE IF NOT EXISTS audit_logs (
          audit_id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          device_id TEXT NOT NULL,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          reason TEXT,
          old_value TEXT,
          new_value TEXT,
          metadata_json TEXT
        );

        INSERT INTO schema_migrations (version, applied_at) VALUES (1, datetime('now'));
      `);

      this.seedInitialData();
    }

    if (currentVersion < 2) {
      this.db.run(`
        -- 13. Event Outbox Table (Publish-After-Commit Local Event Bus)
        CREATE TABLE IF NOT EXISTS event_outbox (
          id TEXT PRIMARY KEY,
          event_id TEXT UNIQUE NOT NULL,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation_id TEXT,
          sequence INTEGER NOT NULL,
          payload TEXT NOT NULL,
          actor_device_id TEXT,
          actor_user_id TEXT,
          created_at TEXT NOT NULL,
          published_at TEXT,
          status TEXT NOT NULL DEFAULT 'PENDING'
        );

        -- 14. Event Sequence Counter Table (Monotonic sequence per business+branch)
        CREATE TABLE IF NOT EXISTS event_sequences (
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          current_sequence INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (business_id, branch_id)
        );

        INSERT INTO schema_migrations (version, applied_at) VALUES (2, datetime('now'));
      `);
    }

    if (currentVersion < 3) {
      this.db.run(`
        -- 15. Products & Inventory
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          price_mmk INTEGER NOT NULL,
          cost_mmk INTEGER NOT NULL DEFAULT 0,
          stock_qty INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL
        );

        -- 16. Sales Orders
        CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          sale_code TEXT NOT NULL,
          session_id TEXT,
          invoice_id TEXT,
          customer_id TEXT,
          subtotal_mmk INTEGER NOT NULL,
          discount_mmk INTEGER NOT NULL DEFAULT 0,
          tax_mmk INTEGER NOT NULL DEFAULT 0,
          total_mmk INTEGER NOT NULL,
          paid_mmk INTEGER NOT NULL DEFAULT 0,
          payment_method TEXT NOT NULL,
          status TEXT NOT NULL,
          date TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        -- 17. Sale Items Breakdown
        CREATE TABLE IF NOT EXISTS sale_items (
          id TEXT PRIMARY KEY,
          sale_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          item_name TEXT NOT NULL,
          type TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price_mmk INTEGER NOT NULL,
          total_price_mmk INTEGER NOT NULL
        );

        -- 18. Staff Members
        CREATE TABLE IF NOT EXISTS staff (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          phone TEXT,
          base_salary_mmk INTEGER NOT NULL DEFAULT 0,
          commission_rate REAL NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );

        -- 19. Staff Ledger (Advances, Commissions, Adjustments)
        CREATE TABLE IF NOT EXISTS staff_ledger (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          staff_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount_mmk INTEGER NOT NULL,
          reference_id TEXT,
          notes TEXT,
          date TEXT NOT NULL,
          is_settled INTEGER NOT NULL DEFAULT 0,
          settlement_id TEXT,
          created_at TEXT NOT NULL
        );

        -- 20. Staff Settlements
        CREATE TABLE IF NOT EXISTS staff_settlements (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          staff_id TEXT NOT NULL,
          settlement_code TEXT NOT NULL,
          total_earnings_mmk INTEGER NOT NULL,
          total_deductions_mmk INTEGER NOT NULL,
          net_payout_mmk INTEGER NOT NULL,
          paid_at TEXT NOT NULL,
          status TEXT NOT NULL,
          created_by TEXT NOT NULL
        );

        -- 21. Cash Ledger Transactions
        CREATE TABLE IF NOT EXISTS cash_transactions (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          type TEXT NOT NULL,
          category TEXT NOT NULL,
          amount_mmk INTEGER NOT NULL,
          reference_type TEXT,
          reference_id TEXT,
          notes TEXT,
          transaction_time TEXT NOT NULL,
          created_by TEXT NOT NULL
        );

        INSERT INTO schema_migrations (version, applied_at) VALUES (3, datetime('now'));
      `);
    }

    if (currentVersion < 4) {
      this.db.run(`
        -- 22. Bookings & Appointments
        CREATE TABLE IF NOT EXISTS bookings (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          booking_code TEXT NOT NULL,
          customer_id TEXT,
          customer_name TEXT NOT NULL,
          customer_phone TEXT,
          service_id TEXT,
          service_name TEXT,
          room_id TEXT,
          room_name TEXT,
          staff_id TEXT,
          staff_name TEXT,
          date TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL,
          status TEXT NOT NULL,
          notes TEXT,
          deposit_amount_mmk INTEGER NOT NULL DEFAULT 0,
          deposit_payment_method TEXT,
          session_id TEXT,
          invoice_id TEXT,
          cancellation_reason TEXT,
          cancelled_by TEXT,
          cancelled_at TEXT,
          checked_in_at TEXT,
          checked_in_by TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (business_id, branch_id, date);
        CREATE INDEX IF NOT EXISTS idx_bookings_room ON bookings (business_id, branch_id, room_id, date);
        CREATE INDEX IF NOT EXISTS idx_bookings_staff ON bookings (business_id, branch_id, staff_id, date);

        INSERT INTO schema_migrations (version, applied_at) VALUES (4, datetime('now'));
      `);
    }

    if (currentVersion < 5) {
      this.db.run(`
        -- Membership Plans
        CREATE TABLE IF NOT EXISTS membership_plans (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          name TEXT NOT NULL,
          name_mm TEXT,
          duration_days INTEGER NOT NULL,
          price_mmk INTEGER NOT NULL,
          discount_percent REAL NOT NULL DEFAULT 0,
          benefits_summary TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        -- Customer Memberships
        CREATE TABLE IF NOT EXISTS customer_memberships (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_phone TEXT,
          plan_id TEXT NOT NULL,
          plan_name TEXT NOT NULL,
          start_date TEXT NOT NULL,
          expiry_date TEXT NOT NULL,
          discount_percent REAL NOT NULL DEFAULT 0,
          paid_amount_mmk INTEGER NOT NULL,
          payment_method TEXT NOT NULL,
          status TEXT NOT NULL,
          invoice_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_customer_memberships_cust ON customer_memberships (business_id, customer_id);

        -- Service Packages
        CREATE TABLE IF NOT EXISTS service_packages (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          name TEXT NOT NULL,
          name_mm TEXT,
          service_id TEXT NOT NULL,
          service_name TEXT NOT NULL,
          total_qty INTEGER NOT NULL,
          price_mmk INTEGER NOT NULL,
          validity_days INTEGER NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        -- Customer Packages
        CREATE TABLE IF NOT EXISTS customer_packages (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_phone TEXT,
          package_id TEXT NOT NULL,
          package_name TEXT NOT NULL,
          service_id TEXT NOT NULL,
          service_name TEXT NOT NULL,
          purchased_qty INTEGER NOT NULL,
          used_qty INTEGER NOT NULL DEFAULT 0,
          remaining_qty INTEGER NOT NULL,
          expiry_date TEXT NOT NULL,
          purchase_price_mmk INTEGER NOT NULL,
          payment_method TEXT NOT NULL,
          status TEXT NOT NULL,
          invoice_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_customer_packages_cust ON customer_packages (business_id, customer_id);

        -- Package Redemptions
        CREATE TABLE IF NOT EXISTS package_redemptions (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          customer_package_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          session_id TEXT,
          invoice_id TEXT,
          service_id TEXT NOT NULL,
          service_name TEXT NOT NULL,
          quantity_redeemed INTEGER NOT NULL,
          redeemed_at TEXT NOT NULL,
          redeemed_by TEXT NOT NULL,
          notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_package_redemptions_pkg ON package_redemptions (customer_package_id);

        -- Gift Cards
        CREATE TABLE IF NOT EXISTS gift_cards (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          card_number TEXT UNIQUE NOT NULL,
          initial_amount_mmk INTEGER NOT NULL,
          current_balance_mmk INTEGER NOT NULL,
          customer_id TEXT,
          customer_name TEXT,
          issue_date TEXT NOT NULL,
          expiry_date TEXT NOT NULL,
          issued_by TEXT NOT NULL,
          status TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_gift_cards_num ON gift_cards (card_number);

        -- Gift Card Redemptions
        CREATE TABLE IF NOT EXISTS gift_card_redemptions (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          gift_card_id TEXT NOT NULL,
          card_number TEXT NOT NULL,
          session_id TEXT,
          invoice_id TEXT,
          amount_mmk INTEGER NOT NULL,
          balance_before_mmk INTEGER NOT NULL,
          balance_after_mmk INTEGER NOT NULL,
          redeemed_at TEXT NOT NULL,
          redeemed_by TEXT NOT NULL,
          notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_card ON gift_card_redemptions (gift_card_id);

        -- Tips (Separated from Service Revenue)
        CREATE TABLE IF NOT EXISTS tips (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          session_id TEXT,
          invoice_id TEXT,
          staff_id TEXT NOT NULL,
          staff_name TEXT NOT NULL,
          amount_mmk INTEGER NOT NULL,
          payment_method TEXT NOT NULL,
          received_by TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tips_staff ON tips (business_id, staff_id);

        -- Invoice Payments (Breakdown for Mixed Payments)
        CREATE TABLE IF NOT EXISTS invoice_payments (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          invoice_id TEXT NOT NULL,
          method TEXT NOT NULL,
          amount_mmk INTEGER NOT NULL,
          tendered_mmk INTEGER,
          change_mmk INTEGER,
          reference_no TEXT,
          notes TEXT,
          paid_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_invoice_payments_inv ON invoice_payments (invoice_id);

        INSERT INTO schema_migrations (version, applied_at) VALUES (5, datetime('now'));
      `);
    }

    if (currentVersion < 6) {
      this.db.run(`
        -- Customer Service Notes
        CREATE TABLE IF NOT EXISTS customer_service_notes (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          customer_name TEXT,
          session_id TEXT,
          booking_id TEXT,
          service_id TEXT,
          service_name TEXT,
          staff_id TEXT,
          staff_name TEXT,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          tags TEXT,
          focus_areas TEXT,
          is_private INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_by_id TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_customer_notes_cust ON customer_service_notes (business_id, customer_id);

        INSERT INTO schema_migrations (version, applied_at) VALUES (6, datetime('now'));
      `);

      try {
        this.db.run(`ALTER TABLE customers ADD COLUMN preferences TEXT;`);
      } catch {}
    }

    if (currentVersion < 7) {
      try {
        this.db.run(`ALTER TABLE bookings ADD COLUMN price INTEGER DEFAULT 0;`);
      } catch {}
      try {
        this.db.run(`ALTER TABLE bookings ADD COLUMN discount INTEGER DEFAULT 0;`);
      } catch {}
      try {
        this.db.run(`ALTER TABLE bookings ADD COLUMN final_amount INTEGER DEFAULT 0;`);
      } catch {}
      try {
        this.db.run(`ALTER TABLE bookings ADD COLUMN completed_at TEXT;`);
      } catch {}
      try {
        this.db.run(`ALTER TABLE sessions ADD COLUMN booking_id TEXT;`);
      } catch {}
      this.db.run(`INSERT INTO schema_migrations (version, applied_at) VALUES (7, datetime('now'));`);
    }

    if (currentVersion < 8) {
      this.db.run(`
        -- Staff Attendance Table
        CREATE TABLE IF NOT EXISTS staff_attendance (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          staff_id TEXT NOT NULL,
          staff_name TEXT NOT NULL,
          date TEXT NOT NULL,
          check_in_time TEXT,
          check_out_time TEXT,
          status TEXT NOT NULL,
          device_id TEXT,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_staff_att_date ON staff_attendance (business_id, branch_id, date);
        CREATE INDEX IF NOT EXISTS idx_staff_att_staff ON staff_attendance (business_id, staff_id);

        -- Shift Handovers Table
        CREATE TABLE IF NOT EXISTS shift_handovers (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          shift_code TEXT NOT NULL,
          staff_id TEXT NOT NULL,
          staff_name TEXT NOT NULL,
          opened_at TEXT NOT NULL,
          closed_at TEXT,
          opening_float_mmk INTEGER NOT NULL,
          expected_cash_mmk INTEGER,
          actual_cash_mmk INTEGER,
          discrepancy_mmk INTEGER,
          notes TEXT,
          status TEXT NOT NULL,
          handed_over_to_id TEXT,
          handed_over_to_name TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_shift_handovers_br ON shift_handovers (business_id, branch_id);

        -- Service Consumables (Recipe / Bill of Materials)
        CREATE TABLE IF NOT EXISTS service_consumables (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          service_id TEXT NOT NULL,
          service_name TEXT NOT NULL,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_srv_consumables_srv ON service_consumables (service_id);

        -- Stock Movements (Tracking inventory consumption and adjustments)
        CREATE TABLE IF NOT EXISTS stock_movements (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          service_id TEXT,
          session_id TEXT,
          invoice_id TEXT,
          customer_id TEXT,
          customer_name TEXT,
          staff_id TEXT,
          staff_name TEXT,
          type TEXT NOT NULL,
          quantity_change REAL NOT NULL,
          previous_stock REAL NOT NULL,
          new_stock REAL NOT NULL,
          unit TEXT,
          notes TEXT,
          date TEXT NOT NULL,
          created_at TEXT NOT NULL,
          created_by TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements (business_id, product_id);

        INSERT INTO schema_migrations (version, applied_at) VALUES (8, datetime('now'));
      `);
    }

    if (currentVersion < 10) {
      this.db.run(`
        -- Suppliers
        CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          email TEXT,
          address TEXT,
          contact_person TEXT,
          notes TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_suppliers_biz ON suppliers (business_id);

        -- Purchase Orders
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          po_number TEXT NOT NULL,
          supplier_id TEXT NOT NULL,
          supplier_name TEXT NOT NULL,
          items_json TEXT NOT NULL,
          total_amount_mmk INTEGER NOT NULL DEFAULT 0,
          paid_amount_mmk INTEGER NOT NULL DEFAULT 0,
          payment_status TEXT NOT NULL DEFAULT 'unpaid',
          payment_method TEXT,
          order_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'received',
          notes TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_po_biz ON purchase_orders (business_id);

        -- Stock Adjustments
        CREATE TABLE IF NOT EXISTS stock_adjustments (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          before_qty REAL NOT NULL,
          after_qty REAL NOT NULL,
          adjust_qty REAL NOT NULL,
          reason TEXT NOT NULL,
          adjusted_by TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_stock_adj_prod ON stock_adjustments (product_id);

        -- Performance Bonus Rules
        CREATE TABLE IF NOT EXISTS performance_bonus_rules (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          rule_name TEXT NOT NULL,
          min_revenue_mmk INTEGER NOT NULL DEFAULT 0,
          min_sessions INTEGER NOT NULL DEFAULT 0,
          min_attendance_days INTEGER NOT NULL DEFAULT 0,
          bonus_amount_mmk INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );

        -- Customer Loyalty Ledger
        CREATE TABLE IF NOT EXISTS customer_loyalty_ledger (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          points INTEGER NOT NULL,
          balance_after INTEGER NOT NULL,
          type TEXT NOT NULL,
          reference_type TEXT,
          reference_id TEXT,
          notes TEXT,
          date TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_loyalty_cust ON customer_loyalty_ledger (customer_id);

        INSERT INTO schema_migrations (version, applied_at) VALUES (10, datetime('now'));
      `);
    }
  }

  /**
   * Safe Seeding with Secure Password Hashing
   */
  private seedInitialData(): void {
    if (!this.db) return;
    const now = new Date().toISOString();

    // Seed Business
    this.db.run(`
      INSERT OR IGNORE INTO businesses (id, name, owner_name, phone, address, created_at, updated_at)
      VALUES ('BIZ_SHOP_001', 'Karaoke & PS5 Lounge Mandalay', 'ကိုအောင်မင်း', '09790000001', 'Mandalay, Myanmar', '${now}', '${now}');
    `);

    // Seed Branch
    this.db.run(`
      INSERT OR IGNORE INTO branches (id, business_id, name, code, is_active, created_at)
      VALUES ('BR_MAIN', 'BIZ_SHOP_001', 'Main Lounge', 'MN-01', 1, '${now}');
    `);

    // Seed Host Device
    this.db.run(`
      INSERT OR IGNORE INTO devices (device_id, business_id, branch_id, device_name, device_role, app_version, database_version, is_registered, status, registered_at, last_seen_at, created_at)
      VALUES ('DEV_HOST_SERVER', 'BIZ_SHOP_001', 'BR_MAIN', 'Local Shop Hub Server (PC)', 'OWNER', '1.0.0', 3, 1, 'ACTIVE', '${now}', '${now}', '${now}');
    `);

    // Seed Initial Dynamic Pairing Code (Valid for 24h)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    this.db.run(`
      INSERT OR IGNORE INTO pairing_codes (code, business_id, branch_id, role_allowed, expires_at, is_used, created_by)
      VALUES ('PAIR-MANDALAY-2026', 'BIZ_SHOP_001', 'BR_MAIN', 'CASHIER', '${expiresAt}', 0, 'SYSTEM');
    `);

    // Users table created empty. Initial Owner user is created via First-Run Owner Setup.

    // Seed Sample Rooms
    this.db.run(`
      INSERT OR IGNORE INTO rooms (id, business_id, branch_id, name, status, hourly_rate_mmk, surcharge_mmk, active_session_id, updated_at)
      VALUES 
        ('room_vip_1', 'BIZ_SHOP_001', 'BR_MAIN', 'VIP KTV Room 1', 'available', 30000, 5000, NULL, '${now}'),
        ('room_ps5_1', 'BIZ_SHOP_001', 'BR_MAIN', 'PS5 Gaming Station 1', 'available', 15000, 0, NULL, '${now}');
    `);

    // Seed Sample Customer
    this.db.run(`
      INSERT OR IGNORE INTO customers (id, business_id, branch_id, name, phone, credit_limit_mmk, credit_allowed, outstanding_balance_mmk, is_active, created_at)
      VALUES ('cust_101', 'BIZ_SHOP_001', 'BR_MAIN', 'ဦးသန့်ဇင်', '09790000099', 150000, 1, 0, 1, '${now}');
    `);
  }

  /**
   * Synchronous Atomic Disk Flush
   */
  public flushToDisk(): void {
    if (!this.db || this.dbFilePath === ':memory:') return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      const tempPath = `${this.dbFilePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, buffer);
      fs.renameSync(tempPath, this.dbFilePath);
    } catch (err) {
      console.error('[PersistentSQLiteStorage] Failed to flush sqlite database to disk:', err);
    }
  }

  /**
   * Deterministic Canonical JSON Serialization & Cryptographic Hash
   */
  public computeCanonicalHash(payload: any): string {
    const canonicalString = this.canonicalizeJSON(payload);
    return crypto.createHash('sha256').update(canonicalString).digest('hex');
  }

  private canonicalizeJSON(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this.canonicalizeJSON(item)).join(',') + ']';
    }
    const sortedKeys = Object.keys(obj).sort();
    return '{' + sortedKeys.map(k => `${JSON.stringify(k)}:${this.canonicalizeJSON(obj[k])}`).join(',') + '}';
  }

  private transactionDepth: number = 0;

  /**
   * ACID Transaction Runner
   */
  public async transaction<T>(callback: () => Promise<T> | T): Promise<T> {
    await this.initialize();
    if (!this.db) throw new Error('Database uninitialized');

    if (this.transactionDepth > 0) {
      this.transactionDepth++;
      try {
        const result = await callback();
        this.transactionDepth--;
        return result;
      } catch (err) {
        this.transactionDepth--;
        throw err;
      }
    }

    this.transactionDepth = 1;
    this.db.run('BEGIN TRANSACTION;');
    try {
      const result = await callback();
      this.db.run('COMMIT;');
      this.transactionDepth = 0;
      this.flushToDisk();
      return result;
    } catch (err) {
      try {
        this.db.run('ROLLBACK;');
      } catch (rollbackErr) {
        console.error('[PersistentSQLiteStorage] Rollback error:', rollbackErr);
      }
      this.transactionDepth = 0;
      throw err;
    }
  }

  // ==========================================
  // BUSINESS & BRANCH METHODS
  // ==========================================
  public getBusiness(businessId: string): ServerBusinessEntity | undefined {
    if (!this.db) return undefined;
    const stmt = this.db.prepare(`SELECT * FROM businesses WHERE id = ?`);
    stmt.bind([businessId]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        name: row.name as string,
        ownerName: row.owner_name as string,
        phone: row.phone as string,
        address: (row.address as string) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      };
    }
    stmt.free();
    return undefined;
  }

  public getBranch(businessId: string, branchId: string): ServerBranchEntity | undefined {
    if (!this.db) return undefined;
    const stmt = this.db.prepare(`SELECT * FROM branches WHERE business_id = ? AND id = ?`);
    stmt.bind([businessId, branchId]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        businessId: row.business_id as string,
        name: row.name as string,
        code: row.code as string,
        isActive: row.is_active === 1,
        createdAt: row.created_at as string,
      };
    }
    stmt.free();
    return undefined;
  }

  // ==========================================
  // DEVICE METHODS & DYNAMIC PAIRING
  // ==========================================
  public getDevice(deviceId: string): ServerDeviceEntity | undefined {
    if (!this.db) return undefined;
    const stmt = this.db.prepare(`SELECT * FROM devices WHERE device_id = ?`);
    stmt.bind([deviceId]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        deviceId: row.device_id as string,
        businessId: row.business_id as string,
        branchId: row.branch_id as string,
        deviceName: row.device_name as string,
        deviceRole: row.device_role as any,
        appVersion: row.app_version as string,
        databaseVersion: Number(row.database_version),
        isRegistered: row.is_registered === 1,
        status: row.status as any,
        registeredAt: row.registered_at as string,
        lastSeenAt: row.last_seen_at as string,
        createdAt: row.created_at as string,
      };
    }
    stmt.free();
    return undefined;
  }

  public getAllRegisteredDevices(businessId: string): ServerDeviceEntity[] {
    if (!this.db) return [];
    const devices: ServerDeviceEntity[] = [];
    const stmt = this.db.prepare(`SELECT * FROM devices WHERE business_id = ? AND is_registered = 1`);
    stmt.bind([businessId]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      devices.push({
        deviceId: row.device_id as string,
        businessId: row.business_id as string,
        branchId: row.branch_id as string,
        deviceName: row.device_name as string,
        deviceRole: row.device_role as any,
        appVersion: row.app_version as string,
        databaseVersion: Number(row.database_version),
        isRegistered: row.is_registered === 1,
        status: row.status as any,
        registeredAt: row.registered_at as string,
        lastSeenAt: row.last_seen_at as string,
        createdAt: row.created_at as string,
      });
    }
    stmt.free();
    return devices;
  }

  public registerDevice(device: Omit<ServerDeviceEntity, 'createdAt' | 'lastSeenAt' | 'registeredAt' | 'status' | 'isRegistered'>): ServerDeviceEntity {
    if (!this.db) throw new Error('DB uninitialized');
    const existing = this.getDevice(device.deviceId);
    const now = new Date().toISOString();

    if (existing) {
      this.db.run(`
        UPDATE devices 
        SET device_name = ?, device_role = ?, app_version = ?, database_version = ?, last_seen_at = ?, status = 'ACTIVE', is_registered = 1
        WHERE device_id = ?
      `, [device.deviceName, device.deviceRole, device.appVersion, device.databaseVersion, now, device.deviceId]);
      this.flushToDisk();
      return this.getDevice(device.deviceId)!;
    }

    this.db.run(`
      INSERT INTO devices (device_id, business_id, branch_id, device_name, device_role, app_version, database_version, is_registered, status, registered_at, last_seen_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'ACTIVE', ?, ?, ?)
    `, [device.deviceId, device.businessId, device.branchId, device.deviceName, device.deviceRole, device.appVersion, device.databaseVersion, now, now, now]);

    this.flushToDisk();
    return this.getDevice(device.deviceId)!;
  }

  public createPairingCode(businessId: string, branchId: string, roleAllowed: any, createdBy: string, expiresInMinutes = 60): string {
    if (!this.db) throw new Error('DB uninitialized');
    const code = 'PAIR-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    this.db.run(`
      INSERT INTO pairing_codes (code, business_id, branch_id, role_allowed, expires_at, is_used, created_by)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `, [code, businessId, branchId, roleAllowed, expiresAt, createdBy]);

    this.flushToDisk();
    return code;
  }

  public pairDevice(deviceId: string, pairingCode: string, deviceInfo: Partial<ServerDeviceEntity>): { success: boolean; message: string; device?: ServerDeviceEntity } {
    if (!this.db) return { success: false, message: 'DB not ready' };
    const stmt = this.db.prepare(`SELECT * FROM pairing_codes WHERE code = ? AND is_used = 0`);
    stmt.bind([pairingCode]);

    if (!stmt.step()) {
      stmt.free();
      return { success: false, message: 'Invalid or expired pairing code.' };
    }

    const row = stmt.getAsObject();
    stmt.free();

    const expiresAt = new Date(row.expires_at as string).getTime();
    if (Date.now() > expiresAt) {
      return { success: false, message: 'Pairing code has expired.' };
    }

    // Mark code used
    this.db.run(`UPDATE pairing_codes SET is_used = 1 WHERE code = ?`, [pairingCode]);

    const registered = this.registerDevice({
      deviceId,
      businessId: (row.business_id as string) || deviceInfo.businessId || 'BIZ_SHOP_001',
      branchId: (row.branch_id as string) || deviceInfo.branchId || 'BR_MAIN',
      deviceName: deviceInfo.deviceName || `LAN Device (${deviceId.substring(0, 6)})`,
      deviceRole: (row.role_allowed as any) || deviceInfo.deviceRole || 'CASHIER',
      appVersion: deviceInfo.appVersion || '1.0.0',
      databaseVersion: deviceInfo.databaseVersion || 3,
    });

    return { success: true, message: 'Device successfully paired and authorized.', device: registered };
  }

  public updateDeviceStatus(deviceId: string, status: 'ACTIVE' | 'REVOKED' | 'PENDING'): void {
    if (!this.db) throw new Error('DB uninitialized');
    this.db.run(`UPDATE devices SET status = ? WHERE device_id = ?`, [status, deviceId]);
    this.flushToDisk();
  }

  // ==========================================
  // USER AUTHENTICATION
  // ==========================================
  public authenticateUser(username: string, plainPassword: string): ServerUserEntity | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT * FROM users WHERE username = ? AND is_active = 1`);
    stmt.bind([username.toLowerCase().trim()]);

    if (!stmt.step()) {
      stmt.free();
      return null;
    }

    const row = stmt.getAsObject();
    stmt.free();

    const computedHash = crypto.createHash('sha256').update(plainPassword + (row.salt as string)).digest('hex');
    if (computedHash !== row.password_hash) {
      return null;
    }

    return {
      id: row.id as string,
      businessId: row.business_id as string,
      branchId: row.branch_id as string,
      username: row.username as string,
      name: row.name as string,
      role: row.role as any,
      isActive: row.is_active === 1,
      createdAt: row.created_at as string,
    };
  }

  public authenticateUserPin(usernameOrId: string, plainPin: string): ServerUserEntity | null {
    if (!this.db || !usernameOrId || !plainPin) return null;
    const cleanLookup = usernameOrId.toLowerCase().trim();
    const stmt = this.db.prepare(`
      SELECT * FROM users 
      WHERE (LOWER(username) = ? OR id = ?) AND is_active = 1
    `);
    stmt.bind([cleanLookup, usernameOrId.trim()]);

    if (!stmt.step()) {
      stmt.free();
      return null;
    }

    const row = stmt.getAsObject();
    stmt.free();

    const salt = (row.salt as string) || '';
    const computedHash = crypto.createHash('sha256').update(plainPin.trim() + salt).digest('hex');
    const storedHash = (row.password_hash as string) || (row.pin_hash as string);

    if (computedHash !== storedHash) {
      return null;
    }

    return {
      id: row.id as string,
      businessId: row.business_id as string,
      branchId: row.branch_id as string,
      username: row.username as string,
      name: row.name as string,
      role: row.role as any,
      isActive: row.is_active === 1,
      createdAt: row.created_at as string,
    };
  }

  public getUserById(userId: string): ServerUserEntity | null {
    if (!this.db || !userId) return null;
    const stmt = this.db.prepare(`SELECT * FROM users WHERE id = ?`);
    stmt.bind([userId.trim()]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return {
      id: row.id as string,
      businessId: row.business_id as string,
      branchId: row.branch_id as string,
      username: row.username as string,
      name: row.name as string,
      role: row.role as any,
      isActive: row.is_active === 1,
      createdAt: row.created_at as string,
    };
  }

  public getUserByUsername(username: string): ServerUserEntity | null {
    if (!this.db || !username) return null;
    const stmt = this.db.prepare(`SELECT * FROM users WHERE LOWER(username) = ?`);
    stmt.bind([username.toLowerCase().trim()]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return {
      id: row.id as string,
      businessId: row.business_id as string,
      branchId: row.branch_id as string,
      username: row.username as string,
      name: row.name as string,
      role: row.role as any,
      isActive: row.is_active === 1,
      createdAt: row.created_at as string,
    };
  }

  public getUsers(businessId?: string): ServerUserEntity[] {
    if (!this.db) return [];
    let sql = `SELECT id, business_id, branch_id, username, name, role, is_active, created_at FROM users`;
    const params: any[] = [];
    if (businessId) {
      sql += ` WHERE business_id = ?`;
      params.push(businessId);
    }
    sql += ` ORDER BY created_at ASC`;
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const users: ServerUserEntity[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      users.push({
        id: row.id as string,
        businessId: row.business_id as string,
        branchId: row.branch_id as string,
        username: row.username as string,
        name: row.name as string,
        role: row.role as any,
        isActive: row.is_active === 1,
        createdAt: row.created_at as string,
      });
    }
    stmt.free();
    return users;
  }

  public countUsers(): number {
    if (!this.db) return 0;
    const stmt = this.db.prepare(`SELECT COUNT(*) as cnt FROM users`);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return Number(row.cnt) || 0;
    }
    stmt.free();
    return 0;
  }

  public createUser(userData: {
    id?: string;
    businessId?: string;
    branchId?: string;
    username: string;
    name: string;
    role: any;
    password?: string;
    pin?: string;
  }): ServerUserEntity {
    if (!this.db) throw new Error('DB not initialized');
    const now = new Date().toISOString();
    const id = userData.id || 'usr_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
    const businessId = userData.businessId || 'BIZ_SHOP_001';
    const branchId = userData.branchId || 'BR_MAIN';
    const username = userData.username.toLowerCase().trim();
    const name = userData.name.trim();
    const role = userData.role || 'cashier';

    const rawSecret = userData.password || userData.pin || '123456';
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.createHash('sha256').update(rawSecret.trim() + salt).digest('hex');

    this.db.run(
      `INSERT INTO users (id, business_id, branch_id, username, name, role, password_hash, salt, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, businessId, branchId, username, name, role, passwordHash, salt, now]
    );
    this.flushToDisk();

    return {
      id,
      businessId,
      branchId,
      username,
      name,
      role,
      isActive: true,
      createdAt: now,
    };
  }

  public updateUser(
    id: string,
    updates: {
      name?: string;
      username?: string;
      role?: any;
      isActive?: boolean;
    }
  ): boolean {
    if (!this.db || !id) return false;
    const existing = this.getUserById(id);
    if (!existing) return false;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name.trim());
    }
    if (updates.username !== undefined) {
      fields.push('username = ?');
      values.push(updates.username.toLowerCase().trim());
    }
    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role);
    }
    if (updates.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.isActive ? 1 : 0);
    }

    if (fields.length === 0) return true;

    values.push(id);
    this.db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    this.flushToDisk();
    return true;
  }

  public updateUserPassword(id: string, newPassword: string): boolean {
    if (!this.db || !id || !newPassword) return false;
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.createHash('sha256').update(newPassword.trim() + salt).digest('hex');
    this.db.run(`UPDATE users SET password_hash = ?, salt = ? WHERE id = ?`, [passwordHash, salt, id]);
    this.flushToDisk();
    return true;
  }

  public setUserActive(id: string, isActive: boolean): boolean {
    if (!this.db || !id) return false;
    this.db.run(`UPDATE users SET is_active = ? WHERE id = ?`, [isActive ? 1 : 0, id]);
    this.flushToDisk();
    return true;
  }

  // ==========================================
  // SERVER IDEMPOTENCY ENGINE
  // ==========================================
  public getIdempotencyRecord(operationId: string): ServerIdempotencyRecord | undefined {
    if (!this.db) return undefined;
    const stmt = this.db.prepare(`SELECT * FROM idempotency_records WHERE operation_id = ?`);
    stmt.bind([operationId]);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        operationId: row.operation_id as string,
        deviceId: row.device_id as string,
        businessId: row.business_id as string,
        branchId: row.branch_id as string,
        operationType: row.operation_type as string,
        entityType: row.entity_type as string,
        entityId: row.entity_id as string,
        requestHash: row.request_hash as string,
        status: row.status as any,
        result: row.result_json ? JSON.parse(row.result_json as string) : undefined,
        error: (row.error_message as string) || undefined,
        createdAt: row.created_at as string,
        processedAt: row.processed_at as string,
      };
    }
    stmt.free();
    return undefined;
  }

  public recordIdempotentOperation(record: ServerIdempotencyRecord): void {
    if (!this.db) throw new Error('DB uninitialized');
    this.db.run(`
      INSERT INTO idempotency_records (
        operation_id, device_id, business_id, branch_id, operation_type, entity_type, entity_id, request_hash, status, result_json, error_message, created_at, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      record.operationId,
      record.deviceId,
      record.businessId,
      record.branchId,
      record.operationType,
      record.entityType,
      record.entityId,
      record.requestHash,
      record.status,
      record.result ? JSON.stringify(record.result) : null,
      record.error || null,
      record.createdAt,
      record.processedAt,
    ]);
  }

  // ==========================================
  // REAL-TIME EVENT OUTBOX ENGINE
  // ==========================================

  public getNextSequence(businessId: string, branchId: string): number {
    if (!this.db) throw new Error('DB uninitialized');
    this.db.run(`
      INSERT INTO event_sequences (business_id, branch_id, current_sequence)
      VALUES (?, ?, 1)
      ON CONFLICT(business_id, branch_id) DO UPDATE SET current_sequence = current_sequence + 1
    `, [businessId, branchId]);

    const stmt = this.db.prepare(`SELECT current_sequence FROM event_sequences WHERE business_id = ? AND branch_id = ?`);
    stmt.bind([businessId, branchId]);
    let seq = 1;
    if (stmt.step()) {
      seq = Number(stmt.getAsObject().current_sequence);
    }
    stmt.free();
    return seq;
  }

  public getLatestSequence(businessId: string, branchId: string): number {
    if (!this.db) return 0;
    const stmt = this.db.prepare(`SELECT current_sequence FROM event_sequences WHERE business_id = ? AND branch_id = ?`);
    stmt.bind([businessId, branchId]);
    let seq = 0;
    if (stmt.step()) {
      seq = Number(stmt.getAsObject().current_sequence);
    }
    stmt.free();
    return seq;
  }

  public recordOutboxEvent(event: {
    eventId?: string;
    businessId: string;
    branchId: string;
    eventType: ServerEventType;
    entityType: string;
    entityId: string;
    operationId?: string;
    payload: any;
    actorDeviceId?: string;
    actorUserId?: string;
  }): OutboxRecord {
    if (!this.db) throw new Error('DB uninitialized');
    const id = 'outbox_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    const eventId = event.eventId || crypto.randomUUID();
    const now = new Date().toISOString();
    const sequence = this.getNextSequence(event.businessId, event.branchId);
    const payloadJson = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);

    this.db.run(`
      INSERT INTO event_outbox (
        id, event_id, business_id, branch_id, event_type, entity_type, entity_id, operation_id, sequence, payload, actor_device_id, actor_user_id, created_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `, [
      id,
      eventId,
      event.businessId,
      event.branchId,
      event.eventType,
      event.entityType,
      event.entityId,
      event.operationId || null,
      sequence,
      payloadJson,
      event.actorDeviceId || null,
      event.actorUserId || null,
      now,
    ]);

    return {
      id,
      eventId,
      businessId: event.businessId,
      branchId: event.branchId,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      operationId: event.operationId,
      sequence,
      payload: payloadJson,
      actorDeviceId: event.actorDeviceId,
      actorUserId: event.actorUserId,
      createdAt: now,
      status: 'PENDING',
    };
  }

  public getPendingOutboxEvents(limit = 50): OutboxRecord[] {
    if (!this.db) return [];
    const events: OutboxRecord[] = [];
    const stmt = this.db.prepare(`
      SELECT * FROM event_outbox WHERE status = 'PENDING' ORDER BY sequence ASC LIMIT ?
    `);
    stmt.bind([limit]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      events.push({
        id: row.id as string,
        eventId: row.event_id as string,
        businessId: row.business_id as string,
        branchId: row.branch_id as string,
        eventType: row.event_type as ServerEventType,
        entityType: row.entity_type as string,
        entityId: row.entity_id as string,
        operationId: (row.operation_id as string) || undefined,
        sequence: Number(row.sequence),
        payload: row.payload as string,
        actorDeviceId: (row.actor_device_id as string) || undefined,
        actorUserId: (row.actor_user_id as string) || undefined,
        createdAt: row.created_at as string,
        publishedAt: (row.published_at as string) || undefined,
        status: row.status as any,
      });
    }
    stmt.free();
    return events;
  }

  public markOutboxEventPublished(eventId: string): void {
    if (!this.db) return;
    const now = new Date().toISOString();
    this.db.run(`UPDATE event_outbox SET status = 'PUBLISHED', published_at = ? WHERE event_id = ?`, [now, eventId]);
    this.flushToDisk();
  }

  public getOutboxEventsSince(businessId: string, branchId: string, sinceSequence: number, limit = 100): ServerEvent[] {
    if (!this.db) return [];
    const events: ServerEvent[] = [];
    const query = branchId === '*'
      ? `SELECT * FROM event_outbox WHERE business_id = ? AND sequence > ? ORDER BY sequence ASC LIMIT ?`
      : `SELECT * FROM event_outbox WHERE business_id = ? AND branch_id = ? AND sequence > ? ORDER BY sequence ASC LIMIT ?`;
    const stmt = this.db.prepare(query);
    stmt.bind(branchId === '*' ? [businessId, sinceSequence, limit] : [businessId, branchId, sinceSequence, limit]);

    while (stmt.step()) {
      const row = stmt.getAsObject();
      let payloadObj: any = {};
      try {
        payloadObj = JSON.parse(row.payload as string);
      } catch {
        payloadObj = row.payload;
      }
      events.push({
        eventId: row.event_id as string,
        eventType: row.event_type as ServerEventType,
        businessId: row.business_id as string,
        branchId: row.branch_id as string,
        entityType: row.entity_type as string,
        entityId: row.entity_id as string,
        operationId: (row.operation_id as string) || undefined,
        version: 1,
        timestamp: row.created_at as string,
        sequence: Number(row.sequence),
        actorDeviceId: (row.actor_device_id as string) || undefined,
        actorUserId: (row.actor_user_id as string) || undefined,
        payload: payloadObj,
      });
    }
    stmt.free();
    return events;
  }

  // ==========================================
  // REAL FINANCIAL OPERATIONS EXECUTION
  // ==========================================

  /**
   * SESSION START: Atomically checks room availability and locks room
   */
  public async executeSessionStart(params: {
    sessionId: string;
    businessId: string;
    branchId: string;
    roomId: string;
    customerName?: string;
    hourlyRateMMK: number;
    userId: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      // Concurrency lock check
      const stmt = this.db.prepare(`SELECT * FROM rooms WHERE id = ? AND business_id = ?`);
      stmt.bind([params.roomId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Room ${params.roomId} not found`);
      }
      const room = stmt.getAsObject();
      stmt.free();

      if (room.status === 'occupied') {
        const conflictErr = new Error(`Room ${room.name} is already occupied by session ${room.active_session_id}`);
        (conflictErr as any).code = 'ROOM_OCCUPIED_CONFLICT';
        throw conflictErr;
      }

      const now = new Date().toISOString();
      // 1. Create Session
      this.db.run(`
        INSERT INTO sessions (id, business_id, branch_id, room_id, room_name, customer_name, start_time, duration_minutes, total_fee_mmk, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'active', ?, ?)
      `, [params.sessionId, params.businessId, params.branchId, params.roomId, room.name, params.customerName || null, now, params.userId, now]);

      // 2. Lock Room
      this.db.run(`
        UPDATE rooms SET status = 'occupied', active_session_id = ?, updated_at = ? WHERE id = ?
      `, [params.sessionId, now, params.roomId]);

      // 3. Atomically Record Outbox Real-Time Events (Publish-After-Commit)
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'SESSION_STARTED',
        entityType: 'SESSION',
        entityId: params.sessionId,
        payload: {
          sessionId: params.sessionId,
          roomId: params.roomId,
          roomName: room.name,
          customerName: params.customerName || null,
          status: 'active',
          startTime: now,
        },
        actorUserId: params.userId,
      });

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'ROOM_STATUS_CHANGED',
        entityType: 'ROOM',
        entityId: params.roomId,
        payload: {
          roomId: params.roomId,
          roomName: room.name,
          status: 'occupied',
          activeSessionId: params.sessionId,
        },
        actorUserId: params.userId,
      });

      return { sessionId: params.sessionId, roomId: params.roomId, roomName: room.name, status: 'active', startTime: now };
    });
  }

  /**
   * SESSION END: Atomically ends session and frees room
   */
  public async executeSessionEnd(params: {
    sessionId: string;
    businessId: string;
    branchId: string;
    roomId: string;
    totalFeeMMK?: number;
    userId: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      
      this.db.run(`
        UPDATE sessions SET status = 'completed', end_time = ?, total_fee_mmk = ? WHERE id = ?
      `, [now, params.totalFeeMMK || 0, params.sessionId]);

      this.db.run(`
        UPDATE rooms SET status = 'available', active_session_id = NULL, updated_at = ? WHERE id = ?
      `, [now, params.roomId]);

      // Complete linked booking if any
      this.db.run(`
        UPDATE bookings SET status = 'COMPLETED', completed_at = ?, updated_at = ?
        WHERE session_id = ? AND status != 'COMPLETED'
      `, [now, now, params.sessionId]);

      try {
        const bStmt = this.db.prepare(`SELECT id FROM bookings WHERE session_id = ?`);
        bStmt.bind([params.sessionId]);
        if (bStmt.step()) {
          const bObj = bStmt.getAsObject();
          this.recordOutboxEvent({
            businessId: params.businessId,
            branchId: params.branchId,
            eventType: 'BOOKING_COMPLETED',
            entityType: 'BOOKING',
            entityId: String(bObj.id),
            payload: {
              bookingId: bObj.id,
              sessionId: params.sessionId,
              status: 'COMPLETED',
              completedAt: now,
            },
            actorUserId: params.userId,
          });
        }
        bStmt.free();
      } catch {}

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'SESSION_ENDED',
        entityType: 'SESSION',
        entityId: params.sessionId,
        payload: {
          sessionId: params.sessionId,
          roomId: params.roomId,
          status: 'completed',
          endTime: now,
        },
        actorUserId: params.userId,
      });

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'ROOM_STATUS_CHANGED',
        entityType: 'ROOM',
        entityId: params.roomId,
        payload: {
          roomId: params.roomId,
          status: 'available',
          activeSessionId: null,
        },
        actorUserId: params.userId,
      });

      return { sessionId: params.sessionId, roomId: params.roomId, status: 'completed', endTime: now };
    });
  }

  /**
   * SESSION EXTEND: Atomically extends session and adjusts price
   */
  public async executeSessionExtend(params: {
    sessionId: string;
    businessId: string;
    branchId: string;
    extendedMinutes: number;
    extensionPriceMMK: number;
    reason?: string;
    userId: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const stmt = this.db.prepare(`SELECT * FROM sessions WHERE id = ? AND business_id = ?`);
      stmt.bind([params.sessionId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Session ${params.sessionId} not found`);
      }
      const session = stmt.getAsObject();
      stmt.free();

      const newDuration = Number(session.duration_minutes || 0) + params.extendedMinutes;
      const newTotalFee = Number(session.total_fee_mmk || 0) + params.extensionPriceMMK;
      const now = new Date().toISOString();

      this.db.run(`
        UPDATE sessions SET duration_minutes = ?, total_fee_mmk = ? WHERE id = ?
      `, [newDuration, newTotalFee, params.sessionId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'SESSION_EXTENDED',
        entityType: 'SESSION',
        entityId: params.sessionId,
        payload: {
          sessionId: params.sessionId,
          roomId: session.room_id,
          extendedMinutes: params.extendedMinutes,
          newDurationMinutes: newDuration,
          extensionPriceMMK: params.extensionPriceMMK,
          newTotalFeeMMK: newTotalFee,
          reason: params.reason || null,
        },
        actorUserId: params.userId,
      });

      return {
        sessionId: params.sessionId,
        roomId: session.room_id,
        durationMinutes: newDuration,
        totalFeeMMK: newTotalFee,
      };
    });
  }

  /**
   * SESSION CANCEL / VOID: Atomically cancels session and frees room
   */
  public async executeSessionCancel(params: {
    sessionId: string;
    businessId: string;
    branchId: string;
    roomId: string;
    reason?: string;
    userId: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      this.db.run(`
        UPDATE sessions SET status = 'cancelled', end_time = ? WHERE id = ?
      `, [now, params.sessionId]);

      this.db.run(`
        UPDATE rooms SET status = 'available', active_session_id = NULL, updated_at = ? WHERE id = ?
      `, [now, params.roomId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'SESSION_ENDED',
        entityType: 'SESSION',
        entityId: params.sessionId,
        payload: {
          sessionId: params.sessionId,
          roomId: params.roomId,
          status: 'cancelled',
          reason: params.reason || null,
          endTime: now,
        },
        actorUserId: params.userId,
      });

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'ROOM_STATUS_CHANGED',
        entityType: 'ROOM',
        entityId: params.roomId,
        payload: {
          roomId: params.roomId,
          status: 'available',
          activeSessionId: null,
        },
        actorUserId: params.userId,
      });

      return { sessionId: params.sessionId, roomId: params.roomId, status: 'cancelled' };
    });
  }

  /**
   * DIRECT SALE: Atomically commits sale, deducts product inventory, creates invoice & cash transaction
   */
  public async executeDirectSale(params: {
    saleId: string;
    invoiceId: string;
    businessId: string;
    branchId: string;
    saleCode: string;
    invoiceNumber: string;
    sessionId?: string;
    customerId?: string;
    customerName?: string;
    items: Array<{
      itemId: string;
      itemName: string;
      type: string;
      quantity: number;
      unitPriceMMK: number;
      totalPriceMMK: number;
    }>;
    subtotalMMK: number;
    discountMMK: number;
    taxMMK?: number;
    totalMMK: number;
    paidMMK: number;
    paymentMethod: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const dateStr = now.split('T')[0];
      const status = params.paidMMK >= params.totalMMK ? 'completed' : 'pending';
      const paymentStatus = params.paidMMK >= params.totalMMK ? 'paid' : (params.paidMMK > 0 ? 'partial' : 'unpaid');

      // 1. Insert Sale Order
      this.db.run(`
        INSERT INTO sales (
          id, business_id, branch_id, sale_code, session_id, invoice_id, customer_id, subtotal_mmk, discount_mmk, tax_mmk, total_mmk, paid_mmk, payment_method, status, date, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        params.saleId,
        params.businessId,
        params.branchId,
        params.saleCode,
        params.sessionId || null,
        params.invoiceId,
        params.customerId || null,
        params.subtotalMMK,
        params.discountMMK,
        params.taxMMK || 0,
        params.totalMMK,
        params.paidMMK,
        params.paymentMethod,
        status,
        dateStr,
        params.userName,
        now,
      ]);

      // 2. Insert Sale Items & Deduct Stock Atomically
      for (const item of params.items) {
        const saleItemId = `si_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.db.run(`
          INSERT INTO sale_items (id, sale_id, item_id, item_name, type, quantity, unit_price_mmk, total_price_mmk)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          saleItemId,
          params.saleId,
          item.itemId,
          item.itemName,
          item.type,
          item.quantity,
          item.unitPriceMMK,
          item.totalPriceMMK,
        ]);

        // Stock deduction for products
        if (item.type === 'product' || item.type === 'inventory') {
          this.db.run(`
            UPDATE products SET stock_qty = stock_qty - ?, updated_at = ? WHERE id = ?
          `, [item.quantity, now, item.itemId]);

          this.recordOutboxEvent({
            businessId: params.businessId,
            branchId: params.branchId,
            eventType: 'STOCK_UPDATED',
            entityType: 'PRODUCT',
            entityId: item.itemId,
            payload: {
              productId: item.itemId,
              quantityDeducted: item.quantity,
              reason: `Sale ${params.saleCode}`,
            },
            actorUserId: params.userId,
          });
        }
      }

      // 3. Insert Invoice
      this.db.run(`
        INSERT INTO invoices (
          id, business_id, branch_id, invoice_number, customer_id, customer_name, subtotal_mmk, discount_mmk, total_mmk, paid_mmk, payment_status, payment_method, date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        params.invoiceId,
        params.businessId,
        params.branchId,
        params.invoiceNumber,
        params.customerId || null,
        params.customerName || null,
        params.subtotalMMK,
        params.discountMMK,
        params.totalMMK,
        params.paidMMK,
        paymentStatus,
        params.paymentMethod,
        dateStr,
        now,
      ]);

      // 4. Cash Ledger Entry (if paid cash)
      if (params.paidMMK > 0 && params.paymentMethod === 'cash') {
        const cashTxId = `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.db.run(`
          INSERT INTO cash_transactions (id, business_id, branch_id, type, category, amount_mmk, reference_type, reference_id, notes, transaction_time, created_by)
          VALUES (?, ?, ?, 'cash_in', 'pos_sale', ?, 'sale', ?, ?, ?, ?)
        `, [cashTxId, params.businessId, params.branchId, params.paidMMK, params.saleId, `Sale ${params.saleCode}`, now, params.userName]);
      }

      // 5. Customer Credit Ledger Entry (if credit sale)
      if (params.customerId && params.totalMMK > params.paidMMK) {
        const debtAmount = params.totalMMK - params.paidMMK;
        const cStmt = this.db.prepare(`SELECT * FROM customers WHERE id = ? AND business_id = ?`);
        cStmt.bind([params.customerId, params.businessId]);
        if (cStmt.step()) {
          const cust = cStmt.getAsObject();
          const newBal = Number(cust.outstanding_balance_mmk || 0) + debtAmount;
          this.db.run(`UPDATE customers SET outstanding_balance_mmk = ? WHERE id = ?`, [newBal, params.customerId]);

          const ldgId = `cldg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          this.db.run(`
            INSERT INTO customer_ledger (id, business_id, branch_id, customer_id, type, amount_mmk, balance_after_mmk, reference_id, notes, date, created_at)
            VALUES (?, ?, ?, ?, 'credit_sale', ?, ?, ?, ?, ?, ?)
          `, [ldgId, params.businessId, params.branchId, params.customerId, debtAmount, newBal, params.saleId, `Credit for Sale ${params.saleCode}`, dateStr, now]);

          this.recordOutboxEvent({
            businessId: params.businessId,
            branchId: params.branchId,
            eventType: 'CUSTOMER_BALANCE_UPDATED',
            entityType: 'CUSTOMER',
            entityId: params.customerId,
            payload: { customerId: params.customerId, outstandingBalanceMMK: newBal },
            actorUserId: params.userId,
          });
        }
        cStmt.free();
      }

      // 6. Record Real-Time Outbox Events
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'SALE_CREATED',
        entityType: 'SALE',
        entityId: params.saleId,
        payload: {
          saleId: params.saleId,
          saleCode: params.saleCode,
          invoiceId: params.invoiceId,
          totalMMK: params.totalMMK,
          paidMMK: params.paidMMK,
          paymentStatus,
          paymentMethod: params.paymentMethod,
        },
        actorUserId: params.userId,
      });

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'PAYMENT_CREATED',
        entityType: 'INVOICE',
        entityId: params.invoiceId,
        payload: {
          invoiceId: params.invoiceId,
          invoiceNumber: params.invoiceNumber,
          totalMMK: params.totalMMK,
          paidMMK: params.paidMMK,
          paymentStatus,
        },
        actorUserId: params.userId,
      });

      return {
        saleId: params.saleId,
        invoiceId: params.invoiceId,
        saleCode: params.saleCode,
        totalMMK: params.totalMMK,
        paidMMK: params.paidMMK,
        status,
        paymentStatus,
      };
    });
  }

  /**
   * CUSTOMER REPAYMENT: Atomically deducts customer debt and records cash in
   */
  public async executeCustomerRepayment(params: {
    ledgerId: string;
    businessId: string;
    branchId: string;
    customerId: string;
    amountMMK: number;
    paymentMethod: string;
    notes?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const stmt = this.db.prepare(`SELECT * FROM customers WHERE id = ? AND business_id = ?`);
      stmt.bind([params.customerId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Customer ${params.customerId} not found`);
      }
      const customer = stmt.getAsObject();
      stmt.free();

      const currentBal = Number(customer.outstanding_balance_mmk || 0);
      const newBal = Math.max(0, currentBal - params.amountMMK);
      const now = new Date().toISOString();
      const dateStr = now.split('T')[0];

      // 1. Update Customer
      this.db.run(`UPDATE customers SET outstanding_balance_mmk = ? WHERE id = ?`, [newBal, params.customerId]);

      // 2. Insert Customer Ledger
      this.db.run(`
        INSERT INTO customer_ledger (id, business_id, branch_id, customer_id, type, amount_mmk, balance_after_mmk, notes, date, created_at)
        VALUES (?, ?, ?, ?, 'repayment', ?, ?, ?, ?, ?)
      `, [params.ledgerId, params.businessId, params.branchId, params.customerId, params.amountMMK, newBal, params.notes || 'Debt repayment', dateStr, now]);

      // 3. Cash Transaction (if cash)
      if (params.paymentMethod === 'cash') {
        const cashTxId = `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.db.run(`
          INSERT INTO cash_transactions (id, business_id, branch_id, type, category, amount_mmk, reference_type, reference_id, notes, transaction_time, created_by)
          VALUES (?, ?, ?, 'cash_in', 'debt_repayment', ?, 'customer_repayment', ?, ?, ?, ?)
        `, [cashTxId, params.businessId, params.branchId, params.amountMMK, params.customerId, `Customer debt repayment from ${customer.name}`, now, params.userName]);
      }

      // 4. Outbox Real-Time Events
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'CUSTOMER_PAYMENT_CREATED',
        entityType: 'CUSTOMER_LEDGER',
        entityId: params.ledgerId,
        payload: {
          ledgerId: params.ledgerId,
          customerId: params.customerId,
          amountMMK: params.amountMMK,
          newBalance: newBal,
        },
        actorUserId: params.userId,
      });

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'CUSTOMER_BALANCE_UPDATED',
        entityType: 'CUSTOMER',
        entityId: params.customerId,
        payload: {
          customerId: params.customerId,
          outstandingBalanceMMK: newBal,
        },
        actorUserId: params.userId,
      });

      return { customerId: params.customerId, amountMMK: params.amountMMK, previousBalance: currentBal, newBalance: newBal };
    });
  }

  /**
   * STAFF ADVANCE: Atomically creates staff advance and cash payout transaction
   */
  public async executeStaffAdvance(params: {
    advanceId: string;
    businessId: string;
    branchId: string;
    staffId: string;
    amountMMK: number;
    notes?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const dateStr = now.split('T')[0];

      // 1. Insert Staff Ledger
      this.db.run(`
        INSERT INTO staff_ledger (id, business_id, branch_id, staff_id, type, amount_mmk, notes, date, is_settled, created_at)
        VALUES (?, ?, ?, ?, 'advance', ?, ?, ?, 0, ?)
      `, [params.advanceId, params.businessId, params.branchId, params.staffId, params.amountMMK, params.notes || 'Salary advance', dateStr, now]);

      // 2. Insert Cash Out Transaction
      const cashTxId = `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      this.db.run(`
        INSERT INTO cash_transactions (id, business_id, branch_id, type, category, amount_mmk, reference_type, reference_id, notes, transaction_time, created_by)
        VALUES (?, ?, ?, 'cash_out', 'staff_advance', ?, 'staff_advance', ?, ?, ?, ?)
      `, [cashTxId, params.businessId, params.branchId, params.amountMMK, params.advanceId, params.notes || 'Staff salary advance', now, params.userName]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'STAFF_ADVANCE_CREATED',
        entityType: 'STAFF_LEDGER',
        entityId: params.advanceId,
        payload: {
          advanceId: params.advanceId,
          staffId: params.staffId,
          amountMMK: params.amountMMK,
          notes: params.notes || null,
        },
        actorUserId: params.userId,
      });

      return { advanceId: params.advanceId, staffId: params.staffId, amountMMK: params.amountMMK };
    });
  }

  /**
   * STAFF SETTLEMENT: Atomically settles commission/salary and marks ledger settled
   */
  public async executeStaffSettlement(params: {
    settlementId: string;
    businessId: string;
    branchId: string;
    staffId: string;
    settlementCode: string;
    totalEarningsMMK: number;
    totalDeductionsMMK: number;
    netPayoutMMK: number;
    settledLedgerIds?: string[];
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      // 1. Insert Settlement
      this.db.run(`
        INSERT INTO staff_settlements (
          id, business_id, branch_id, staff_id, settlement_code, total_earnings_mmk, total_deductions_mmk, net_payout_mmk, paid_at, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
      `, [
        params.settlementId,
        params.businessId,
        params.branchId,
        params.staffId,
        params.settlementCode,
        params.totalEarningsMMK,
        params.totalDeductionsMMK,
        params.netPayoutMMK,
        now,
        params.userName,
      ]);

      // 2. Mark Staff Ledger as Settled
      if (params.settledLedgerIds && params.settledLedgerIds.length > 0) {
        for (const ldgId of params.settledLedgerIds) {
          this.db.run(`UPDATE staff_ledger SET is_settled = 1, settlement_id = ? WHERE id = ?`, [params.settlementId, ldgId]);
        }
      } else {
        this.db.run(`UPDATE staff_ledger SET is_settled = 1, settlement_id = ? WHERE staff_id = ? AND is_settled = 0`, [params.settlementId, params.staffId]);
      }

      // 3. Cash Out Transaction (if net payout > 0)
      if (params.netPayoutMMK > 0) {
        const cashTxId = `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.db.run(`
          INSERT INTO cash_transactions (id, business_id, branch_id, type, category, amount_mmk, reference_type, reference_id, notes, transaction_time, created_by)
          VALUES (?, ?, ?, 'cash_out', 'staff_salary', ?, 'staff_settlement', ?, ?, ?, ?)
        `, [cashTxId, params.businessId, params.branchId, params.netPayoutMMK, params.settlementId, `Staff settlement payout ${params.settlementCode}`, now, params.userName]);
      }

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'STAFF_SETTLEMENT_CREATED',
        entityType: 'STAFF_SETTLEMENT',
        entityId: params.settlementId,
        payload: {
          settlementId: params.settlementId,
          settlementCode: params.settlementCode,
          staffId: params.staffId,
          netPayoutMMK: params.netPayoutMMK,
        },
        actorUserId: params.userId,
      });

      return { settlementId: params.settlementId, staffId: params.staffId, netPayoutMMK: params.netPayoutMMK };
    });
  }

  /**
   * STOCK ADJUSTMENT: Atomically updates product inventory
   */
  public async executeStockAdjustment(params: {
    productId: string;
    businessId: string;
    branchId: string;
    newStockQty: number;
    reason?: string;
    userId: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      this.db.run(`
        UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ? AND business_id = ?
      `, [params.newStockQty, now, params.productId, params.businessId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'STOCK_UPDATED',
        entityType: 'PRODUCT',
        entityId: params.productId,
        payload: {
          productId: params.productId,
          stockQty: params.newStockQty,
          reason: params.reason || 'Manual Adjustment',
        },
        actorUserId: params.userId,
      });

      return { productId: params.productId, stockQty: params.newStockQty };
    });
  }

  public async resetRoomStatus(businessId: string, roomId: string): Promise<void> {
    return this.transaction(async () => {
      if (!this.db) return;
      const now = new Date().toISOString();
      this.db.run(`
        UPDATE rooms SET status = 'available', active_session_id = NULL, updated_at = ? WHERE id = ? AND business_id = ?
      `, [now, roomId, businessId]);
    });
  }

  /**
   * PAYMENT: Atomically registers bill payment and updates invoice
   */
  public async executePayment(params: {
    invoiceId: string;
    businessId: string;
    branchId: string;
    invoiceNumber: string;
    subtotalMMK: number;
    discountMMK: number;
    totalMMK: number;
    paidMMK: number;
    paymentMethod: string;
    customerId?: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const paymentStatus = params.paidMMK >= params.totalMMK ? 'paid' : (params.paidMMK > 0 ? 'partial' : 'unpaid');

      this.db.run(`
        INSERT OR REPLACE INTO invoices (
          id, business_id, branch_id, invoice_number, customer_id, subtotal_mmk, discount_mmk, total_mmk, paid_mmk, payment_status, payment_method, date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        params.invoiceId,
        params.businessId,
        params.branchId,
        params.invoiceNumber,
        params.customerId || null,
        params.subtotalMMK,
        params.discountMMK,
        params.totalMMK,
        params.paidMMK,
        paymentStatus,
        params.paymentMethod,
        now.split('T')[0],
        now,
      ]);

      // Atomically Record Outbox Real-Time Events
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'PAYMENT_CREATED',
        entityType: 'INVOICE',
        entityId: params.invoiceId,
        payload: {
          invoiceId: params.invoiceId,
          invoiceNumber: params.invoiceNumber,
          totalMMK: params.totalMMK,
          paidMMK: params.paidMMK,
          paymentStatus,
          paymentMethod: params.paymentMethod,
          customerId: params.customerId || null,
        },
      });

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'INVOICE_UPDATED',
        entityType: 'INVOICE',
        entityId: params.invoiceId,
        payload: {
          invoiceId: params.invoiceId,
          invoiceNumber: params.invoiceNumber,
          paymentStatus,
          paidMMK: params.paidMMK,
        },
      });

      return { invoiceId: params.invoiceId, invoiceNumber: params.invoiceNumber, totalMMK: params.totalMMK, paidMMK: params.paidMMK, paymentStatus };
    });
  }

  /**
   * EXPENSE: Atomically records expense
   */
  public async executeExpense(params: {
    expenseId: string;
    businessId: string;
    branchId: string;
    category: string;
    description: string;
    amountMMK: number;
    paymentMethod: string;
    createdBy: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      this.db.run(`
        INSERT INTO expenses (id, business_id, branch_id, category, description, amount_mmk, payment_method, date, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [params.expenseId, params.businessId, params.branchId, params.category, params.description, params.amountMMK, params.paymentMethod, now.split('T')[0], params.createdBy, now]);

      // Atomically Record Outbox Real-Time Event
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'EXPENSE_CREATED',
        entityType: 'EXPENSE',
        entityId: params.expenseId,
        payload: {
          expenseId: params.expenseId,
          category: params.category,
          description: params.description,
          amountMMK: params.amountMMK,
          paymentMethod: params.paymentMethod,
          createdBy: params.createdBy,
        },
        actorUserId: params.createdBy,
      });

      return { expenseId: params.expenseId, amountMMK: params.amountMMK, category: params.category };
    });
  }

  /**
   * CUSTOMER CREDIT & LEDGER: Updates customer balance and adds ledger record
   */
  public async executeCustomerCredit(params: {
    ledgerId: string;
    businessId: string;
    branchId: string;
    customerId: string;
    amountMMK: number; // positive increases debt
    notes?: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const stmt = this.db.prepare(`SELECT * FROM customers WHERE id = ? AND business_id = ?`);
      stmt.bind([params.customerId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Customer ${params.customerId} not found`);
      }
      const customer = stmt.getAsObject();
      stmt.free();

      const newBalance = Number(customer.outstanding_balance_mmk) + params.amountMMK;
      const creditLimit = Number(customer.credit_limit_mmk);

      if (newBalance > creditLimit) {
        const limitErr = new Error(`Customer credit limit exceeded: Projected ${newBalance} MMK > Limit ${creditLimit} MMK`);
        (limitErr as any).code = 'CREDIT_LIMIT_EXCEEDED';
        throw limitErr;
      }

      const now = new Date().toISOString();
      this.db.run(`
        UPDATE customers SET outstanding_balance_mmk = ? WHERE id = ?
      `, [newBalance, params.customerId]);

      this.db.run(`
        INSERT INTO customer_ledger (id, business_id, branch_id, customer_id, type, amount_mmk, balance_after_mmk, notes, date, created_at)
        VALUES (?, ?, ?, ?, 'credit_sale', ?, ?, ?, ?, ?)
      `, [params.ledgerId, params.businessId, params.branchId, params.customerId, params.amountMMK, newBalance, params.notes || null, now.split('T')[0], now]);

      // Atomically Record Outbox Real-Time Events
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'CUSTOMER_CREDIT_CREATED',
        entityType: 'CUSTOMER_LEDGER',
        entityId: params.ledgerId,
        payload: {
          ledgerId: params.ledgerId,
          customerId: params.customerId,
          amountMMK: params.amountMMK,
          newBalance,
          notes: params.notes || null,
        },
      });

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'CUSTOMER_BALANCE_UPDATED',
        entityType: 'CUSTOMER',
        entityId: params.customerId,
        payload: {
          customerId: params.customerId,
          outstandingBalanceMMK: newBalance,
        },
      });

      return { customerId: params.customerId, previousBalance: customer.outstanding_balance_mmk, newBalance, amountMMK: params.amountMMK };
    });
  }

  /**
   * CASH CLOSING: Enforces single authoritative closing per date & branch
   */
  public async executeCashClosing(params: {
    closingId: string;
    businessId: string;
    branchId: string;
    date: string;
    openingCashMMK: number;
    cashSalesMMK: number;
    debtRepaymentsMMK: number;
    cashExpensesMMK: number;
    actualCashMMK: number;
    closedBy: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const expectedCash = params.openingCashMMK + params.cashSalesMMK + params.debtRepaymentsMMK - params.cashExpensesMMK;
      const discrepancy = params.actualCashMMK - expectedCash;
      const status = discrepancy === 0 ? 'balanced' : (discrepancy < 0 ? 'shortage' : 'overage');
      const now = new Date().toISOString();

      try {
        this.db.run(`
          INSERT INTO cash_closings (
            id, business_id, branch_id, date, opening_cash_mmk, cash_sales_mmk, debt_repayments_mmk, cash_expenses_mmk, expected_cash_mmk, actual_cash_mmk, discrepancy_mmk, status, closed_by, closed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          params.closingId,
          params.businessId,
          params.branchId,
          params.date,
          params.openingCashMMK,
          params.cashSalesMMK,
          params.debtRepaymentsMMK,
          params.cashExpensesMMK,
          expectedCash,
          params.actualCashMMK,
          discrepancy,
          status,
          params.closedBy,
          now,
        ]);
      } catch (err: any) {
        if (err.message && err.message.includes('UNIQUE')) {
          const dupErr = new Error(`Cash closing already recorded for business date ${params.date}`);
          (dupErr as any).code = 'DATE_ALREADY_CLOSED';
          throw dupErr;
        }
        throw err;
      }

      // Atomically Record Outbox Real-Time Event
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'CASH_CLOSING_CREATED',
        entityType: 'CASH_CLOSING',
        entityId: params.closingId,
        payload: {
          closingId: params.closingId,
          date: params.date,
          expectedCashMMK: expectedCash,
          actualCashMMK: params.actualCashMMK,
          discrepancyMMK: discrepancy,
          status,
          closedBy: params.closedBy,
        },
        actorUserId: params.closedBy,
      });

      return { closingId: params.closingId, date: params.date, expectedCashMMK: expectedCash, actualCashMMK: params.actualCashMMK, discrepancyMMK: discrepancy, status };
    });
  }

  // ==========================================
  // AUDIT & BACKUP / RESTORE
  // ==========================================
  public logAudit(audit: Omit<ServerAuditRecord, 'auditId' | 'timestamp'>): ServerAuditRecord {
    if (!this.db) throw new Error('DB uninitialized');
    const auditId = 'srv_aud_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
    const now = new Date().toISOString();

    this.db.run(`
      INSERT INTO audit_logs (
        audit_id, business_id, branch_id, user_id, user_name, device_id, action, entity_type, entity_id, timestamp, reason, old_value, new_value, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      auditId,
      audit.businessId,
      audit.branchId,
      audit.userId,
      audit.userName,
      audit.deviceId,
      audit.action,
      audit.entityType,
      audit.entityId,
      now,
      audit.reason || null,
      audit.oldValue || null,
      audit.newValue || null,
      audit.metadata ? JSON.stringify(audit.metadata) : null,
    ]);

    this.flushToDisk();
    return { ...audit, auditId, timestamp: now };
  }

  public getAuditLogs(businessId: string, branchId?: string): ServerAuditRecord[] {
    if (!this.db) return [];
    const logs: ServerAuditRecord[] = [];
    const query = branchId 
      ? `SELECT * FROM audit_logs WHERE business_id = ? AND branch_id = ? ORDER BY timestamp DESC`
      : `SELECT * FROM audit_logs WHERE business_id = ? ORDER BY timestamp DESC`;
    const stmt = this.db.prepare(query);
    stmt.bind(branchId ? [businessId, branchId] : [businessId]);

    while (stmt.step()) {
      const row = stmt.getAsObject();
      logs.push({
        auditId: row.audit_id as string,
        businessId: row.business_id as string,
        branchId: row.branch_id as string,
        userId: row.user_id as string,
        userName: row.user_name as string,
        deviceId: row.device_id as string,
        action: row.action as string,
        entityType: row.entity_type as string,
        entityId: row.entity_id as string,
        timestamp: row.timestamp as string,
        reason: (row.reason as string) || undefined,
        oldValue: (row.old_value as string) || undefined,
        newValue: (row.new_value as string) || undefined,
        metadata: row.metadata_json ? JSON.parse(row.metadata_json as string) : undefined,
      });
    }
    stmt.free();
    return logs;
  }

  public exportBackup(backupFilePath: string): void {
    if (!this.db) throw new Error('DB uninitialized');
    const data = this.db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(backupFilePath, buffer);
  }

  public createDefaultBackup(): { fileName: string; filePath: string; sizeBytes: number; createdAt: string } {
    const timestamp = Date.now();
    const fileName = `backup_${timestamp}.sqlite`;
    const filePath = path.join(runtimeConfig.backupDir, fileName);
    this.exportBackup(filePath);
    const stats = fs.statSync(filePath);
    return {
      fileName,
      filePath,
      sizeBytes: stats.size,
      createdAt: new Date(timestamp).toISOString(),
    };
  }

  public listBackups(customDir?: string): { fileName: string; filePath: string; sizeBytes: number; createdAt: string }[] {
    const targetDir = customDir || runtimeConfig.backupDir;
    if (!fs.existsSync(targetDir)) return [];
    const files = fs.readdirSync(targetDir);
    const backups: { fileName: string; filePath: string; sizeBytes: number; createdAt: string }[] = [];

    for (const file of files) {
      if (file.endsWith('.sqlite') || file.endsWith('.db')) {
        const fullPath = path.join(targetDir, file);
        try {
          const stat = fs.statSync(fullPath);
          backups.push({
            fileName: file,
            filePath: fullPath,
            sizeBytes: stat.size,
            createdAt: stat.mtime.toISOString(),
          });
        } catch {}
      }
    }

    return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public restoreBackup(backupFilePath: string): void {
    if (!SQL) throw new Error('SQL engine uninitialized');
    if (!fs.existsSync(backupFilePath)) throw new Error('Backup file does not exist: ' + backupFilePath);
    const fileBuffer = fs.readFileSync(backupFilePath);
    this.db = new SQL.Database(fileBuffer);
    this.flushToDisk();
  }

  /**
   * Check Booking Conflict for Room or Staff overlap
   */
  public checkBookingConflict(params: {
    businessId: string;
    branchId: string;
    date: string;
    startTime: string;
    endTime: string;
    roomId?: string;
    staffId?: string;
    excludeBookingId?: string;
  }): { hasConflict: boolean; reason?: string; conflictingBooking?: any } {
    if (!this.db) return { hasConflict: false };

    let query = `
      SELECT * FROM bookings 
      WHERE business_id = ? AND branch_id = ? AND date = ? 
      AND status IN ('CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'PENDING')
    `;
    const bindArgs: any[] = [params.businessId, params.branchId, params.date];

    if (params.excludeBookingId) {
      query += ` AND id != ?`;
      bindArgs.push(params.excludeBookingId);
    }

    const stmt = this.db.prepare(query);
    stmt.bind(bindArgs);

    while (stmt.step()) {
      const b = stmt.getAsObject();
      const existingStart = String(b.start_time);
      const existingEnd = String(b.end_time);

      const isOverlap = existingStart < params.endTime && existingEnd > params.startTime;

      if (isOverlap) {
        if (params.roomId && b.room_id === params.roomId) {
          stmt.free();
          return {
            hasConflict: true,
            reason: `Room ${b.room_name || params.roomId} is already booked from ${existingStart} to ${existingEnd}`,
            conflictingBooking: b,
          };
        }
        if (params.staffId && b.staff_id === params.staffId) {
          stmt.free();
          return {
            hasConflict: true,
            reason: `Staff ${b.staff_name || params.staffId} is already scheduled from ${existingStart} to ${existingEnd}`,
            conflictingBooking: b,
          };
        }
      }
    }
    stmt.free();

    // Check active running sessions in sessions table
    if (params.roomId || params.staffId) {
      try {
        const sessStmt = this.db.prepare(`
          SELECT id, room_id, room_name, customer_name, start_time, duration_minutes, status
          FROM sessions
          WHERE business_id = ? AND branch_id = ? AND status IN ('active', 'in_service')
        `);
        sessStmt.bind([params.businessId, params.branchId]);
        while (sessStmt.step()) {
          const s = sessStmt.getAsObject();
          let sStart = '00:00';
          const stStr = String(s.start_time || '');
          if (stStr.includes('T')) {
            sStart = stStr.split('T')[1].slice(0, 5);
          } else if (stStr.includes(':')) {
            sStart = stStr.slice(0, 5);
          }
          
          const [sh, sm] = sStart.split(':').map(Number);
          const sDuration = Number(s.duration_minutes) || 60;
          const totalMinutes = (isNaN(sh) ? 0 : sh) * 60 + (isNaN(sm) ? 0 : sm) + sDuration;
          const sEnd = `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;

          const isOverlap = sStart < params.endTime && sEnd > params.startTime;
          if (isOverlap && params.roomId && String(s.room_id) === params.roomId) {
            sessStmt.free();
            return {
              hasConflict: true,
              reason: `အခန်း (${s.room_name || params.roomId}) သည် လက်ရှိတွင် ဝန်ဆောင်မှုပေးနေဆဲဖြစ်ပါသည် (${sStart}-${sEnd}) (Active session running in room)`,
            };
          }
        }
        sessStmt.free();
      } catch {}
    }

    return { hasConflict: false };
  }

  /**
   * BOOKING CREATE: Atomically checks resource conflicts and creates booking
   */
  public async executeBookingCreate(params: {
    bookingId: string;
    businessId: string;
    branchId: string;
    bookingCode?: string;
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
    price?: number;
    discount?: number;
    finalAmount?: number;
    status?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');

      // Idempotency: return existing booking if this booking ID is already present
      const existStmt = this.db.prepare(`SELECT * FROM bookings WHERE id = ?`);
      existStmt.bind([params.bookingId]);
      if (existStmt.step()) {
        const existingRecord = existStmt.getAsObject();
        existStmt.free();
        return existingRecord;
      }
      existStmt.free();

      // 1. Conflict Check
      const conflict = this.checkBookingConflict({
        businessId: params.businessId,
        branchId: params.branchId,
        date: params.date,
        startTime: params.startTime,
        endTime: params.endTime,
        roomId: params.roomId,
        staffId: params.staffId,
      });

      if (conflict.hasConflict) {
        const err: any = new Error(conflict.reason || 'Resource schedule conflict');
        err.code = 'RESOURCE_CONFLICT';
        throw err;
      }

      const now = new Date().toISOString();
      const bookingCode = params.bookingCode || `BKG-${Date.now().toString().slice(-6)}`;
      const status = params.status || 'CONFIRMED';
      const price = params.price || 0;
      const discount = params.discount || 0;
      const finalAmount = params.finalAmount !== undefined ? params.finalAmount : Math.max(0, price - discount);

      // 2. Insert Booking
      this.db.run(`
        INSERT INTO bookings (
          id, business_id, branch_id, booking_code, customer_id, customer_name, customer_phone,
          service_id, service_name, room_id, room_name, staff_id, staff_name, date, start_time,
          end_time, duration_minutes, price, discount, final_amount, status, notes, deposit_amount_mmk, deposit_payment_method,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        params.bookingId,
        params.businessId,
        params.branchId,
        bookingCode,
        params.customerId || null,
        params.customerName,
        params.customerPhone || null,
        params.serviceId || null,
        params.serviceName || null,
        params.roomId || null,
        params.roomName || null,
        params.staffId || null,
        params.staffName || null,
        params.date,
        params.startTime,
        params.endTime,
        params.durationMinutes,
        price,
        discount,
        finalAmount,
        status,
        params.notes || null,
        params.depositAmountMMK || 0,
        params.depositPaymentMethod || null,
        params.userName,
        now,
        now,
      ]);

      const createdRecord = {
        id: params.bookingId,
        businessId: params.businessId,
        branchId: params.branchId,
        bookingCode,
        customerId: params.customerId || null,
        customerName: params.customerName,
        customerPhone: params.customerPhone || null,
        serviceId: params.serviceId || null,
        serviceName: params.serviceName || null,
        roomId: params.roomId || null,
        roomName: params.roomName || null,
        staffId: params.staffId || null,
        staffName: params.staffName || null,
        date: params.date,
        startTime: params.startTime,
        endTime: params.endTime,
        durationMinutes: params.durationMinutes,
        price,
        discount,
        finalAmount,
        status,
        notes: params.notes || null,
        depositAmountMMK: params.depositAmountMMK || 0,
        depositPaymentMethod: params.depositPaymentMethod || null,
        createdBy: params.userName,
        createdAt: now,
        updatedAt: now,
      };

      // 3. Atomically Record Real-Time Outbox Event
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'BOOKING_CREATED',
        entityType: 'BOOKING',
        entityId: params.bookingId,
        payload: { booking: createdRecord },
        actorUserId: params.userId,
      });

      return createdRecord;
    });
  }

  /**
   * BOOKING UPDATE: Atomically updates booking with conflict checking
   */
  public async executeBookingUpdate(params: {
    bookingId: string;
    businessId: string;
    branchId: string;
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
    status?: string;
    price?: number;
    discount?: number;
    finalAmount?: number;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');

      // Check current booking status for state transition validation
      const curStmt = this.db.prepare(`SELECT status FROM bookings WHERE id = ? AND business_id = ?`);
      curStmt.bind([params.bookingId, params.businessId]);
      if (curStmt.step()) {
        const curObj = curStmt.getAsObject();
        const currentStatus = String(curObj.status);
        if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(currentStatus)) {
          curStmt.free();
          const err: any = new Error(`Cannot update booking with terminal status ${currentStatus}`);
          err.code = 'INVALID_STATE_TRANSITION';
          throw err;
        }
        if (params.status && params.status !== currentStatus) {
          if (currentStatus === 'IN_SERVICE' && params.status === 'PENDING') {
            curStmt.free();
            const err: any = new Error(`Cannot transition from IN_SERVICE to PENDING`);
            err.code = 'INVALID_STATE_TRANSITION';
            throw err;
          }
        }
      }
      curStmt.free();

      // 1. Conflict Check excluding this booking
      const conflict = this.checkBookingConflict({
        businessId: params.businessId,
        branchId: params.branchId,
        date: params.date,
        startTime: params.startTime,
        endTime: params.endTime,
        roomId: params.roomId,
        staffId: params.staffId,
        excludeBookingId: params.bookingId,
      });

      if (conflict.hasConflict) {
        const err: any = new Error(conflict.reason || 'Resource schedule conflict');
        err.code = 'RESOURCE_CONFLICT';
        throw err;
      }

      const now = new Date().toISOString();

      this.db.run(`
        UPDATE bookings SET
          customer_name = COALESCE(?, customer_name),
          customer_phone = COALESCE(?, customer_phone),
          service_id = COALESCE(?, service_id),
          service_name = COALESCE(?, service_name),
          room_id = COALESCE(?, room_id),
          room_name = COALESCE(?, room_name),
          staff_id = COALESCE(?, staff_id),
          staff_name = COALESCE(?, staff_name),
          date = ?,
          start_time = ?,
          end_time = ?,
          duration_minutes = ?,
          price = COALESCE(?, price),
          discount = COALESCE(?, discount),
          final_amount = COALESCE(?, final_amount),
          status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          updated_at = ?
        WHERE id = ? AND business_id = ?
      `, [
        params.customerName || null,
        params.customerPhone || null,
        params.serviceId || null,
        params.serviceName || null,
        params.roomId || null,
        params.roomName || null,
        params.staffId || null,
        params.staffName || null,
        params.date,
        params.startTime,
        params.endTime,
        params.durationMinutes,
        params.price !== undefined ? params.price : null,
        params.discount !== undefined ? params.discount : null,
        params.finalAmount !== undefined ? params.finalAmount : null,
        params.status || null,
        params.notes || null,
        now,
        params.bookingId,
        params.businessId,
      ]);

      const stmt = this.db.prepare(`SELECT * FROM bookings WHERE id = ?`);
      stmt.bind([params.bookingId]);
      stmt.step();
      const updated = stmt.getAsObject();
      stmt.free();

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'BOOKING_UPDATED',
        entityType: 'BOOKING',
        entityId: params.bookingId,
        payload: { booking: updated },
        actorUserId: params.userId,
      });

      return updated;
    });
  }

  /**
   * BOOKING CANCEL: Atomically cancels booking and preserves history
   */
  public async executeBookingCancel(params: {
    bookingId: string;
    businessId: string;
    branchId: string;
    cancellationReason?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`SELECT * FROM bookings WHERE id = ? AND business_id = ?`);
      stmt.bind([params.bookingId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Booking ${params.bookingId} not found`);
      }
      const booking = stmt.getAsObject();
      stmt.free();

      // Idempotency: If already cancelled, return successfully
      if (String(booking.status) === 'CANCELLED') {
        return { bookingId: params.bookingId, status: 'CANCELLED', cancelledAt: String(booking.cancelled_at || now), alreadyCancelled: true };
      }

      if (['COMPLETED', 'IN_SERVICE'].includes(String(booking.status))) {
        const err: any = new Error(`Cannot cancel booking with status ${booking.status}`);
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
      }

      this.db.run(`
        UPDATE bookings SET
          status = 'CANCELLED',
          cancellation_reason = ?,
          cancelled_by = ?,
          cancelled_at = ?,
          updated_at = ?
        WHERE id = ? AND business_id = ?
      `, [params.cancellationReason || 'Customer requested cancellation', params.userName, now, now, params.bookingId, params.businessId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'BOOKING_CANCELLED',
        entityType: 'BOOKING',
        entityId: params.bookingId,
        payload: {
          bookingId: params.bookingId,
          status: 'CANCELLED',
          cancellationReason: params.cancellationReason,
          cancelledBy: params.userName,
          cancelledAt: now,
        },
        actorUserId: params.userId,
      });

      return { bookingId: params.bookingId, status: 'CANCELLED', cancelledAt: now };
    });
  }

  /**
   * BOOKING CHECK-IN: Atomically checks in customer and optionally starts service session
   */
  public async executeBookingCheckIn(params: {
    bookingId: string;
    businessId: string;
    branchId: string;
    startSession?: boolean;
    sessionId?: string;
    hourlyRateMMK?: number;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`SELECT * FROM bookings WHERE id = ? AND business_id = ?`);
      stmt.bind([params.bookingId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Booking ${params.bookingId} not found`);
      }
      const booking = stmt.getAsObject();
      stmt.free();

      // Disallow terminal states
      if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(String(booking.status))) {
        const err: any = new Error(`Cannot check in booking with status ${booking.status}`);
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
      }

      let createdSessionId: string | null = null;
      let newStatus = 'CHECKED_IN';

      // 1. Check if active session already exists for this booking via booking.session_id
      if (booking.session_id) {
        try {
          const chkStmt = this.db.prepare(`SELECT id, status FROM sessions WHERE id = ?`);
          chkStmt.bind([booking.session_id]);
          if (chkStmt.step()) {
            const chkObj = chkStmt.getAsObject();
            if (['active', 'started', 'extended', 'in_service'].includes(String(chkObj.status))) {
              createdSessionId = String(chkObj.id);
              newStatus = 'IN_SERVICE';
            }
          }
          chkStmt.free();
        } catch {}
      }

      // 2. Also check if active session already exists via sessions.booking_id
      if (!createdSessionId) {
        try {
          const bkgSessStmt = this.db.prepare(`SELECT id, status FROM sessions WHERE booking_id = ? AND status IN ('active', 'started', 'extended', 'in_service')`);
          bkgSessStmt.bind([params.bookingId]);
          if (bkgSessStmt.step()) {
            const bkgSessObj = bkgSessStmt.getAsObject();
            createdSessionId = String(bkgSessObj.id);
            newStatus = 'IN_SERVICE';
          }
          bkgSessStmt.free();
        } catch {}
      }

      // 3. Auto start session ONLY if requested, room is assigned, and NO active session already exists
      if (params.startSession && booking.room_id && !createdSessionId) {
        // Guard: check if room is currently occupied by another active session
        try {
          const occStmt = this.db.prepare(`SELECT id, customer_name FROM sessions WHERE room_id = ? AND status IN ('active', 'started', 'extended') AND (booking_id IS NULL OR booking_id != ?)`);
          occStmt.bind([booking.room_id, params.bookingId]);
          if (occStmt.step()) {
            const occ = occStmt.getAsObject();
            occStmt.free();
            const err: any = new Error(`Room is currently occupied by active session (${occ.customer_name || occ.id})`);
            err.code = 'ROOM_OCCUPIED_CONFLICT';
            throw err;
          }
          occStmt.free();
        } catch (e: any) {
          if (e.code === 'ROOM_OCCUPIED_CONFLICT') throw e;
        }

        createdSessionId = params.sessionId || `sess_${Date.now()}`;
        
        // Start Session with booking_id link
        this.db.run(`
          INSERT INTO sessions (id, business_id, branch_id, room_id, room_name, customer_name, start_time, duration_minutes, total_fee_mmk, status, booking_id, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?, ?)
        `, [
          createdSessionId,
          params.businessId,
          params.branchId,
          booking.room_id,
          booking.room_name || 'Room',
          booking.customer_name,
          now,
          booking.duration_minutes || 60,
          params.bookingId,
          params.userName,
          now,
        ]);

        // Lock room
        this.db.run(`
          UPDATE rooms SET status = 'occupied', active_session_id = ?, updated_at = ? WHERE id = ?
        `, [createdSessionId, now, booking.room_id]);

        newStatus = 'IN_SERVICE';

        this.recordOutboxEvent({
          businessId: params.businessId,
          branchId: params.branchId,
          eventType: 'SESSION_STARTED',
          entityType: 'SESSION',
          entityId: createdSessionId,
          payload: {
            sessionId: createdSessionId,
            roomId: booking.room_id,
            roomName: booking.room_name,
            customerName: booking.customer_name,
            status: 'active',
            startTime: now,
            bookingId: params.bookingId,
          },
          actorUserId: params.userId,
        });

        this.recordOutboxEvent({
          businessId: params.businessId,
          branchId: params.branchId,
          eventType: 'ROOM_STATUS_CHANGED',
          entityType: 'ROOM',
          entityId: String(booking.room_id),
          payload: {
            roomId: booking.room_id,
            roomName: booking.room_name,
            status: 'occupied',
            activeSessionId: createdSessionId,
          },
          actorUserId: params.userId,
        });
      }

      this.db.run(`
        UPDATE bookings SET
          status = ?,
          session_id = COALESCE(?, session_id),
          checked_in_at = COALESCE(checked_in_at, ?),
          checked_in_by = COALESCE(checked_in_by, ?),
          updated_at = ?
        WHERE id = ? AND business_id = ?
      `, [newStatus, createdSessionId, now, params.userName, now, params.bookingId, params.businessId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'BOOKING_CHECKED_IN',
        entityType: 'BOOKING',
        entityId: params.bookingId,
        payload: {
          bookingId: params.bookingId,
          status: newStatus,
          sessionId: createdSessionId,
          checkedInAt: now,
          checkedInBy: params.userName,
        },
        actorUserId: params.userId,
      });

      return {
        bookingId: params.bookingId,
        status: newStatus,
        sessionId: createdSessionId,
        checkedInAt: now,
      };
    });
  }

  /**
   * BOOKING CONFIRM: Atomically confirms pending booking
   */
  public async executeBookingConfirm(params: {
    bookingId: string;
    businessId: string;
    branchId: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`SELECT * FROM bookings WHERE id = ? AND business_id = ?`);
      stmt.bind([params.bookingId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Booking ${params.bookingId} not found`);
      }
      const booking = stmt.getAsObject();
      stmt.free();

      // Idempotency: If already confirmed, return current state
      if (String(booking.status) === 'CONFIRMED') {
        return { bookingId: params.bookingId, status: 'CONFIRMED', updatedAt: String(booking.updated_at || now), alreadyConfirmed: true };
      }

      if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(String(booking.status))) {
        const err: any = new Error(`Cannot confirm booking with status ${booking.status}`);
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
      }

      this.db.run(`
        UPDATE bookings SET status = 'CONFIRMED', updated_at = ? WHERE id = ? AND business_id = ?
      `, [now, params.bookingId, params.businessId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'BOOKING_CONFIRMED',
        entityType: 'BOOKING',
        entityId: params.bookingId,
        payload: { bookingId: params.bookingId, status: 'CONFIRMED', updatedAt: now },
        actorUserId: params.userId,
      });

      return { bookingId: params.bookingId, status: 'CONFIRMED', updatedAt: now };
    });
  }

  /**
   * BOOKING NO-SHOW: Marks customer as no-show and releases resources
   */
  public async executeBookingNoShow(params: {
    bookingId: string;
    businessId: string;
    branchId: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`SELECT * FROM bookings WHERE id = ? AND business_id = ?`);
      stmt.bind([params.bookingId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Booking ${params.bookingId} not found`);
      }
      const booking = stmt.getAsObject();
      stmt.free();

      // Idempotency: If already marked no-show, return current state
      if (String(booking.status) === 'NO_SHOW') {
        return { bookingId: params.bookingId, status: 'NO_SHOW', updatedAt: String(booking.updated_at || now), alreadyNoShow: true };
      }

      if (['COMPLETED', 'CANCELLED', 'IN_SERVICE'].includes(String(booking.status))) {
        const err: any = new Error(`Cannot mark booking with status ${booking.status} as NO_SHOW`);
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
      }

      this.db.run(`
        UPDATE bookings SET status = 'NO_SHOW', updated_at = ? WHERE id = ? AND business_id = ?
      `, [now, params.bookingId, params.businessId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'BOOKING_NO_SHOW',
        entityType: 'BOOKING',
        entityId: params.bookingId,
        payload: { bookingId: params.bookingId, status: 'NO_SHOW', updatedAt: now },
        actorUserId: params.userId,
      });

      return { bookingId: params.bookingId, status: 'NO_SHOW', updatedAt: now };
    });
  }

  /**
   * BOOKING COMPLETE: Atomically marks service as completed
   */
  public async executeBookingComplete(params: {
    bookingId: string;
    businessId: string;
    branchId: string;
    sessionId?: string;
    invoiceId?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`SELECT * FROM bookings WHERE id = ? AND business_id = ?`);
      stmt.bind([params.bookingId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Booking ${params.bookingId} not found`);
      }
      const booking = stmt.getAsObject();
      stmt.free();

      // Idempotency: If already completed, return current state
      if (String(booking.status) === 'COMPLETED') {
        return { bookingId: params.bookingId, status: 'COMPLETED', completedAt: String(booking.completed_at || now), alreadyCompleted: true };
      }

      if (['CANCELLED', 'NO_SHOW'].includes(String(booking.status))) {
        const err: any = new Error(`Cannot complete booking with status ${booking.status}`);
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
      }

      this.db.run(`
        UPDATE bookings SET
          status = 'COMPLETED',
          session_id = COALESCE(?, session_id),
          invoice_id = COALESCE(?, invoice_id),
          completed_at = ?,
          updated_at = ?
        WHERE id = ? AND business_id = ?
      `, [params.sessionId || null, params.invoiceId || null, now, now, params.bookingId, params.businessId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'BOOKING_COMPLETED',
        entityType: 'BOOKING',
        entityId: params.bookingId,
        payload: {
          bookingId: params.bookingId,
          status: 'COMPLETED',
          sessionId: params.sessionId || booking.session_id,
          invoiceId: params.invoiceId || booking.invoice_id,
          completedAt: now,
        },
        actorUserId: params.userId,
      });

      return { bookingId: params.bookingId, status: 'COMPLETED', completedAt: now };
    });
  }

  public getBookings(businessId: string, branchId: string, date?: string): any[] {
    if (!this.db) return [];
    let query = `SELECT * FROM bookings WHERE business_id = ? AND branch_id = ?`;
    const bindArgs: any[] = [businessId, branchId];
    if (date) {
      query += ` AND date = ?`;
      bindArgs.push(date);
    }
    query += ` ORDER BY date ASC, start_time ASC`;

    const stmt = this.db.prepare(query);
    stmt.bind(bindArgs);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  // ==========================================
  // PHASE 27: MEMBERSHIPS, PACKAGES, GIFT CARDS, TIPS & MIXED PAYMENT
  // ==========================================

  public async executeMembershipPlanCreate(params: {
    planId: string;
    businessId: string;
    branchId: string;
    name: string;
    nameMm?: string;
    durationDays: number;
    priceMMK: number;
    discountPercent: number;
    benefitsSummary?: string;
    isActive?: boolean;
    userId: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const isActiveNum = params.isActive === false ? 0 : 1;

      this.db.run(`
        INSERT INTO membership_plans (
          id, business_id, branch_id, name, name_mm, duration_days, price_mmk, discount_percent, benefits_summary, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        params.planId,
        params.businessId,
        params.branchId,
        params.name,
        params.nameMm || null,
        params.durationDays,
        params.priceMMK,
        params.discountPercent || 0,
        params.benefitsSummary || null,
        isActiveNum,
        now,
        now,
      ]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'MEMBERSHIP_PLAN_CREATED',
        entityType: 'MEMBERSHIP_PLAN',
        entityId: params.planId,
        payload: { ...params, isActive: Boolean(isActiveNum) },
        actorUserId: params.userId,
      });

      return { planId: params.planId, name: params.name, durationDays: params.durationDays, priceMMK: params.priceMMK, discountPercent: params.discountPercent };
    });
  }

  public async executeMembershipPlanUpdate(params: {
    planId: string;
    businessId: string;
    branchId: string;
    name?: string;
    nameMm?: string;
    durationDays?: number;
    priceMMK?: number;
    discountPercent?: number;
    benefitsSummary?: string;
    isActive?: boolean;
    userId: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`SELECT * FROM membership_plans WHERE id = ? AND business_id = ?`);
      stmt.bind([params.planId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Membership plan ${params.planId} not found`);
      }
      const existing = stmt.getAsObject();
      stmt.free();

      const name = params.name ?? existing.name;
      const nameMm = params.nameMm ?? existing.name_mm;
      const durationDays = params.durationDays ?? existing.duration_days;
      const priceMMK = params.priceMMK ?? existing.price_mmk;
      const discountPercent = params.discountPercent ?? existing.discount_percent;
      const benefitsSummary = params.benefitsSummary ?? existing.benefits_summary;
      const isActiveNum = params.isActive !== undefined ? (params.isActive ? 1 : 0) : existing.is_active;

      this.db.run(`
        UPDATE membership_plans SET
          name = ?, name_mm = ?, duration_days = ?, price_mmk = ?, discount_percent = ?, benefits_summary = ?, is_active = ?, updated_at = ?
        WHERE id = ? AND business_id = ?
      `, [name, nameMm, durationDays, priceMMK, discountPercent, benefitsSummary, isActiveNum, now, params.planId, params.businessId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'MEMBERSHIP_PLAN_UPDATED',
        entityType: 'MEMBERSHIP_PLAN',
        entityId: params.planId,
        payload: { planId: params.planId, name, durationDays, priceMMK, discountPercent, isActive: Boolean(isActiveNum) },
        actorUserId: params.userId,
      });

      return { planId: params.planId, name, durationDays, priceMMK, discountPercent, isActive: Boolean(isActiveNum) };
    });
  }

  public async executeMembershipPurchase(params: {
    membershipId: string;
    businessId: string;
    branchId: string;
    customerId: string;
    customerName: string;
    customerPhone?: string;
    planId: string;
    paymentMethod: string;
    startDate?: string;
    invoiceId?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const todayStr = now.split('T')[0];
      const startDate = params.startDate || todayStr;

      // 1. Look up plan
      const pStmt = this.db.prepare(`SELECT * FROM membership_plans WHERE id = ? AND business_id = ?`);
      pStmt.bind([params.planId, params.businessId]);
      if (!pStmt.step()) {
        pStmt.free();
        throw new Error(`Membership plan ${params.planId} not found`);
      }
      const plan = pStmt.getAsObject();
      pStmt.free();

      if (Number(plan.is_active) === 0) {
        throw new Error(`Membership plan ${plan.name} is inactive`);
      }

      const durationDays = Number(plan.duration_days || 30);
      const startDateTime = new Date(startDate);
      const expiryDateObj = new Date(startDateTime.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const expiryDate = expiryDateObj.toISOString().split('T')[0];

      const priceMMK = Number(plan.price_mmk || 0);
      const discountPercent = Number(plan.discount_percent || 0);

      // 2. Insert customer_memberships
      this.db.run(`
        INSERT INTO customer_memberships (
          id, business_id, branch_id, customer_id, customer_name, customer_phone,
          plan_id, plan_name, start_date, expiry_date, discount_percent, paid_amount_mmk,
          payment_method, status, invoice_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `, [
        params.membershipId,
        params.businessId,
        params.branchId,
        params.customerId,
        params.customerName,
        params.customerPhone || null,
        params.planId,
        plan.name,
        startDate,
        expiryDate,
        discountPercent,
        priceMMK,
        params.paymentMethod,
        params.invoiceId || null,
        now,
        now,
      ]);

      // 3. Cash Transaction if cash
      if (params.paymentMethod === 'cash' && priceMMK > 0) {
        const cashTxId = `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.db.run(`
          INSERT INTO cash_transactions (
            id, business_id, branch_id, type, category, amount_mmk, reference_type, reference_id, notes, transaction_time, created_by
          ) VALUES (?, ?, ?, 'cash_in', 'membership_sale_cash', ?, 'membership', ?, ?, ?, ?)
        `, [
          cashTxId,
          params.businessId,
          params.branchId,
          priceMMK,
          params.membershipId,
          `Membership: ${plan.name} for ${params.customerName}`,
          now,
          params.userName,
        ]);
      }

      // 4. Outbox Event
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'MEMBERSHIP_PURCHASED',
        entityType: 'CUSTOMER_MEMBERSHIP',
        entityId: params.membershipId,
        payload: {
          membershipId: params.membershipId,
          customerId: params.customerId,
          customerName: params.customerName,
          planId: params.planId,
          planName: plan.name,
          startDate,
          expiryDate,
          discountPercent,
          priceMMK,
          paymentMethod: params.paymentMethod,
          status: 'active',
        },
        actorUserId: params.userId,
      });

      return {
        membershipId: params.membershipId,
        customerId: params.customerId,
        planName: plan.name,
        startDate,
        expiryDate,
        discountPercent,
        paidAmountMMK: priceMMK,
        status: 'active',
      };
    });
  }

  public async executeServicePackageCreate(params: {
    packageId: string;
    businessId: string;
    branchId: string;
    name: string;
    nameMm?: string;
    serviceId: string;
    serviceName: string;
    totalQty: number;
    priceMMK: number;
    validityDays: number;
    isActive?: boolean;
    userId: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const isActiveNum = params.isActive === false ? 0 : 1;

      this.db.run(`
        INSERT INTO service_packages (
          id, business_id, branch_id, name, name_mm, service_id, service_name, total_qty, price_mmk, validity_days, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        params.packageId,
        params.businessId,
        params.branchId,
        params.name,
        params.nameMm || null,
        params.serviceId,
        params.serviceName,
        params.totalQty,
        params.priceMMK,
        params.validityDays,
        isActiveNum,
        now,
        now,
      ]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'SERVICE_PACKAGE_CREATED',
        entityType: 'SERVICE_PACKAGE',
        entityId: params.packageId,
        payload: { ...params, isActive: Boolean(isActiveNum) },
        actorUserId: params.userId,
      });

      return { packageId: params.packageId, name: params.name, totalQty: params.totalQty, priceMMK: params.priceMMK };
    });
  }

  public async executeServicePackageUpdate(params: {
    packageId: string;
    businessId: string;
    branchId: string;
    name?: string;
    nameMm?: string;
    totalQty?: number;
    priceMMK?: number;
    validityDays?: number;
    isActive?: boolean;
    userId: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`SELECT * FROM service_packages WHERE id = ? AND business_id = ?`);
      stmt.bind([params.packageId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Package ${params.packageId} not found`);
      }
      const existing = stmt.getAsObject();
      stmt.free();

      const name = params.name ?? existing.name;
      const nameMm = params.nameMm ?? existing.name_mm;
      const totalQty = params.totalQty ?? existing.total_qty;
      const priceMMK = params.priceMMK ?? existing.price_mmk;
      const validityDays = params.validityDays ?? existing.validity_days;
      const isActiveNum = params.isActive !== undefined ? (params.isActive ? 1 : 0) : existing.is_active;

      this.db.run(`
        UPDATE service_packages SET
          name = ?, name_mm = ?, total_qty = ?, price_mmk = ?, validity_days = ?, is_active = ?, updated_at = ?
        WHERE id = ? AND business_id = ?
      `, [name, nameMm, totalQty, priceMMK, validityDays, isActiveNum, now, params.packageId, params.businessId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'SERVICE_PACKAGE_UPDATED',
        entityType: 'SERVICE_PACKAGE',
        entityId: params.packageId,
        payload: { packageId: params.packageId, name, totalQty, priceMMK, validityDays, isActive: Boolean(isActiveNum) },
        actorUserId: params.userId,
      });

      return { packageId: params.packageId, name, totalQty, priceMMK, isActive: Boolean(isActiveNum) };
    });
  }

  public async executePackagePurchase(params: {
    customerPackageId: string;
    businessId: string;
    branchId: string;
    customerId: string;
    customerName: string;
    customerPhone?: string;
    packageId: string;
    paymentMethod: string;
    invoiceId?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const todayStr = now.split('T')[0];

      // 1. Look up package template
      const pStmt = this.db.prepare(`SELECT * FROM service_packages WHERE id = ? AND business_id = ?`);
      pStmt.bind([params.packageId, params.businessId]);
      if (!pStmt.step()) {
        pStmt.free();
        throw new Error(`Service package ${params.packageId} not found`);
      }
      const pkg = pStmt.getAsObject();
      pStmt.free();

      if (Number(pkg.is_active) === 0) {
        throw new Error(`Package ${pkg.name} is inactive`);
      }

      const totalQty = Number(pkg.total_qty || 1);
      const validityDays = Number(pkg.validity_days || 90);
      const priceMMK = Number(pkg.price_mmk || 0);
      const expiryDateObj = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
      const expiryDate = expiryDateObj.toISOString().split('T')[0];

      // 2. Insert customer_packages
      this.db.run(`
        INSERT INTO customer_packages (
          id, business_id, branch_id, customer_id, customer_name, customer_phone,
          package_id, package_name, service_id, service_name,
          purchased_qty, used_qty, remaining_qty, expiry_date, purchase_price_mmk,
          payment_method, status, invoice_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'active', ?, ?, ?)
      `, [
        params.customerPackageId,
        params.businessId,
        params.branchId,
        params.customerId,
        params.customerName,
        params.customerPhone || null,
        params.packageId,
        pkg.name,
        pkg.service_id,
        pkg.service_name,
        totalQty,
        totalQty,
        expiryDate,
        priceMMK,
        params.paymentMethod,
        params.invoiceId || null,
        now,
        now,
      ]);

      // 3. Cash Transaction if cash
      if (params.paymentMethod === 'cash' && priceMMK > 0) {
        const cashTxId = `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.db.run(`
          INSERT INTO cash_transactions (
            id, business_id, branch_id, type, category, amount_mmk, reference_type, reference_id, notes, transaction_time, created_by
          ) VALUES (?, ?, ?, 'cash_in', 'package_sale_cash', ?, 'package', ?, ?, ?, ?)
        `, [
          cashTxId,
          params.businessId,
          params.branchId,
          priceMMK,
          params.customerPackageId,
          `Package: ${pkg.name} for ${params.customerName}`,
          now,
          params.userName,
        ]);
      }

      // 4. Outbox Event
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'PACKAGE_PURCHASED',
        entityType: 'CUSTOMER_PACKAGE',
        entityId: params.customerPackageId,
        payload: {
          customerPackageId: params.customerPackageId,
          customerId: params.customerId,
          packageName: pkg.name,
          totalQty,
          remainingQty: totalQty,
          expiryDate,
          purchasePriceMMK: priceMMK,
          paymentMethod: params.paymentMethod,
        },
        actorUserId: params.userId,
      });

      return {
        customerPackageId: params.customerPackageId,
        packageName: pkg.name,
        totalQty,
        remainingQty: totalQty,
        expiryDate,
        purchasePriceMMK: priceMMK,
        status: 'active',
      };
    });
  }

  public async executePackageRedeem(params: {
    customerPackageId: string;
    quantity: number;
    businessId: string;
    branchId: string;
    sessionId?: string;
    invoiceId?: string;
    notes?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const todayStr = now.split('T')[0];

      // 1. Fetch customer package
      const stmt = this.db.prepare(`SELECT * FROM customer_packages WHERE id = ? AND business_id = ?`);
      stmt.bind([params.customerPackageId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Customer package ${params.customerPackageId} not found`);
      }
      const pkg = stmt.getAsObject();
      stmt.free();

      if (pkg.status !== 'active') {
        throw new Error(`Customer package is ${pkg.status} and cannot be redeemed`);
      }

      if (pkg.expiry_date && pkg.expiry_date < todayStr) {
        this.db.run(`UPDATE customer_packages SET status = 'expired', updated_at = ? WHERE id = ?`, [now, params.customerPackageId]);
        throw new Error(`Customer package expired on ${pkg.expiry_date}`);
      }

      const remainingQty = Number(pkg.remaining_qty || 0);
      const usedQty = Number(pkg.used_qty || 0);

      // Over-redemption prevention
      if (remainingQty < params.quantity) {
        throw new Error(`Over-redemption prevented: Requested ${params.quantity}, but only ${remainingQty} sessions remaining`);
      }

      const newRemaining = remainingQty - params.quantity;
      const newUsed = usedQty + params.quantity;
      const newStatus = newRemaining === 0 ? 'exhausted' : 'active';

      // 2. Update customer package balance atomically
      this.db.run(`
        UPDATE customer_packages SET
          remaining_qty = ?, used_qty = ?, status = ?, updated_at = ?
        WHERE id = ? AND business_id = ?
      `, [newRemaining, newUsed, newStatus, now, params.customerPackageId, params.businessId]);

      // 3. Record redemption record
      const redemptionId = `pred_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      this.db.run(`
        INSERT INTO package_redemptions (
          id, business_id, branch_id, customer_package_id, customer_id, session_id, invoice_id,
          service_id, service_name, quantity_redeemed, redeemed_at, redeemed_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        redemptionId,
        params.businessId,
        params.branchId,
        params.customerPackageId,
        pkg.customer_id,
        params.sessionId || null,
        params.invoiceId || null,
        pkg.service_id,
        pkg.service_name,
        params.quantity,
        now,
        params.userName,
        params.notes || null,
      ]);

      // 4. Outbox Event
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'PACKAGE_REDEEMED',
        entityType: 'PACKAGE_REDEMPTION',
        entityId: redemptionId,
        payload: {
          redemptionId,
          customerPackageId: params.customerPackageId,
          packageName: pkg.package_name,
          quantityRedeemed: params.quantity,
          remainingQty: newRemaining,
          usedQty: newUsed,
          status: newStatus,
          sessionId: params.sessionId,
          invoiceId: params.invoiceId,
        },
        actorUserId: params.userId,
      });

      return {
        redemptionId,
        customerPackageId: params.customerPackageId,
        packageName: pkg.package_name,
        quantityRedeemed: params.quantity,
        remainingQty: newRemaining,
        usedQty: newUsed,
        status: newStatus,
      };
    });
  }

  public async executeGiftCardIssue(params: {
    giftCardId: string;
    cardNumber?: string;
    businessId: string;
    branchId: string;
    initialAmountMMK: number;
    customerId?: string;
    customerName?: string;
    expiryDays?: number;
    paymentMethod?: string;
    notes?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const todayStr = now.split('T')[0];

      // Auto-generate clean gift card number if not specified
      const cardNumber = params.cardNumber || `GC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const expiryDays = params.expiryDays || 365;
      const expiryDateObj = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
      const expiryDate = expiryDateObj.toISOString().split('T')[0];

      // Check duplicate card number
      const checkStmt = this.db.prepare(`SELECT id FROM gift_cards WHERE card_number = ? AND business_id = ?`);
      checkStmt.bind([cardNumber, params.businessId]);
      if (checkStmt.step()) {
        checkStmt.free();
        throw new Error(`Gift Card number '${cardNumber}' already exists`);
      }
      checkStmt.free();

      // 1. Insert gift card
      this.db.run(`
        INSERT INTO gift_cards (
          id, business_id, branch_id, card_number, initial_amount_mmk, current_balance_mmk,
          customer_id, customer_name, issue_date, expiry_date, issued_by, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `, [
        params.giftCardId,
        params.businessId,
        params.branchId,
        cardNumber,
        params.initialAmountMMK,
        params.initialAmountMMK,
        params.customerId || null,
        params.customerName || null,
        todayStr,
        expiryDate,
        params.userName,
        params.notes || null,
        now,
        now,
      ]);

      // 2. Cash Inflow if paid cash
      if (params.paymentMethod === 'cash' && params.initialAmountMMK > 0) {
        const cashTxId = `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.db.run(`
          INSERT INTO cash_transactions (
            id, business_id, branch_id, type, category, amount_mmk, reference_type, reference_id, notes, transaction_time, created_by
          ) VALUES (?, ?, ?, 'cash_in', 'gift_card_sale_cash', ?, 'gift_card', ?, ?, ?, ?)
        `, [
          cashTxId,
          params.businessId,
          params.branchId,
          params.initialAmountMMK,
          params.giftCardId,
          `Gift Card Issue ${cardNumber}`,
          now,
          params.userName,
        ]);
      }

      // 3. Outbox Event
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'GIFT_CARD_ISSUED',
        entityType: 'GIFT_CARD',
        entityId: params.giftCardId,
        payload: {
          giftCardId: params.giftCardId,
          cardNumber,
          initialAmountMMK: params.initialAmountMMK,
          currentBalanceMMK: params.initialAmountMMK,
          customerId: params.customerId,
          expiryDate,
          status: 'active',
        },
        actorUserId: params.userId,
      });

      return {
        giftCardId: params.giftCardId,
        cardNumber,
        initialAmountMMK: params.initialAmountMMK,
        currentBalanceMMK: params.initialAmountMMK,
        expiryDate,
        status: 'active',
      };
    });
  }

  public async executeGiftCardRedeem(params: {
    giftCardIdOrNumber: string;
    amountMMK: number;
    businessId: string;
    branchId: string;
    sessionId?: string;
    invoiceId?: string;
    notes?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const todayStr = now.split('T')[0];

      // 1. Fetch card by ID or Number
      let stmt = this.db.prepare(`SELECT * FROM gift_cards WHERE (id = ? OR card_number = ?) AND business_id = ?`);
      stmt.bind([params.giftCardIdOrNumber, params.giftCardIdOrNumber, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Gift Card '${params.giftCardIdOrNumber}' not found`);
      }
      const card = stmt.getAsObject();
      stmt.free();

      if (card.status !== 'active') {
        throw new Error(`Gift Card ${card.card_number} is ${card.status} and cannot be redeemed`);
      }

      if (card.expiry_date && card.expiry_date < todayStr) {
        this.db.run(`UPDATE gift_cards SET status = 'expired', updated_at = ? WHERE id = ?`, [now, card.id]);
        throw new Error(`Gift Card ${card.card_number} expired on ${card.expiry_date}`);
      }

      const currentBalance = Number(card.current_balance_mmk || 0);

      // Duplicate / Overdraft Prevention
      if (currentBalance < params.amountMMK) {
        throw new Error(`Insufficient gift card balance: Card has ${currentBalance.toLocaleString()} MMK, requested ${params.amountMMK.toLocaleString()} MMK`);
      }

      const balanceAfter = currentBalance - params.amountMMK;
      const newStatus = balanceAfter === 0 ? 'exhausted' : 'active';

      // 2. Deduct balance atomically
      this.db.run(`
        UPDATE gift_cards SET
          current_balance_mmk = ?, status = ?, updated_at = ?
        WHERE id = ? AND business_id = ?
      `, [balanceAfter, newStatus, now, card.id, params.businessId]);

      // 3. Record redemption entry
      const redemptionId = `gcred_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      this.db.run(`
        INSERT INTO gift_card_redemptions (
          id, business_id, branch_id, gift_card_id, card_number, session_id, invoice_id,
          amount_mmk, balance_before_mmk, balance_after_mmk, redeemed_at, redeemed_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        redemptionId,
        params.businessId,
        params.branchId,
        card.id,
        card.card_number,
        params.sessionId || null,
        params.invoiceId || null,
        params.amountMMK,
        currentBalance,
        balanceAfter,
        now,
        params.userName,
        params.notes || null,
      ]);

      // 4. Outbox Event
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'GIFT_CARD_REDEEMED',
        entityType: 'GIFT_CARD_REDEMPTION',
        entityId: redemptionId,
        payload: {
          redemptionId,
          giftCardId: card.id,
          cardNumber: card.card_number,
          amountMMK: params.amountMMK,
          balanceBeforeMMK: currentBalance,
          balanceAfterMMK: balanceAfter,
          status: newStatus,
          sessionId: params.sessionId,
          invoiceId: params.invoiceId,
        },
        actorUserId: params.userId,
      });

      return {
        redemptionId,
        giftCardId: card.id,
        cardNumber: card.card_number,
        amountMMK: params.amountMMK,
        balanceBeforeMMK: currentBalance,
        balanceAfterMMK: balanceAfter,
        status: newStatus,
      };
    });
  }

  public async executeTipRecord(params: {
    tipId: string;
    businessId: string;
    branchId: string;
    sessionId?: string;
    invoiceId?: string;
    staffId: string;
    staffName: string;
    amountMMK: number;
    paymentMethod: string;
    receivedBy: string;
    notes?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const todayStr = now.split('T')[0];

      if (params.amountMMK <= 0) {
        throw new Error('Tip amount must be greater than zero');
      }

      // 1. Insert Tip Record (separated from service revenue)
      this.db.run(`
        INSERT INTO tips (
          id, business_id, branch_id, session_id, invoice_id, staff_id, staff_name,
          amount_mmk, payment_method, received_by, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        params.tipId,
        params.businessId,
        params.branchId,
        params.sessionId || null,
        params.invoiceId || null,
        params.staffId,
        params.staffName,
        params.amountMMK,
        params.paymentMethod,
        params.receivedBy,
        params.notes || null,
        now,
      ]);

      // 2. Staff Ledger Attribution (Recorded as bonus/tip credit)
      const stLedgId = `stledg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      this.db.run(`
        INSERT INTO staff_ledger (
          id, business_id, branch_id, staff_id, type, amount_mmk, notes, date, created_at
        ) VALUES (?, ?, ?, ?, 'bonus', ?, ?, ?, ?)
      `, [
        stLedgId,
        params.businessId,
        params.branchId,
        params.staffId,
        params.amountMMK,
        `Customer Tip for Session/Invoice ${params.invoiceId || params.sessionId || ''}`,
        todayStr,
        now,
      ]);

      // 3. Cash Inflow if paid cash
      if (params.paymentMethod === 'cash') {
        const cashTxId = `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.db.run(`
          INSERT INTO cash_transactions (
            id, business_id, branch_id, type, category, amount_mmk, reference_type, reference_id, notes, transaction_time, created_by
          ) VALUES (?, ?, ?, 'cash_in', 'tip_cash', ?, 'tip', ?, ?, ?, ?)
        `, [
          cashTxId,
          params.businessId,
          params.branchId,
          params.amountMMK,
          params.tipId,
          `Staff Tip for ${params.staffName}`,
          now,
          params.userName,
        ]);
      }

      // 4. Outbox Event
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'TIP_RECORDED',
        entityType: 'TIP',
        entityId: params.tipId,
        payload: {
          tipId: params.tipId,
          staffId: params.staffId,
          staffName: params.staffName,
          amountMMK: params.amountMMK,
          paymentMethod: params.paymentMethod,
          sessionId: params.sessionId,
          invoiceId: params.invoiceId,
        },
        actorUserId: params.userId,
      });

      return {
        tipId: params.tipId,
        staffId: params.staffId,
        staffName: params.staffName,
        amountMMK: params.amountMMK,
        paymentMethod: params.paymentMethod,
      };
    });
  }

  public async executePackageCancel(params: {
    customerPackageId: string;
    businessId: string;
    branchId: string;
    reason?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`SELECT * FROM customer_packages WHERE id = ? AND business_id = ?`);
      stmt.bind([params.customerPackageId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Customer package ${params.customerPackageId} not found`);
      }
      const pkg = stmt.getAsObject();
      stmt.free();

      this.db.run(`
        UPDATE customer_packages SET status = 'cancelled', updated_at = ? WHERE id = ? AND business_id = ?
      `, [now, params.customerPackageId, params.businessId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'PACKAGE_CANCELLED',
        entityType: 'CUSTOMER_PACKAGE',
        entityId: params.customerPackageId,
        payload: {
          customerPackageId: params.customerPackageId,
          packageName: pkg.package_name,
          customerId: pkg.customer_id,
          reason: params.reason,
          status: 'cancelled',
        },
        actorUserId: params.userId,
      });

      return { customerPackageId: params.customerPackageId, status: 'cancelled' };
    });
  }

  public async executeMembershipCancel(params: {
    membershipId: string;
    businessId: string;
    branchId: string;
    reason?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`SELECT * FROM customer_memberships WHERE id = ? AND business_id = ?`);
      stmt.bind([params.membershipId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Customer membership ${params.membershipId} not found`);
      }
      const mem = stmt.getAsObject();
      stmt.free();

      this.db.run(`
        UPDATE customer_memberships SET status = 'cancelled', updated_at = ? WHERE id = ? AND business_id = ?
      `, [now, params.membershipId, params.businessId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'MEMBERSHIP_CANCELLED',
        entityType: 'CUSTOMER_MEMBERSHIP',
        entityId: params.membershipId,
        payload: {
          membershipId: params.membershipId,
          planName: mem.plan_name,
          customerId: mem.customer_id,
          reason: params.reason,
          status: 'cancelled',
        },
        actorUserId: params.userId,
      });

      return { membershipId: params.membershipId, status: 'cancelled' };
    });
  }

  public async executeGiftCardVoid(params: {
    giftCardIdOrNumber: string;
    businessId: string;
    branchId: string;
    reason?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`SELECT * FROM gift_cards WHERE (id = ? OR card_number = ?) AND business_id = ?`);
      stmt.bind([params.giftCardIdOrNumber, params.giftCardIdOrNumber, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Gift card ${params.giftCardIdOrNumber} not found`);
      }
      const card = stmt.getAsObject();
      stmt.free();

      this.db.run(`
        UPDATE gift_cards SET status = 'cancelled', updated_at = ? WHERE id = ? AND business_id = ?
      `, [now, card.id, params.businessId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'GIFT_CARD_VOIDED',
        entityType: 'GIFT_CARD',
        entityId: String(card.id),
        payload: {
          giftCardId: card.id,
          cardNumber: card.card_number,
          customerId: card.customer_id,
          reason: params.reason,
          status: 'cancelled',
        },
        actorUserId: params.userId,
      });

      return { giftCardId: card.id, cardNumber: card.card_number, status: 'cancelled' };
    });
  }

  /**
   * ATOMIC MIXED PAYMENT:
   * Supports splitting invoice payment across multiple methods:
   * e.g. Cash 50,000 + KBZPay 30,000 + Customer Credit 20,000.
   * Atomically records payment items, updates cash ledger for cash portions,
   * updates customer credit debt for credit portions, and updates invoice paid balance.
   */
  public async executeMixedPayment(params: {
    invoiceId: string;
    businessId: string;
    branchId: string;
    payments: Array<{
      id?: string;
      method: string;
      amountMMK: number;
      tenderedMMK?: number;
      changeMMK?: number;
      referenceNo?: string;
      notes?: string;
    }>;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const todayStr = now.split('T')[0];

      // 1. Fetch Invoice
      const invStmt = this.db.prepare(`SELECT * FROM invoices WHERE id = ? AND business_id = ?`);
      invStmt.bind([params.invoiceId, params.businessId]);
      if (!invStmt.step()) {
        invStmt.free();
        throw new Error(`Invoice ${params.invoiceId} not found`);
      }
      const invoice = invStmt.getAsObject();
      invStmt.free();

      const totalMMK = Number(invoice.total_mmk || 0);
      const prevPaidMMK = Number(invoice.paid_mmk || 0);
      const balanceDue = Math.max(0, totalMMK - prevPaidMMK);

      if (params.payments.length === 0) {
        throw new Error('Mixed payment must contain at least one payment line');
      }

      // Calculate total paid across lines
      const totalPaidNow = params.payments.reduce((sum, p) => sum + Number(p.amountMMK || 0), 0);
      if (totalPaidNow <= 0) {
        throw new Error('Total payment amount must be greater than zero');
      }

      // Check for overpayment against remaining balance
      if (totalPaidNow > balanceDue) {
        // Only allow if cash line has tender and change
        const hasCashWithChange = params.payments.some(p => p.method === 'cash' && (p.tenderedMMK || 0) > p.amountMMK);
        if (!hasCashWithChange && totalPaidNow - balanceDue > 0) {
          throw new Error(`Overpayment prevented: Balance due is ${balanceDue.toLocaleString()} MMK, but attempted to pay ${totalPaidNow.toLocaleString()} MMK`);
        }
      }

      const newPaidMMK = Math.min(totalMMK, prevPaidMMK + totalPaidNow);
      const isCreditPayment = params.payments.some(p => p.method === 'credit');
      let newStatus: string;
      if (newPaidMMK >= totalMMK) {
        newStatus = isCreditPayment ? 'credit' : 'paid';
      } else {
        newStatus = 'partial';
      }

      // 2. Process each payment record
      for (const p of params.payments) {
        const paymentId = p.id || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const amount = Number(p.amountMMK || 0);

        // Insert into invoice_payments
        this.db.run(`
          INSERT INTO invoice_payments (
            id, business_id, branch_id, invoice_id, method, amount_mmk, tendered_mmk, change_mmk, reference_no, notes, paid_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          paymentId,
          params.businessId,
          params.branchId,
          params.invoiceId,
          p.method,
          amount,
          p.tenderedMMK || null,
          p.changeMMK || null,
          p.referenceNo || null,
          p.notes || null,
          now,
        ]);

        // Cash portion -> Cash transaction
        if (p.method === 'cash' && amount > 0) {
          const cashTxId = `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          this.db.run(`
            INSERT INTO cash_transactions (
              id, business_id, branch_id, type, category, amount_mmk, reference_type, reference_id, notes, transaction_time, created_by
            ) VALUES (?, ?, ?, 'cash_in', 'pos_sale_cash', ?, 'invoice', ?, ?, ?, ?)
          `, [
            cashTxId,
            params.businessId,
            params.branchId,
            amount,
            params.invoiceId,
            `Mixed payment cash for Invoice ${invoice.invoice_number || params.invoiceId}`,
            now,
            params.userName,
          ]);
        }

        // Credit portion -> Customer debt ledger
        if (p.method === 'credit' && amount > 0) {
          if (!invoice.customer_id) {
            throw new Error('Credit payment requires a registered customer on the invoice');
          }
          const cStmt = this.db.prepare(`SELECT * FROM customers WHERE id = ? AND business_id = ?`);
          cStmt.bind([invoice.customer_id, params.businessId]);
          if (!cStmt.step()) {
            cStmt.free();
            throw new Error(`Customer ${invoice.customer_id} not found for credit payment`);
          }
          const customer = cStmt.getAsObject();
          cStmt.free();

          const prevBal = Number(customer.outstanding_balance_mmk || 0);
          const newBal = prevBal + amount;

          // Check credit limit if configured
          if (customer.credit_limit_mmk && Number(customer.credit_limit_mmk) > 0) {
            if (newBal > Number(customer.credit_limit_mmk)) {
              throw new Error(`Customer credit limit exceeded: Max ${Number(customer.credit_limit_mmk).toLocaleString()} MMK, new debt would be ${newBal.toLocaleString()} MMK`);
            }
          }

          this.db.run(`UPDATE customers SET outstanding_balance_mmk = ? WHERE id = ?`, [newBal, invoice.customer_id]);

          const ldgId = `cldg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          this.db.run(`
            INSERT INTO customer_ledger (
              id, business_id, branch_id, customer_id, type, amount_mmk, balance_after_mmk, reference_id, notes, date, created_at
            ) VALUES (?, ?, ?, ?, 'credit_sale', ?, ?, ?, ?, ?, ?)
          `, [
            ldgId,
            params.businessId,
            params.branchId,
            invoice.customer_id,
            amount,
            newBal,
            params.invoiceId,
            `Credit portion for Invoice ${invoice.invoice_number || params.invoiceId}`,
            todayStr,
            now,
          ]);
        }
      }

      // 3. Update Invoice
      const primaryMethod = params.payments.length === 1 ? params.payments[0].method : 'mixed';
      this.db.run(`
        UPDATE invoices SET
          paid_mmk = ?, payment_status = ?, payment_method = ?
        WHERE id = ? AND business_id = ?
      `, [newPaidMMK, newStatus, primaryMethod, params.invoiceId, params.businessId]);

      // 4. Outbox Events
      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'PAYMENT_CREATED',
        entityType: 'INVOICE',
        entityId: params.invoiceId,
        payload: {
          invoiceId: params.invoiceId,
          invoiceNumber: invoice.invoice_number,
          totalMMK,
          paidMMK: newPaidMMK,
          paymentStatus: newStatus,
          payments: params.payments,
        },
        actorUserId: params.userId,
      });

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'INVOICE_UPDATED',
        entityType: 'INVOICE',
        entityId: params.invoiceId,
        payload: {
          invoiceId: params.invoiceId,
          invoiceNumber: invoice.invoice_number,
          paidMMK: newPaidMMK,
          paymentStatus: newStatus,
        },
        actorUserId: params.userId,
      });

      return {
        invoiceId: params.invoiceId,
        totalMMK,
        paidMMK: newPaidMMK,
        totalPaidMMK: totalPaidNow,
        status: newStatus,
        paymentStatus: newStatus,
        paymentsProcessed: params.payments.length,
      };
    });
  }

  // ==========================================
  // QUERY METHODS FOR PHASE 27
  // ==========================================

  public getMembershipPlans(businessId: string, branchId: string): any[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`
      SELECT * FROM membership_plans WHERE business_id = ? ORDER BY is_active DESC, price_mmk ASC
    `);
    stmt.bind([businessId]);
    const results: any[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  public getCustomerMemberships(businessId: string, customerId: string): any[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`
      SELECT * FROM customer_memberships WHERE business_id = ? AND customer_id = ? ORDER BY created_at DESC
    `);
    stmt.bind([businessId, customerId]);
    const results: any[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  public getServicePackages(businessId: string, branchId: string): any[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`
      SELECT * FROM service_packages WHERE business_id = ? ORDER BY is_active DESC, price_mmk ASC
    `);
    stmt.bind([businessId]);
    const results: any[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  public getCustomerPackages(businessId: string, customerId: string): any[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`
      SELECT * FROM customer_packages WHERE business_id = ? AND customer_id = ? ORDER BY created_at DESC
    `);
    stmt.bind([businessId, customerId]);
    const results: any[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  public getGiftCards(businessId: string, branchId: string): any[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`
      SELECT * FROM gift_cards WHERE business_id = ? ORDER BY created_at DESC
    `);
    stmt.bind([businessId]);
    const results: any[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  public getGiftCardByNumber(businessId: string, cardNumber: string): any | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`
      SELECT * FROM gift_cards WHERE business_id = ? AND card_number = ?
    `);
    stmt.bind([businessId, cardNumber]);
    let result = null;
    if (stmt.step()) result = stmt.getAsObject();
    stmt.free();
    return result;
  }

  public getTips(businessId: string, branchId: string, staffId?: string, date?: string): any[] {
    if (!this.db) return [];
    let query = `SELECT * FROM tips WHERE business_id = ?`;
    const bindArgs: any[] = [businessId];
    if (staffId) {
      query += ` AND staff_id = ?`;
      bindArgs.push(staffId);
    }
    if (date) {
      query += ` AND created_at LIKE ?`;
      bindArgs.push(`${date}%`);
    }
    query += ` ORDER BY created_at DESC`;

    const stmt = this.db.prepare(query);
    stmt.bind(bindArgs);
    const results: any[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  public getCustomerFinancialProfile(businessId: string, customerId: string, canViewSensitive: boolean = false): any {
    if (!this.db) return null;

    // Customer record
    const cStmt = this.db.prepare(`SELECT * FROM customers WHERE id = ? AND business_id = ?`);
    cStmt.bind([customerId, businessId]);
    if (!cStmt.step()) {
      cStmt.free();
      return null;
    }
    const customer = cStmt.getAsObject();
    cStmt.free();

    // Memberships
    const memberships = this.getCustomerMemberships(businessId, customerId);
    // Packages
    const packages = this.getCustomerPackages(businessId, customerId);
    // Gift Cards linked to this customer
    const gcStmt = this.db.prepare(`SELECT * FROM gift_cards WHERE customer_id = ? AND business_id = ? ORDER BY created_at DESC`);
    gcStmt.bind([customerId, businessId]);
    const giftCards: any[] = [];
    while (gcStmt.step()) giftCards.push(gcStmt.getAsObject());
    gcStmt.free();

    // Credit Ledger
    const ldgStmt = this.db.prepare(`SELECT * FROM customer_ledger WHERE customer_id = ? AND business_id = ? ORDER BY created_at DESC LIMIT 50`);
    ldgStmt.bind([customerId, businessId]);
    const ledger: any[] = [];
    while (ldgStmt.step()) ledger.push(ldgStmt.getAsObject());
    ldgStmt.free();

    // Invoices
    const invStmt = this.db.prepare(`SELECT * FROM invoices WHERE customer_id = ? AND business_id = ? ORDER BY created_at DESC LIMIT 50`);
    invStmt.bind([customerId, businessId]);
    const invoices: any[] = [];
    while (invStmt.step()) invoices.push(invStmt.getAsObject());
    invStmt.free();

    // Bookings
    const bkgStmt = this.db.prepare(`SELECT * FROM bookings WHERE customer_id = ? AND business_id = ? ORDER BY date DESC, start_time DESC LIMIT 50`);
    bkgStmt.bind([customerId, businessId]);
    const bookings: any[] = [];
    while (bkgStmt.step()) bookings.push(bkgStmt.getAsObject());
    bkgStmt.free();

    // Sessions
    const sessStmt = this.db.prepare(`SELECT * FROM sessions WHERE (customer_name = ? OR customer_name = ?) AND business_id = ? ORDER BY start_time DESC LIMIT 50`);
    sessStmt.bind([customer.name, (customer as any).phone || customer.name, businessId]);
    const sessions: any[] = [];
    while (sessStmt.step()) sessions.push(sessStmt.getAsObject());
    sessStmt.free();

    // Notes
    const notes = this.getCustomerServiceNotes(businessId, customerId, canViewSensitive);

    return {
      customer,
      memberships,
      packages,
      giftCards,
      ledger,
      invoices,
      bookings,
      sessions,
      notes,
    };
  }

  public getCustomerServiceNotes(businessId: string, customerId: string, canViewSensitive: boolean = false): any[] {
    if (!this.db) return [];
    let query = `SELECT * FROM customer_service_notes WHERE business_id = ? AND customer_id = ?`;
    const bindArgs: any[] = [businessId, customerId];

    if (!canViewSensitive) {
      query += ` AND is_private = 0`;
    }
    query += ` ORDER BY created_at DESC`;

    const stmt = this.db.prepare(query);
    stmt.bind(bindArgs);
    const results: any[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  public async executeCustomerNoteCreate(params: {
    noteId: string;
    businessId: string;
    branchId: string;
    customerId: string;
    customerName?: string;
    sessionId?: string;
    bookingId?: string;
    serviceId?: string;
    serviceName?: string;
    staffId?: string;
    staffName?: string;
    category: string;
    title: string;
    content: string;
    tags?: string[];
    focusAreas?: string[];
    isPrivate?: boolean;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      this.db.run(`
        INSERT INTO customer_service_notes (
          id, business_id, branch_id, customer_id, customer_name, session_id, booking_id,
          service_id, service_name, staff_id, staff_name, category, title, content,
          tags, focus_areas, is_private, created_at, created_by, created_by_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        params.noteId,
        params.businessId,
        params.branchId,
        params.customerId,
        params.customerName || '',
        params.sessionId || null,
        params.bookingId || null,
        params.serviceId || null,
        params.serviceName || null,
        params.staffId || null,
        params.staffName || null,
        params.category,
        params.title,
        params.content,
        params.tags ? JSON.stringify(params.tags) : null,
        params.focusAreas ? JSON.stringify(params.focusAreas) : null,
        params.isPrivate ? 1 : 0,
        now,
        params.userName,
        params.userId,
        now,
      ]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'CUSTOMER_NOTE_CREATED',
        entityType: 'CUSTOMER_SERVICE_NOTE',
        entityId: params.noteId,
        payload: {
          noteId: params.noteId,
          customerId: params.customerId,
          category: params.category,
          title: params.title,
          isPrivate: params.isPrivate,
        },
        actorUserId: params.userId,
      });

      return { noteId: params.noteId, customerId: params.customerId, success: true };
    });
  }

  public async executeCustomerNoteUpdate(params: {
    noteId: string;
    businessId: string;
    branchId: string;
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
    focusAreas?: string[];
    isPrivate?: boolean;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`SELECT * FROM customer_service_notes WHERE id = ? AND business_id = ?`);
      stmt.bind([params.noteId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Note ${params.noteId} not found`);
      }
      const existing = stmt.getAsObject();
      stmt.free();

      const newTitle = params.title !== undefined ? params.title : existing.title;
      const newContent = params.content !== undefined ? params.content : existing.content;
      const newCategory = params.category !== undefined ? params.category : existing.category;
      const newTags = params.tags !== undefined ? JSON.stringify(params.tags) : existing.tags;
      const newFocusAreas = params.focusAreas !== undefined ? JSON.stringify(params.focusAreas) : existing.focus_areas;
      const newIsPrivate = params.isPrivate !== undefined ? (params.isPrivate ? 1 : 0) : existing.is_private;

      this.db.run(`
        UPDATE customer_service_notes SET
          title = ?, content = ?, category = ?, tags = ?, focus_areas = ?, is_private = ?, updated_at = ?
        WHERE id = ? AND business_id = ?
      `, [newTitle, newContent, newCategory, newTags, newFocusAreas, newIsPrivate, now, params.noteId, params.businessId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'CUSTOMER_NOTE_UPDATED',
        entityType: 'CUSTOMER_SERVICE_NOTE',
        entityId: params.noteId,
        payload: { noteId: params.noteId, customerId: existing.customer_id },
        actorUserId: params.userId,
      });

      return { noteId: params.noteId, success: true };
    });
  }

  public async executeCustomerNoteDelete(params: {
    noteId: string;
    businessId: string;
    branchId: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const stmt = this.db.prepare(`SELECT customer_id FROM customer_service_notes WHERE id = ? AND business_id = ?`);
      stmt.bind([params.noteId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        return { success: true, deleted: false };
      }
      const custId = stmt.getAsObject().customer_id;
      stmt.free();

      this.db.run(`DELETE FROM customer_service_notes WHERE id = ? AND business_id = ?`, [params.noteId, params.businessId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'CUSTOMER_NOTE_DELETED',
        entityType: 'CUSTOMER_SERVICE_NOTE',
        entityId: params.noteId,
        payload: { noteId: params.noteId, customerId: custId },
        actorUserId: params.userId,
      });

      return { noteId: params.noteId, success: true, deleted: true };
    });
  }

  public async executeCustomerPreferencesUpdate(params: {
    customerId: string;
    businessId: string;
    branchId: string;
    preferences: any;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const prefsStr = JSON.stringify(params.preferences);

      this.db.run(`UPDATE customers SET preferences = ? WHERE id = ? AND business_id = ?`, [
        prefsStr,
        params.customerId,
        params.businessId,
      ]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'CUSTOMER_UPDATED',
        entityType: 'CUSTOMER',
        entityId: params.customerId,
        payload: { customerId: params.customerId, preferences: params.preferences },
        actorUserId: params.userId,
      });

      return { customerId: params.customerId, success: true };
    });
  }

  // ==========================================
  // PHASE 36: STAFF ATTENDANCE, SHIFTS, CONSUMABLES & PAYROLL
  // ==========================================

  public async executeStaffClockIn(params: {
    attendanceId?: string;
    businessId: string;
    branchId: string;
    staffId: string;
    staffName: string;
    date?: string;
    checkInTime?: string;
    status?: string;
    notes?: string;
    deviceId?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const today = params.date || now.split('T')[0];
      const checkInTime = params.checkInTime || now;
      const status = params.status || 'checked_in';
      const attId = params.attendanceId || `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      this.db.run(`
        INSERT INTO staff_attendance (
          id, business_id, branch_id, staff_id, staff_name, date, check_in_time, status, device_id, user_id, user_name, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        attId,
        params.businessId,
        params.branchId,
        params.staffId,
        params.staffName,
        today,
        checkInTime,
        status,
        params.deviceId || null,
        params.userId,
        params.userName,
        params.notes || null,
        now,
        now,
      ]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'STAFF_CLOCK_IN',
        entityType: 'STAFF_ATTENDANCE',
        entityId: attId,
        payload: {
          attendanceId: attId,
          staffId: params.staffId,
          staffName: params.staffName,
          date: today,
          checkInTime,
          status,
        },
        actorUserId: params.userId,
      });

      return { attendanceId: attId, staffId: params.staffId, date: today, checkInTime, status };
    });
  }

  public async executeStaffClockOut(params: {
    attendanceId: string;
    businessId: string;
    branchId: string;
    checkOutTime?: string;
    notes?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const checkOutTime = params.checkOutTime || now;

      const stmt = this.db.prepare(`SELECT * FROM staff_attendance WHERE id = ? AND business_id = ?`);
      stmt.bind([params.attendanceId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Attendance record ${params.attendanceId} not found`);
      }
      const existing = stmt.getAsObject();
      stmt.free();

      this.db.run(`
        UPDATE staff_attendance SET
          check_out_time = ?,
          status = 'checked_out',
          notes = COALESCE(?, notes),
          updated_at = ?
        WHERE id = ? AND business_id = ?
      `, [checkOutTime, params.notes || null, now, params.attendanceId, params.businessId]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'STAFF_CLOCK_OUT',
        entityType: 'STAFF_ATTENDANCE',
        entityId: params.attendanceId,
        payload: {
          attendanceId: params.attendanceId,
          staffId: existing.staff_id,
          checkOutTime,
          status: 'checked_out',
        },
        actorUserId: params.userId,
      });

      return { attendanceId: params.attendanceId, checkOutTime, status: 'checked_out' };
    });
  }

  public async executeShiftOpen(params: {
    shiftId?: string;
    businessId: string;
    branchId: string;
    shiftCode?: string;
    staffId: string;
    staffName: string;
    openingFloatMMK: number;
    notes?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const shiftId = params.shiftId || `shf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const shiftCode = params.shiftCode || `SHF-${Date.now().toString().slice(-6)}`;

      this.db.run(`
        INSERT INTO shift_handovers (
          id, business_id, branch_id, shift_code, staff_id, staff_name, opened_at, opening_float_mmk, notes, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
      `, [
        shiftId,
        params.businessId,
        params.branchId,
        shiftCode,
        params.staffId,
        params.staffName,
        now,
        params.openingFloatMMK,
        params.notes || null,
        now,
      ]);

      if (params.openingFloatMMK > 0) {
        const cashTxId = `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.db.run(`
          INSERT INTO cash_transactions (
            id, business_id, branch_id, type, category, amount_mmk, reference_type, reference_id, notes, transaction_time, created_by
          ) VALUES (?, ?, ?, 'cash_in', 'shift_opening_float', ?, 'shift', ?, ?, ?, ?)
        `, [
          cashTxId,
          params.businessId,
          params.branchId,
          params.openingFloatMMK,
          shiftId,
          `Shift opening float for ${params.staffName}`,
          now,
          params.userName,
        ]);
      }

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'SHIFT_OPENED',
        entityType: 'SHIFT_HANDOVER',
        entityId: shiftId,
        payload: {
          shiftId,
          shiftCode,
          staffId: params.staffId,
          staffName: params.staffName,
          openingFloatMMK: params.openingFloatMMK,
          openedAt: now,
          status: 'open',
        },
        actorUserId: params.userId,
      });

      return { shiftId, shiftCode, staffId: params.staffId, openingFloatMMK: params.openingFloatMMK, status: 'open' };
    });
  }

  public async executeShiftClose(params: {
    shiftId: string;
    businessId: string;
    branchId: string;
    actualCashMMK: number;
    notes?: string;
    handedOverToId?: string;
    handedOverToName?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`SELECT * FROM shift_handovers WHERE id = ? AND business_id = ?`);
      stmt.bind([params.shiftId, params.businessId]);
      if (!stmt.step()) {
        stmt.free();
        throw new Error(`Shift ${params.shiftId} not found`);
      }
      const shift = stmt.getAsObject();
      stmt.free();

      if (shift.status === 'closed') {
        return shift;
      }

      const openedAt = String(shift.opened_at);
      const openingFloat = Number(shift.opening_float_mmk || 0);

      // Sum all cash transactions since openedAt
      const cashTxStmt = this.db.prepare(`
        SELECT type, SUM(amount_mmk) as total FROM cash_transactions
        WHERE business_id = ? AND branch_id = ? AND datetime(REPLACE(transaction_time, 'T', ' ')) >= datetime(REPLACE(?, 'T', ' '))
        GROUP BY type
      `);
      cashTxStmt.bind([params.businessId, params.branchId, openedAt]);
      let cashIn = 0;
      let cashOut = 0;
      while (cashTxStmt.step()) {
        const row = cashTxStmt.getAsObject();
        if (row.type === 'cash_in') cashIn = Number(row.total || 0);
        if (row.type === 'cash_out') cashOut = Number(row.total || 0);
      }
      cashTxStmt.free();

      const expectedCash = (cashIn - cashOut) > 0 ? (cashIn - cashOut) : openingFloat;
      const discrepancy = params.actualCashMMK - expectedCash;

      this.db.run(`
        UPDATE shift_handovers SET
          closed_at = ?,
          expected_cash_mmk = ?,
          actual_cash_mmk = ?,
          discrepancy_mmk = ?,
          notes = COALESCE(?, notes),
          status = 'closed',
          handed_over_to_id = ?,
          handed_over_to_name = ?
        WHERE id = ? AND business_id = ?
      `, [
        now,
        expectedCash,
        params.actualCashMMK,
        discrepancy,
        params.notes || null,
        params.handedOverToId || null,
        params.handedOverToName || null,
        params.shiftId,
        params.businessId,
      ]);

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'SHIFT_CLOSED',
        entityType: 'SHIFT_HANDOVER',
        entityId: params.shiftId,
        payload: {
          shiftId: params.shiftId,
          closedAt: now,
          expectedCashMMK: expectedCash,
          actualCashMMK: params.actualCashMMK,
          discrepancyMMK: discrepancy,
          handedOverToName: params.handedOverToName,
          status: 'closed',
        },
        actorUserId: params.userId,
      });

      return {
        shiftId: params.shiftId,
        expectedCashMMK: expectedCash,
        actualCashMMK: params.actualCashMMK,
        discrepancyMMK: discrepancy,
        status: 'closed',
      };
    });
  }

  public async executeServiceConsumableLink(params: {
    id?: string;
    businessId: string;
    branchId: string;
    serviceId: string;
    serviceName: string;
    productId: string;
    productName: string;
    quantity: number;
    unit?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const linkId = params.id || `scon_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      this.db.run(`
        INSERT INTO service_consumables (
          id, business_id, branch_id, service_id, service_name, product_id, product_name, quantity, unit, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        linkId,
        params.businessId,
        params.branchId,
        params.serviceId,
        params.serviceName,
        params.productId,
        params.productName,
        params.quantity,
        params.unit || null,
        now,
        now,
      ]);

      return { id: linkId, serviceId: params.serviceId, productId: params.productId, quantity: params.quantity };
    });
  }

  public async executeServiceConsumablesDeduct(params: {
    serviceId: string;
    businessId: string;
    branchId: string;
    multiplier?: number;
    sessionId?: string;
    invoiceId?: string;
    customerId?: string;
    customerName?: string;
    staffId?: string;
    staffName?: string;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      const multiplier = params.multiplier || 1;

      const stmt = this.db.prepare(`SELECT * FROM service_consumables WHERE service_id = ? AND business_id = ?`);
      stmt.bind([params.serviceId, params.businessId]);
      const recipeItems: any[] = [];
      while (stmt.step()) recipeItems.push(stmt.getAsObject());
      stmt.free();

      const deductedItems: any[] = [];

      for (const item of recipeItems) {
        const qtyToDeduct = Number(item.quantity) * multiplier;

        const pStmt = this.db.prepare(`SELECT * FROM products WHERE id = ? AND business_id = ?`);
        pStmt.bind([item.product_id, params.businessId]);
        if (pStmt.step()) {
          const product = pStmt.getAsObject();
          pStmt.free();

          const prevStock = Number(product.stock_qty !== undefined ? product.stock_qty : (product.stock_quantity || 0));
          const newStock = Math.max(0, prevStock - qtyToDeduct);

          this.db.run(`UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ? AND business_id = ?`, [
            newStock,
            now,
            item.product_id,
            params.businessId,
          ]);

          const movementId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          this.db.run(`
            INSERT INTO stock_movements (
              id, business_id, branch_id, product_id, product_name, service_id, session_id, invoice_id,
              customer_id, customer_name, staff_id, staff_name, type, quantity_change, previous_stock,
              new_stock, unit, notes, date, created_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'consumption', ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            movementId,
            params.businessId,
            params.branchId,
            item.product_id,
            item.product_name,
            params.serviceId,
            params.sessionId || null,
            params.invoiceId || null,
            params.customerId || null,
            params.customerName || null,
            params.staffId || null,
            params.staffName || null,
            qtyToDeduct,
            prevStock,
            newStock,
            item.unit || null,
            `Recipe consumption for service ${item.service_name}`,
            today,
            now,
            params.userName,
          ]);

          deductedItems.push({
            productId: item.product_id,
            productName: item.product_name,
            quantityDeducted: qtyToDeduct,
            previousStock: prevStock,
            newStock,
          });
        } else {
          pStmt.free();
        }
      }

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'SERVICE_CONSUMABLES_DEDUCTED',
        entityType: 'SERVICE_CONSUMABLES',
        entityId: params.serviceId,
        payload: {
          serviceId: params.serviceId,
          deductedItems,
          sessionId: params.sessionId,
          invoiceId: params.invoiceId,
        },
        actorUserId: params.userId,
      });

      return { serviceId: params.serviceId, deductedItems };
    });
  }

  public async executeStaffSettlementCreate(params: {
    settlementId?: string;
    businessId: string;
    branchId: string;
    staffId: string;
    staffName: string;
    baseSalaryMMK?: number;
    bonusMMK?: number;
    deductionsMMK?: number;
    notes?: string;
    payImmediately?: boolean;
    userId: string;
    userName: string;
  }): Promise<any> {
    return this.transaction(async () => {
      if (!this.db) throw new Error('DB error');
      const now = new Date().toISOString();
      const settlementId = params.settlementId || `stl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const settlementCode = `STL-${Date.now().toString().slice(-6)}`;

      const ldgStmt = this.db.prepare(`
        SELECT * FROM staff_ledger 
        WHERE staff_id = ? AND business_id = ? AND is_settled = 0
      `);
      ldgStmt.bind([params.staffId, params.businessId]);
      let commissionTotal = 0;
      let advanceTotal = 0;
      const ledgerIdsToSettle: string[] = [];

      while (ldgStmt.step()) {
        const row = ldgStmt.getAsObject();
        ledgerIdsToSettle.push(String(row.id));
        if (row.type === 'commission' || row.type === 'bonus') {
          commissionTotal += Number(row.amount_mmk || 0);
        } else if (row.type === 'advance' || row.type === 'deduction') {
          advanceTotal += Number(row.amount_mmk || 0);
        }
      }
      ldgStmt.free();

      const baseSalary = params.baseSalaryMMK || 0;
      const extraBonus = params.bonusMMK || 0;
      const extraDeductions = (params.deductionsMMK || 0) + advanceTotal;
      const totalEarnings = commissionTotal + baseSalary + extraBonus;
      const netPayout = Math.max(0, totalEarnings - extraDeductions);

      this.db.run(`
        INSERT INTO staff_settlements (
          id, business_id, branch_id, staff_id, settlement_code, total_earnings_mmk, total_deductions_mmk, net_payout_mmk, paid_at, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)
      `, [
        settlementId,
        params.businessId,
        params.branchId,
        params.staffId,
        settlementCode,
        totalEarnings,
        extraDeductions,
        netPayout,
        now,
        params.userName,
      ]);

      for (const id of ledgerIdsToSettle) {
        this.db.run(`UPDATE staff_ledger SET is_settled = 1, settlement_id = ? WHERE id = ?`, [settlementId, id]);
      }

      if (params.payImmediately && netPayout > 0) {
        const cashTxId = `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.db.run(`
          INSERT INTO cash_transactions (
            id, business_id, branch_id, type, category, amount_mmk, reference_type, reference_id, notes, transaction_time, created_by
          ) VALUES (?, ?, ?, 'cash_out', 'staff_settlement_payout', ?, 'settlement', ?, ?, ?, ?)
        `, [
          cashTxId,
          params.businessId,
          params.branchId,
          netPayout,
          settlementId,
          `Payroll payout for ${params.staffName} (${settlementCode})`,
          now,
          params.userName,
        ]);
      }

      this.recordOutboxEvent({
        businessId: params.businessId,
        branchId: params.branchId,
        eventType: 'STAFF_SETTLEMENT_CREATED',
        entityType: 'STAFF_SETTLEMENT',
        entityId: settlementId,
        payload: {
          settlementId,
          settlementCode,
          staffId: params.staffId,
          staffName: params.staffName,
          totalEarnings,
          totalDeductions: extraDeductions,
          netPayout,
          paidAt: now,
        },
        actorUserId: params.userId,
      });

      return {
        settlementId,
        settlementCode,
        staffId: params.staffId,
        totalEarnings,
        totalDeductions: extraDeductions,
        netPayout,
        settledLedgerCount: ledgerIdsToSettle.length,
      };
    });
  }

  // Query methods for Phase 36
  public getStaffAttendance(businessId: string, branchId: string, date?: string, staffId?: string): any[] {
    if (!this.db) return [];
    let query = `SELECT * FROM staff_attendance WHERE business_id = ?`;
    const bindArgs: any[] = [businessId];
    if (date) {
      query += ` AND date = ?`;
      bindArgs.push(date);
    }
    if (staffId) {
      query += ` AND staff_id = ?`;
      bindArgs.push(staffId);
    }
    query += ` ORDER BY date DESC, created_at DESC`;
    const stmt = this.db.prepare(query);
    stmt.bind(bindArgs);
    const results: any[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  public getShiftHandovers(businessId: string, branchId: string, status?: string): any[] {
    if (!this.db) return [];
    let query = `SELECT * FROM shift_handovers WHERE business_id = ? AND branch_id = ?`;
    const bindArgs: any[] = [businessId, branchId];
    if (status) {
      query += ` AND status = ?`;
      bindArgs.push(status);
    }
    query += ` ORDER BY opened_at DESC`;
    const stmt = this.db.prepare(query);
    stmt.bind(bindArgs);
    const results: any[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  public getServiceConsumables(businessId: string, serviceId?: string): any[] {
    if (!this.db) return [];
    let query = `SELECT * FROM service_consumables WHERE business_id = ?`;
    const bindArgs: any[] = [businessId];
    if (serviceId) {
      query += ` AND service_id = ?`;
      bindArgs.push(serviceId);
    }
    query += ` ORDER BY service_name ASC, product_name ASC`;
    const stmt = this.db.prepare(query);
    stmt.bind(bindArgs);
    const results: any[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  public getStockMovements(businessId: string, branchId?: string, productId?: string): any[] {
    if (!this.db) return [];
    let query = `SELECT * FROM stock_movements WHERE business_id = ?`;
    const bindArgs: any[] = [businessId];
    if (branchId) {
      query += ` AND branch_id = ?`;
      bindArgs.push(branchId);
    }
    if (productId) {
      query += ` AND product_id = ?`;
      bindArgs.push(productId);
    }
    query += ` ORDER BY created_at DESC`;
    const stmt = this.db.prepare(query);
    stmt.bind(bindArgs);
    const results: any[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  public getRooms(businessId: string = 'default'): any[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`SELECT * FROM rooms WHERE business_id = ? ORDER BY name ASC`);
    stmt.bind([businessId]);
    const results: any[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  public replaceSetupWizardData(payload: {
    businessId?: string;
    branchId?: string;
    userId?: string;
    userName?: string;
    settings?: any;
    ownerUser?: any;
    staff?: any[];
    rooms?: any[];
    tables?: any[];
    serviceCategories?: any[];
    services?: any[];
    productCategories?: any[];
    products?: any[];
    paymentMethods?: any[];
    expenseCategories?: any[];
    commissionRules?: any[];
  }): Promise<{ backupFile?: string }> {
    if (!this.db) throw new Error('Database uninitialized');
    const db = this.db;

    // Automatically trigger a backup snapshot before destructive replacement
    const backupResult = this.createDefaultBackup();

    return this.transaction(() => {
      const now = new Date().toISOString();
      const bizId = payload.businessId || 'BIZ_SHOP_001';
      const branchId = payload.branchId || 'BR_MAIN';

      // 1. Business Profile
      if (payload.settings) {
        const s = payload.settings;
        db.run(`
          UPDATE businesses 
          SET name = ?, phone = ?, address = ?, updated_at = ? 
          WHERE id = ?
        `, [
          s.shopName || 'Shwe Thiri Lounge',
          s.phone || '',
          s.address || '',
          now,
          bizId,
        ]);
      }

      // 2. Owner User
      if (payload.ownerUser) {
        const u = payload.ownerUser;
        db.run(`
          INSERT OR REPLACE INTO users (id, business_id, branch_id, username, name, role, password_hash, salt, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, 'owner', ?, ?, 1, ?)
        `, [u.id, bizId, branchId, u.username, u.name, u.pinHash || '', u.pinSalt || '', u.createdAt || now]);
      }

      // 3. Staff
      if (payload.staff && Array.isArray(payload.staff)) {
        db.run(`DELETE FROM staff WHERE business_id = ? OR branch_id = ?`, [bizId, branchId]);
        for (const st of payload.staff) {
          db.run(`
            INSERT INTO staff (id, business_id, branch_id, name, role, phone, base_salary_mmk, commission_rate, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
          `, [st.id, bizId, branchId, st.name, st.role || 'Therapist', st.phone || '', st.baseSalaryMMK || 0, st.commissionRate || 0, now]);
        }
      }

      // 4. Rooms
      if (payload.rooms && Array.isArray(payload.rooms)) {
        db.run(`DELETE FROM rooms WHERE business_id = ? OR branch_id = ?`, [bizId, branchId]);
        for (const rm of payload.rooms) {
          db.run(`
            INSERT INTO rooms (id, business_id, branch_id, name, status, hourly_rate_mmk, surcharge_mmk, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)
          `, [rm.id, bizId, branchId, rm.name, rm.status || 'available', rm.hourlyRateMMK || 0, now]);
        }
      }

      // 5. Products
      if (payload.products && Array.isArray(payload.products)) {
        db.run(`DELETE FROM products WHERE business_id = ?`, [bizId]);
        for (const prd of payload.products) {
          db.run(`
            INSERT INTO products (id, business_id, name, sku, price_mmk, cost_mmk, stock_qty, category, is_active, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
          `, [prd.id, bizId, prd.name, prd.sku || prd.id, prd.sellingPriceMMK || 0, prd.costPriceMMK || 0, prd.stockQuantity || 0, prd.category || 'General', now]);
        }
      }

      // Broadcast event
      this.recordOutboxEvent({
        businessId: bizId,
        branchId: branchId,
        eventType: 'SETUP_WIZARD_COMPLETED',
        entityType: 'SYSTEM',
        entityId: 'settings_main',
        payload: {
          timestamp: now,
          shopName: payload.settings?.shopName,
        },
        actorUserId: payload.userId || 'owner',
      });

      return { backupFile: backupResult.fileName };
    });
  }

  // Suppliers
  public getSuppliers(businessId: string = 'BIZ_SHOP_001'): any[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`SELECT * FROM suppliers WHERE business_id = ? ORDER BY name ASC`);
    stmt.bind([businessId]);
    const res: any[] = [];
    while (stmt.step()) res.push(stmt.getAsObject());
    stmt.free();
    return res;
  }

  public saveSupplier(supplier: any): any {
    if (!this.db) throw new Error('Database uninitialized');
    const now = new Date().toISOString();
    this.db.run(`
      INSERT OR REPLACE INTO suppliers (id, business_id, branch_id, name, phone, email, address, contact_person, notes, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      supplier.id || `sup_${Date.now()}`,
      supplier.businessId || 'BIZ_SHOP_001',
      supplier.branchId || 'BR_MAIN',
      supplier.name,
      supplier.phone || '',
      supplier.email || '',
      supplier.address || '',
      supplier.contactPerson || '',
      supplier.notes || '',
      supplier.isActive !== false ? 1 : 0,
      supplier.createdAt || now,
      now,
    ]);
    return supplier;
  }

  // Purchase Orders
  public getPurchaseOrders(businessId: string = 'BIZ_SHOP_001'): any[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`SELECT * FROM purchase_orders WHERE business_id = ? ORDER BY created_at DESC`);
    stmt.bind([businessId]);
    const res: any[] = [];
    while (stmt.step()) {
      const obj: any = stmt.getAsObject();
      if (obj.items_json) {
        try { obj.items = JSON.parse(obj.items_json as string); } catch { obj.items = []; }
      }
      res.push(obj);
    }
    stmt.free();
    return res;
  }

  public recordPurchaseOrder(po: any): Promise<any> {
    return this.transaction(() => {
      if (!this.db) throw new Error('Database uninitialized');
      const now = new Date().toISOString();
      const poId = po.id || `po_${Date.now()}`;
      const itemsJson = JSON.stringify(po.items || []);

      this.db.run(`
        INSERT INTO purchase_orders (id, business_id, branch_id, po_number, supplier_id, supplier_name, items_json, total_amount_mmk, paid_amount_mmk, payment_status, payment_method, order_date, status, notes, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        poId,
        po.businessId || 'BIZ_SHOP_001',
        po.branchId || 'BR_MAIN',
        po.poNumber || `PO-${Date.now()}`,
        po.supplierId,
        po.supplierName,
        itemsJson,
        po.totalAmountMMK || 0,
        po.paidAmountMMK || 0,
        po.paymentStatus || 'paid',
        po.paymentMethod || 'cash',
        now.split('T')[0],
        po.status || 'received',
        po.notes || '',
        po.createdBy || 'owner',
        now,
        now,
      ]);

      if (Array.isArray(po.items)) {
        for (const item of po.items) {
          const prdStmt = this.db.prepare(`SELECT stock_qty, cost_mmk FROM products WHERE id = ?`);
          prdStmt.bind([item.productId]);
          if (prdStmt.step()) {
            const pObj = prdStmt.getAsObject();
            const prev = (pObj.stock_qty as number) || 0;
            const after = prev + (item.quantity || 0);
            this.db.run(`UPDATE products SET stock_qty = ?, cost_mmk = ?, updated_at = ? WHERE id = ?`, [after, item.costPriceMMK || pObj.cost_mmk, now, item.productId]);

            this.db.run(`
              INSERT INTO stock_movements (id, business_id, branch_id, product_id, product_name, type, quantity_change, previous_stock, new_stock, notes, date, created_at, created_by)
              VALUES (?, ?, ?, ?, ?, 'purchase', ?, ?, ?, ?, ?, ?, ?)
            `, [
              `stkmov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              po.businessId || 'BIZ_SHOP_001',
              po.branchId || 'BR_MAIN',
              item.productId,
              item.productName,
              item.quantity || 0,
              prev,
              after,
              `PO: ${po.poNumber} from ${po.supplierName}`,
              now.split('T')[0],
              now,
              po.createdBy || 'owner',
            ]);
          }
          prdStmt.free();
        }
      }

      return { id: poId, ...po };
    });
  }

  // Stock Adjustments
  public getStockAdjustments(businessId: string = 'BIZ_SHOP_001'): any[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`SELECT * FROM stock_adjustments WHERE business_id = ? ORDER BY created_at DESC`);
    stmt.bind([businessId]);
    const res: any[] = [];
    while (stmt.step()) res.push(stmt.getAsObject());
    stmt.free();
    return res;
  }

  public recordStockAdjustment(adj: any): Promise<any> {
    return this.transaction(() => {
      if (!this.db) throw new Error('Database uninitialized');
      const now = new Date().toISOString();
      const adjId = adj.id || `adj_${Date.now()}`;

      const prdStmt = this.db.prepare(`SELECT name, stock_qty FROM products WHERE id = ?`);
      prdStmt.bind([adj.productId]);
      let prevStock = 0;
      let prdName = adj.productName || 'Product';
      if (prdStmt.step()) {
        const pObj = prdStmt.getAsObject();
        prevStock = (pObj.stock_qty as number) || 0;
        prdName = (pObj.name as string) || prdName;
      }
      prdStmt.free();

      const newStock = Math.max(0, prevStock + adj.adjustQty);
      this.db.run(`UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?`, [newStock, now, adj.productId]);

      this.db.run(`
        INSERT INTO stock_adjustments (id, business_id, branch_id, product_id, product_name, before_qty, after_qty, adjust_qty, reason, adjusted_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        adjId,
        adj.businessId || 'BIZ_SHOP_001',
        adj.branchId || 'BR_MAIN',
        adj.productId,
        prdName,
        prevStock,
        newStock,
        adj.adjustQty,
        adj.reason || 'Manual Adjustment',
        adj.adjustedBy || 'owner',
        now,
      ]);

      this.db.run(`
        INSERT INTO stock_movements (id, business_id, branch_id, product_id, product_name, type, quantity_change, previous_stock, new_stock, notes, date, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `stkmov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        adj.businessId || 'BIZ_SHOP_001',
        adj.branchId || 'BR_MAIN',
        adj.productId,
        prdName,
        adj.adjustQty >= 0 ? 'adjustment_in' : 'adjustment_out',
        adj.adjustQty,
        prevStock,
        newStock,
        `Adjustment: ${adj.reason}`,
        now.split('T')[0],
        now,
        adj.adjustedBy || 'owner',
      ]);

      return { id: adjId, ...adj, beforeQty: prevStock, afterQty: newStock };
    });
  }

  // Customer Loyalty Ledger
  public getCustomerLoyaltyEntries(customerId: string): any[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`SELECT * FROM customer_loyalty_ledger WHERE customer_id = ? ORDER BY created_at DESC`);
    stmt.bind([customerId]);
    const res: any[] = [];
    while (stmt.step()) res.push(stmt.getAsObject());
    stmt.free();
    return res;
  }

  public recordLoyaltyPoints(params: any): Promise<any> {
    return this.transaction(() => {
      if (!this.db) throw new Error('Database uninitialized');
      const now = new Date().toISOString();

      const custStmt = this.db.prepare(`SELECT balance_after FROM customer_loyalty_ledger WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1`);
      custStmt.bind([params.customerId]);
      let currentPts = 0;
      if (custStmt.step()) {
        const cObj = custStmt.getAsObject();
        currentPts = (cObj.balance_after as number) || 0;
      }
      custStmt.free();

      const ptsVal = Math.abs(params.points || 0);
      const change = params.type === 'redeem' ? -ptsVal : ptsVal;
      const newBal = Math.max(0, currentPts + change);
      const custName = params.customerName || 'Customer';

      const entryId = `loy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      this.db.run(`
        INSERT INTO customer_loyalty_ledger (id, customer_id, customer_name, points, balance_after, type, reference_type, reference_id, notes, date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        entryId,
        params.customerId,
        custName,
        ptsVal,
        newBal,
        params.type || 'earn',
        params.referenceType || 'manual',
        params.referenceId || '',
        params.notes || '',
        now.split('T')[0],
        now,
      ]);

      return { id: entryId, points: ptsVal, balanceAfter: newBal };
    });
  }

  // Performance Bonus Rules
  public getPerformanceBonusRules(businessId: string = 'BIZ_SHOP_001'): any[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`SELECT * FROM performance_bonus_rules WHERE business_id = ? ORDER BY created_at DESC`);
    stmt.bind([businessId]);
    const res: any[] = [];
    while (stmt.step()) res.push(stmt.getAsObject());
    stmt.free();
    return res;
  }

  public savePerformanceBonusRule(rule: any): any {
    if (!this.db) throw new Error('Database uninitialized');
    const now = new Date().toISOString();
    this.db.run(`
      INSERT OR REPLACE INTO performance_bonus_rules (id, business_id, branch_id, rule_name, min_revenue_mmk, min_sessions, min_attendance_days, bonus_amount_mmk, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      rule.id || `prule_${Date.now()}`,
      rule.businessId || 'BIZ_SHOP_001',
      rule.branchId || 'BR_MAIN',
      rule.ruleName,
      rule.minRevenueMMK || 0,
      rule.minSessions || 0,
      rule.minAttendanceDays || 0,
      rule.bonusAmountMMK || 0,
      rule.isActive !== false ? 1 : 0,
      rule.createdAt || now,
    ]);
    return rule;
  }

  public close(): void {
    this.flushToDisk();
    if (this.db) {
      try {
        this.db.close();
      } catch {}
      this.db = null;
      this.isInitialized = false;
      this.initPromise = null;
    }
  }
}

export const serverStorage = new PersistentSQLiteStorage();
