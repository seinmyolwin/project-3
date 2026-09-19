import React, { useState } from 'react';
import {
  CashClosingRecord,
  Invoice,
  ExpenseRecord,
  StaffLedgerEntry,
  StaffSettlement,
  CustomerCreditLedger,
  UserAccount,
} from '../../types';
import { db } from '../../db/database';
import { formatMMK, calculateCashClosing } from '../../domain/financial';
import { Language } from '../../utils/translations';
import {
  CheckCircle2,
  AlertTriangle,
  Lock,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface CashClosingViewProps {
  closings: CashClosingRecord[];
  invoices: Invoice[];
  expenses: ExpenseRecord[];
  staffLedger: StaffLedgerEntry[];
  settlements: StaffSettlement[];
  creditLedger: CustomerCreditLedger[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const CashClosingView: React.FC<CashClosingViewProps> = ({
  closings,
  invoices,
  expenses,
  staffLedger,
  settlements,
  creditLedger,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [openingFloat, setOpeningFloat] = useState<number>(100000);
  const [actualCountedCash, setActualCountedCash] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  // Filter today's transactions
  const dayInvoices = invoices.filter(i => i.createdAt.startsWith(selectedDate) && i.status === 'paid');
  const dayExpenses = expenses.filter(e => e.date === selectedDate);
  const dayAdvances = staffLedger.filter(e => e.date === selectedDate && e.type === 'advance');
  const daySettlements = settlements.filter(s => s.paidAt.startsWith(selectedDate) && s.paymentMethod === 'cash');
  const dayCreditRepayments = creditLedger.filter(
    e => e.date === selectedDate && e.type === 'payment_received' && e.paymentMethod === 'cash'
  );

  // Inflows: Cash from sessions & direct sales
  let cashSalesInflow = 0;
  let kpayTotal = 0;
  let waveTotal = 0;
  let otherDigitalTotal = 0;
  let creditSalesTotal = 0;

  for (const inv of dayInvoices) {
    for (const p of inv.payments) {
      if (p.method === 'cash') cashSalesInflow += p.amountMMK;
      else if (p.method === 'kpay') kpayTotal += p.amountMMK;
      else if (p.method === 'wave') waveTotal += p.amountMMK;
      else if (p.method === 'credit') creditSalesTotal += p.amountMMK;
      else otherDigitalTotal += p.amountMMK;
    }
  }

  // Cash credit repayments
  const cashDebtRepaymentsInflow = dayCreditRepayments.reduce((sum, r) => sum + r.amountMMK, 0);

  // Outflows: Cash expenses
  const cashExpensesOutflow = dayExpenses
    .filter(e => e.paymentMethod === 'cash')
    .reduce((sum, e) => sum + e.amountMMK, 0);

  // Outflows: Staff advances
  const cashStaffAdvancesOutflow = dayAdvances.reduce((sum, a) => sum + a.amountMMK, 0);

  // Outflows: Staff settlements
  const cashStaffSettlementsOutflow = daySettlements.reduce((sum, s) => sum + s.netPayoutMMK, 0);

  // Reconciliation
  const reconciliation = calculateCashClosing({
    openingCashFloatMMK: openingFloat,
    cashSalesTotalMMK: cashSalesInflow,
    cashCreditRepaymentsMMK: cashDebtRepaymentsInflow,
    cashExpensesMMK: cashExpensesOutflow,
    cashStaffAdvancesMMK: cashStaffAdvancesOutflow,
    cashStaffSettlementsMMK: cashStaffSettlementsOutflow,
    actualCashCountedMMK: actualCountedCash,
  });

  const totalGrossRevenueMMK = dayInvoices.reduce((sum, i) => sum + i.totalMMK, 0);
  const totalExpensesMMK = dayExpenses.reduce((sum, e) => sum + e.amountMMK, 0);
  const netCashFlowMMK = reconciliation.totalCashInflowMMK - reconciliation.totalCashOutflowMMK;

  const handleExecuteClosing = async () => {
    if (actualCountedCash < 0) {
      alert('Please enter valid physical counted cash');
      return;
    }

    try {
      await db.performCashClosingTransaction({
        closing: {
          date: selectedDate,
          shift: 'full_day',
          openedAt: `${selectedDate}T09:00:00.000Z`,
          closedAt: new Date().toISOString(),
          openedBy: currentUser.name,
          closedBy: currentUser.name,
          openingCashFloatMMK: openingFloat,
          cashSalesTotalMMK: cashSalesInflow,
          cashCreditRepaymentsMMK: cashDebtRepaymentsInflow,
          cashExpensesMMK: cashExpensesOutflow,
          cashStaffAdvancesMMK: cashStaffAdvancesOutflow,
          cashStaffSettlementsMMK: cashStaffSettlementsOutflow,
          expectedCashInDrawerMMK: reconciliation.expectedCashInDrawerMMK,
          actualCashCountedMMK: actualCountedCash,
          cashDifferenceMMK: reconciliation.cashDifferenceMMK,
          differenceReason: closingNotes.trim() || undefined,
          kpayTotalMMK: kpayTotal,
          waveTotalMMK: waveTotal,
          cbpayTotalMMK: otherDigitalTotal,
          ayapayTotalMMK: 0,
          creditSalesTotalMMK: creditSalesTotal,
          totalGrossRevenueMMK,
          totalExpensesMMK,
          netCashFlowMMK,
          status: 'closed',
          notes: closingNotes.trim() || undefined,
        },
        currentUser,
      });

      alert(isMm ? 'နေ့စဉ် စာရင်းပိတ်ခြင်း အောင်မြင်ပါသည်' : 'Daily cash closing successfully recorded and locked!');
      onRefresh();
      setActiveTab('history');
    } catch (err: any) {
      alert('Cash closing error: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {isMm ? 'နေ့စဉ် ငွေစာရင်းပိတ်ခြင်းနှင့် ချိန်ညှိမှု' : 'Daily Cash Closing & Drawer Reconciliation'}
          </h2>
          <p className="text-xs text-gray-500">
            {isMm
              ? 'အဖွင့်လက်ကျန်၊ ငွေဝင်/ငွေထွက်နှင့် လက်ကျန်ငွေသား ချိန်ညှိစာရင်း'
              : 'Opening float, cash inflows, expenses, payouts, and counted drawer verification'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('current')}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold ${
              activeTab === 'current'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isMm ? 'ယနေ့ စာရင်းပိတ်ရန်' : 'Close Today'}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isMm ? 'ယခင်ပိတ်ပြီး စာရင်းများ' : 'Closing History'}
          </button>
        </div>
      </div>

      {activeTab === 'current' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Mathematical Reconciliation Breakdown */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900">
                {isMm ? 'ငွေသား စာရင်းရှင်းတမ်း (Audit Calculation)' : 'Cash Drawer Mathematical Audit'}
              </h3>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-mono"
              />
            </div>

            {/* Inflows Section */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-emerald-800 uppercase tracking-wider text-[11px] flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                {isMm ? 'ငွေဝင် စာရင်းများ (+ Cash Inflows)' : 'Cash Inflows (+)'}
              </span>
              <div className="rounded-xl bg-emerald-50/50 p-3 border border-emerald-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">{isMm ? 'အဖွင့်ငွေသား (Opening Float):' : 'Opening Cash Float:'}</span>
                  <input
                    type="number"
                    value={openingFloat}
                    onChange={e => setOpeningFloat(parseInt(e.target.value) || 0)}
                    className="w-32 rounded-lg border border-gray-200 bg-white p-1 text-right text-xs font-bold"
                  />
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>{isMm ? 'ဆက်ရှင်နှင့် အရောင်းငွေသား:' : 'Cash Sales & Sessions:'}</span>
                  <span className="font-bold text-emerald-900">{formatMMK(cashSalesInflow)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>{isMm ? 'ဖောက်သည် အကြွေးပြန်ဆပ်ငွေသား:' : 'Cash Customer Debt Repayments:'}</span>
                  <span className="font-bold text-emerald-900">{formatMMK(cashDebtRepaymentsInflow)}</span>
                </div>
                <div className="border-t border-emerald-200 pt-1 flex justify-between font-bold text-emerald-950">
                  <span>{isMm ? 'စုစုပေါင်း ငွေဝင်:' : 'Total Cash Available:'}</span>
                  <span>{formatMMK(reconciliation.totalCashInflowMMK + openingFloat)}</span>
                </div>
              </div>
            </div>

            {/* Outflows Section */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-rose-800 uppercase tracking-wider text-[11px] flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5" />
                {isMm ? 'ငွေထွက် စာရင်းများ (- Cash Outflows)' : 'Cash Outflows (-)'}
              </span>
              <div className="rounded-xl bg-rose-50/50 p-3 border border-rose-100 space-y-1.5">
                <div className="flex justify-between text-gray-700">
                  <span>{isMm ? 'ဆိုင်တွင်း ကုန်ကျစရိတ်များ:' : 'Cash Operating Expenses:'}</span>
                  <span className="font-bold text-rose-700">{formatMMK(cashExpensesOutflow)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>{isMm ? 'ဝန်ထမ်း ကြိုထုတ်ငွေသား:' : 'Cash Staff Advances:'}</span>
                  <span className="font-bold text-rose-700">{formatMMK(cashStaffAdvancesOutflow)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>{isMm ? 'ဝန်ထမ်းရှင်းတမ်း ပေးချေငွေသား:' : 'Cash Staff Settlement Payouts:'}</span>
                  <span className="font-bold text-rose-700">{formatMMK(cashStaffSettlementsOutflow)}</span>
                </div>
                <div className="border-t border-rose-200 pt-1 flex justify-between font-bold text-rose-950">
                  <span>{isMm ? 'စုစုပေါင်း ငွေထွက်:' : 'Total Cash Outflows:'}</span>
                  <span>-{formatMMK(reconciliation.totalCashOutflowMMK)}</span>
                </div>
              </div>
            </div>

            {/* Expected Result Box */}
            <div className="rounded-xl bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block uppercase">
                  {isMm ? 'အံဆွဲထဲ ရှိရမည့် ငွေသားစာရင်း' : 'Mathematical Expected Cash'}
                </span>
                <span className="text-xl font-black text-amber-400 font-mono">
                  {formatMMK(reconciliation.expectedCashInDrawerMMK)}
                </span>
              </div>
              <Lock className="h-6 w-6 text-slate-500" />
            </div>

            {/* Non-Cash / Digital Payments Overview */}
            <div className="rounded-xl bg-gray-50 p-3 border border-gray-100 text-xs space-y-1">
              <span className="font-bold text-gray-700 block mb-1">
                {isMm ? 'ဒစ်ဂျစ်တယ် ငွေပေးချေမှုများ (ဘဏ်/အိတ်စနစ်):' : 'Digital & Credit Receipts:'}
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">KBZPay (KPay):</span>
                  <span className="font-semibold text-gray-900">{formatMMK(kpayTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">WavePay:</span>
                  <span className="font-semibold text-gray-900">{formatMMK(waveTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer Debt:</span>
                  <span className="font-semibold text-gray-900">{formatMMK(creditSalesTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Other / CB / AYA:</span>
                  <span className="font-semibold text-gray-900">{formatMMK(otherDigitalTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Physical Cash Counting & Sign-Off */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs lg:col-span-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-sm font-bold text-gray-900">
                  {isMm ? 'လက်တွေ့ရေတွက်ရရှိငွေ ထည့်သွင်းခြင်း' : 'Physical Cash Verification'}
                </h3>
                <p className="text-xs text-gray-500">
                  {isMm ? 'ငွေကိုင်မှ အံဆွဲထဲရှိ ငွေသားကို ရေတွက်၍ ထည့်ပါ' : 'Count drawer bills and enter actual total'}
                </p>
              </div>

              {/* Input for counted cash */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-800">
                  {isMm ? 'ရေတွက်ရရှိသည့် ငွေသားစုစုပေါင်း (ကျပ်)' : 'Counted Cash in Drawer (MMK)'}
                </label>
                <input
                  type="number"
                  step="500"
                  value={actualCountedCash || ''}
                  onChange={e => setActualCountedCash(parseInt(e.target.value) || 0)}
                  placeholder="e.g. 350000"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-lg font-extrabold text-gray-900 focus:border-emerald-600 focus:bg-white focus:outline-hidden"
                />

                <button
                  type="button"
                  onClick={() => setActualCountedCash(reconciliation.expectedCashInDrawerMMK)}
                  className="mt-1.5 text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  {isMm ? 'မျှော်မှန်းငွေနှင့် ကိုက်ညီသည်ဟု ဖြည့်မည်' : 'Set to match expected amount'}
                </button>
              </div>

              {/* Discrepancy Box */}
              <div
                className={`rounded-2xl p-4 border text-xs ${
                  reconciliation.isBalanced
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                    : reconciliation.cashDifferenceMMK < 0
                    ? 'border-rose-200 bg-rose-50 text-rose-950'
                    : 'border-amber-200 bg-amber-50 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {reconciliation.isBalanced ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                  )}
                  <span className="font-bold text-sm">
                    {reconciliation.isBalanced
                      ? (isMm ? 'စာရင်း အတိအကျ ကိုက်ညီပါသည် (Balanced)' : 'Perfectly Balanced')
                      : reconciliation.cashDifferenceMMK < 0
                      ? (isMm ? 'ငွေလိုငွေ ဖြစ်ပေါ်နေပါသည် (Shortage)' : 'Cash Drawer Shortage')
                      : (isMm ? 'ငွေပိုငွေ ဖြစ်ပေါ်နေပါသည် (Surplus)' : 'Cash Drawer Surplus')}
                  </span>
                </div>

                <div className="flex justify-between items-center border-t border-current/10 pt-2 font-mono">
                  <span>{isMm ? 'ကွာဟချက် ပမာဏ:' : 'Discrepancy:'}</span>
                  <span className="text-base font-extrabold">
                    {formatMMK(reconciliation.cashDifferenceMMK)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  {isMm ? 'စာရင်းပိတ် မှတ်ချက်' : 'Closing Notes'}
                </label>
                <textarea
                  rows={2}
                  value={closingNotes}
                  onChange={e => setClosingNotes(e.target.value)}
                  placeholder={isMm ? 'ဥပမာ - ညနေပိုင်း ချိန်ညှိမှု ပြီးစီး...' : 'e.g. End of day shift sign-off'}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs text-gray-900"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleExecuteClosing}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800"
            >
              <Lock className="h-4 w-4" />
              <span>{isMm ? 'စာရင်းပိတ်၍ အတည်ပြုသိမ်းဆည်းမည်' : 'Close Shift & Lock Drawer'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* History View */
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-gray-900">
            {isMm ? 'ယခင် စာရင်းပိတ်မှတ်တမ်းများ' : 'Historical Shift Closing Records'}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-y border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Date & Shift</th>
                  <th className="py-2.5 px-3">Opening Float</th>
                  <th className="py-2.5 px-3">Cash Sales</th>
                  <th className="py-2.5 px-3">Cash Expenses</th>
                  <th className="py-2.5 px-3">Expected Cash</th>
                  <th className="py-2.5 px-3">Counted Cash</th>
                  <th className="py-2.5 px-3">Discrepancy</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Closed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {closings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-400">
                      {isMm ? 'ပိတ်ပြီးစာရင်း မရှိသေးပါ' : 'No closing records found'}
                    </td>
                  </tr>
                ) : (
                  closings.map(cl => (
                    <tr key={cl.id} className="hover:bg-gray-50/80">
                      <td className="py-2.5 px-3 font-mono font-bold text-gray-900">
                        {cl.date} ({cl.shift.toUpperCase()})
                      </td>
                      <td className="py-2.5 px-3 font-mono">{formatMMK(cl.openingCashFloatMMK)}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-700">{formatMMK(cl.cashSalesTotalMMK)}</td>
                      <td className="py-2.5 px-3 font-mono text-rose-600">{formatMMK(cl.cashExpensesMMK)}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold">{formatMMK(cl.expectedCashInDrawerMMK)}</td>
                      <td className="py-2.5 px-3 font-mono font-extrabold text-gray-900">
                        {formatMMK(cl.actualCashCountedMMK)}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <span
                          className={`font-bold ${
                            cl.cashDifferenceMMK === 0
                              ? 'text-emerald-700'
                              : cl.cashDifferenceMMK < 0
                              ? 'text-rose-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {formatMMK(cl.cashDifferenceMMK)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            cl.status === 'closed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {cl.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">{cl.closedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
