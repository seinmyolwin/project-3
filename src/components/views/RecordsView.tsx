import React, { useState } from 'react';
import {
  CashClosingRecord,
  Invoice,
  ExpenseRecord,
  StaffLedgerEntry,
  StaffSettlement,
  CustomerCreditLedger,
  CustomerLedgerEntry,
  UserAccount,
  ShopSettings,
  StaffMember,
  SessionRecord,
  Customer,
} from '../../types';
import { Language } from '../../utils/translations';
import { CashClosingView } from './CashClosingView';
import { ReportsView } from './ReportsView';
import { BadgePercent, TrendingUp, BookOpen } from 'lucide-react';

interface RecordsViewProps {
  closings: CashClosingRecord[];
  invoices: Invoice[];
  expenses: ExpenseRecord[];
  staffLedger: StaffLedgerEntry[];
  settlements: StaffSettlement[];
  creditLedger: (CustomerCreditLedger | CustomerLedgerEntry)[];
  settings?: ShopSettings | null;
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
  staff: StaffMember[];
  sessions: SessionRecord[];
  customers?: Customer[];
  defaultSubTab?: 'cashClosing' | 'reports';
}

export const RecordsView: React.FC<RecordsViewProps> = ({
  closings,
  invoices,
  expenses,
  staffLedger,
  settlements,
  creditLedger,
  settings,
  currentUser,
  lang,
  onRefresh,
  staff,
  sessions,
  customers,
  defaultSubTab = 'cashClosing',
}) => {
  const isMm = lang === 'my';
  const [subTab, setSubTab] = useState<'cashClosing' | 'reports'>(defaultSubTab);

  return (
    <div className="space-y-6">
      {/* Records Sub-Tab Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isMm ? 'မှတ်တမ်းနှင့် အစီရင်ခံစာများ' : 'Records & Financial Reports'}
              </h2>
              <p className="text-xs text-gray-500">
                {isMm
                  ? 'နေ့စဉ် စာရင်းပိတ်မှတ်တမ်းနှင့် ဘဏ္ဍာရေး အမြတ်/အရှုံး အစီရင်ခံစာများ'
                  : 'Daily cash closing logs and financial profit & loss statements'}
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tab selection buttons */}
        <div className="flex flex-wrap gap-2 rounded-xl bg-gray-100 p-1.5 border border-gray-200">
          <button
            type="button"
            onClick={() => setSubTab('cashClosing')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
              subTab === 'cashClosing'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
            }`}
          >
            <BadgePercent className="h-4 w-4" />
            <span>{isMm ? 'နေ့စဉ် စာရင်းပိတ်' : 'Daily Cash Closing'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('reports')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
              subTab === 'reports'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>{isMm ? 'အစီရင်ခံစာ' : 'Reports & P&L'}</span>
          </button>
        </div>
      </div>

      {/* Sub-tab view rendering */}
      {subTab === 'cashClosing' && (
        <CashClosingView
          closings={closings}
          invoices={invoices}
          expenses={expenses}
          staffLedger={staffLedger}
          settlements={settlements}
          creditLedger={creditLedger as any}
          settings={settings}
          currentUser={currentUser}
          lang={lang}
          onRefresh={onRefresh}
        />
      )}

      {subTab === 'reports' && (
        <ReportsView
          invoices={invoices}
          expenses={expenses}
          staff={staff}
          staffLedger={staffLedger}
          sessions={sessions}
          customers={customers}
          creditLedger={creditLedger}
          currentUser={currentUser}
          lang={lang}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
};
