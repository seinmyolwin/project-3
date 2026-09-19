import React, { useState } from 'react';
import { Customer, CustomerCreditLedger, CustomerLedgerEntry, UserAccount, PaymentMethod } from '../../types';
import { db } from '../../db/database';
import { formatMMK, deriveCustomerLedgerBalances, calculateCustomerAgingReport } from '../../domain/financial';
import { Language } from '../../utils/translations';
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
} from 'lucide-react';

interface CustomersViewProps {
  customers: Customer[];
  creditLedger: (CustomerCreditLedger | CustomerLedgerEntry)[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  creditLedger,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'has_debt' | 'no_debt' | 'limit_exceeded'>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');

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

  // Add Customer Modal
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustLimit, setNewCustLimit] = useState(1000000);
  const [newCustCreditAllowed, setNewCustCreditAllowed] = useState(true);

  // Overall KPIs
  const totalOutstandingAllMMK = customers.reduce((sum, c) => sum + (c.currentBalanceMMK || 0), 0);
  const totalCreditLimitAllMMK = customers.reduce((sum, c) => sum + (c.creditLimitMMK || 0), 0);
  const customersWithDebtCount = customers.filter(c => (c.currentBalanceMMK || 0) > 0).length;

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
    if (!matchesSearch) return false;

