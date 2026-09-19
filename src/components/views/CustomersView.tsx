import React, { useState } from 'react';
import { Customer, CustomerCreditLedger, UserAccount, PaymentMethod } from '../../types';
import { db } from '../../db/database';
import { formatMMK } from '../../domain/financial';
import { Language } from '../../utils/translations';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  X,
} from 'lucide-react';

interface CustomersViewProps {
  customers: Customer[];
  creditLedger: CustomerCreditLedger[];
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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [repayPaymentMethod, setRepayPaymentMethod] = useState<PaymentMethod>('cash');
  const [repayNotes, setRepayNotes] = useState<string>('');

  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustLimit, setNewCustLimit] = useState(1000000);

  const filteredCustomers = customers.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];
  const customerHistory = creditLedger.filter(e => e.customerId === selectedCustomer?.id);

  // Handle Repayment
  const handleConfirmRepayment = async () => {
    if (!selectedCustomer || repayAmount <= 0) return;
    try {
      await db.recordCustomerCreditRepaymentTransaction({
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

  // Handle Add New Customer
  const handleAddCustomer = async () => {
    if (!newCustName.trim()) return;
    try {
      const newCust: Customer = {
        id: 'cust_' + Date.now(),
        name: newCustName.trim(),
        phone: newCustPhone.trim() || '09-xxxxxxxxx',
        creditLimitMMK: newCustLimit || 500000,
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
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {isMm ? 'ဖောက်သည်များနှင့် အကြွေးစာရင်း စီမံခန့်ခွဲမှု' : 'Customers & Credit Ledger'}
          </h2>
          <p className="text-xs text-gray-500">
            {isMm
              ? 'VIP ဖောက်သည်များ၊ အကြွေးပေးမှတ်တမ်းနှင့် အကြွေးပြန်ဆပ်ငွေများ'
              : 'VIP customer profiles, credit limits, outstanding debt, and repayments'}
          </p>
        </div>

        <button
          onClick={() => setIsAddCustomerOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          <span>{isMm ? 'ဖောက်သည် အသစ်ထည့်ရန်' : 'Add New Customer'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Customer List (5 cols on lg) */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs lg:col-span-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isMm ? 'ဖောက်သည် အမည် သို့မဟုတ် ဖုန်း ရှာရန်...' : 'Search by name or phone...'}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-xs text-gray-900 focus:border-emerald-600 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
            {filteredCustomers.map(cust => {
              const isSelected = selectedCustomer?.id === cust.id;
              const hasDebt = cust.currentBalanceMMK > 0;

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
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{cust.name}</h4>
                    <p className="text-[11px] text-gray-500">{cust.phone}</p>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        hasDebt ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {hasDebt ? `${formatMMK(cust.currentBalanceMMK)}` : 'No Debt (ရှင်းပြီး)'}
                    </span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">
                      Limit: {formatMMK(cust.creditLimitMMK)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Customer Details & Credit History (7 cols on lg) */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs lg:col-span-7 space-y-4">
          {selectedCustomer ? (
            <>
              {/* Profile Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">{selectedCustomer.name}</h3>
                  <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-rose-50 px-3 py-1.5 text-right border border-rose-100">
                    <span className="text-[10px] font-semibold text-rose-700 block">
                      {isMm ? 'လက်ရှိ အကြွေးကျန်ငွေ:' : 'Current Debt Balance:'}
                    </span>
                    <span className="text-sm font-extrabold text-rose-900 font-mono">
                      {formatMMK(selectedCustomer.currentBalanceMMK)}
                    </span>
                  </div>

                  {selectedCustomer.currentBalanceMMK > 0 && (
                    <button
                      onClick={() => {
                        setRepayAmount(selectedCustomer.currentBalanceMMK);
                        setIsRepayModalOpen(true);
                      }}
                      className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                    >
                      {isMm ? 'အကြွေးဆပ်ငွေ လက်ခံမည်' : 'Receive Repayment'}
                    </button>
                  )}
                </div>
              </div>

              {/* History Table */}
              <div>
                <h4 className="text-xs font-bold text-gray-800 mb-2">
                  {isMm ? 'အကြွေးနှင့် ပြန်ဆပ်ငွေ စာရင်းမှတ်တမ်း' : 'Credit & Repayment History'}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-700">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-y border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Incurred (+)</th>
                        <th className="py-2.5 px-3">Repaid (-)</th>
                        <th className="py-2.5 px-3">Balance After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {customerHistory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-400">
                            {isMm ? 'အကြွေးမှတ်တမ်း မရှိပါ' : 'No credit history records'}
                          </td>
                        </tr>
                      ) : (
                        customerHistory.map(entry => (
                          <tr key={entry.id} className="hover:bg-gray-50/80">
                            <td className="py-2.5 px-3 font-mono">{entry.date}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  entry.type === 'debt_incurred'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {entry.type === 'debt_incurred' ? (
                                  <>
                                    <ArrowUpRight className="h-3 w-3" />
                                    <span>Debt</span>
                                  </>
                                ) : (
                                  <>
                                    <ArrowDownLeft className="h-3 w-3" />
                                    <span>Repaid</span>
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-gray-900">{entry.notes || '-'}</td>
                            <td className="py-2.5 px-3 font-bold text-rose-600 font-mono">
                              {entry.type === 'debt_incurred' ? formatMMK(entry.amountMMK) : '-'}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-emerald-700 font-mono">
                              {entry.type === 'payment_received' ? formatMMK(entry.amountMMK) : '-'}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-gray-900 font-mono">
                              {formatMMK(entry.balanceAfterMMK)}
                            </td>
                          </tr>
                        ))
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
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {isMm ? 'အကြွေးဆပ်ငွေ လက်ခံခြင်း' : 'Receive Credit Repayment'}
              </h3>
              <button onClick={() => setIsRepayModalOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="rounded-xl bg-gray-50 p-3 border border-gray-100">
                <span className="text-gray-600 block">Customer: <b className="text-gray-900">{selectedCustomer.name}</b></span>
                <span className="text-rose-700 block font-bold mt-1">
                  Total Outstanding Debt: {formatMMK(selectedCustomer.currentBalanceMMK)}
                </span>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'ပေးဆပ်ငွေ ပမာဏ (ကျပ်)' : 'Repayment Amount (MMK)'}
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedCustomer.currentBalanceMMK}
                  value={repayAmount || ''}
                  onChange={e => setRepayAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm font-bold text-gray-900"
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
                  {isMm ? 'မှတ်ချက်' : 'Notes / Reference'}
                </label>
                <input
                  type="text"
                  value={repayNotes}
                  onChange={e => setRepayNotes(e.target.value)}
                  placeholder="e.g. Paid in full via cash"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs text-gray-900"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
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

      {/* ADD CUSTOMER MODAL */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {isMm ? 'ဖောက်သည် အသစ်ဖွင့်ခြင်း' : 'Register New Customer'}
              </h3>
              <button onClick={() => setIsAddCustomerOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-gray-700">Customer Full Name</label>
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
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomer}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
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
