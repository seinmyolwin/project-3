import React, { useState } from 'react';
import { CashClosingRecord, ShopSettings } from '../types';
import { formatMMK } from '../domain/financial';
import { Language } from '../utils/translations';
import { Printer, Download, X, FileText, CheckCircle2, Building2, Calendar, User } from 'lucide-react';

interface CashClosingPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  closingData: {
    date: string;
    shift: string;
    openedAt: string;
    closedAt: string;
    openedBy: string;
    closedBy: string;
    openingCashFloatMMK: number;
    cashSalesTotalMMK: number;
    cashCreditRepaymentsMMK: number;
    cashExpensesMMK: number;
    cashStaffAdvancesMMK: number;
    cashStaffSettlementsMMK: number;
    expectedCashInDrawerMMK: number;
    actualCountedCashMMK: number;
    cashDifferenceMMK: number;
    differenceReason?: string;
    kpayTotalMMK: number;
    waveTotalMMK: number;
    cbpayTotalMMK: number;
    creditSalesTotalMMK: number;
    totalGrossRevenueMMK: number;
    totalExpensesMMK: number;
    netCashFlowMMK: number;
    notes?: string;
  };
  settings: ShopSettings | null;
  lang: Language;
}

export const CashClosingPrintModal: React.FC<CashClosingPrintModalProps> = ({
  isOpen,
  onClose,
  closingData,
  settings,
  lang,
}) => {
  const isMm = lang === 'my';
  const [paperSize, setPaperSize] = useState<'A4' | 'Letter' | 'A5'>('A4');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalInflow =
    closingData.openingCashFloatMMK +
    closingData.cashSalesTotalMMK +
    closingData.cashCreditRepaymentsMMK;

  const totalOutflow =
    closingData.cashExpensesMMK +
    closingData.cashStaffAdvancesMMK +
    closingData.cashStaffSettlementsMMK;

  const isBalanced = closingData.cashDifferenceMMK === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Modal Container (Hidden during print) */}
      <div className="w-full max-w-3xl rounded-3xl border border-cyan-500/40 bg-[#0b0f19] p-6 text-slate-100 shadow-2xl space-y-6 print:m-0 print:p-0 print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* Top Control Bar (Hidden on print) */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                {isMm ? 'နေ့စဉ် ငွေစာရင်းပိတ် ရှင်းတမ်း PDF / ပရင့်' : 'Daily Cash Closing PDF & Print'}
              </h2>
              <p className="text-xs text-slate-400">
                {isMm ? 'စာရွက်ဆိုဒ် ရွေးချယ်၍ ပရင့်ထုတ်ပါ သို့မဟုတ် PDF အဖြစ်သိမ်းပါ' : 'Select paper size and print / save as PDF'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Paper Size Selector */}
            <div className="flex items-center gap-1.5 bg-[#111827] px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-xs text-slate-400 font-semibold">Size:</span>
              {(['A4', 'Letter', 'A5'] as const).map(sz => (
                <button
                  key={sz}
                  onClick={() => setPaperSize(sz)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    paperSize === sz
                      ? 'bg-cyan-500 text-slate-950 shadow-md'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              <Printer className="h-4 w-4" />
              <span>{isMm ? 'ပရင့်ထုတ်မည် / PDF သိမ်းမည်' : 'Print / Save as PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Sheet Container */}
        <div className={`mx-auto bg-white text-slate-900 p-8 rounded-2xl shadow-xl space-y-6 ${paperSize === 'A5' ? 'max-w-xl' : 'max-w-2xl'} print:shadow-none print:p-4 print:w-full print:max-w-none print:rounded-none`}>
          
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
            <div className="flex items-center justify-center gap-2">
              <Building2 className="h-6 w-6 text-emerald-700" />
              <h1 className="text-xl font-black tracking-tight text-slate-900">
                {isMm ? settings?.shopNameMm || 'ရွှေသီရိ စပါနှင့် ကာရာအိုကေ' : settings?.shopName || 'Shwe Thiri Spa & KTV'}
              </h1>
            </div>
            <p className="text-xs text-slate-600 font-medium">
              {settings?.address || 'Yangon, Myanmar'} • Tel: {settings?.phone || '09-977888999'}
            </p>
            <div className="pt-2">
              <span className="inline-block bg-slate-100 border border-slate-300 px-4 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider text-slate-800">
                {isMm ? 'နေ့စဉ် ငွေစာရင်းပိတ် ရှင်းတမ်း (Daily Cash Closing Report)' : 'DAILY CASH CLOSING & RECONCILIATION REPORT'}
              </span>
            </div>
          </div>

          {/* Meta Info Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">{isMm ? 'ရက်စွဲ (Date):' : 'Closing Date:'}</span>
                <span className="font-mono font-bold text-slate-900">{closingData.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">{isMm ? 'အလှည့် (Shift):' : 'Shift:'}</span>
                <span className="font-bold uppercase text-slate-900">{closingData.shift}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">{isMm ? 'ဖွင့်လှစ်သူ:' : 'Opened By:'}</span>
                <span className="font-bold text-slate-900">{closingData.openedBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">{isMm ? 'ပိတ်သိမ်းသူ:' : 'Closed By:'}</span>
                <span className="font-bold text-slate-900">{closingData.closedBy}</span>
              </div>
            </div>
          </div>

          {/* Mathematical Inflow & Outflow Table / Breakdown */}
          <div className="space-y-4 text-xs">
            {/* Inflows */}
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-4 space-y-2">
              <h3 className="font-bold text-emerald-900 text-sm border-b border-emerald-200 pb-1">
                {isMm ? '၁။ ငွေဝင်စာရင်းများ (Cash Inflows)' : '1. Cash Inflows'}
              </h3>
              <div className="space-y-1.5 pl-2">
                <div className="flex justify-between text-slate-700">
                  <span>{isMm ? 'အဖွင့်ငွေသား (Opening Cash Float):' : 'Opening Cash Float:'}</span>
                  <span className="font-mono font-bold">{formatMMK(closingData.openingCashFloatMMK)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>{isMm ? 'အခန်းနှင့် ဝန်ဆောင်မှု အရောင်းငွေသား:' : 'Cash Sales & Room Sessions:'}</span>
                  <span className="font-mono font-bold">{formatMMK(closingData.cashSalesTotalMMK)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>{isMm ? 'ဖောက်သည် အကြွေးပြန်ဆပ်ငွေသား:' : 'Cash Customer Debt Repayments:'}</span>
                  <span className="font-mono font-bold">{formatMMK(closingData.cashCreditRepaymentsMMK)}</span>
                </div>
                <div className="border-t border-emerald-200 pt-1.5 flex justify-between font-black text-emerald-950 text-sm">
                  <span>{isMm ? 'စုစုပေါင်း ရရှိငွေ (Total Inflows):' : 'Total Cash Inflows:'}</span>
                  <span className="font-mono">{formatMMK(totalInflow)}</span>
                </div>
              </div>
            </div>

            {/* Outflows */}
            <div className="rounded-xl border border-rose-300 bg-rose-50/40 p-4 space-y-2">
              <h3 className="font-bold text-rose-900 text-sm border-b border-rose-200 pb-1">
                {isMm ? '၂။ ငွေထွက်စာရင်းများ (Cash Outflows)' : '2. Cash Outflows'}
              </h3>
              <div className="space-y-1.5 pl-2">
                <div className="flex justify-between text-slate-700">
                  <span>{isMm ? 'ဆိုင်တွင်း သုံးစွဲစရိတ်ငွေသား (Expenses):' : 'Operating Expenses (Cash):'}</span>
                  <span className="font-mono font-bold text-rose-700">-{formatMMK(closingData.cashExpensesMMK)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>{isMm ? 'ဝန်ထမ်း ကြိုထုတ်ငွေသား (Staff Advances):' : 'Staff Advances:'}</span>
                  <span className="font-mono font-bold text-rose-700">-{formatMMK(closingData.cashStaffAdvancesMMK)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>{isMm ? 'ဝန်ထမ်းရှင်းတမ်း ပေးချေငွေသား (Staff Settlements):' : 'Staff Settlements Payouts:'}</span>
                  <span className="font-mono font-bold text-rose-700">-{formatMMK(closingData.cashStaffSettlementsMMK)}</span>
                </div>
                <div className="border-t border-rose-200 pt-1.5 flex justify-between font-black text-rose-950 text-sm">
                  <span>{isMm ? 'စုစုပေါင်း ငွေထွက် (Total Outflows):' : 'Total Cash Outflows:'}</span>
                  <span className="font-mono">-{formatMMK(totalOutflow)}</span>
                </div>
              </div>
            </div>

            {/* Reconciliation Box */}
            <div className="rounded-xl border-2 border-slate-900 bg-slate-900 text-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">
                    {isMm ? 'အံဆွဲထဲတွင် ရှိရမည့် ခန့်မှန်းငွေ (Expected Cash)' : 'Expected Cash in Drawer'}
                  </span>
                  <span className="text-xl font-mono font-black text-amber-400">
                    {formatMMK(closingData.expectedCashInDrawerMMK)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">
                    {isMm ? 'လက်တွေ့ရေတွက်ရရှိငွေ (Actual Counted)' : 'Actual Counted Cash'}
                  </span>
                  <span className="text-xl font-mono font-black text-emerald-400">
                    {formatMMK(closingData.actualCountedCashMMK)}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-2 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-300">{isMm ? 'ကွာဟချက် အခြေအနေ (Discrepancy):' : 'Discrepancy Status:'}</span>
                <span className={`font-mono text-sm px-3 py-1 rounded-lg ${
                  isBalanced
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : closingData.cashDifferenceMMK < 0
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {isBalanced ? (isMm ? 'ကိုက်ညီသည် (Balanced)' : 'Balanced (0)') : formatMMK(closingData.cashDifferenceMMK)}
                </span>
              </div>
            </div>

            {/* Digital Payments Summary */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                {isMm ? '၃။ ဒစ်ဂျစ်တယ်နှင့် အကြွေးအရောင်းများ (Digital & Credit)' : '3. Digital & Credit Breakdown'}
              </h3>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                  <span className="text-slate-500 block text-[10px]">KBZPay</span>
                  <span className="font-mono font-bold text-slate-900">{formatMMK(closingData.kpayTotalMMK)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                  <span className="text-slate-500 block text-[10px]">WavePay</span>
                  <span className="font-mono font-bold text-slate-900">{formatMMK(closingData.waveTotalMMK)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                  <span className="text-slate-500 block text-[10px]">Customer Debt</span>
                  <span className="font-mono font-bold text-slate-900">{formatMMK(closingData.creditSalesTotalMMK)}</span>
                </div>
              </div>
            </div>

            {closingData.notes && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <span className="font-bold text-slate-700 block mb-0.5">{isMm ? 'မှတ်ချက် (Notes):' : 'Closing Notes:'}</span>
                <p className="text-slate-600 italic">{closingData.notes}</p>
              </div>
            )}
          </div>

          {/* Signatures Footer */}
          <div className="grid grid-cols-2 gap-8 pt-10 text-xs">
            <div className="text-center space-y-8">
              <div className="border-b border-slate-400 pb-2"></div>
              <p className="font-bold text-slate-700">
                {isMm ? 'ငွေကိုင် / စာရင်းစစ် (Prepared By)' : 'Cashier / Prepared By'}
              </p>
            </div>
            <div className="text-center space-y-8">
              <div className="border-b border-slate-400 pb-2"></div>
              <p className="font-bold text-slate-700">
                {isMm ? 'မန်နေဂျာ / အတည်ပြုသူ (Approved By)' : 'Manager / Approved By'}
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
