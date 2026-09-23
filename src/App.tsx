/**
 * Shwe Thiri Spa & KTV Business Management & Accounting ERP (Myanmar)
 * 100% Offline-First Architecture
 * @license Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { db } from './db/database';
import { seedDatabaseIfEmpty } from './db/seedData';
import { hashPin } from './utils/cryptoAuth';
import {
  Room,
  SessionRecord,
  StaffMember,
  StaffLedgerEntry,
  ServiceItem,
  ProductItem,
  Customer,
  CustomerCreditLedger,
  Invoice,
  ExpenseRecord,
  CashClosingRecord,
  AuditLog,
  UserAccount,
  StaffSettlement,
  ShopSettings,
  StaffType,
  TableRecord,
  ServiceCategory,
  ProductCategory,
  PaymentMethodRecord,
  ExpenseCategoryRecord,
  CommissionRuleRecord,
} from './types';
import { Language } from './utils/translations';
import { Navbar, ActiveTab } from './components/Navbar';
import { PINModal } from './components/PINLoginModal';
import { ReceiptModal } from './components/ReceiptModal';
import { LANConnectionModal } from './components/LANConnectionModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { SetupWizardModal } from './components/SetupWizardModal';
import { PWAInstallModal } from './components/PWAInstallModal';
import { syncManager, SyncState } from './services/syncManager';
import { realtimeClient } from './services/realtimeClient';
import { RoomsView } from './components/views/RoomsView';
import { PosView } from './components/views/PosView';
import { StaffView } from './components/views/StaffView';
import { CustomersView } from './components/views/CustomersView';
import { ExpensesView } from './components/views/ExpensesView';
import { SettingsAuditView } from './components/views/SettingsAuditView';
import { MasterDataView } from './components/views/MasterDataView';
import { RecordsView } from './components/views/RecordsView';
import { BookingsView } from './components/views/BookingsView';
import { MembershipsPackagesView } from './components/views/MembershipsPackagesView';
import { BookingRecord } from './types';

export default function App() {
  // Application State
  const [activeTab, setActiveTab] = useState<ActiveTab>('rooms');
  const [lang, setLang] = useState<Language>('my');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Database collections
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLedger, setStaffLedger] = useState<StaffLedgerEntry[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creditLedger, setCreditLedger] = useState<CustomerCreditLedger[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [closings, setClosings] = useState<CashClosingRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [settlements, setSettlements] = useState<StaffSettlement[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);

  // Master Data collections
  const [staffTypes, setStaffTypes] = useState<StaffType[]>([]);
  const [tables, setTables] = useState<TableRecord[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRecord[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryRecord[]>([]);
  const [commissionRules, setCommissionRules] = useState<CommissionRuleRecord[]>([]);

  // Active Session & User
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isPINModalOpen, setIsPINModalOpen] = useState<boolean>(false);
  const [isLANModalOpen, setIsLANModalOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState<boolean>(false);
  const [isPWAModalOpen, setIsPWAModalOpen] = useState<boolean>(false);
  const [activeInvoiceReceipt, setActiveInvoiceReceipt] = useState<Invoice | null>(null);

  // Sync Transport State
  const [syncState, setSyncState] = useState<SyncState>('LOCAL_ONLY');
  const [syncMessage, setSyncMessage] = useState<string>('');

  // Load all tables from IndexedDB
  const refreshData = useCallback(async () => {
    try {
      const [
        rmList,
        sessList,
        stfList,
        stfLedgerList,
        srvList,
        prodList,
        custList,
        credLedgerList,
        invList,
        expList,
        closeList,
        bkgList,
        auditList,
        userList,
        settleList,
        shopSettingsList,
        stfTypeList,
        tblList,
        srvCatList,
        prodCatList,
        payMethodList,
        expCatList,
        commRuleList,
      ] = await Promise.all([
        db.rooms.toArray(),
        db.sessions.reverse().toArray(),
        db.staff.toArray(),
        db.staffLedger.reverse().toArray(),
        db.services.toArray(),
        db.products.toArray(),
        db.customers.toArray(),
        db.customerCreditLedger.reverse().toArray(),
        db.invoices.reverse().toArray(),
        db.expenses.reverse().toArray(),
        db.cashClosings.reverse().toArray(),
        db.bookings.reverse().toArray(),
        db.auditLogs.reverse().toArray(),
        db.users.toArray(),
        db.staffSettlements.reverse().toArray(),
        db.settings.toArray(),
        db.staffTypes.toArray(),
        db.diningTables.toArray(),
        db.serviceCategories.toArray(),
        db.productCategories.toArray(),
        db.paymentMethods.toArray(),
        db.expenseCategoriesMaster.toArray(),
        db.commissionRulesMaster.toArray(),
      ]);

      setRooms(rmList);
      setSessions(sessList);
      setStaff(stfList);
      setStaffLedger(stfLedgerList);
      setServices(srvList);
      setProducts(prodList);
      setCustomers(custList);
      setCreditLedger(credLedgerList);
      setInvoices(invList);
      setExpenses(expList);
      setClosings(closeList);
      setBookings(bkgList);
      setAuditLogs(auditList);
      setUsers(userList);
      setSettlements(settleList);
      setSettings(shopSettingsList[0] || null);

      setStaffTypes(stfTypeList);
      setTables(tblList);
      setServiceCategories(srvCatList);
      setProductCategories(prodCatList);
      setPaymentMethods(payMethodList);
      setExpenseCategories(expCatList);
      setCommissionRules(commRuleList);

      // Default user to Cashier or Owner if none selected
      if (userList.length > 0) {
        setCurrentUser(prev => prev || userList.find((u: UserAccount) => u.role === 'cashier') || userList[0]);
      }
    } catch (err) {
      console.error('Error loading database tables:', err);
    }
  }, []);

  // Initial App Mount & Sync Transport Wiring
  useEffect(() => {
    let isMounted = true;
    async function init() {
      setIsLoading(true);
      try {
        await seedDatabaseIfEmpty();
        await db.migratePlaintextPinsToSaltedHashes();
        await refreshData();
      } catch (err) {
        console.error('Error during initial mount:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    init();

    // Start Sync Transport Manager
    syncManager.start();

    // Sync State Listener
    const unsubscribeState = syncManager.onStateChange((state, details) => {
      if (isMounted) {
        setSyncState(state);
        setSyncMessage(details?.message || '');
      }
    });

    // Realtime Events Listener for Multi-device Instant UI Refresh
    const unsubscribeRealtime = realtimeClient.onEvent(() => {
      if (isMounted) {
        refreshData();
      }
    });

    return () => {
      isMounted = false;
      unsubscribeState();
      unsubscribeRealtime();
      syncManager.stop();
    };
  }, [refreshData]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07090e] text-white">
        <div className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 font-bold text-2xl flex items-center justify-center text-white shadow-lg neon-glow-cyan animate-pulse">
            ရွှေ
          </div>
          <h2 className="text-lg font-bold tracking-wide text-cyan-300">ရွှေသီရိ စီမံခန့်ခွဲမှုစနစ်ကို စတင်နေပါသည်...</h2>
          <p className="text-xs text-slate-400">Loading Neon Night POS & Offline DB...</p>
        </div>
      </div>
    );
  }

  const fallbackHash = hashPin('0000', 'salt_fallback_cashier');
  // Active authenticated user fallback
  const effectiveUser: UserAccount = currentUser || {
    id: 'usr_cashier',
    name: 'Daw Khin Khin (ငွေကိုင်)',
    username: 'daw_khin_khin',
    role: 'cashier',
    pinHash: fallbackHash.pinHash,
    pinSalt: fallbackHash.pinSalt,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        onOpenPINModal={() => setIsPINModalOpen(true)}
        lang={lang}
        onToggleLang={() => setLang(l => (l === 'my' ? 'en' : 'my'))}
        settings={settings}
        onOpenLANModal={() => setIsLANModalOpen(true)}
        onOpenSearchModal={() => setIsSearchModalOpen(true)}
        onOpenSetupWizard={() => {
          if (effectiveUser.role !== 'owner') {
            alert(lang === 'my' ? 'ဆိုင်ရှင် (Owner) သာလျှင် စနစ်ပြင်ဆင်ခြင်း ပြုလုပ်နိုင်ပါသည်' : 'Only Shop Owner can access Setup Wizard');
            return;
          }
          setIsSetupWizardOpen(true);
        }}
        onOpenPWAModal={() => setIsPWAModalOpen(true)}
        syncState={syncState}
        syncMessage={syncMessage}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'rooms' && (
          <RoomsView
            rooms={rooms}
            sessions={sessions}
            staff={staff}
            services={services}
            products={products}
            customers={customers}
            currentUser={effectiveUser}
            lang={lang}
            onRefresh={refreshData}
            onShowReceipt={inv => setActiveInvoiceReceipt(inv)}
          />
        )}

        {activeTab === 'bookings' && (
          <BookingsView
            bookings={bookings}
            rooms={rooms}
            staff={staff}
            services={services}
            customers={customers}
            currentUser={effectiveUser}
            lang={lang}
            onRefreshData={refreshData}
            onNavigateToRoom={(roomId) => {
              setActiveTab('rooms');
            }}
          />
        )}

        {activeTab === 'pos' && (
          <PosView
            products={products}
            services={services}
            rooms={rooms}
            sessions={sessions}
            staff={staff}
            customers={customers}
            invoices={invoices}
            settings={settings}
            currentUser={effectiveUser}
            lang={lang}
            onRefresh={refreshData}
            onShowReceipt={inv => setActiveInvoiceReceipt(inv)}
          />
        )}

        {activeTab === 'memberships' && (
          <MembershipsPackagesView
            currentUser={effectiveUser}
            customers={customers}
            services={services}
            staff={staff}
            lang={lang}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'staff' && (
          <StaffView
            staff={staff}
            staffLedger={staffLedger}
            settlements={settlements}
            currentUser={effectiveUser}
            lang={lang}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersView
            customers={customers}
            creditLedger={creditLedger}
            currentUser={effectiveUser}
            lang={lang}
            onRefresh={refreshData}
            bookings={bookings}
            sessions={sessions}
            invoices={invoices}
            services={services}
            staff={staff}
            rooms={rooms}
            onNavigateToTab={(tab: string) => setActiveTab(tab as any)}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesView
            expenses={expenses}
            currentUser={effectiveUser}
            lang={lang}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'records' && (
          <RecordsView
            closings={closings}
            invoices={invoices}
            expenses={expenses}
            staffLedger={staffLedger}
            settlements={settlements}
            creditLedger={creditLedger}
            settings={settings}
            currentUser={effectiveUser}
            lang={lang}
            onRefresh={refreshData}
            staff={staff}
            sessions={sessions}
            customers={customers}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsAuditView
            users={users}
            auditLogs={auditLogs}
            settings={settings}
            currentUser={effectiveUser}
            lang={lang}
            onRefresh={refreshData}
            staff={staff}
            staffTypes={staffTypes}
            rooms={rooms}
            tables={tables}
            services={services}
            serviceCategories={serviceCategories}
            products={products}
            productCategories={productCategories}
            customers={customers}
            paymentMethods={paymentMethods}
            expenseCategories={expenseCategories}
            commissionRules={commissionRules}
          />
        )}
      </main>

      {/* Global Modals */}
      {isPINModalOpen && (
        <PINModal
          users={users}
          currentUser={currentUser}
          onSelectUser={user => setCurrentUser(user)}
          onClose={() => setIsPINModalOpen(false)}
        />
      )}

      {activeInvoiceReceipt && (
        <ReceiptModal
          invoice={activeInvoiceReceipt}
          settings={settings}
          onClose={() => setActiveInvoiceReceipt(null)}
          lang={lang}
        />
      )}

      <LANConnectionModal
        isOpen={isLANModalOpen}
        onClose={() => setIsLANModalOpen(false)}
        lang={lang}
      />

      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        customers={customers}
        invoices={invoices}
        staff={staff}
        lang={lang}
        onSelectInvoice={inv => setActiveInvoiceReceipt(inv)}
      />

      {isSetupWizardOpen && (
        <SetupWizardModal
          currentUser={effectiveUser}
          lang={lang}
          onCompleted={async (newOwnerUser) => {
            await refreshData();
            if (newOwnerUser) {
              setCurrentUser(newOwnerUser);
            }
            setIsSetupWizardOpen(false);
            setActiveTab('rooms');
          }}
          onClose={() => setIsSetupWizardOpen(false)}
        />
      )}

      <PWAInstallModal
        lang={lang}
        isOpenManual={isPWAModalOpen}
        onCloseManual={() => setIsPWAModalOpen(false)}
      />
    </div>
  );
}