    if (filterStatus === 'has_debt') return (c.currentBalanceMMK || 0) > 0;
    if (filterStatus === 'no_debt') return (c.currentBalanceMMK || 0) === 0;
    if (filterStatus === 'limit_exceeded') return c.creditLimitMMK > 0 && (c.currentBalanceMMK || 0) > c.creditLimitMMK;
    return true;
  });

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];
  const customerHistory = creditLedger
    .filter(e => e.customerId === selectedCustomer?.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const selectedDerivedBalances = deriveCustomerLedgerBalances(customerHistory);

  // Aging report for selected customer
  const agingReport = selectedCustomer
    ? calculateCustomerAgingReport({
        customers: [selectedCustomer],
        ledgerEntries: creditLedger,
      }).customerBreakdowns[0]
    : null;

  // Handle Repayment
  const handleConfirmRepayment = async () => {
    if (!selectedCustomer || repayAmount <= 0) return;
    try {
      await db.recordCustomerRepaymentTransaction({
        customerId: selectedCustomer.id,
        amountMMK: repayAmount,
        paymentMethod: repayPaymentMethod,
        notes: repayNotes.trim() || undefined,
        currentUser,
      });

      setIsRepayModalOpen(false);
      setRepayAmount(0);
      setRepayNotes('');
      onRefresh();
    } catch (err: any) {
      alert('Error recording repayment: ' + err.message);
    }
  };

  // Handle Adjustment
  const handleConfirmAdjustment = async () => {
    if (!selectedCustomer || adjustmentAmount <= 0) return;
    if (!adjustmentNotes.trim()) {
      alert('Please provide a mandatory reason for this adjustment.');
      return;
    }

    try {
      await db.recordCustomerCreditAdjustmentTransaction({
        customerId: selectedCustomer.id,
        type: adjustmentType,
        amountMMK: adjustmentAmount,
        notes: adjustmentNotes.trim(),
        currentUser,
      });

      setIsAdjustmentModalOpen(false);
      setAdjustmentAmount(0);
      setAdjustmentNotes('');
      onRefresh();
    } catch (err: any) {
      alert('Error recording ledger adjustment: ' + err.message);
    }
  };

  // Handle Reversal
  const handleConfirmReversal = async () => {
    if (!reversalTargetEntry) return;
    if (!reversalReason.trim()) {
      alert('A mandatory reason is required to perform a reversal.');
      return;
    }

    try {
      await db.reverseCustomerLedgerEntryTransaction({
        entryId: reversalTargetEntry.id,
        reason: reversalReason.trim(),
        currentUser,
      });

      setReversalTargetEntry(null);
      setReversalReason('');
      onRefresh();
    } catch (err: any) {
      alert('Reversal failed: ' + err.message);
    }
  };

  // Handle Add New Customer
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

  return (
    <div className="space-y-6">
      {/* Top Header & Overview KPIs */}
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
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            <span>{isMm ? 'ဖောက်သည် အသစ်ဖွင့်ရန်' : 'Register Customer'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Customer Selection & Search Panel (5 cols on lg) */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs lg:col-span-5 space-y-3">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isMm ? 'ဖောက်သည် အမည် သို့မဟုတ် ဖုန်း ရှာရန်...' : 'Search customer name or phone...'}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-xs text-gray-900 focus:border-emerald-600 focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1 border-b border-gray-100 pb-2 text-[11px]">
              {(['all', 'has_debt', 'no_debt', 'limit_exceeded'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                    filterStatus === st
                      ? 'bg-emerald-100 text-emerald-900 font-bold'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {st === 'all' && (isMm ? 'အားလုံး' : 'All')}
                  {st === 'has_debt' && (isMm ? 'အကြွေးရှိ' : 'Has Debt')}
                  {st === 'no_debt' && (isMm ? 'အကြွေးမရှိ' : 'No Debt')}
                  {st === 'limit_exceeded' && (isMm ? 'အကြွေးဘောင်ကျော်' : 'Exceeded')}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[550px] space-y-2 overflow-y-auto pr-1">
            {filteredCustomers.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                {isMm ? 'ရှာဖွေတွေ့ရှိမှု မရှိပါ' : 'No matching customers found'}
              </div>
            ) : (
              filteredCustomers.map(cust => {
                const isSelected = selectedCustomer?.id === cust.id;
                const balance = cust.currentBalanceMMK || 0;
                const limit = cust.creditLimitMMK || 0;
                const hasDebt = balance > 0;
                const isExceeded = limit > 0 && balance > limit;

                return (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-600/20'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-gray-900">{cust.name}</h4>
                        {isExceeded && (
                          <span className="rounded-full bg-rose-100 p-0.5 text-rose-700" title="Credit limit exceeded">
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 font-mono">{cust.phone}</p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold font-mono ${
                          hasDebt
                            ? isExceeded
                              ? 'bg-rose-200 text-rose-950 border border-rose-300'
                              : 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {hasDebt ? formatMMK(balance) : 'No Debt'}
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5 font-mono">
                        Limit: {formatMMK(limit)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Customer Profile, Detailed Ledger & Aging (7 cols on lg) */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs lg:col-span-7 space-y-5">
          {selectedCustomer ? (
            <>
              {/* Profile Card & Quick Actions */}
              <div className="border-b border-gray-100 pb-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900">{selectedCustomer.name}</h3>
                      {selectedCustomer.creditAllowed !== false ? (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          {isMm ? 'အကြွေးပေးခွင့်ပြု' : 'Credit Allowed'}
                        </span>
                      ) : (
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                          {isMm ? 'အကြွေးပေးခွင့်မရှိ' : 'Credit Disabled'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedCustomer.phone}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsAdjustmentModalOpen(true)}
                      className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-xs"
                    >
                      {isMm ? 'စာရင်းပြင်ဆင်ရန်' : 'Record Adjustment'}
                    </button>

                    <button
                      onClick={() => {
                        setRepayAmount(selectedDerivedBalances.netOutstandingDebtMMK || selectedCustomer.currentBalanceMMK || 0);
                        setIsRepayModalOpen(true);
                      }}
                      className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                    >
                      {isMm ? 'ပြန်ဆပ်ငွေ လက်ခံမည်' : 'Receive Repayment'}
                    </button>
                  </div>
                </div>

                {/* Balance Metrics Grid */}
                <div className="grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-3 border border-gray-100">
                  <div>
                    <span className="text-[10px] text-gray-500 block uppercase font-bold">
                      {isMm ? 'စုစုပေါင်း အကြွေးယူခဲ့သမျှ' : 'Total Debt Incurred'}
                    </span>
                    <span className="text-sm font-extrabold text-gray-900 font-mono">
                      {formatMMK(selectedDerivedBalances.totalDebtIncurredMMK)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-500 block uppercase font-bold">
                      {isMm ? 'စုစုပေါင်း ပြန်ဆပ်ပြီး' : 'Total Repaid'}
                    </span>
                    <span className="text-sm font-extrabold text-emerald-700 font-mono">
                      {formatMMK(selectedDerivedBalances.totalPaymentReceivedMMK)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-rose-700 block uppercase font-bold">
                      {isMm ? 'အကြွေးကျန် ပမာဏ' : 'Net Outstanding'}
                    </span>
                    <span className="text-sm font-black text-rose-950 font-mono">
                      {formatMMK(selectedDerivedBalances.netOutstandingDebtMMK)}
                    </span>
                  </div>
                </div>

                {/* Credit Limit Usage Progress Bar */}
                {selectedCustomer.creditLimitMMK > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-gray-600">
                      <span>Credit Limit: {formatMMK(selectedCustomer.creditLimitMMK)}</span>
                      <span>
                        {Math.min(
                          100,
                          Math.round(
                            (selectedDerivedBalances.netOutstandingDebtMMK / selectedCustomer.creditLimitMMK) * 100
                          )
                        )}
                        % Used
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          selectedDerivedBalances.netOutstandingDebtMMK > selectedCustomer.creditLimitMMK
                            ? 'bg-rose-600'
                            : selectedDerivedBalances.netOutstandingDebtMMK > selectedCustomer.creditLimitMMK * 0.8
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            (selectedDerivedBalances.netOutstandingDebtMMK / selectedCustomer.creditLimitMMK) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Debt Aging Breakdown Section */}
              {agingReport && selectedDerivedBalances.netOutstandingDebtMMK > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                  <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-700" />
                    <span>{isMm ? 'အကြွေးကျန် ကာလခွဲခြားမှု (Aging Analysis)' : 'Debt Aging Breakdown'}</span>
                  </h4>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-white p-2 border border-amber-100">
                      <span className="text-[10px] text-gray-500 block">0–30 Days</span>
                      <span className="font-bold text-gray-900 font-mono">
                        {formatMMK(agingReport.bucket0to30MMK)}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-amber-100">
                      <span className="text-[10px] text-gray-500 block">31–60 Days</span>
                      <span className="font-bold text-amber-800 font-mono">
                        {formatMMK(agingReport.bucket31to60MMK)}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-amber-100">
                      <span className="text-[10px] text-gray-500 block">61–90 Days</span>
                      <span className="font-bold text-orange-800 font-mono">
                        {formatMMK(agingReport.bucket61to90MMK)}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-amber-100">
                      <span className="text-[10px] text-gray-500 block">90+ Days</span>
                      <span className="font-extrabold text-rose-800 font-mono">
                        {formatMMK(agingReport.bucketOver90MMK)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Traceable Ledger History Table */}
              <div>
                <h4 className="text-xs font-bold text-gray-800 mb-2.5">
                  {isMm ? 'လယ်ဂျာ မှတ်တမ်းအပြည့်အစုံ (Traceable Customer Ledger)' : 'Traceable Customer Financial Ledger'}
                </h4>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-left text-xs text-gray-700">
                    <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Notes / Ref</th>
                        <th className="py-2.5 px-3">Incurred (+)</th>
                        <th className="py-2.5 px-3">Repaid (-)</th>
                        <th className="py-2.5 px-3">Balance After</th>
                        <th className="py-2.5 px-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {customerHistory.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-400">
                            {isMm ? 'အကြွေးမှတ်တမ်း မရှိပါ' : 'No credit history records'}
                          </td>
                        </tr>
                      ) : (
                        customerHistory.map(entry => {
                          const isDebt = entry.type === 'debt_incurred';
                          const isPayment = entry.type === 'payment_received';
                          const isReversal = entry.type === 'debt_reversal' || (entry.type as string) === 'credit_reversal';
                          const isAdj = entry.type === 'adjustment';

                          return (
                            <tr key={entry.id} className="hover:bg-gray-50/80">
                              <td className="py-2.5 px-3 font-mono text-[11px]">{entry.date}</td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                    isDebt
                                      ? 'bg-rose-100 text-rose-800'
                                      : isPayment
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : isReversal
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {isDebt && 'DEBT (+)'}
                                  {isPayment && 'PAYMENT (-)'}
                                  {isReversal && 'REVERSAL'}
                                  {isAdj && 'ADJUSTMENT'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-gray-900 max-w-[180px] truncate">
                                {entry.notes || '-'}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-rose-600 font-mono">
                                {isDebt || (isAdj && entry.amountMMK > 0)
                                  ? formatMMK(Math.abs(entry.amountMMK))
                                  : '-'}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-emerald-700 font-mono">
                                {isPayment || isReversal || (isAdj && entry.amountMMK < 0)
                                  ? formatMMK(Math.abs(entry.amountMMK))
                                  : '-'}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-gray-900 font-mono">
                                {formatMMK(entry.balanceAfterMMK)}
                              </td>
                              <td className="py-2.5 px-3">
                                {!isReversal && (
                                  <button
                                    onClick={() => setReversalTargetEntry(entry)}
                                    title="Reverse this ledger entry"
                                    className="rounded-lg bg-gray-100 p-1 text-gray-600 hover:bg-rose-100 hover:text-rose-700"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-gray-400">
              {isMm ? 'ဖောက်သည် ရွေးချယ်ပါ' : 'Select a customer from the left list'}
            </div>
          )}
        </div>
      </div>

      {/* RECEIVE REPAYMENT MODAL */}
      {isRepayModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {isMm ? 'အကြွေးဆပ်ငွေ လက်ခံခြင်း' : 'Receive Credit Repayment'}
              </h3>
              <button onClick={() => setIsRepayModalOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
                <span className="text-gray-700 block">Customer: <b className="text-gray-900">{selectedCustomer.name}</b></span>
                <span className="text-rose-800 block font-extrabold mt-1 text-sm font-mono">
                  Net Outstanding Debt: {formatMMK(selectedDerivedBalances.netOutstandingDebtMMK)}
                </span>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'ပေးဆပ်ငွေ ပမာဏ (ကျပ်)' : 'Repayment Amount (MMK)'}
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedDerivedBalances.netOutstandingDebtMMK}
                  value={repayAmount || ''}
                  onChange={e => setRepayAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm font-bold text-gray-900 font-mono"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'ငွေပေးချေမှု နည်းလမ်း' : 'Payment Method'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['cash', 'kpay', 'wave'].map(pm => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setRepayPaymentMethod(pm as any)}
                      className={`rounded-xl border p-2 text-center text-xs font-semibold uppercase ${
                        repayPaymentMethod === pm
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'မှတ်ချက် / ရည်ညွှန်းချက်' : 'Notes / Payment Reference'}
                </label>
                <input
                  type="text"
                  value={repayNotes}
                  onChange={e => setRepayNotes(e.target.value)}
                  placeholder="e.g. Paid partial repayment via KPay"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRepayModalOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={repayAmount <= 0}
                onClick={handleConfirmRepayment}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirm Repayment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD ADJUSTMENT MODAL */}
      {isAdjustmentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {isMm ? 'ဖောက်သည် အကြွေးစာရင်း ပြင်ဆင်ခြင်း' : 'Record Ledger Adjustment'}
              </h3>
              <button onClick={() => setIsAdjustmentModalOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-gray-50 p-3 border border-gray-100">
                <span className="text-gray-600 block">Customer: <b className="text-gray-900">{selectedCustomer.name}</b></span>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">Adjustment Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('adjustment_credit')}
                    className={`rounded-xl border p-2.5 text-center text-xs font-bold ${
                      adjustmentType === 'adjustment_credit'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    Credit (- Debt)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('adjustment_debit')}
                    className={`rounded-xl border p-2.5 text-center text-xs font-bold ${
                      adjustmentType === 'adjustment_debit'
                        ? 'border-rose-600 bg-rose-50 text-rose-900 ring-1 ring-rose-600'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    Debit (+ Debt)
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">Adjustment Amount (MMK)</label>
                <input
                  type="number"
                  min="1"
                  value={adjustmentAmount || ''}
                  onChange={e => setAdjustmentAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm font-bold text-gray-900 font-mono"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-rose-700">
                  Mandatory Adjustment Reason *
                </label>
                <textarea
                  rows={2}
                  value={adjustmentNotes}
                  onChange={e => setAdjustmentNotes(e.target.value)}
                  placeholder="e.g. Approved discount adjustment / Correction of billing error"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={adjustmentAmount <= 0 || !adjustmentNotes.trim()}
                onClick={handleConfirmAdjustment}
                className="rounded-xl bg-gray-900 px-5 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
              >
                Save Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVERSAL PROMPT MODAL */}
      {reversalTargetEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-rose-900 flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                <span>Confirm Ledger Entry Reversal</span>
              </h3>
              <button onClick={() => setReversalTargetEntry(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-600">
                You are about to reverse Entry <b className="font-mono">{reversalTargetEntry.id}</b> ({reversalTargetEntry.type}) for amount <b className="font-mono text-gray-900">{formatMMK(reversalTargetEntry.amountMMK)}</b>. Financial history is preserved; an opposite reversal ledger entry will be posted.
              </p>

              <div>
                <label className="mb-1 block font-semibold text-rose-700">
                  Mandatory Reversal Reason *
                </label>
                <input
                  type="text"
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  placeholder="e.g. Wrong entry posted by cashier / Customer requested correction"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReversalTargetEntry(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reversalReason.trim()}
                onClick={handleConfirmReversal}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CUSTOMER MODAL */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {isMm ? 'ဖောက်သည် အသစ်ဖွင့်ခြင်း' : 'Register New Customer'}
              </h3>
              <button onClick={() => setIsAddCustomerOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-gray-700">Customer Full Name *</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="e.g. U Thant Zin"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">Phone Number</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  placeholder="09-xxxxxxxxx"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900 font-mono"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">Credit Limit (MMK)</label>
                <input
                  type="number"
                  step="50000"
                  value={newCustLimit}
                  onChange={e => setNewCustLimit(parseInt(e.target.value) || 0)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="creditAllowed"
                  checked={newCustCreditAllowed}
                  onChange={e => setNewCustCreditAllowed(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="creditAllowed" className="font-semibold text-gray-700">
                  Allow Credit Sales for this customer
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newCustName.trim()}
                onClick={handleAddCustomer}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Save Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

