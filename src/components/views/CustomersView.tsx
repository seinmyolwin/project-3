import React, { useState, useEffect, useCallback } from 'react';
import {
  Customer,
  CustomerCreditLedger,
  CustomerLedgerEntry,
  UserAccount,
  PaymentMethod,
  CustomerMembership,
  CustomerPackage,
  GiftCard,
  CustomerServiceNote,
  CustomerServiceHistoryItem,
  Booking,
  Session,
  Invoice,
  ServiceItem,
  Staff,
  Room,
} from '../../types';
import { db } from '../../db/database';
import { formatMMK, deriveCustomerLedgerBalances, calculateCustomerAgingReport } from '../../domain/financial';
import { Language } from '../../utils/translations';
import { CustomerRebookModal } from '../customers/CustomerRebookModal';
import { CustomerEditModal } from '../customers/CustomerEditModal';
import { CustomerNoteModal } from '../customers/CustomerNoteModal';
import { CustomerPreferencesTab } from '../customers/CustomerPreferencesTab';
import { CustomerNotesTab } from '../customers/CustomerNotesTab';
import { CustomerServiceHistoryTab } from '../customers/CustomerServiceHistoryTab';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  X,
  RotateCcw,
  SlidersHorizontal,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Package,
  Gift,
  Phone,
  User,
  Calendar,
  Clock,
  CreditCard,
  Edit2,
  FileText,
  Heart,
  Scissors,
  DollarSign,
  TrendingUp,
  Receipt,
  Copy,
  Check,
} from 'lucide-react';

