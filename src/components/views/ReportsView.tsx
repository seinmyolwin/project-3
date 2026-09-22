import React, { useState } from 'react';
import {
  Invoice,
  ExpenseRecord,
  StaffMember,
  StaffLedgerEntry,
  SessionRecord,
  UserAccount,
  Customer,
  CustomerCreditLedger,
  CustomerLedgerEntry,
} from '../../types';
import { formatMMK, deriveCustomerLedgerBalances, calculateCustomerAgingReport } from '../../domain/financial';
import { Language } from '../../utils/translations';
import { db } from '../../db/database';
import {
  TrendingUp,
  Download,
  Printer,
  Calendar,
  DollarSign,
  Users,
  PieChart,
  ShoppingBag,
  Award,
  CreditCard,
  ShieldAlert,
  Trophy,
  Crown,
  Medal,
  Sparkles,
  Sliders,
  CheckCircle2,
  Zap,
  X,
  Check,
  Gift,
  ChevronDown,
  Info,
} from 'lucide-react';

interface ReportsViewProps {
  invoices: Invoice[];
  expenses: ExpenseRecord[];
  staff: StaffMember[];
  staffLedger: StaffLedgerEntry[];
  sessions: SessionRecord[];
  customers?: Customer[];
  creditLedger?: (CustomerCreditLedger | CustomerLedgerEntry)[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh?: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  invoices,
  expenses,
  staff,
  staffLedger,
  sessions,
  customers = [],
  creditLedger = [],
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';

  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all'>('month');

  // Performance Award Selector State
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthYYYYMM = now.toISOString().slice(0, 7);

  const [selectedPerformanceMonth, setSelectedPerformanceMonth] = useState<string>(currentMonthYYYYMM);
  const [weightRevenue, setWeightRevenue] = useState<number>(40);
  const [weightSessions, setWeightSessions] = useState<number>(30);
  const [weightCommission, setWeightCommission] = useState<number>(30);
  const [awardAmountMMK, setAwardAmountMMK] = useState<number>(50000);
  const [isCriteriaOpen, setIsCriteriaOpen] = useState<boolean>(false);
  const [awardModalCandidate, setAwardModalCandidate] = useState<any | null>(null);
  const [awardNotification, setAwardNotification] = useState<string | null>(null);

  // Month options for quick picker
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return d.toISOString().slice(0, 7);
  });
  if (!monthOptions.includes(selectedPerformanceMonth)) {
    monthOptions.unshift(selectedPerformanceMonth);
  }

  // Customer Credit & Debt Aging Aggregations
  const activeCustomers = customers.filter(c => c.isActive !== false);
  const customerCreditSummaries = activeCustomers.map(cust => {
    const custEntries = creditLedger.filter(e => e.customerId === cust.id);
    const derived = deriveCustomerLedgerBalances(custEntries);
    const agingSummary = calculateCustomerAgingReport({
      customers: [cust],
      ledgerEntries: custEntries,
    });
    const agingBucket = agingSummary.customerBreakdowns[0] || {
      bucket0to30MMK: 0,
      bucket31to60MMK: 0,
      bucket61to90MMK: 0,
      bucketOver90MMK: 0,
    };
    return {
      customer: cust,
      derived,
      agingBucket,
    };
  });

  const totalOutstandingCreditMMK = customerCreditSummaries.reduce(
    (sum, item) => sum + item.derived.netOutstandingDebtMMK,
    0
  );
  const debtorsCount = customerCreditSummaries.filter(item => item.derived.netOutstandingDebtMMK > 0).length;

  // Date filtering logic
  const getStartDate = () => {
    if (dateFilter === 'today') return todayStr;
    if (dateFilter === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().split('T')[0];
    }
    if (dateFilter === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return d.toISOString().split('T')[0];
    }
    return '1970-01-01';
  };

  const startDate = getStartDate();

  // Filter entities by date
  const filteredInvoices = invoices.filter(
    i => i.status === 'paid' && i.createdAt.split('T')[0] >= startDate
  );
  const filteredExpenses = expenses.filter(e => e.date >= startDate);
  const filteredStaffLedger = staffLedger.filter(e => e.date >= startDate);

  // P&L Calculations
  let serviceRevenue = 0;
  let productRevenue = 0;
  let productCOGS = 0;

  for (const inv of filteredInvoices) {
    for (const item of inv.items) {
      if (item.type === 'service' || item.type === 'room_time' || item.type === 'surcharge') {
        serviceRevenue += item.totalPriceMMK;
      } else if (item.type === 'product') {
        productRevenue += item.totalPriceMMK;
        if (item.costPriceMMK) {
          productCOGS += item.costPriceMMK * item.quantity;
        }
      }
    }
  }

  const grossRevenue = serviceRevenue + productRevenue;
  const grossProfit = grossRevenue - productCOGS;

  const totalCommissionsIncurred = filteredStaffLedger
    .filter(e => e.type === 'commission')
    .reduce((sum, e) => sum + e.amountMMK, 0);

  const totalBonusesIncurred = filteredStaffLedger
    .filter(e => e.type === 'bonus')
    .reduce((sum, e) => sum + e.amountMMK, 0);

  const totalOperatingExpenses = filteredExpenses.reduce((sum, e) => sum + e.amountMMK, 0);

  const totalOperatingCosts = totalCommissionsIncurred + totalBonusesIncurred + totalOperatingExpenses;
  const netOperatingProfit = grossProfit - totalOperatingCosts;

  // Staff Performance Ranking & Auto-Award Evaluation Logic
  const activeStaffList = staff.filter(s => s.isActive !== false);

  const perfInvoices = invoices.filter(
    inv => inv.status === 'paid' && inv.createdAt.startsWith(selectedPerformanceMonth)
  );

  const perfSessions = sessions.filter(
    s => s.status === 'completed' &&
         ((s.createdAt && s.createdAt.startsWith(selectedPerformanceMonth)) ||
          (s.startTime && s.startTime.startsWith(selectedPerformanceMonth)))
  );

  const perfLedger = staffLedger.filter(
    e => (e.date && e.date.startsWith(selectedPerformanceMonth)) ||
         (e.createdAt && e.createdAt.startsWith(selectedPerformanceMonth))
  );

  const getSessionValue = (s: SessionRecord): number => {
    const base = (s.basePriceMMK || 0) + (s.roomSurchargeMMK || 0);
    const orders = (s.orderItems || []).reduce((sum, item) => sum + (item.totalPriceMMK || 0), 0);
    const extensions = (s.extensions || []).reduce((sum, ext) => sum + (ext.extensionPriceMMK || 0), 0);
    return base + orders + extensions;
  };

  const rawStaffPerformance = activeStaffList.map(stf => {
    const staffSess = perfSessions.filter(s =>
      s.assignedStaff.some(as => as.staffId === stf.id)
    );
    const sessionsCount = staffSess.length;

    let salesRevenueMMK = 0;
    for (const s of staffSess) {
      salesRevenueMMK += getSessionValue(s);
    }

    const commissionEarnedMMK = perfLedger
      .filter(e => e.staffId === stf.id && e.type === 'commission')
      .reduce((sum, e) => sum + e.amountMMK, 0);

    return {
      staff: stf,
      sessionsCount,
      salesRevenueMMK,
      commissionEarnedMMK,
    };
  });

  const maxSales = Math.max(...rawStaffPerformance.map(d => d.salesRevenueMMK), 1);
  const maxSessions = Math.max(...rawStaffPerformance.map(d => d.sessionsCount), 1);
  const maxCommissions = Math.max(...rawStaffPerformance.map(d => d.commissionEarnedMMK), 1);

  const totalWeights = (weightRevenue + weightSessions + weightCommission) || 100;

  const rankedCandidates = rawStaffPerformance.map(st => {
    const salesScore = (st.salesRevenueMMK / maxSales) * 100;
    const sessionScore = (st.sessionsCount / maxSessions) * 100;
    const commScore = (st.commissionEarnedMMK / maxCommissions) * 100;

    const compositeScore = Math.round(
      ((salesScore * weightRevenue) + (sessionScore * weightSessions) + (commScore * weightCommission)) / (totalWeights / 100)
    );

    const existingAward = staffLedger.find(
      e => e.staffId === st.staff.id &&
           e.type === 'bonus' &&
           e.notes.includes('Performance Award Winner') &&
           e.notes.includes(selectedPerformanceMonth)
    );

    return {
      ...st,
      salesScore,
      sessionScore,
      commScore,
      compositeScore,
      alreadyAwarded: !!existingAward,
      awardedEntry: existingAward,
    };
  }).sort((a, b) => b.compositeScore - a.compositeScore || b.salesRevenueMMK - a.salesRevenueMMK || b.sessionsCount - a.sessionsCount);

  const topWinner = rankedCandidates[0];

  const handleConfirmAwardBonus = async () => {
    if (!awardModalCandidate) return;
    try {
      const reasonText = `Performance Award Winner (${selectedPerformanceMonth}) - စွမ်းဆောင်ရည်ဆုကြေး`;
      await db.recordStaffAdjustmentTransaction({
        staffId: awardModalCandidate.staff.id,
        type: 'bonus',
        amountMMK: awardAmountMMK,
        reason: reasonText,
        currentUser,
      });

      setAwardNotification(
        isMm
          ? `${awardModalCandidate.staff.name} အား ${selectedPerformanceMonth} လအတွက် စွမ်းဆောင်ရည်ဆုကြေး ${formatMMK(awardAmountMMK)} ကျပ် အောင်မြင်စွာ ပေးအပ်လိုက်ပြီး ဝန်ထမ်းစာရင်းရှင်းတမ်း (Staff Ledger) ထဲသို့ အလိုအလျောက် ထည့်ပေါင်းပေးလိုက်ပါသည်။`
          : `Successfully awarded ${formatMMK(awardAmountMMK)} performance bonus to ${awardModalCandidate.staff.name} for ${selectedPerformanceMonth}! Added to staff ledger.`
      );
      setAwardModalCandidate(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert('Error recording performance award: ' + err.message);
    }
  };

  // CSV Exporter (100% Client-Side)
  const handleExportCSV = () => {
    const rows = [
      ['Date', 'Invoice Code', 'Customer', 'Subtotal (MMK)', 'Discount', 'Total (MMK)', 'Payments', 'Cashier'],
      ...filteredInvoices.map(i => [
        i.createdAt,
        i.invoiceCode,
        i.customerName,
        i.subtotalMMK,
        i.discountAmountMMK,
        i.totalMMK,
        i.payments.map(p => `${p.method}:${p.amountMMK}`).join(';'),
        i.cashierName,
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `shwe_thiri_sales_${dateFilter}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Range Picker */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {isMm ? 'ဘဏ္ဍာရေး အစီရင်ခံစာနှင့် အမြတ်/အရှုံး (P&L)' : 'Financial Reports & Profit & Loss'}
          </h2>
          <p className="text-xs text-gray-500">
            {isMm
              ? 'စုစုပေါင်းဝင်ငွေ၊ ကုန်ကျစရိတ်၊ ဝန်ထမ်းကော်မရှင်နှင့် အသားတင်အမြတ်'
              : 'Deterministic integer accounting for revenues, COGS, commissions, and net profit'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {[
              { id: 'today', labelEn: 'Today', labelMm: 'ယနေ့' },
              { id: '7days', labelEn: '7 Days', labelMm: '၇ ရက်' },
              { id: 'month', labelEn: 'This Month', labelMm: 'ဒီလ' },
              { id: 'all', labelEn: 'All Time', labelMm: 'အားလုံး' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDateFilter(tab.id as any)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  dateFilter === tab.id
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {isMm ? tab.labelMm : tab.labelEn}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold text-gray-500">
            {isMm ? 'စုစုပေါင်း ဝင်ငွေ (Gross Revenue)' : 'Gross Revenue'}
          </span>
          <p className="text-xl font-extrabold text-emerald-800 font-mono mt-1">{formatMMK(grossRevenue)}</p>
          <span className="text-[11px] text-gray-400 mt-0.5 block">{filteredInvoices.length} paid invoices</span>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold text-gray-500">
            {isMm ? 'ဝန်ထမ်းကော်မရှင် ကုန်ကျငွေ' : 'Staff Commissions'}
          </span>
          <p className="text-xl font-extrabold text-indigo-800 font-mono mt-1">
            {formatMMK(totalCommissionsIncurred)}
          </p>
          <span className="text-[11px] text-gray-400 mt-0.5 block">Staff incentive share</span>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold text-gray-500">
            {isMm ? 'ဆိုင်တွင်း စရိတ် (Operating Expenses)' : 'Operating Expenses'}
          </span>
          <p className="text-xl font-extrabold text-rose-700 font-mono mt-1">
            {formatMMK(totalOperatingExpenses)}
          </p>
          <span className="text-[11px] text-gray-400 mt-0.5 block">{filteredExpenses.length} expense items</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-xs">
          <span className="text-xs font-bold text-emerald-900">
            {isMm ? 'အသားတင် အမြတ်ငွေ (Net Operating Profit)' : 'Net Operating Profit'}
          </span>
          <p
            className={`text-xl font-black font-mono mt-1 ${
              netOperatingProfit >= 0 ? 'text-emerald-900' : 'text-rose-700'
            }`}
          >
            {formatMMK(netOperatingProfit)}
          </p>
          <span className="text-[11px] text-emerald-700 mt-0.5 block">
            {grossRevenue > 0
              ? `${((netOperatingProfit / grossRevenue) * 100).toFixed(1)}% profit margin`
              : '0% margin'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* P&L Statement Table (7 cols on lg) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs lg:col-span-7 space-y-4">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
            {isMm ? 'ဝင်ငွေနှင့် အမြတ်/အရှုံး စာရင်းချုပ် (Statement of P&L)' : 'Income Statement (P&L Breakdown)'}
          </h3>

          <div className="space-y-3 text-xs">
            {/* 1. Revenue */}
            <div>
              <span className="font-bold text-gray-900 block text-xs uppercase text-emerald-800">
                1. Gross Revenue (စုစုပေါင်း ဝင်ငွေ)
              </span>
              <div className="mt-1.5 space-y-1 rounded-xl bg-gray-50 p-3">
                <div className="flex justify-between">
                  <span>Massage & KTV Sessions Revenue</span>
                  <span className="font-semibold text-gray-900">{formatMMK(serviceRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Beverage, Food & Product Sales</span>
                  <span className="font-semibold text-gray-900">{formatMMK(productRevenue)}</span>
                </div>
                <div className="border-t border-gray-200 pt-1 flex justify-between font-bold text-emerald-900">
                  <span>Total Gross Revenue</span>
                  <span>{formatMMK(grossRevenue)}</span>
                </div>
              </div>
            </div>

            {/* 2. Cost of Goods Sold */}
            <div>
              <span className="font-bold text-gray-900 block text-xs uppercase text-slate-800">
                2. Cost of Goods Sold (ရောင်းကုန်ပစ္စည်းရင်းနှီးစရိတ်)
              </span>
              <div className="mt-1.5 space-y-1 rounded-xl bg-gray-50 p-3">
                <div className="flex justify-between">
                  <span>Direct Inventory Wholesale Cost</span>
                  <span className="font-semibold text-rose-600">-{formatMMK(productCOGS)}</span>
                </div>
                <div className="border-t border-gray-200 pt-1 flex justify-between font-bold text-gray-900">
                  <span>Gross Profit (အကြမ်းဖျင်းအမြတ်)</span>
                  <span>{formatMMK(grossProfit)}</span>
                </div>
              </div>
            </div>

            {/* 3. Operating Expenses & Commissions */}
            <div>
              <span className="font-bold text-gray-900 block text-xs uppercase text-rose-800">
                3. Operating Expenses & Staff Commissions (လည်ပတ်စရိတ်များနှင့် ကော်မရှင်)
              </span>
              <div className="mt-1.5 space-y-1 rounded-xl bg-gray-50 p-3">
                <div className="flex justify-between">
                  <span>Staff Commissions Incurred</span>
                  <span className="font-semibold text-rose-600">-{formatMMK(totalCommissionsIncurred)}</span>
                </div>
                {totalBonusesIncurred > 0 && (
                  <div className="flex justify-between">
                    <span>Staff Bonuses</span>
                    <span className="font-semibold text-rose-600">-{formatMMK(totalBonusesIncurred)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Shop Operating Expenses (Fuel, Laundry, Utilities)</span>
                  <span className="font-semibold text-rose-600">-{formatMMK(totalOperatingExpenses)}</span>
                </div>
                <div className="border-t border-gray-200 pt-1 flex justify-between font-bold text-rose-950">
                  <span>Total Operating Incurred Costs</span>
                  <span>-{formatMMK(totalOperatingCosts)}</span>
                </div>
              </div>
            </div>

            {/* 4. Net Operating Profit */}
            <div className="rounded-xl bg-emerald-100/70 p-4 border border-emerald-300 flex justify-between items-center text-sm font-extrabold text-emerald-950">
              <span>NET OPERATING PROFIT (အသားတင် အမြတ်ငွေ):</span>
              <span className="text-base font-black font-mono">{formatMMK(netOperatingProfit)}</span>
            </div>
          </div>
        </div>

        {/* Staff Performance Award Auto-Selector (5 cols on lg) */}
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 p-5 shadow-xs lg:col-span-5 space-y-4 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-amber-950 shadow-xs">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-amber-950 flex items-center gap-1.5">
                  <span>{isMm ? 'စွမ်းဆောင်ရည် အကောင်းဆုံး ဝန်ထမ်းဆု ရွေးချယ်မှု စနစ်' : 'Staff Performance Award Engine'}</span>
                  <Crown className="h-4 w-4 text-amber-500 fill-amber-400" />
                </h3>
                <p className="text-[11px] text-amber-800/80 font-medium">
                  {isMm ? 'မှတ်တမ်းများမှ ကာလအလိုက် အကောင်းဆုံး ဝန်ထမ်းအား အလိုအလျောက် ရွေးထုတ်စနစ်' : 'Auto-evaluate performance & grant monthly bonus to ledger'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCriteriaOpen(!isCriteriaOpen)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100/60 shadow-2xs transition-all"
              title="Configure Custom Evaluation Criteria & Weights"
            >
              <Sliders className="h-3.5 w-3.5 text-amber-600" />
              <span>{isMm ? 'သတ်မှတ်ချက်များ' : 'Criteria'}</span>
              <ChevronDown className={`h-3 w-3 text-amber-600 transition-transform ${isCriteriaOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Month Selector Bar */}
          <div className="flex items-center justify-between bg-white/90 p-2.5 rounded-xl border border-amber-200/80 text-xs">
            <span className="font-bold text-amber-950 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber-600" />
              <span>{isMm ? 'ဆုပေးရွေးချယ်မည့် ကာလ:' : 'Evaluation Month:'}</span>
            </span>

            <div className="flex items-center gap-2">
              <select
                value={selectedPerformanceMonth}
                onChange={e => setSelectedPerformanceMonth(e.target.value)}
                className="rounded-lg border border-amber-300 bg-amber-50/50 px-2.5 py-1 font-extrabold text-amber-950 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
              >
                {monthOptions.map(m => (
                  <option key={m} value={m}>
                    {m} {m === currentMonthYYYYMM ? `(${isMm ? 'လက်ရှိလ' : 'Current'})` : ''}
                  </option>
                ))}
              </select>
              <input
                type="month"
                value={selectedPerformanceMonth}
                onChange={e => e.target.value && setSelectedPerformanceMonth(e.target.value)}
                className="rounded-lg border border-amber-300 bg-amber-50/50 px-2 py-1 text-xs text-amber-950 font-mono outline-none"
              />
            </div>
          </div>

          {/* Award Notification Message */}
          {awardNotification && (
            <div className="flex items-start justify-between rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-900 shadow-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="font-medium">{awardNotification}</p>
              </div>
              <button
                onClick={() => setAwardNotification(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold ml-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Criteria Customizer Drawer */}
          {isCriteriaOpen && (
            <div className="rounded-xl border border-amber-300 bg-white p-3.5 space-y-3 shadow-md text-xs animate-fadeIn">
              <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-amber-600" />
                  <span>{isMm ? 'ပိုင်ရှင် စိတ်ကြိုက် စွမ်းဆောင်ရည် သတ်မှတ်ချက် အလေးချိန်များ (%)' : 'Custom Evaluation Criteria & Weights (%)'}</span>
                </span>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                  Total: {weightRevenue + weightSessions + weightCommission}%
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 block">
                    {isMm ? '၁. ရောင်းရငွေ အလေးချိန် (%)' : '1. Revenue Weight (%)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightRevenue}
                    onChange={e => setWeightRevenue(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-bold text-gray-900 focus:border-amber-500 outline-none"
                  />
                  <span className="text-[10px] text-gray-400 block">{isMm ? 'ဝယ်ယူမှု စုစုပေါင်း' : 'Sales share'}</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 block">
                    {isMm ? '၂. အကြိမ်ရေ အလေးချိန် (%)' : '2. Session Count Weight (%)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightSessions}
                    onChange={e => setWeightSessions(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-bold text-gray-900 focus:border-amber-500 outline-none"
                  />
                  <span className="text-[10px] text-gray-400 block">{isMm ? 'ဝန်ဆောင်မှု အကြိမ်ရေ' : 'Session volume'}</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 block">
                    {isMm ? '၃. ကော်မရှင် အလေးချိန် (%)' : '3. Commission Weight (%)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightCommission}
                    onChange={e => setWeightCommission(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-bold text-gray-900 focus:border-amber-500 outline-none"
                  />
                  <span className="text-[10px] text-gray-400 block">{isMm ? 'ကော်မရှင် ရရှိငွေ' : 'Commission earned'}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <label className="text-[11px] font-extrabold text-amber-950 block">
                    {isMm ? 'သတ်မှတ် စွမ်းဆောင်ရည် ဆုကြေးငွေ (MMK):' : 'Award Bonus Amount (MMK):'}
                  </label>
                  <input
                    type="number"
                    step="5000"
                    value={awardAmountMMK}
                    onChange={e => setAwardAmountMMK(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-40 rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-extrabold text-amber-900 font-mono bg-amber-50/50 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsCriteriaOpen(false)}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-extrabold text-amber-950 hover:bg-amber-400 shadow-2xs"
                >
                  {isMm ? 'အတည်ပြုမည်' : 'Save Criteria'}
                </button>
              </div>
            </div>
          )}

          {/* Winner Spotlight Banner (#1 Performer) */}
          {topWinner ? (
            <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 p-4 text-amber-950 shadow-md relative overflow-hidden">
              <div className="absolute top-2 right-2 opacity-20 pointer-events-none">
                <Crown className="h-20 w-20 text-amber-900" />
              </div>

              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 bg-amber-950/90 text-amber-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs">
                    <Sparkles className="h-3 w-3 text-amber-400" />
                    <span>{selectedPerformanceMonth} {isMm ? 'စွမ်းဆောင်ရည် အကောင်းဆုံး ဆုရှင်' : 'Top Performer'}</span>
                  </div>
                  <span className="bg-amber-950 text-amber-300 font-black px-2.5 py-1 rounded-full text-xs font-mono">
                    {topWinner.compositeScore} / 100 {isMm ? 'မှတ်' : 'Pts'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-950 text-amber-300 font-black text-xl shadow-inner border border-amber-300/40">
                    🥇
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-amber-950 leading-tight">
                      {topWinner.staff.name}
                    </h4>
                    <span className="text-xs font-bold text-amber-900/80 uppercase">
                      {topWinner.staff.role} • {topWinner.staff.phone || 'No Phone'}
                    </span>
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-3 gap-2 text-center bg-amber-950/10 p-2 rounded-xl border border-amber-900/10">
                  <div>
                    <span className="text-[10px] text-amber-900 font-bold block">{isMm ? 'ရောင်းရငွေ' : 'Revenue'}</span>
                    <span className="text-xs font-extrabold font-mono text-amber-950">{formatMMK(topWinner.salesRevenueMMK)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-900 font-bold block">{isMm ? 'အကြိမ်ရေ' : 'Sessions'}</span>
                    <span className="text-xs font-extrabold font-mono text-amber-950">{topWinner.sessionsCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-900 font-bold block">{isMm ? 'ကော်မရှင်' : 'Commission'}</span>
                    <span className="text-xs font-extrabold font-mono text-amber-950">{formatMMK(topWinner.commissionEarnedMMK)}</span>
                  </div>
                </div>

                {/* Award Action Button */}
                <div className="pt-1">
                  {topWinner.alreadyAwarded ? (
                    <div className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-900/90 text-emerald-200 py-2 px-3 text-xs font-bold border border-emerald-400/50 shadow-inner">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>
                        {isMm
                          ? `${selectedPerformanceMonth} အတွက် ဆုကြေး (${formatMMK(topWinner.awardedEntry?.amountMMK || awardAmountMMK)}) စာရင်းရှင်းတမ်း (Ledger) ထဲသို့ ပေးအပ်ပြီးပါပြီ`
                          : `Bonus (${formatMMK(topWinner.awardedEntry?.amountMMK || awardAmountMMK)}) credited to staff ledger!`}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAwardModalCandidate(topWinner)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-950 text-amber-300 hover:bg-black py-2.5 px-4 text-xs font-black shadow-lg active:scale-98 transition-all cursor-pointer border border-amber-400/40"
                    >
                      <Gift className="h-4 w-4 text-amber-400 animate-bounce" />
                      <span>
                        {isMm
                          ? `စွမ်းဆောင်ရည်ဆုကြေး (${formatMMK(awardAmountMMK)}) အတည်ပြု ပေးအပ်မည်`
                          : `Award ${formatMMK(awardAmountMMK)} Performance Bonus to Ledger`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
              {isMm ? 'ရွေးချယ်ထားသော လတွင် ဝန်ထမ်း မှတ်တမ်း မရှိသေးပါ' : 'No staff performance records for selected month.'}
            </div>
          )}

          {/* Full Ranked Leaderboard */}
          <div className="space-y-2 text-xs pt-1">
            <span className="font-extrabold text-amber-950 block text-xs uppercase tracking-wider">
              {isMm ? 'ဝန်ထမ်းများ စွမ်းဆောင်ရည် အဆင့်သတ်မှတ်ချက်' : 'Full Performance Leaderboard'}
            </span>

            {rankedCandidates.map((st, idx) => (
              <div
                key={st.staff.id}
                className={`flex items-center justify-between rounded-xl border p-3 transition-all ${
                  idx === 0
                    ? 'border-amber-300 bg-amber-50/80 shadow-2xs'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black shrink-0 ${
                      idx === 0
                        ? 'bg-amber-400 text-amber-950 shadow-xs'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-900'
                        : idx === 2
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h5 className="font-extrabold text-gray-900 truncate">{st.staff.name}</h5>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded font-mono shrink-0">
                        {st.compositeScore} pts
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 uppercase block truncate">{st.staff.role}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right shrink-0">
                  <div>
                    <span className="font-bold text-emerald-800 font-mono block">
                      {formatMMK(st.commissionEarnedMMK)}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">{st.sessionsCount} sess • {formatMMK(st.salesRevenueMMK)}</span>
                  </div>

                  {!st.alreadyAwarded ? (
                    <button
                      onClick={() => setAwardModalCandidate(st)}
                      className="rounded-lg bg-amber-500 hover:bg-amber-600 text-amber-950 px-2 py-1 text-[11px] font-extrabold shadow-2xs shrink-0"
                      title="Grant Performance Bonus"
                    >
                      {isMm ? 'ဆုပေးမည်' : 'Award'}
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                      {isMm ? 'ပေးပြီး' : 'Awarded'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Performance Award */}
      {awardModalCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-amber-300 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-amber-950 font-bold">
                  <Gift className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    {isMm ? 'စွမ်းဆောင်ရည်ဆုကြေး အတည်ပြု ပေးအပ်ခြင်း' : 'Grant Performance Bonus'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {isMm ? 'ဝန်ထမ်းစာရင်းရှင်းတမ်း (Staff Ledger) ထဲသို့ ဆုကြေးထည့်သွင်းမည်' : 'Credit performance award directly to staff ledger'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setAwardModalCandidate(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl bg-amber-50/80 p-4 border border-amber-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">{isMm ? 'ဆုရ ဝန်ထမ်း:' : 'Winner Staff:'}</span>
                <span className="font-extrabold text-amber-950 text-sm">{awardModalCandidate.staff.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{isMm ? 'သက်ဆိုင်ရာ ကာလ/လ:' : 'Evaluation Month:'}</span>
                <span className="font-extrabold font-mono text-gray-900">{selectedPerformanceMonth}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{isMm ? 'စွမ်းဆောင်ရည် အမှတ်:' : 'Performance Score:'}</span>
                <span className="font-extrabold font-mono text-amber-800">{awardModalCandidate.compositeScore} / 100 Pts</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-800 block">
                {isMm ? 'ပေးအပ်မည့် ဆုကြေးငွေ ပမာဏ (MMK):' : 'Bonus Award Amount (MMK):'}
              </label>
              <input
                type="number"
                step="5000"
                value={awardAmountMMK}
                onChange={e => setAwardAmountMMK(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full rounded-xl border border-amber-300 bg-amber-50/50 p-2.5 text-base font-extrabold text-amber-950 font-mono focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-[11px] text-blue-900 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p>
                {isMm
                  ? 'ဤဆုကြေးငွေကို ဝန်ထမ်း၏ စာရင်းရှင်းတမ်း (Staff Ledger) ထဲသို့ "bonus" အဖြစ် ထည့်သွင်းပေးမည်ဖြစ်ပြီး သက်ဆိုင်ရာ လအတွက် လစာ/ကော်မရှင် စာရင်းရှင်းတမ်း (Monthly Settlement Payout) တွင် အလိုအလျောက် ပေါင်းစပ်ပေးသွားမည်ဖြစ်ပါသည်။'
                  : 'This award bonus will be credited to the staff ledger and automatically included in their monthly payout settlement calculation.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAwardModalCandidate(null)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
              >
                {isMm ? 'မလုပ်ဆောင်ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmAwardBonus}
                className="rounded-xl bg-amber-500 hover:bg-amber-600 px-5 py-2 text-xs font-black text-amber-950 shadow-md active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>{isMm ? 'အတည်ပြု ပေးအပ်မည်' : 'Confirm & Credit Bonus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Credit Portfolio & Debt Aging Summary */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {isMm ? 'ဖောက်သည် အကြွေးနှင့် ကြွေးကျန် ကာလခွဲခြားမှု အစီရင်ခံစာ' : 'Customer Credit & Debt Aging Report'}
              </h3>
              <p className="text-xs text-gray-500">
                {isMm ? 'ဖောက်သည်များ၏ စုစုပေါင်း အကြွေးကျန်များ' : 'Overview of active customer receivables and age distribution'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="rounded-xl bg-gray-50 p-2.5 border border-gray-100">
              <span className="text-gray-500 block text-[10px] uppercase">{isMm ? 'အကြွေးရှိသူ အရေအတွက်' : 'Debtors Count'}</span>
              <span className="text-sm font-bold text-gray-900">{debtorsCount} {isMm ? 'ဦး' : 'customers'}</span>
            </div>
            <div className="rounded-xl bg-rose-50 p-2.5 border border-rose-100">
              <span className="text-rose-600 block text-[10px] uppercase">{isMm ? 'စုစုပေါင်း အကြွေးကျန်' : 'Total Outstanding'}</span>
              <span className="text-sm font-extrabold text-rose-800 font-mono">{formatMMK(totalOutstandingCreditMMK)}</span>
            </div>
          </div>
        </div>

        {customerCreditSummaries.filter(s => s.derived.netOutstandingDebtMMK > 0).length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            {isMm ? 'လက်ရှိတွင် အကြွေးကျန်ရှိသော ဖောက်သည် မရှိပါ' : 'No customers currently have outstanding debt.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 bg-gray-50/50 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">{isMm ? 'ဖောက်သည်' : 'Customer'}</th>
                  <th className="py-2.5 px-3 text-right">{isMm ? 'စုစုပေါင်း ဝယ်ယူမှု' : 'Total Sales'}</th>
                  <th className="py-2.5 px-3 text-right">{isMm ? 'ပေးချေပြီး' : 'Total Paid'}</th>
                  <th className="py-2.5 px-3 text-right">{isMm ? 'အကြွေးကျန်' : 'Outstanding Debt'}</th>
                  <th className="py-2.5 px-3 text-center">{isMm ? '၀-၃၀ ရက်' : '0-30 Days'}</th>
                  <th className="py-2.5 px-3 text-center">{isMm ? '၃၁-၆၀ ရက်' : '31-60 Days'}</th>
                  <th className="py-2.5 px-3 text-center">{isMm ? '၆၁-၉၀ ရက်' : '61-90 Days'}</th>
                  <th className="py-2.5 px-3 text-center">{isMm ? '၉၀+ ရက်' : '90+ Days'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customerCreditSummaries
                  .filter(s => s.derived.netOutstandingDebtMMK > 0)
                  .map(({ customer, derived, agingBucket }) => (
                    <tr key={customer.id} className="hover:bg-gray-50/80">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-gray-900">{customer.name}</div>
                        <div className="text-[10px] text-gray-500">{customer.phone}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-700">
                        {formatMMK(derived.totalDebtIncurredMMK)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                        {formatMMK(derived.totalPaymentReceivedMMK)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-700 font-bold">
                        {formatMMK(derived.netOutstandingDebtMMK)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {agingBucket.bucket0to30MMK > 0 ? (
                          <span className="text-emerald-700 font-medium">{formatMMK(agingBucket.bucket0to30MMK)}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {agingBucket.bucket31to60MMK > 0 ? (
                          <span className="text-amber-700 font-medium">{formatMMK(agingBucket.bucket31to60MMK)}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {agingBucket.bucket61to90MMK > 0 ? (
                          <span className="text-orange-700 font-semibold">{formatMMK(agingBucket.bucket61to90MMK)}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {agingBucket.bucketOver90MMK > 0 ? (
                          <span className="text-rose-700 font-extrabold bg-rose-50 px-1.5 py-0.5 rounded">
                            {formatMMK(agingBucket.bucketOver90MMK)}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
