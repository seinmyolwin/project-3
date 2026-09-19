import React, { useState } from 'react';
import {
  Invoice,
  ExpenseRecord,
  StaffMember,
  StaffLedgerEntry,
  SessionRecord,
  UserAccount,
} from '../../types';
import { formatMMK } from '../../domain/financial';
import { Language } from '../../utils/translations';
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
} from 'lucide-react';

interface ReportsViewProps {
  invoices: Invoice[];
  expenses: ExpenseRecord[];
  staff: StaffMember[];
  staffLedger: StaffLedgerEntry[];
  sessions: SessionRecord[];
  currentUser: UserAccount;
  lang: Language;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  invoices,
  expenses,
  staff,
  staffLedger,
  sessions,
  lang,
}) => {
  const isMm = lang === 'my';

  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all'>('month');

  // Date filtering logic
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

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

  // Staff Performance Ranking
  const staffStats = staff.map(stf => {
    const comms = filteredStaffLedger
      .filter(e => e.staffId === stf.id && e.type === 'commission')
      .reduce((sum, e) => sum + e.amountMMK, 0);

    // Count sessions assigned
    const completedSessions = sessions.filter(
      s => s.status === 'completed' && s.assignedStaff.some(as => as.staffId === stf.id)
    );

    return {
      staff: stf,
      sessionsCount: completedSessions.length,
      commissionEarned: comms,
    };
  }).sort((a, b) => b.commissionEarned - a.commissionEarned);

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

        {/* Staff Performance Leaderboard (5 cols on lg) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Award className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-gray-900">
              {isMm ? 'ဝန်ထမ်းစွမ်းဆောင်ရည်နှင့် ကော်မရှင်ဇယား' : 'Staff Commission Leaderboard'}
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            {staffStats.map((st, idx) => (
              <div
                key={st.staff.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 p-3"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                      idx === 0
                        ? 'bg-amber-400 text-amber-950'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-800'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <h5 className="font-bold text-gray-900">{st.staff.name}</h5>
                    <span className="text-[10px] text-gray-500 uppercase">{st.staff.role}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-extrabold text-emerald-800 font-mono block">
                    {formatMMK(st.commissionEarned)}
                  </span>
                  <span className="text-[10px] text-gray-400">{st.sessionsCount} sessions</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