interface CustomersViewProps {
  customers: Customer[];
  creditLedger: (CustomerCreditLedger | CustomerLedgerEntry)[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
  bookings?: Booking[];
  sessions?: Session[];
  invoices?: Invoice[];
  services?: ServiceItem[];
  staff?: Staff[];
  rooms?: Room[];
  onNavigateToTab?: (tab: string) => void;
}

type Customer360Tab =
  | 'service_history'
  | 'notes'
  | 'preferences'
  | 'bookings'
  | 'invoices'
  | 'ledger'
  | 'packages';

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  creditLedger,
  currentUser,
  lang,
  onRefresh,
  bookings: propBookings,
  sessions: propSessions,
  invoices: propInvoices,
  services: propServices,
  staff: propStaff,
  rooms: propRooms,
  onNavigateToTab,
}) => {
  const isMm = lang === 'my';

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'has_debt' | 'no_debt' | 'limit_exceeded'>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [activeTab, setActiveTab] = useState<Customer360Tab>('service_history');

  // Master collections fallback if not in props
  const [servicesList, setServicesList] = useState<ServiceItem[]>(propServices || []);
  const [staffList, setStaffList] = useState<Staff[]>(propStaff || []);
  const [roomsList, setRoomsList] = useState<Room[]>(propRooms || []);

  // Customer 360 Records
  const [serviceHistory, setServiceHistory] = useState<CustomerServiceHistoryItem[]>([]);
  const [customerNotes, setCustomerNotes] = useState<CustomerServiceNote[]>([]);
  const [custMemberships, setCustMemberships] = useState<CustomerMembership[]>([]);
  const [custPackages, setCustPackages] = useState<CustomerPackage[]>([]);
  const [custGiftCards, setCustGiftCards] = useState<GiftCard[]>([]);
  const [customerBookings, setCustomerBookings] = useState<Booking[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);

  // Modals
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isRebookOpen, setIsRebookOpen] = useState(false);
  const [rebookPrefill, setRebookPrefill] = useState<any>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [activeNoteToEdit, setActiveNoteToEdit] = useState<CustomerServiceNote | null>(null);
  const [noteLinkContext, setNoteLinkContext] = useState<any>(null);

  // Repay Modal
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [repayPaymentMethod, setRepayPaymentMethod] = useState<PaymentMethod>('cash');
  const [repayNotes, setRepayNotes] = useState<string>('');

  // Adjustment Modal
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'adjustment_debit' | 'adjustment_credit'>('adjustment_credit');
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [adjustmentNotes, setAdjustmentNotes] = useState<string>('');

  // Reversal Modal
  const [reversalTargetEntry, setReversalTargetEntry] = useState<CustomerLedgerEntry | CustomerCreditLedger | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');

  // Add Customer Form
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustLimit, setNewCustLimit] = useState(1000000);
  const [newCustCreditAllowed, setNewCustCreditAllowed] = useState(true);

  const [copiedPhone, setCopiedPhone] = useState(false);

  // Overall KPIs
  const totalOutstandingAllMMK = customers.reduce((sum, c) => sum + (c.currentBalanceMMK || 0), 0);
  const totalCreditLimitAllMMK = customers.reduce((sum, c) => sum + (c.creditLimitMMK || 0), 0);
  const customersWithDebtCount = customers.filter(c => (c.currentBalanceMMK || 0) > 0).length;

  // Sync prop changes
  useEffect(() => {
    if (propServices) setServicesList(propServices);
    else db.services.toArray().then(setServicesList);

    if (propStaff) setStaffList(propStaff);
    else db.staff.toArray().then(setStaffList);

    if (propRooms) setRoomsList(propRooms);
    else db.rooms.toArray().then(setRoomsList);
  }, [propServices, propStaff, propRooms]);

  // Filtered customers (Search by Name, Phone, and Customer ID)
  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      c.id.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (filterStatus === 'has_debt') return (c.currentBalanceMMK || 0) > 0;
    if (filterStatus === 'no_debt') return (c.currentBalanceMMK || 0) === 0;
    if (filterStatus === 'limit_exceeded') return c.creditLimitMMK > 0 && (c.currentBalanceMMK || 0) > c.creditLimitMMK;
    return true;
  });

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];

  const customerLedgerHistory = creditLedger
    .filter(e => e.customerId === selectedCustomer?.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const selectedDerivedBalances = deriveCustomerLedgerBalances(customerLedgerHistory);

  const agingReport = selectedCustomer
    ? calculateCustomerAgingReport({
        customers: [selectedCustomer],
        ledgerEntries: creditLedger,
      }).customerBreakdowns[0]
    : null;

  // Load customer specific profile data
  const loadCustomerData = useCallback(async () => {
    if (!selectedCustomer?.id) return;
    try {
      const [hist, notes, mems, pkgs, gcs, bkgs, invs] = await Promise.all([
        db.getCustomerServiceHistory(selectedCustomer.id),
        db.customerServiceNotes.where('customerId').equals(selectedCustomer.id).reverse().sortBy('createdAt'),
        db.customerMemberships.where('customerId').equals(selectedCustomer.id).toArray(),
        db.customerPackages.where('customerId').equals(selectedCustomer.id).toArray(),
        db.giftCards.where('customerId').equals(selectedCustomer.id).toArray(),
        db.bookings.where('customerId').equals(selectedCustomer.id).reverse().sortBy('date'),
        db.invoices.where('customerId').equals(selectedCustomer.id).reverse().sortBy('createdAt'),
      ]);

      setServiceHistory(hist);
      setCustomerNotes(notes);
      setCustMemberships(mems);
      setCustPackages(pkgs);
      setCustGiftCards(gcs);
      setCustomerBookings(bkgs);
      setCustomerInvoices(invs);
    } catch (err) {
      console.error('Error loading customer 360 data:', err);
    }
  }, [selectedCustomer?.id]);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  // Rebooking trigger
  const handleOpenRebook = (item: CustomerServiceHistoryItem) => {
    setRebookPrefill({
      id: item.serviceId,
      name: item.serviceName,
      staffId: item.staffId,
      staffName: item.staffName,
      durationMinutes: item.durationMinutes,
    });
    setIsRebookOpen(true);
  };

  // Note triggers
  const handleOpenAddNote = (context?: any) => {
    setActiveNoteToEdit(null);
    setNoteLinkContext(context || null);
    setIsNoteModalOpen(true);
  };

  const handleOpenEditNote = (note: CustomerServiceNote) => {
    setActiveNoteToEdit(note);
    setNoteLinkContext(null);
    setIsNoteModalOpen(true);
  };

  // Add Customer
  const handleAddCustomer = async () => {
    if (!newCustName.trim()) return;
    try {
      const newCust: Customer = {
        id: 'cust_' + Date.now(),
        name: newCustName.trim(),
        phone: newCustPhone.trim() || '09-xxxxxxxxx',
        creditLimitMMK: newCustLimit || 500000,
        creditAllowed: newCustCreditAllowed,
        currentBalanceMMK: 0,
        createdAt: new Date().toISOString(),
      };
      await db.customers.add(newCust);
      setIsAddCustomerOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      onRefresh();
      setSelectedCustomerId(newCust.id);
    } catch (err: any) {
      alert('Error creating customer: ' + err.message);
    }
  };

  // Repayment
  const handleRepay = async () => {
    if (!selectedCustomer || repayAmount <= 0) return;
    try {
      await db.recordCustomerCreditRepaymentTransaction({
        customerId: selectedCustomer.id,
        amountMMK: repayAmount,
        paymentMethod: repayPaymentMethod,
        notes: repayNotes,
        currentUser: { id: currentUser.id, name: currentUser.name, role: currentUser.role },
      });
      setIsRepayModalOpen(false);
      setRepayAmount(0);
      setRepayNotes('');
      onRefresh();
      loadCustomerData();
    } catch (err: any) {
      alert('Repayment failed: ' + err.message);
    }
  };

  // Adjustment
  const handleAdjustment = async () => {
    if (!selectedCustomer || adjustmentAmount <= 0) return;
    try {
      await db.recordCustomerCreditAdjustmentTransaction({
        customerId: selectedCustomer.id,
        amountMMK: adjustmentAmount,
        type: adjustmentType,
        notes: adjustmentNotes,
        currentUser: { id: currentUser.id, name: currentUser.name, role: currentUser.role },
      });
      setIsAdjustmentModalOpen(false);
      setAdjustmentAmount(0);
      setAdjustmentNotes('');
      onRefresh();
      loadCustomerData();
    } catch (err: any) {
      alert('Adjustment failed: ' + err.message);
    }
  };

  // Reversal
  const handleReversal = async () => {
    if (!reversalTargetEntry || !reversalReason.trim()) return;
    try {
      await db.reverseCustomerLedgerEntryTransaction({
        entryId: reversalTargetEntry.id,
        reason: reversalReason.trim(),
        currentUser: { id: currentUser.id, name: currentUser.name, role: currentUser.role },
      });
      setReversalTargetEntry(null);
      setReversalReason('');
      onRefresh();
      loadCustomerData();
    } catch (err: any) {
      alert('Reversal failed: ' + err.message);
    }
  };

  // Copy phone helper
  const handleCopyPhone = (phone: string) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Computed Customer 360 KPIs
  const totalCompletedServices = serviceHistory.filter(s => s.status === 'completed' || s.status === 'paid').length;
  const totalLifetimeSpendMMK = serviceHistory
    .filter(s => s.status === 'completed' || s.status === 'paid')
    .reduce((sum, s) => sum + s.amountMMK, 0);

  const activeMembership = custMemberships.find(m => m.status === 'active' && new Date(m.expiryDate) >= new Date());
  const totalPackageSessionsRemaining = custPackages.reduce((sum, p) => sum + (p.remainingQty || 0), 0);
  const totalGiftCardBalanceMMK = custGiftCards
    .filter(g => g.status === 'active')
    .reduce((sum, g) => sum + (g.currentBalanceMMK || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Overall KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-rose-200/80 bg-linear-to-br from-rose-50 to-white p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 block">
            {isMm ? 'စုစုပေါင်း ဖောက်သည် အကြွေးကျန်ငွေ' : 'Total Outstanding Customer Debt'}
          </span>
          <p className="mt-1 text-2xl font-black text-rose-950 font-mono">
            {formatMMK(totalOutstandingAllMMK)}
          </p>
          <p className="mt-1 text-xs text-rose-600 font-medium">
            {customersWithDebtCount} {isMm ? 'ဦး အကြွေးကျန်ရှိသည်' : 'customers currently owe money'}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200/80 bg-linear-to-br from-blue-50 to-white p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
            {isMm ? 'စုစုပေါင်း ခွင့်ပြု အကြွေးပမာဏ' : 'Total Customer Credit Limit'}
          </span>
          <p className="mt-1 text-2xl font-black text-blue-950 font-mono">
            {formatMMK(totalCreditLimitAllMMK)}
          </p>
          <p className="mt-1 text-xs text-blue-600 font-medium">
            {Math.round((totalOutstandingAllMMK / Math.max(1, totalCreditLimitAllMMK)) * 100)}% {isMm ? 'အသုံးချထားသည်' : 'overall utilization rate'}
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
              {isMm ? 'ဖောက်သည် ဦးရေ စုစုပေါင်း' : 'Total Registered Customers'}
            </span>
            <p className="mt-1 text-2xl font-black text-gray-900 font-mono">
              {customers.length}
            </p>
          </div>
          <button
            onClick={() => setIsAddCustomerOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{isMm ? 'ဖောက်သည် အသစ်ဖွင့်ရန်' : 'Register Customer'}</span>
          </button>
        </div>
      </div>

      {/* Main Workspace: Left Customer List, Right Customer 360 Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Customer List Pane (4 Cols) */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
            {/* Search Input (Fast Tablet Search by Name, Phone, ID) */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isMm ? 'အမည်၊ ဖုန်း၊ ID ဖြင့် ရှာရန်...' : 'Search name, phone, or ID...'}
                className="w-full rounded-xl border border-gray-200 pl-9 pr-8 py-2 text-xs font-medium text-gray-900 focus:border-blue-500 focus:outline-hidden bg-gray-50/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Quick Status Filter Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-2 text-[11px] font-bold">
              {[
                { id: 'all', label: isMm ? 'အားလုံး' : 'All' },
                { id: 'has_debt', label: isMm ? 'အကြွေးကျန်' : 'Owes' },
                { id: 'no_debt', label: isMm ? 'ရှင်းပြီး' : 'Clear' },
                { id: 'limit_exceeded', label: isMm ? 'ကျော်လွန်' : 'Over Limit' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id as any)}
                  className={`rounded-lg px-2.5 py-1 whitespace-nowrap transition-colors ${
                    filterStatus === f.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Customer List */}
            <div className="mt-3 divide-y divide-gray-100 max-h-[640px] overflow-y-auto pr-1">
              {filteredCustomers.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  {isMm ? 'ကိုက်ညီသော ဖောက်သည် မတွေ့ပါ' : 'No matching customers found'}
                </div>
              ) : (
                filteredCustomers.map(c => {
                  const isSelected = c.id === selectedCustomer?.id;
                  const owes = (c.currentBalanceMMK || 0) > 0;
                  const isOver = c.creditLimitMMK > 0 && (c.currentBalanceMMK || 0) > c.creditLimitMMK;

                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className={`w-full text-left p-3 rounded-xl transition-all ${
                        isSelected
                          ? 'bg-blue-50/80 border border-blue-200 shadow-xs'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-xs text-gray-900">{c.name}</p>
                          <p className="text-[11px] text-gray-500 font-mono">{c.phone || 'No phone'}</p>
                          <span className="text-[10px] text-gray-400 font-mono">ID: {c.id}</span>
                        </div>

                        <div className="text-right">
                          <p
                            className={`font-mono text-xs font-bold ${
                              owes ? 'text-rose-600' : 'text-gray-400'
                            }`}
                          >
                            {formatMMK(c.currentBalanceMMK || 0)}
                          </p>
                          {isOver && (
                            <span className="inline-block mt-0.5 rounded-sm bg-rose-100 px-1 py-0.2 text-[9px] font-bold text-rose-700">
                              LIMIT EXCEEDED
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Customer 360 Workspace (8 Cols) */}
        <div className="space-y-4 lg:col-span-8">
          {selectedCustomer ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-5">
              {/* Profile Header Card */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-gray-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-black text-gray-900">{selectedCustomer.name}</h2>
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-mono text-gray-600 border border-gray-200">
                      ID: {selectedCustomer.id}
                    </span>
                    {selectedCustomer.creditAllowed ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Credit Allowed</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                        <ShieldAlert className="h-3 w-3" />
                        <span>Credit Suspended</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-600 pt-0.5">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Phone className="h-3.5 w-3.5 text-gray-400" />
                      <span>{selectedCustomer.phone || 'No phone recorded'}</span>
                      {selectedCustomer.phone && (
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(selectedCustomer.phone)}
                          className="text-gray-400 hover:text-gray-600"
                          title="Copy phone"
                        >
                          {copiedPhone ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 font-mono text-gray-400">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        Member since: {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setIsEditCustomerOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                    <span>{isMm ? 'ပြင်ဆင်ရန်' : 'Edit Profile'}</span>
                  </button>

                  <button
                    onClick={() => setIsRepayModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                  >
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                    <span>{isMm ? 'ကြွေးဆပ်ငွေသွင်း' : 'Repay'}</span>
                  </button>

                  <button
                    onClick={() => setIsAdjustmentModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-gray-600" />
                    <span>{isMm ? 'ချိန်ညှိချက်' : 'Adjust'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenAddNote()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-purple-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{isMm ? 'မှတ်စုရေးမည်' : '+ Note'}</span>
                  </button>
                </div>
              </div>

              {/* 360 Quick Stats Row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                    {isMm ? 'လာရောက်မှု' : 'Total Visits'}
                  </span>
                  <p className="mt-1 text-base font-black text-gray-900 font-mono">
                    {totalCompletedServices}
                  </p>
                  <span className="text-[10px] text-gray-400">services completed</span>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                    {isMm ? 'စုစုပေါင်း သုံးစွဲမှု' : 'Lifetime Spend'}
                  </span>
                  <p className="mt-1 text-base font-black text-emerald-900 font-mono truncate">
                    {formatMMK(totalLifetimeSpendMMK)}
                  </p>
                  <span className="text-[10px] text-gray-400">all completed</span>
                </div>

                <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                    {isMm ? 'အကြွေးကျန်ငွေ' : 'Debt Balance'}
                  </span>
                  <p className="mt-1 text-base font-black text-rose-950 font-mono">
                    {formatMMK(selectedCustomer.currentBalanceMMK || 0)}
                  </p>
                  <span className="text-[10px] text-rose-600">
                    Limit: {formatMMK(selectedCustomer.creditLimitMMK || 0)}
                  </span>
                </div>

                <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                    {isMm ? 'အသင်းဝင် ကတ်' : 'Membership'}
                  </span>
                  <p className="mt-1 text-sm font-black text-purple-950 truncate">
                    {activeMembership ? activeMembership.planName : (isMm ? 'မရှိသေးပါ' : 'None')}
                  </p>
                  <span className="text-[10px] text-purple-600">
                    {activeMembership ? `${activeMembership.discountPercent}% off` : 'Standard'}
                  </span>
                </div>

                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                    {isMm ? 'ပက်ကေ့ချ် လက်ကျန်' : 'Packages'}
                  </span>
                  <p className="mt-1 text-base font-black text-amber-950 font-mono">
                    {totalPackageSessionsRemaining}
                  </p>
                  <span className="text-[10px] text-amber-600">sessions left</span>
                </div>

                <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">
                    {isMm ? 'လက်ဆောင်ကတ်' : 'Gift Card'}
                  </span>
                  <p className="mt-1 text-base font-black text-teal-950 font-mono truncate">
                    {formatMMK(totalGiftCardBalanceMMK)}
                  </p>
                  <span className="text-[10px] text-teal-600">
                    {custGiftCards.filter(g => g.status === 'active').length} active cards
                  </span>
                </div>
              </div>

              {/* 360 Workspace Tabs */}
              <div className="flex border-b border-gray-200 overflow-x-auto gap-1">
                {[
                  { id: 'service_history', label: isMm ? 'ဝန်ဆောင်မှု မှတ်တမ်း' : 'Service History', icon: Scissors, count: serviceHistory.length },
                  { id: 'notes', label: isMm ? 'မှတ်စု & ကုသမှု' : 'Notes & Observations', icon: FileText, count: customerNotes.length },
                  { id: 'preferences', label: isMm ? 'နှစ်သက်မှု ပရိုဖိုင်' : 'Preferences', icon: Heart },
                  { id: 'bookings', label: isMm ? 'ရက်ချိန်းများ' : 'Bookings', icon: Calendar, count: customerBookings.length },
                  { id: 'invoices', label: isMm ? 'ဘောက်ချာများ' : 'Invoices', icon: Receipt, count: customerInvoices.length },
                  { id: 'ledger', label: isMm ? 'အကြွေးစာရင်း' : 'Credit Ledger', icon: DollarSign, count: customerLedgerHistory.length },
                  { id: 'packages', label: isMm ? 'ပက်ကေ့ချ် & ကတ်' : 'Packages & Cards', icon: Package, count: custPackages.length + custMemberships.length + custGiftCards.length },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                        isActive
                          ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                          : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-200'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{tab.label}</span>
                      {tab.count !== undefined && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                            isActive ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content Display */}
              <div className="pt-2">
                {/* 1. Service History Tab */}
                {activeTab === 'service_history' && (
                  <CustomerServiceHistoryTab
                    customer={selectedCustomer}
                    history={serviceHistory}
                    lang={lang}
                    onOpenRebook={handleOpenRebook}
                    onOpenAddNote={handleOpenAddNote}
                  />
                )}

                {/* 2. Structured Notes Tab */}
                {activeTab === 'notes' && (
                  <CustomerNotesTab
                    customer={selectedCustomer}
                    notes={customerNotes}
                    currentUser={currentUser}
                    lang={lang}
                    onOpenAddNote={handleOpenAddNote}
                    onOpenEditNote={handleOpenEditNote}
                    onRefresh={loadCustomerData}
                  />
                )}

                {/* 3. Customer Preferences Profile Tab */}
                {activeTab === 'preferences' && (
                  <CustomerPreferencesTab
                    customer={selectedCustomer}
                    staff={staffList}
                    currentUser={currentUser}
                    lang={lang}
                    onUpdated={() => {
                      onRefresh();
                      loadCustomerData();
                    }}
                  />
                )}

                {/* 4. Bookings & Appointments */}
                {activeTab === 'bookings' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <h4 className="text-sm font-bold text-gray-900">
                        {isMm ? 'ဖောက်သည်၏ ရက်ချိန်းများ' : 'Customer Bookings'}
                      </h4>
                      <button
                        onClick={() => {
                          setRebookPrefill(null);
                          setIsRebookOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{isMm ? 'ရက်ချိန်း အသစ်ယူမည်' : 'New Booking'}</span>
                      </button>
                    </div>

                    {customerBookings.length === 0 ? (
                      <p className="text-xs text-gray-400 py-6 text-center">
                        {isMm ? 'ရက်ချိန်း မှတ်တမ်း မရှိသေးပါ' : 'No bookings found for this customer.'}
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                        {customerBookings.map(b => (
                          <div key={b.id} className="p-3 flex items-center justify-between hover:bg-gray-50 text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900">{b.serviceName}</span>
                                <span className="rounded-sm bg-gray-100 px-1.5 py-0.2 text-[10px] font-mono text-gray-600 uppercase">
                                  {b.status}
                                </span>
                              </div>
                              <p className="text-gray-500">
                                {b.date} • {b.startTime} - {b.endTime} ({b.durationMinutes}m)
                                {b.staffName && ` • Staff: ${b.staffName}`}
                                {b.roomName && ` • Room: ${b.roomName}`}
                              </p>
                            </div>
                            <span className="font-mono text-gray-400 text-[11px]">{b.id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Invoices & Payments */}
                {activeTab === 'invoices' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                      {isMm ? 'ဖောက်သည် ဝယ်ယူခဲ့သော ဘောက်ချာများ' : 'Invoice History'}
                    </h4>
                    {customerInvoices.length === 0 ? (
                      <p className="text-xs text-gray-400 py-6 text-center">
                        {isMm ? 'ဘောက်ချာ မှတ်တမ်း မရှိသေးပါ' : 'No invoices found for this customer.'}
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                        {customerInvoices.map(inv => (
                          <div key={inv.id} className="p-3 flex items-center justify-between hover:bg-gray-50 text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold font-mono text-gray-900">
                                  #{inv.invoiceCode || inv.billNumber || inv.id}
                                </span>
                                <span className="text-gray-500 font-mono">
                                  {new Date(inv.createdAt).toLocaleDateString()}
                                </span>
                                <span className="rounded-sm bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800 uppercase">
                                  {inv.status}
                                </span>
                              </div>
                              <p className="text-gray-600">
                                Items: {inv.items.map(i => i.description).join(', ')}
                              </p>
                            </div>
                            <div className="text-right font-mono">
                              <p className="font-bold text-gray-900">{formatMMK(inv.totalMMK)}</p>
                              <p className="text-[11px] text-gray-400">
                                Paid: {formatMMK(inv.paidAmountMMK || 0)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Financial Ledger & Aging Tab */}
                {activeTab === 'ledger' && (
                  <div className="space-y-5">
                    {/* Aging summary */}
                    {agingReport && (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
                          {isMm ? 'အကြွေး သက်တမ်း ခွဲခြမ်းစိတ်ဖြာမှု (Aging Analysis)' : 'Debt Aging Analysis'}
                        </span>
                        <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                          <div className="rounded-xl border border-gray-200 bg-white p-2">
                            <span className="text-[10px] text-gray-500 block">0-30 Days</span>
                            <strong className="text-gray-900">{formatMMK(agingReport.bucket0to30MMK)}</strong>
                          </div>
                          <div className="rounded-xl border border-gray-200 bg-white p-2">
                            <span className="text-[10px] text-amber-600 block">31-60 Days</span>
                            <strong className="text-amber-900">{formatMMK(agingReport.bucket31to60MMK)}</strong>
                          </div>
                          <div className="rounded-xl border border-gray-200 bg-white p-2">
                            <span className="text-[10px] text-orange-600 block">61-90 Days</span>
                            <strong className="text-orange-900">{formatMMK(agingReport.bucket61to90MMK)}</strong>
                          </div>
                          <div className="rounded-xl border border-rose-200 bg-rose-50 p-2">
                            <span className="text-[10px] text-rose-700 block">90+ Days</span>
                            <strong className="text-rose-900">{formatMMK(agingReport.bucketOver90MMK)}</strong>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ledger history table */}
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-left text-xs text-gray-600">
                        <thead className="border-b border-gray-200 bg-gray-50 font-bold uppercase tracking-wider text-[10px] text-gray-500">
                          <tr>
                            <th className="px-3 py-2.5">{isMm ? 'ရက်စွဲ' : 'Date'}</th>
                            <th className="px-3 py-2.5">{isMm ? 'အမျိုးအစား' : 'Type'}</th>
                            <th className="px-3 py-2.5 text-right">{isMm ? 'အကြွေးတိုး (+)' : 'Incurred (+)'}</th>
                            <th className="px-3 py-2.5 text-right">{isMm ? 'ကြွေးဆပ် (-)' : 'Repaid (-)'}</th>
                            <th className="px-3 py-2.5 text-right">{isMm ? 'လက်ကျန်' : 'Balance After'}</th>
                            <th className="px-3 py-2.5">{isMm ? 'မှတ်ချက်' : 'Notes'}</th>
                            <th className="px-2 py-2.5 text-center">{isMm ? 'ပြန်ပြင်' : 'Action'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-medium">
                          {customerLedgerHistory.map(entry => {
                            const isDebit = entry.type === 'debt_incurred' || (entry.type === 'adjustment' && (entry.amountMMK || 0) > 0);
                            const isReversed = (entry as any).isReversed;
                            const balAfter = entry.balanceAfterMMK || 0;

                            return (
                              <tr key={entry.id} className={isReversed ? 'bg-gray-50/70 opacity-60' : 'hover:bg-gray-50'}>
                                <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-900">{entry.date}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className="rounded-sm bg-gray-100 px-1.5 py-0.2 text-[10px] uppercase text-gray-700 font-mono">
                                    {entry.type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-rose-600">
                                  {isDebit ? formatMMK(entry.amountMMK) : '-'}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">
                                  {!isDebit ? formatMMK(entry.amountMMK) : '-'}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">
                                  {formatMMK(balAfter || 0)}
                                </td>
                                <td className="px-3 py-2 truncate max-w-xs">{entry.notes || '-'}</td>
                                <td className="px-2 py-2 text-center">
                                  {!isReversed && (currentUser.role === 'owner' || currentUser.role === 'manager') && (
                                    <button
                                      type="button"
                                      onClick={() => setReversalTargetEntry(entry)}
                                      className="rounded-md p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                                      title="Reverse Entry"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 7. Packages, Memberships & Gift Cards */}
                {activeTab === 'packages' && (
                  <div className="space-y-6">
                    {/* Memberships */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-800 mb-2 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4" />
                        <span>{isMm ? 'အသင်းဝင် ကတ်များ (Memberships)' : 'Customer Memberships'}</span>
                      </h4>
                      {custMemberships.length === 0 ? (
                        <p className="text-xs text-gray-400">No active memberships.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {custMemberships.map(m => (
                            <div key={m.id} className="rounded-xl border border-purple-200 bg-purple-50/50 p-3">
                              <span className="font-bold text-sm text-purple-950 block">{m.planName}</span>
                              <p className="text-xs text-purple-800 mt-1">
                                Discount: {m.discountPercent}% • Status: <span className="uppercase font-bold">{m.status}</span>
                              </p>
                              <p className="text-[11px] text-purple-600 font-mono mt-0.5">
                                Expires: {m.expiryDate}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Packages */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2 flex items-center gap-1.5">
                        <Package className="h-4 w-4" />
                        <span>{isMm ? 'ကြိုတင်ဝယ်ယူထားသော ပက်ကေ့ချ်များ' : 'Service Packages'}</span>
                      </h4>
                      {custPackages.length === 0 ? (
                        <p className="text-xs text-gray-400">No purchased packages.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {custPackages.map(p => (
                            <div key={p.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                              <span className="font-bold text-sm text-amber-950 block">{p.packageName}</span>
                              <p className="text-xs text-amber-900 mt-1">
                                {p.serviceName}
                              </p>
                              <div className="mt-2 flex items-center justify-between text-xs font-bold font-mono">
                                <span>Remaining: {p.remainingQty} / {p.purchasedQty}</span>
                                <span className="text-amber-700">Expires: {p.expiryDate}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Gift Cards */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-teal-800 mb-2 flex items-center gap-1.5">
                        <Gift className="h-4 w-4" />
                        <span>{isMm ? 'လက်ဆောင်ကတ် လက်ကျန်ငွေ' : 'Gift Cards'}</span>
                      </h4>
                      {custGiftCards.length === 0 ? (
                        <p className="text-xs text-gray-400">No gift cards assigned.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {custGiftCards.map(gc => (
                            <div key={gc.id} className="rounded-xl border border-teal-200 bg-teal-50/50 p-3">
                              <span className="font-bold text-sm text-teal-950 font-mono block">
                                #{gc.cardNumber}
                              </span>
                              <p className="text-sm font-black text-teal-900 font-mono mt-1">
                                Balance: {formatMMK(gc.currentBalanceMMK)}
                              </p>
                              <p className="text-[11px] text-teal-700 font-mono mt-0.5">
                                Expires: {gc.expiryDate}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-xs text-gray-400 bg-white">
              {isMm ? 'ဖောက်သည် ရွေးချယ်ပေးပါ' : 'Select a customer from the left list to view their 360 profile.'}
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}

      {/* 1. Rebook Modal */}
      {selectedCustomer && (
        <CustomerRebookModal
          isOpen={isRebookOpen}
          onClose={() => setIsRebookOpen(false)}
          customer={selectedCustomer}
          prefillService={rebookPrefill}
          services={servicesList}
          staff={staffList}
          rooms={roomsList}
          currentUser={currentUser}
          lang={lang}
          onSuccess={() => {
            loadCustomerData();
            onRefresh();
          }}
        />
      )}

      {/* 2. Customer Edit Modal */}
      {selectedCustomer && (
        <CustomerEditModal
          isOpen={isEditCustomerOpen}
          onClose={() => setIsEditCustomerOpen(false)}
          customer={selectedCustomer}
          currentUser={currentUser}
          lang={lang}
          onSuccess={() => {
            onRefresh();
            loadCustomerData();
          }}
        />
      )}

      {/* 3. Customer Note Modal */}
      {selectedCustomer && (
        <CustomerNoteModal
          isOpen={isNoteModalOpen}
          onClose={() => setIsNoteModalOpen(false)}
          customer={selectedCustomer}
          existingNote={activeNoteToEdit}
          linkContext={noteLinkContext}
          currentUser={currentUser}
          lang={lang}
          onSuccess={() => {
            loadCustomerData();
          }}
        />
      )}

      {/* 4. Add Customer Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="font-bold text-base text-gray-900">
                {isMm ? 'ဖောက်သည် အသစ် ဖွင့်လှစ်ခြင်း' : 'Register New Customer'}
              </h3>
              <button onClick={() => setIsAddCustomerOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  {isMm ? 'ဖောက်သည် အမည်' : 'Customer Name'} *
                </label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="e.g. Daw Aye Aye"
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm text-gray-900 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  {isMm ? 'ဖုန်းနံပါတ်' : 'Phone Number'}
                </label>
                <input
                  type="tel"
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  placeholder="09-xxxxxxxxx"
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-mono text-gray-900 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  {isMm ? 'ခွင့်ပြု အကြွေးပမာဏ (MMK)' : 'Credit Limit (MMK)'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={newCustLimit}
                  onChange={e => setNewCustLimit(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-mono font-bold text-gray-900 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="newCustCreditAllowed"
                  checked={newCustCreditAllowed}
                  onChange={e => setNewCustCreditAllowed(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="newCustCreditAllowed" className="text-xs font-bold text-gray-700 select-none">
                  {isMm ? 'အကြွေးဝယ်ယူခွင့် ဖွင့်ထားမည်' : 'Allow Credit Purchases'}
                </label>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="flex-1 rounded-xl border border-gray-300 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomer}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  {isMm ? 'စာရင်းသွင်းမည်' : 'Register Customer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Repay Modal */}
      {isRepayModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="font-bold text-base text-gray-900">
                {isMm ? 'အကြွေးပြန်ဆပ်ငွေ လက်ခံခြင်း' : 'Receive Customer Repayment'}
              </h3>
              <button onClick={() => setIsRepayModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                <span className="text-xs text-rose-700 font-bold block">{selectedCustomer.name}</span>
                <p className="text-sm font-black text-rose-950 font-mono mt-0.5">
                  Current Debt: {formatMMK(selectedCustomer.currentBalanceMMK || 0)}
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  {isMm ? 'ဆပ်ငွေ ပမာဏ (MMK)' : 'Repayment Amount (MMK)'} *
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedCustomer.currentBalanceMMK || undefined}
                  value={repayAmount || ''}
                  onChange={e => setRepayAmount(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-base font-mono font-black text-gray-900 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  {isMm ? 'ငွေပေးချေမှု နည်းလမ်း' : 'Payment Method'}
                </label>
                <select
                  value={repayPaymentMethod}
                  onChange={e => setRepayPaymentMethod(e.target.value as any)}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-bold text-gray-900 focus:border-emerald-500 focus:outline-hidden"
                >
                  <option value="cash">Cash (ငွေသား)</option>
                  <option value="kpay">KBZPay</option>
                  <option value="wavepay">WavePay</option>
                  <option value="cbpay">CB Pay</option>
                  <option value="ayapay">AYA Pay</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  {isMm ? 'မှတ်ချက်' : 'Notes / Reference'}
                </label>
                <input
                  type="text"
                  value={repayNotes}
                  onChange={e => setRepayNotes(e.target.value)}
                  placeholder="e.g. Cashier Counter 1"
                  className="w-full rounded-xl border border-gray-300 p-2 text-xs text-gray-900 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsRepayModalOpen(false)}
                  className="flex-1 rounded-xl border border-gray-300 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleRepay}
                  disabled={repayAmount <= 0}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isMm ? 'အတည်ပြု လက်ခံမည်' : 'Confirm Repayment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Adjustment Modal */}
      {isAdjustmentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="font-bold text-base text-gray-900">
                {isMm ? 'အကြွေးစာရင်း ချိန်ညှိချက်' : 'Record Credit Adjustment'}
              </h3>
              <button onClick={() => setIsAdjustmentModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  {isMm ? 'ချိန်ညှိမှု အမျိုးအစား' : 'Adjustment Type'}
                </label>
                <select
                  value={adjustmentType}
                  onChange={e => setAdjustmentType(e.target.value as any)}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-bold text-gray-900 focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="adjustment_credit">
                    Credit Adjustment (-) လျှော့ပေါ့ခြင်း / အကြွေးလျော့
                  </option>
                  <option value="adjustment_debit">
                    Debit Adjustment (+) ပြန်ပေါင်းခြင်း / အကြွေးတိုး
                  </option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  {isMm ? 'ပမာဏ (MMK)' : 'Amount (MMK)'} *
                </label>
                <input
                  type="number"
                  min={1}
                  value={adjustmentAmount || ''}
                  onChange={e => setAdjustmentAmount(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-base font-mono font-black text-gray-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  {isMm ? 'ချိန်ညှိရသည့် အကြောင်းပြချက်' : 'Reason / Justification'} *
                </label>
                <textarea
                  rows={2}
                  required
                  value={adjustmentNotes}
                  onChange={e => setAdjustmentNotes(e.target.value)}
                  placeholder="e.g. Audit correction, manager discount approval"
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  className="flex-1 rounded-xl border border-gray-300 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleAdjustment}
                  disabled={adjustmentAmount <= 0 || !adjustmentNotes.trim()}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {isMm ? 'ချိန်ညှိချက် မှတ်တမ်းတင်မည်' : 'Apply Adjustment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Reversal Modal */}
      {reversalTargetEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="font-bold text-base text-rose-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
                <span>{isMm ? 'စာရင်း အပြောင်းအလဲ ပြန်ဖျက်ခြင်း (Reversal)' : 'Reverse Ledger Transaction'}</span>
              </h3>
              <button onClick={() => setReversalTargetEntry(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs">
                <p><strong>Entry ID:</strong> {reversalTargetEntry.id}</p>
                <p><strong>Date:</strong> {reversalTargetEntry.date}</p>
                <p><strong>Amount:</strong> {formatMMK(reversalTargetEntry.amountMMK)}</p>
                <p><strong>Type:</strong> {reversalTargetEntry.type}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  {isMm ? 'ပြန်ဖျက်ရသည့် အကြောင်းရင်း' : 'Mandatory Reason'} *
                </label>
                <textarea
                  rows={2}
                  required
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  placeholder="e.g. Wrong amount entered by cashier"
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900 focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setReversalTargetEntry(null)}
                  className="flex-1 rounded-xl border border-gray-300 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleReversal}
                  disabled={!reversalReason.trim()}
                  className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                >
                  {isMm ? 'ပြန်ဖျက်ခြင်း အတည်ပြုမည်' : 'Confirm Reversal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
