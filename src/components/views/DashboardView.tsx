import React, { useState } from 'react';
import {
  Invoice,
  SessionRecord,
  Room,
  Booking,
  ProductItem,
  ServiceItem,
  Customer,
  StaffMember,
  ExpenseRecord,
  StaffLedgerEntry,
  CustomerCreditLedger,
  CustomerLedgerEntry,
  UserAccount,
  ShopSettings,
  CashClosingRecord,
} from '../../types';
import { formatMMK } from '../../domain/financial';
import { Language } from '../../utils/translations';
import { ActiveTab } from '../Navbar';
import { db } from '../../db/database';
import {
  LayoutGrid,
  CalendarDays,
  ShoppingBag,
  Users,
  CreditCard,
  ReceiptText,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  DollarSign,
  Activity,
  Sparkles,
  BedDouble,
  Package,
  Sliders,
  Save,
  UserCheck,
  X,
} from 'lucide-react';

interface DashboardViewProps {
  invoices: Invoice[];
  sessions: SessionRecord[];
  rooms: Room[];
  bookings: Booking[];
  products: ProductItem[];
  services: ServiceItem[];
  customers: Customer[];
  staff: StaffMember[];
  expenses: ExpenseRecord[];
  staffLedger: StaffLedgerEntry[];
  creditLedger?: (CustomerCreditLedger | CustomerLedgerEntry)[];
  closings?: CashClosingRecord[];
  settings?: ShopSettings | null;
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onShowReceipt: (inv: Invoice) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  invoices,
  sessions,
  rooms,
  bookings,
  products,
  services,
  customers,
  staff,
  expenses,
  staffLedger,
  creditLedger = [],
  closings = [],
  settings,
  currentUser,
  lang,
  onRefresh,
  onNavigateTab,
  onShowReceipt,
}) => {
  const isMm = lang === 'my';
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Active Control States for Manager Direct Actions
  const [activeControlTab, setActiveControlTab] = useState<'rooms' | 'staff' | 'sales' | 'settings'>('rooms');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Assign Staff Modal State
  const [assigningStaff, setAssigningStaff] = useState<StaffMember | null>(null);
  const [assignRoomId, setAssignRoomId] = useState<string>('');
  const [assignServiceId, setAssignServiceId] = useState<string>('');
  const [assignCustomerName, setAssignCustomerName] = useState<string>('Walk-In Guest');
  const [assignPlannedMinutes, setAssignPlannedMinutes] = useState<number>(60);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // Quick Shop Settings State for Direct Manager Update
  const [shopName, setShopName] = useState(settings?.shopName || 'Shwe Thiri Spa & KTV');
  const [shopNameMm, setShopNameMm] = useState(settings?.shopNameMm || 'ရွှေသီရိ စပါနှင့် ကာရာအိုကေ');
  const [taxPercent, setTaxPercent] = useState(settings?.taxPercent || 0);
  const [serviceChargePercent, setServiceChargePercent] = useState(settings?.serviceChargePercent || 0);

  // Date Range Filter State for Dashboard
  const [dashDateFilter, setDashDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'prev_month' | 'all'>('month');

  const getDashboardDateRange = () => {
    const d = new Date();
    const tStr = d.toISOString().split('T')[0];
    if (dashDateFilter === 'today') return { start: tStr, end: tStr };
    if (dashDateFilter === 'yesterday') {
      const y = new Date(d);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      return { start: yStr, end: yStr };
    }
    if (dashDateFilter === 'week') {
      const w = new Date(d);
      w.setDate(w.getDate() - 7);
      return { start: w.toISOString().split('T')[0], end: tStr };
    }
    if (dashDateFilter === 'month') {
      const m = new Date(d.getFullYear(), d.getMonth(), 1);
      return { start: m.toISOString().split('T')[0], end: tStr };
    }
    if (dashDateFilter === 'prev_month') {
      const pmStart = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const pmEnd = new Date(d.getFullYear(), d.getMonth(), 0);
      return { start: pmStart.toISOString().split('T')[0], end: pmEnd.toISOString().split('T')[0] };
    }
    return { start: '1970-01-01', end: '9999-12-31' };
  };

  const { start: dashStart, end: dashEnd } = getDashboardDateRange();
  const filteredDashInvoices = invoices.filter(i => i.status === 'paid' && i.createdAt.split('T')[0] >= dashStart && i.createdAt.split('T')[0] <= dashEnd);
  const filteredDashExpenses = expenses.filter(e => e.date >= dashStart && e.date <= dashEnd);
  const filteredDashSessions = sessions.filter(s => (s.createdAt ? s.createdAt.split('T')[0] >= dashStart && s.createdAt.split('T')[0] <= dashEnd : true));

  let grossSalesMMK = 0;
  let totalDiscountsMMK = 0;
  let netSalesMMK = 0;
  let serviceRevenueMMK = 0;
  let productRevenueMMK = 0;
  let cashCollectedMMK = 0;
  let digitalCollectedMMK = 0;
  let creditSalesMMK = 0;

  for (const inv of filteredDashInvoices) {
    grossSalesMMK += inv.subtotalMMK || inv.totalMMK || 0;
    totalDiscountsMMK += inv.discountAmountMMK || 0;
    netSalesMMK += inv.totalMMK || 0;
    for (const item of inv.items) {
      if (item.type === 'service' || item.type === 'room_time' || item.type === 'surcharge') {
        serviceRevenueMMK += item.totalPriceMMK;
      } else if (item.type === 'product') {
        productRevenueMMK += item.totalPriceMMK;
      }
    }
    for (const pay of inv.payments || []) {
      const method = (pay.method || '').toLowerCase();
      if (method === 'cash') {
        cashCollectedMMK += pay.amountMMK;
      } else if (method.includes('kbz') || method.includes('wave') || method.includes('bank') || method.includes('transfer')) {
        digitalCollectedMMK += pay.amountMMK;
      } else if (method === 'credit') {
        creditSalesMMK += pay.amountMMK;
      }
    }
  }

  const totalExpensesMMK = filteredDashExpenses.reduce((sum, e) => sum + e.amountMMK, 0);
  const netOperatingResultMMK = netSalesMMK - totalExpensesMMK;
  const completedSessionsCount = filteredDashSessions.filter(s => s.status === 'completed').length;
  const activeSessions = sessions.filter(s => s.status === 'active');
  const activeSessionsCount = activeSessions.length;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied');
  const occupiedRoomsCount = occupiedRooms.length;
  const availableRooms = rooms.filter(r => r.status === 'available');
  const lowStockProductsCount = products.filter(p => (p.stockQty || 0) <= 5).length;
  const activeStaffList = staff.filter(s => s.isActive !== false);
  const totalOutstandingCreditMMK = customers.reduce((sum, c) => sum + (c.currentBalanceMMK || 0), 0);
  const todayBookings = bookings.filter(b => b.date === todayStr && b.status !== 'CANCELLED');
  const todayInvoices = invoices.filter(i => i.status === 'paid' && i.createdAt.startsWith(todayStr));

  // Direct Manager Action: Update Room Status
  const handleToggleRoomStatus = async (roomId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'available' ? 'maintenance' : 'available';
      await db.rooms.update(roomId, { status: newStatus as any });
      setActionMessage(isMm ? `အခန်းအခြေအနေကို ပြောင်းလဲပြီးပါပြီ။` : `Room status updated successfully.`);
      onRefresh();
    } catch (err: any) {
      alert('Error updating room: ' + err.message);
    }
  };

  // Direct Manager Action: Toggle Staff Active Status
  const handleToggleStaffActive = async (stf: StaffMember) => {
    try {
      const newActive = stf.isActive === false ? true : false;
      await db.staff.update(stf.id, { isActive: newActive });
      setActionMessage(isMm ? `ဝန်ထမ်း ${stf.name} ၏ အခြေအနေကို ပြောင်းလဲပြီးပါပြီ။` : `Staff ${stf.name} status updated.`);
      onRefresh();
    } catch (err: any) {
      alert('Error updating staff: ' + err.message);
    }
  };

  // Open Assign Staff Modal
  const handleOpenAssignModal = (stf: StaffMember) => {
    setAssigningStaff(stf);
    if (rooms.length > 0) {
      setAssignRoomId(rooms[0].id);
    }
    if (services.length > 0) {
      setAssignServiceId(services[0].id);
    }
    setAssignCustomerName('Walk-In Guest');
    setAssignPlannedMinutes(60);
  };

  // Confirm Staff Room Assignment
  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningStaff || !assignRoomId) return;
    setIsAssigning(true);
    try {
      const room = rooms.find(r => r.id === assignRoomId);
      if (!room) throw new Error('Room not found');

      const srv = services.find(s => s.id === assignServiceId);
      const existingActiveSession = sessions.find(s => s.roomId === room.id && s.status === 'active');

      if (existingActiveSession) {
        const newAssignment = {
          staffId: assigningStaff.id,
          staffName: assigningStaff.name,
          staffRole: assigningStaff.role,
          commissionType: 'percentage' as const,
          commissionRate: 10,
          commissionAmountMMK: 0,
        };
        const alreadyAssigned = existingActiveSession.assignedStaff.some(s => s.staffId === assigningStaff.id);
        const newAssignedStaff = alreadyAssigned
          ? existingActiveSession.assignedStaff
          : [...existingActiveSession.assignedStaff, newAssignment];

        await db.changeSessionStaffTransaction({
          sessionId: existingActiveSession.id,
          newAssignedStaff,
          reason: `Assigned via Dashboard by ${currentUser.name}`,
          currentUser,
        });

        setActionMessage(isMm ? `ဝန်ထမ်း ${assigningStaff.name} ကို အခန်း (${room.name}) သို့ အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ။` : `Staff ${assigningStaff.name} assigned to room ${room.name}.`);
      } else {
        const basePrice = srv ? srv.priceMMK : (room.hourlyRateMMK || 15000);
        await db.startSessionTransaction({
          session: {
            roomId: room.id,
            roomName: room.name,
            customerId: 'walk_in',
            customerName: assignCustomerName || 'Walk-In Guest',
            serviceId: srv ? srv.id : 'srv_standard',
            serviceName: srv ? srv.name : 'Standard Service',
            plannedDurationMinutes: assignPlannedMinutes,
            actualDurationMinutes: 0,
            startTime: new Date().toISOString(),
            status: 'active',
            hourlyRateMMK: room.hourlyRateMMK || 15000,
            basePriceMMK: basePrice,
            roomSurchargeMMK: 0,
            orderItems: [],
            assignedStaff: [{
              staffId: assigningStaff.id,
              staffName: assigningStaff.name,
              staffRole: assigningStaff.role,
              commissionType: 'percentage' as const,
              commissionRate: 10,
              commissionAmountMMK: 0,
            }],
            notes: `Assigned via Dashboard Staff Roster`,
          },
          currentUser,
        });

        setActionMessage(isMm ? `ဝန်ထမ်း ${assigningStaff.name} ကို အခန်း (${room.name}) တွင် ဆက်ရှင်အသစ် စတင်၍ ချိတ်ဆက်ပြီးပါပြီ။` : `Staff ${assigningStaff.name} started session in room ${room.name}.`);
      }

      setAssigningStaff(null);
      onRefresh();
    } catch (err: any) {
      alert('Error assigning staff: ' + err.message);
    } finally {
      setIsAssigning(false);
    }
  };

  // Direct Manager Action: Save Shop Settings from Dashboard
  const handleSaveShopSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      if (settings?.id) {
        await db.settings.update(settings.id, {
          shopName,
          shopNameMm,
          taxPercent,
          serviceChargePercent,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await db.settings.add({
          id: 'settings_main',
          shopName,
          shopNameMm,
          phone: '',
          address: '',
          addressMm: '',
          taxPercent,
          serviceChargePercent,
          allowNegativeStock: false,
          requirePinForVoid: false,
          receiptFooterNote: '',
          receiptFooterNoteMm: '',
          currencySymbol: 'Ks',
        });
      }
      setActionMessage(isMm ? 'ဆိုင်အချက်အလက်များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။' : 'Shop settings updated successfully.');
      onRefresh();
    } catch (err: any) {
      alert('Error saving shop settings: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Manager Overview Header */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 p-6 shadow-2xl text-white">
        <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-20 bottom-0 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-400 border border-emerald-500/40">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                {isMm ? 'ဆိုင်လုပ်ငန်းများ ပုံမှန်လည်ပတ်နေပါသည်' : 'Shop Operations Active'}
              </span>
              <span className="text-xs text-cyan-300 font-mono">
                {todayStr} • {currentUser.name} ({currentUser.role})
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {isMm ? (settings?.shopNameMm || 'ရွှေသီရိ စပါနှင့် ကာရာအိုကေ') : (settings?.shopName || 'Shwe Thiri Spa & KTV')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              {isMm
                ? 'စီမံခန့်ခွဲမှုနေရာ'
                : 'Management Area'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigateTab('pos')}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-xs font-black text-white shadow-lg hover:from-cyan-400 hover:to-blue-500 active:scale-95 transition-all cursor-pointer"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>{isMm ? 'အရောင်းကောင်တာ (POS)' : 'New POS Sale'}</span>
            </button>
            <button
              onClick={() => onNavigateTab('rooms')}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-lg hover:from-purple-500 hover:to-indigo-500 active:scale-95 transition-all cursor-pointer"
            >
              <BedDouble className="h-4 w-4" />
              <span>{isMm ? 'အခန်းများကြည့်ရန်' : 'Room Manager'}</span>
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-500/20 border border-emerald-500/40 p-3 text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{actionMessage}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-emerald-400 hover:text-white font-bold">×</button>
          </div>
        )}
      </div>

      {/* Date Range Filter Bar for Dashboard */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl text-white">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold">{isMm ? 'ဒက်ရှ်ဘုတ် ကာလအလိုက် စစ်ဆေးရန် (Period):' : 'Dashboard Period Filter:'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1 bg-slate-800 p-1 rounded-xl">
          {[
            { id: 'today', labelEn: 'Today', labelMm: 'ယနေ့' },
            { id: 'yesterday', labelEn: 'Yesterday', labelMm: 'မနေ့က' },
            { id: 'week', labelEn: 'Last 7 Days', labelMm: '၇ ရက်' },
            { id: 'month', labelEn: 'This Month', labelMm: 'ဒီလ' },
            { id: 'prev_month', labelEn: 'Prev Month', labelMm: 'ပြီးခဲ့သောလ' },
            { id: 'all', labelEn: 'All Time', labelMm: 'အားလုံး' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setDashDateFilter(tab.id as any)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                dashDateFilter === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {isMm ? tab.labelMm : tab.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Key Operational & Financial Metrics Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div 
          onClick={() => onNavigateTab('pos')}
          className="rounded-2xl border border-cyan-500/20 bg-slate-900/90 p-4 shadow-md hover:border-cyan-400/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-cyan-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{isMm ? 'စုစုပေါင်း အသားတင်အရောင်း' : 'Net Sales Revenue'}</span>
            <DollarSign className="h-4 w-4 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-xl font-extrabold text-white font-mono">{formatMMK(netSalesMMK)}</p>
          <div className="text-[10px] text-cyan-300/80 mt-1 flex justify-between">
            <span>Gross: {formatMMK(grossSalesMMK)}</span>
            <span>Disc: {formatMMK(totalDiscountsMMK)}</span>
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('reports' as any)}
          className="rounded-2xl border border-emerald-500/20 bg-slate-900/90 p-4 shadow-md hover:border-emerald-400/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{isMm ? 'လုပ်ငန်းလည်ပတ် အမြတ်' : 'Net Operating Result'}</span>
            <TrendingUp className="h-4 w-4 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-xl font-extrabold text-emerald-400 font-mono">{formatMMK(netOperatingResultMMK)}</p>
          <div className="text-[10px] text-emerald-300/80 mt-1 flex justify-between">
            <span>Exp: {formatMMK(totalExpensesMMK)}</span>
            <span>{filteredDashInvoices.length} paid bills</span>
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('rooms')}
          className="rounded-2xl border border-purple-500/20 bg-slate-900/90 p-4 shadow-md hover:border-purple-400/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-purple-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{isMm ? 'အခန်းနှင့် စက်ရှင်များ' : 'Rooms & Sessions'}</span>
            <BedDouble className="h-4 w-4 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-xl font-extrabold text-white font-mono">{activeSessionsCount} <span className="text-xs text-slate-400 font-normal">Active</span></p>
          <div className="text-[10px] text-purple-300/80 mt-1 flex justify-between">
            <span>Occ: {occupiedRoomsCount} / {rooms.length}</span>
            <span>Done: {completedSessionsCount}</span>
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('customers')}
          className="rounded-2xl border border-rose-500/20 bg-slate-900/90 p-4 shadow-md hover:border-rose-400/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-rose-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{isMm ? 'ငွေကောက်ခံမှုနှင့် အကြွေး' : 'Collections & Credit'}</span>
            <CreditCard className="h-4 w-4 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-xl font-extrabold text-white font-mono">{formatMMK(cashCollectedMMK + digitalCollectedMMK)}</p>
          <div className="text-[10px] text-rose-300/80 mt-1 flex justify-between">
            <span>Cash: {formatMMK(cashCollectedMMK)}</span>
            <span>Debt: {formatMMK(totalOutstandingCreditMMK)}</span>
          </div>
        </div>
      </div>

      {/* 3. Direct Management & Operations Panel */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Sliders className="h-5 w-5 text-cyan-400" />
              <span>{isMm ? 'ဆိုင်လုပ်ငန်းများ တိုက်ရိုက် စီမံထိန်းချုပ်ရန်' : 'Direct Shop Operations & Management'}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isMm ? 'အခန်းများ၊ ဝန်ထမ်းများ (အခန်းသို့ တိုက်ရိုက် Assign ချရန်)၊ ယနေ့အရောင်းနှင့် ဆိုင်ဆက်တင်များ။' : 'Directly update room states, staff room assignment, and shop parameters in real time.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            {[
              { id: 'rooms', labelEn: 'Room Status', labelMm: 'အခန်းအခြေအနေ' },
              { id: 'staff', labelEn: 'Staff Roster & Assign', labelMm: 'ဝန်ထမ်းစာရင်း & Assign' },
              { id: 'sales', labelEn: 'Today Sales', labelMm: 'ယနေ့အရောင်း' },
              { id: 'settings', labelEn: 'Shop Settings', labelMm: 'ဆိုင်ဆက်တင်' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveControlTab(tab.id as any)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                  activeControlTab === tab.id
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {isMm ? tab.labelMm : tab.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: Room Control Panel */}
        {activeControlTab === 'rooms' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                {isMm ? 'အခန်းများ အခြေအနေ စစ်ဆေးရန်နှင့် ပြင်ဆင်ရန် (ကလစ်နှိပ်၍ ပြောင်းပါ)' : 'Room Status & Maintenance Control'}
              </span>
              <button
                onClick={() => onNavigateTab('rooms')}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <span>{isMm ? 'အခန်းစီမံခန့်ခွဲမှုသို့ သွားရန်' : 'Full Room Manager'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {rooms.map(room => {
                const isOccupied = room.status === 'occupied';
                const isMaint = room.status === 'maintenance';
                return (
                  <div key={room.id} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3 shadow-md flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-extrabold text-white text-sm">{room.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isOccupied ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                          isMaint ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}>
                          {room.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">အမျိုးအစား: {room.type} • နှုန်းထား: {formatMMK(room.hourlyRateMMK || 0)}/နာရီ</p>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                      <button
                        onClick={() => handleToggleRoomStatus(room.id, room.status)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                          isMaint 
                            ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30' 
                            : 'bg-amber-600/20 text-amber-300 border-amber-500/40 hover:bg-amber-600/30'
                        }`}
                      >
                        {isMaint ? (isMm ? 'ဖွင့်မည် (Available)' : 'Set Available') : (isMm ? 'ပြုပြင်ဆိုင်းငံ့မည်' : 'Set Maintenance')}
                      </button>

                      <button
                        onClick={() => onNavigateTab('rooms')}
                        className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300"
                      >
                        {isMm ? 'ကြည့်မည်' : 'Manage'} →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Staff Roster & Room Assignment Panel */}
        {activeControlTab === 'staff' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {isMm ? 'ဝန်ထမ်းစာရင်းနှင့် အခန်းသို့ တိုက်ရိုက် Assign ချရန်' : 'Staff Roster & Room Assignment Control'}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isMm ? 'ဝန်ထမ်းကတ်ပေါ်ရှိ "အခန်းချိတ်ရန် (Assign)" ကိုနှိပ်၍ သက်ဆိုင်ရာအခန်းသို့ ချက်ချင်း တာဝန်ပေးနိုင်ပါသည်။' : 'Click "Assign Room" on any staff member to assign them to a room and auto-calculate session.'}
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('staff')}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 shrink-0"
              >
                <span>{isMm ? 'ဝန်ထမ်းစီမံခန့်ခွဲမှု' : 'Full Staff Manager'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {staff.map(stf => {
                const isActive = stf.isActive !== false;
                return (
                  <div key={stf.id} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3 shadow-md flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-extrabold text-white text-sm">{stf.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}>
                          {isActive ? (isMm ? 'တာဝန်ကျ' : 'Active') : (isMm ? 'အနားယူ' : 'Off Duty')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">ရာထူး: {stf.role} • အခြေအနေ: {stf.status}</p>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-1 border-t border-slate-800/80">
                      {isActive && (
                        <button
                          onClick={() => handleOpenAssignModal(stf)}
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/30 transition-all cursor-pointer"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>{isMm ? 'အခန်းချိတ်ရန် (Assign)' : 'Assign Room'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleToggleStaffActive(stf)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                          isActive 
                            ? 'bg-rose-600/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30' 
                            : 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
                        }`}
                      >
                        {isActive ? (isMm ? 'ပိတ်မည်' : 'Inactive') : (isMm ? 'ဖွင့်မည်' : 'Active')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Live Sales Feed */}
        {activeControlTab === 'sales' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                {isMm ? 'ယနေ့ အရောင်း ငွေစာရင်းများနှင့် ဘေလ်များ' : "Today's Sales Records & Invoices"}
              </span>
              <button
                onClick={() => onNavigateTab('pos')}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <span>{isMm ? 'POS အရောင်းကောင်တာသို့ သွားရန်' : 'Open POS Terminal'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {todayInvoices.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                {isMm ? 'ယနေ့အတွက် ပေးချေပြီးသော ဘေလ် မရှိသေးပါ။' : 'No paid invoices recorded for today yet.'}
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {todayInvoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono">{inv.invoiceCode}</span>
                        <span className="text-slate-400">• {inv.customerName}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{new Date(inv.createdAt).toLocaleTimeString()} • ငွေကိုင်: {inv.cashierName}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-extrabold text-emerald-400">{formatMMK(inv.totalMMK)}</span>
                      <button
                        onClick={() => onShowReceipt(inv)}
                        className="rounded-lg bg-cyan-600/20 px-3 py-1 text-xs font-bold text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/30"
                      >
                        {isMm ? 'ပြေစာကြည့်ရန်' : 'View Receipt'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Shop Configuration & Core Settings */}
        {activeControlTab === 'settings' && (
          <form onSubmit={handleSaveShopSettings} className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300">
                {isMm ? 'ဆိုင်အမည်၊ အခွန်နှင့် ဝန်ဆောင်ခ နှုန်းထားများ ပြင်ဆင်ရန်' : 'Shop Name & Tax Configuration'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">Shop Name (English)</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">ဆိုင်အမည် (မြန်မာ)</label>
                <input
                  type="text"
                  value={shopNameMm}
                  onChange={e => setShopNameMm(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">Commercial Tax (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={taxPercent}
                  onChange={e => setTaxPercent(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">Service Charge (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={serviceChargePercent}
                  onChange={e => setServiceChargePercent(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isUpdating}
                className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-cyan-500 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>{isUpdating ? 'သိမ်းဆည်းနေသည်...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 4. Quick Access Navigation Hub */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span>{isMm ? 'အမြန်သွားရောက်ရန် နေရာများ' : 'Quick Navigation'}</span>
          </h3>
          <span className="text-xs text-slate-400">{isMm ? 'တစ်ချက်နှိပ်၍ အခြားစာမျက်နှာသို့ သွားပါ' : 'Instant click to module'}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
          {[
            { id: 'dashboard', label: isMm ? 'ဒက်ရှ်ဘုတ်' : 'Dashboard', icon: TrendingUp, color: 'from-cyan-600 to-blue-600' },
            { id: 'rooms', label: isMm ? 'အခန်းများ' : 'Rooms', icon: LayoutGrid, color: 'from-purple-600 to-indigo-600' },
            { id: 'bookings', label: isMm ? 'ချိန်းဆိုမှု' : 'Bookings', icon: CalendarDays, color: 'from-amber-600 to-orange-600' },
            { id: 'pos', label: isMm ? 'အရောင်း' : 'POS Sale', icon: ShoppingBag, color: 'from-emerald-600 to-teal-600' },
            { id: 'memberships', label: isMm ? 'အသင်းဝင်' : 'Memberships', icon: Sparkles, color: 'from-pink-600 to-rose-600' },
            { id: 'staff', label: isMm ? 'ဝန်ထမ်း' : 'Staff', icon: Users, color: 'from-blue-600 to-cyan-600' },
            { id: 'customers', label: isMm ? 'ဖောက်သည်' : 'Customers', icon: CreditCard, color: 'from-violet-600 to-purple-600' },
            { id: 'expenses', label: isMm ? 'စရိတ်' : 'Expenses', icon: ReceiptText, color: 'from-rose-600 to-red-600' },
            { id: 'records', label: isMm ? 'မှတ်တမ်း' : 'Records', icon: ShieldCheck, color: 'from-slate-700 to-slate-900' },
          ].map(mod => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => onNavigateTab(mod.id as ActiveTab)}
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-center transition-all hover:border-cyan-500/50 hover:bg-slate-800 cursor-pointer shadow-sm"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${mod.color} text-white shadow-md group-hover:scale-110 transition-transform`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 truncate w-full">{mod.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Assign Staff to Room Modal Dialog */}
      {assigningStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-cyan-400" />
                  <span>{isMm ? 'ဝန်ထမ်းအား အခန်းသို့ Assign ချရန်' : 'Assign Staff to Room'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isMm ? `ဝန်ထမ်း: ${assigningStaff.name} (${assigningStaff.role})` : `Staff: ${assigningStaff.name} (${assigningStaff.role})`}
                </p>
              </div>
              <button
                onClick={() => setAssigningStaff(null)}
                className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAssign} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">
                  {isMm ? 'အခန်းရွေးချယ်ပါ (Room)' : 'Select Room'}
                </label>
                <select
                  value={assignRoomId}
                  onChange={e => setAssignRoomId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500 font-semibold"
                  required
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type}) — {r.status.toUpperCase()} • {formatMMK(r.hourlyRateMMK || 0)}/hr
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">
                  {isMm ? 'ဝန်ဆောင်မှု အမျိုးအစား (Service)' : 'Select Service'}
                </label>
                <select
                  value={assignServiceId}
                  onChange={e => setAssignServiceId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500 font-semibold"
                >
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {formatMMK(s.priceMMK)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">
                  {isMm ? 'ဖောက်သည်အမည် (Customer Name)' : 'Customer Name'}
                </label>
                <input
                  type="text"
                  value={assignCustomerName}
                  onChange={e => setAssignCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500 font-semibold"
                  placeholder="Walk-In Guest / Customer Name"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">
                  {isMm ? 'ကြာချိန် (မိနစ် - Planned Minutes)' : 'Planned Duration (Minutes)'}
                </label>
                <input
                  type="number"
                  value={assignPlannedMinutes}
                  onChange={e => setAssignPlannedMinutes(parseInt(e.target.value) || 60)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500 font-mono font-semibold"
                  step="15"
                  min="15"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssigningStaff(null)}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-800"
                >
                  {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg hover:bg-cyan-500 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>{isAssigning ? (isMm ? 'ချိတ်ဆက်နေသည်...' : 'Assigning...') : (isMm ? 'အတည်ပြု Assign ချမည်' : 'Confirm Assignment')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
