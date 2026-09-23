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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto cash-closing-modal-overlay">
      {/* Dynamic Print CSS per selected paper size */}
      <style>{`
        @media print {
          @page {
            size: ${paperSize === 'A4' ? 'A4' : paperSize === 'Letter' ? 'letter' : 'A5'} portrait;
            margin: ${paperSize === 'A5' ? '4mm' : '8mm'};
          }
          
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide UI overlay controls during print */
          .print\\:hidden, button, .no-print {
            display: none !important;
          }

          /* Reset modal container for print output */
          .cash-closing-modal-overlay {
            position: absolute !important;
            inset: 0 !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
            backdrop-filter: none !important;
          }

          .cash-closing-modal-container {
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }

          .cash-closing-print-sheet {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: ${paperSize === 'A5' ? '2mm' : '4mm'} !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Modal Container */}
      <div className="w-full max-w-3xl rounded-3xl border border-cyan-500/40 bg-[#0b0f19] p-6 text-slate-100 shadow-2xl space-y-6 print:m-0 print:p-0 print:border-none print:shadow-none print:bg-white print:text-black cash-closing-modal-container">
        
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
                {isMm ? 'စာရွက်ဆိုဒ် ရွေးချယ်၍ ပရင့်ထုတ်ပါ သို့မဟုတ် PDF အဖြစ်သိမ်းပါ' : 'Select target paper size and print / save as PDF'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Paper Size Selector */}
            <div className="flex items-center gap-1.5 bg-[#111827] px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-xs text-slate-400 font-semibold mr-1">
                {isMm ? 'စာရွက်ဆိုဒ်:' : 'Paper Size:'}
              </span>
              {([
                { id: 'A4', label: 'A4 (210×297mm)' },
                { id: 'Letter', label: 'Letter (8.5×11")' },
                { id: 'A5', label: 'A5 (148×210mm)' },
              ] as const).map(sz => (
                <button
                  key={sz.id}
                  onClick={() => setPaperSize(sz.id as 'A4' | 'Letter' | 'A5')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    paperSize === sz.id
                      ? 'bg-cyan-500 text-slate-950 shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                  title={sz.label}
                >
                  {sz.id}
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

        {/* Paper Size Info Note (Hidden on print) */}
        <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between print:hidden">
          <span>
            {isMm
              ? `လက်ရှိရွေးချယ်ထားသော စာရွက်ဆိုဒ် - ${paperSize} (ပရင့်စနစ်အတွက် @page CSS ပြင်ဆင်ပြီး)`
              : `Target Page Layout: ${paperSize} portrait (@page layout rule active)`}
          </span>
          <span className="text-slate-500 text-[10px]">
            {isMm ? '* စက်ပရင်တာနှင့် PDF စနစ်ကို Browser ထိန်းချုပ်ပါသည်' : '* OS & Printer dialog controls final output device'}
          </span>
        </div>

        {/* Printable Sheet Container */}
        <div
          className={`cash-closing-print-sheet mx-auto bg-white text-slate-900 rounded-2xl shadow-xl transition-all ${
            paperSize === 'A5'
              ? 'max-w-md p-4 text-[11px] space-y-3'
              : 'max-w-2xl p-7 text-xs space-y-5'
          } print:shadow-none print:w-full print:max-w-none print:rounded-none`}
        >
          
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-3 space-y-1">
            <div className="flex items-center justify-center gap-2">
              <Building2 className={`text-emerald-700 ${paperSize === 'A5' ? 'h-5 w-5' : 'h-6 w-6'}`} />
              <h1 className={`font-black tracking-tight text-slate-900 ${paperSize === 'A5' ? 'text-lg' : 'text-xl'}`}>
                {isMm ? settings?.shopNameMm || 'ရွှေသီရိ စပါနှင့် ကာရာအိုကေ' : settings?.shopName || 'Shwe Thiri Spa & KTV'}
              </h1>
            </div>
            <p className="text-[11px] text-slate-600 font-medium">
              {settings?.address || 'Yangon, Myanmar'} • Tel: {settings?.phone || '09-977888999'}
            </p>
            <div className="pt-1">
              <span className="inline-block bg-slate-100 border border-slate-300 px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
                {isMm ? 'နေ့စဉ် ငွေစာရင်းပိတ် ရှင်းတမ်း' : 'DAILY CASH CLOSING REPORT'}
              </span>
            </div>
          </div>

          {/* Meta Info Grid */}
          <div className={`grid grid-cols-2 gap-3 text-[11px] bg-slate-50 rounded-xl border border-slate-200 ${paperSize === 'A5' ? 'p-2.5' : 'p-3.5'}`}>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">{isMm ? 'ရက်စွဲ:' : 'Closing Date:'}</span>
                <span className="font-mono font-bold text-slate-900">{closingData.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">{isMm ? 'အလှည့်:' : 'Shift:'}</span>
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
          <div className={paperSize === 'A5' ? 'space-y-2 text-[11px]' : 'space-y-3.5 text-xs'}>
            {/* Inflows */}
            <div className={`rounded-xl border border-emerald-300 bg-emerald-50/40 space-y-1.5 ${paperSize === 'A5' ? 'p-2.5' : 'p-3.5'}`}>
              <h3 className="font-bold text-emerald-900 border-b border-emerald-200 pb-1 flex justify-between">
                <span>{isMm ? '၁။ ငွေဝင်စာရင်းများ (Cash Inflows)' : '1. Cash Inflows'}</span>
              </h3>
              <div className="space-y-1 pl-1">
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
                <div className="border-t border-emerald-200 pt-1 flex justify-between font-black text-emerald-950">
                  <span>{isMm ? 'စုစုပေါင်း ရရှိငွေ (Total Inflows):' : 'Total Cash Inflows:'}</span>
                  <span className="font-mono">{formatMMK(totalInflow)}</span>
                </div>
              </div>
            </div>

            {/* Outflows */}
            <div className={`rounded-xl border border-rose-300 bg-rose-50/40 space-y-1.5 ${paperSize === 'A5' ? 'p-2.5' : 'p-3.5'}`}>
              <h3 className="font-bold text-rose-900 border-b border-rose-200 pb-1 flex justify-between">
                <span>{isMm ? '၂။ ငွေထွက်စာရင်းများ (Cash Outflows)' : '2. Cash Outflows'}</span>
              </h3>
              <div className="space-y-1 pl-1">
                <div className="flex justify-between text-slate-700">
                  <span>{isMm ? 'သုံးစွဲစရိတ်ငွေသား (Expenses):' : 'Operating Expenses (Cash):'}</span>
                  <span className="font-mono font-bold text-rose-700">-{formatMMK(closingData.cashExpensesMMK)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>{isMm ? 'ဝန်ထမ်း ကြိုထုတ်ငွေသား (Advances):' : 'Staff Advances:'}</span>
                  <span className="font-mono font-bold text-rose-700">-{formatMMK(closingData.cashStaffAdvancesMMK)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>{isMm ? 'ဝန်ထမ်းရှင်းတမ်း ပေးချေငွေသား:' : 'Staff Settlements Payouts:'}</span>
                  <span className="font-mono font-bold text-rose-700">-{formatMMK(closingData.cashStaffSettlementsMMK)}</span>
                </div>
                <div className="border-t border-rose-200 pt-1 flex justify-between font-black text-rose-950">
                  <span>{isMm ? 'စုစုပေါင်း ငွေထွက် (Total Outflows):' : 'Total Cash Outflows:'}</span>
                  <span className="font-mono">-{formatMMK(totalOutflow)}</span>
                </div>
              </div>
            </div>

            {/* Reconciliation Box */}
            <div className={`rounded-xl border-2 border-slate-900 bg-slate-900 text-white space-y-2 ${paperSize === 'A5' ? 'p-3' : 'p-4'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    {isMm ? 'အံဆွဲထဲ ရှိရမည့် ငွေသား (Expected)' : 'Expected Cash in Drawer'}
                  </span>
                  <span className={`font-mono font-black text-amber-400 ${paperSize === 'A5' ? 'text-base' : 'text-xl'}`}>
                    {formatMMK(closingData.expectedCashInDrawerMMK)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    {isMm ? 'လက်တွေ့ရေတွက်ရရှိငွေ (Actual)' : 'Actual Counted Cash'}
                  </span>
                  <span className={`font-mono font-black text-emerald-400 ${paperSize === 'A5' ? 'text-base' : 'text-xl'}`}>
                    {formatMMK(closingData.actualCountedCashMMK)}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-1.5 flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-300">{isMm ? 'ကွာဟချက် အခြေအနေ:' : 'Discrepancy Status:'}</span>
                <span className={`font-mono px-2.5 py-0.5 rounded-lg ${
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
            <div className={`rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 ${paperSize === 'A5' ? 'p-2.5' : 'p-3.5'}`}>
              <h3 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">
                {isMm ? '၃။ ဒစ်ဂျစ်တယ်နှင့် အကြွေးအရောင်းများ (Digital & Credit)' : '3. Digital & Credit Breakdown'}
              </h3>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center">
                  <span className="text-slate-500 block text-[9px]">KBZPay</span>
                  <span className="font-mono font-bold text-slate-900">{formatMMK(closingData.kpayTotalMMK)}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center">
                  <span className="text-slate-500 block text-[9px]">WavePay</span>
                  <span className="font-mono font-bold text-slate-900">{formatMMK(closingData.waveTotalMMK)}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center">
                  <span className="text-slate-500 block text-[9px]">Customer Debt</span>
                  <span className="font-mono font-bold text-slate-900">{formatMMK(closingData.creditSalesTotalMMK)}</span>
                </div>
              </div>
            </div>

            {closingData.notes && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px]">
                <span className="font-bold text-slate-700 block mb-0.5">{isMm ? 'မှတ်ချက် (Notes):' : 'Closing Notes:'}</span>
                <p className="text-slate-600 italic">{closingData.notes}</p>
              </div>
            )}
          </div>

          {/* Signatures Footer */}
          <div className={`grid grid-cols-2 gap-6 text-[11px] ${paperSize === 'A5' ? 'pt-6' : 'pt-8'}`}>
            <div className="text-center space-y-6">
              <div className="border-b border-slate-400 pb-1"></div>
              <p className="font-bold text-slate-700">
                {isMm ? 'ငွေကိုင် / စာရင်းစစ်' : 'Cashier / Prepared By'}
              </p>
            </div>
            <div className="text-center space-y-6">
              <div className="border-b border-slate-400 pb-1"></div>
              <p className="font-bold text-slate-700">
                {isMm ? 'မန်နေဂျာ / အတည်ပြုသူ' : 'Manager / Approved By'}
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );

};
