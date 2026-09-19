import React, { useState } from 'react';
import { ExpenseRecord, UserAccount, PaymentMethod } from '../../types';
import { db } from '../../db/database';
import { formatMMK } from '../../domain/financial';
import { Language } from '../../utils/translations';
import {
  ReceiptText,
  Plus,
  Filter,
  Calendar,
  Fuel,
  Shirt,
  Sparkles,
  Zap,
  Utensils,
  Wrench,
  MoreHorizontal,
  X,
} from 'lucide-react';

interface ExpensesViewProps {
  expenses: ExpenseRecord[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Form State
  const [category, setCategory] = useState<any>('generator_fuel');
  const [description, setDescription] = useState<string>('');
  const [amountMMK, setAmountMMK] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState<string>('');

  const filteredExpenses = expenses.filter(e => {
    if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;
    return true;
  });

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + e.amountMMK, 0);

  const handleAddExpense = async () => {
    if (amountMMK <= 0 || !description.trim()) {
      alert('Please provide description and valid amount');
      return;
    }

    try {
      await db.recordExpenseTransaction({
        category,
        categoryMm: getCategoryLabel(category),
        description: description.trim(),
        amountMMK,
        paymentMethod,
        receiptNumber: notes.trim() || undefined,
        currentUser,
      });

      setIsAddExpenseOpen(false);
      setDescription('');
      setAmountMMK(0);
      setNotes('');
      onRefresh();
    } catch (err: any) {
      alert('Error recording expense: ' + err.message);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'generator_fuel':
        return Fuel;
      case 'laundry_towels':
        return Shirt;
      case 'supplies_oils':
        return Sparkles;
      case 'utilities':
        return Zap;
      case 'staff_meals':
        return Utensils;
      case 'maintenance':
        return Wrench;
      default:
        return MoreHorizontal;
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'generator_fuel':
        return isMm ? 'မီးစက်ဒီဇယ်ဆီ' : 'Generator Fuel';
      case 'laundry_towels':
        return isMm ? 'ပုဝါနှင့် အဝတ်လျှော်ခ' : 'Laundry & Towels';
      case 'supplies_oils':
        return isMm ? 'နှိပ်နယ်ဆီနှင့် ပစ္စည်းများ' : 'Spa Oils & Supplies';
      case 'utilities':
        return isMm ? 'မီတာခနှင့် ရေဖိုး' : 'Electricity & Utilities';
      case 'staff_meals':
        return isMm ? 'ဝန်ထမ်း ထမင်းကျွေးစရိတ်' : 'Staff Meals';
      case 'maintenance':
        return isMm ? 'ပြုပြင်ထိန်းသိမ်းစရိတ်' : 'Maintenance';
      default:
        return isMm ? 'အထွေထွေစရိတ်' : 'Miscellaneous';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {isMm ? 'ဆိုင်တွင်း ကုန်ကျစရိတ်များ' : 'Shop Operating Expenses'}
          </h2>
          <p className="text-xs text-gray-500">
            {isMm
              ? 'မီးစက်ဆီ၊ ပုဝါလျှော်ခ၊ မီတာခနှင့် နေ့စဉ်ကုန်ကျစရိတ်များ မှတ်တမ်း'
              : 'Track fuel, laundry, electricity, maintenance, and supplies'}
          </p>
        </div>

        <button
          onClick={() => setIsAddExpenseOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          <span>{isMm ? 'စရိတ်အသစ် ထည့်သွင်းရန်' : 'Record Expense'}</span>
        </button>
      </div>

      {/* Summary KPI & Categories Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold text-gray-500">{isMm ? 'စုစုပေါင်း ကုန်ကျစရိတ်' : 'Total Filtered Expense'}</span>
          <p className="text-xl font-extrabold text-rose-700 font-mono mt-1">{formatMMK(totalFiltered)}</p>
          <span className="text-[11px] text-gray-400 mt-0.5 block">{filteredExpenses.length} expense entries</span>
        </div>

        <div className="sm:col-span-2 flex flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          {[
            { id: 'all', label: 'All' },
            { id: 'generator_fuel', label: 'Fuel (မီးစက်ဆီ)' },
            { id: 'laundry_towels', label: 'Laundry (ပုဝါ)' },
            { id: 'supplies_oils', label: 'Spa Oils (နှိပ်ဆီ)' },
            { id: 'utilities', label: 'Utilities (မီတာခ)' },
            { id: 'staff_meals', label: 'Meals (ထမင်းစရိတ်)' },
            { id: 'maintenance', label: 'Maintenance' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expense Records Table */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-y border-gray-200">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Amount (MMK)</th>
                <th className="py-2.5 px-3">Paid Via</th>
                <th className="py-2.5 px-3">Vendor / Recipient</th>
                <th className="py-2.5 px-3">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    {isMm ? 'စရိတ်မှတ်တမ်း မရှိသေးပါ' : 'No expense records found'}
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(exp => {
                  const Icon = getCategoryIcon(exp.category);
                  return (
                    <tr key={exp.id} className="hover:bg-gray-50/80">
                      <td className="py-2.5 px-3 font-mono">{exp.date}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-800">
                          <Icon className="h-3.5 w-3.5 text-gray-500" />
                          <span>{getCategoryLabel(exp.category)}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-900">{exp.description}</td>
                      <td className="py-2.5 px-3 font-extrabold text-rose-700 font-mono text-xs">
                        {formatMMK(exp.amountMMK)}
                      </td>
                      <td className="py-2.5 px-3 uppercase text-[11px] font-semibold">{exp.paymentMethod}</td>
                      <td className="py-2.5 px-3 text-gray-600">{exp.receiptNumber || '-'}</td>
                      <td className="py-2.5 px-3 text-gray-500">{exp.recordedBy}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD EXPENSE MODAL */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {isMm ? 'ကုန်ကျစရိတ် ထည့်သွင်းခြင်း' : 'Record Operating Expense'}
              </h3>
              <button onClick={() => setIsAddExpenseOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'စရိတ် အမျိုးအစား' : 'Expense Category'}
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                >
                  <option value="generator_fuel">{isMm ? 'မီးစက်ဒီဇယ်ဆီ (Generator Fuel)' : 'Generator Fuel'}</option>
                  <option value="laundry_towels">{isMm ? 'ပုဝါနှင့် အဝတ်လျှော်ခ (Laundry & Towels)' : 'Laundry & Towels'}</option>
                  <option value="supplies_oils">{isMm ? 'နှိပ်နယ်ဆီနှင့် ပစ္စည်းများ (Spa Oils & Supplies)' : 'Spa Oils & Supplies'}</option>
                  <option value="utilities">{isMm ? 'မီတာခနှင့် ရေဖိုး (Utilities)' : 'Electricity & Water'}</option>
                  <option value="staff_meals">{isMm ? 'ဝန်ထမ်း ထမင်းကျွေးစရိတ် (Staff Meals)' : 'Staff Meals'}</option>
                  <option value="maintenance">{isMm ? 'ပြုပြင်ထိန်းသိမ်းစရိတ် (Maintenance)' : 'Maintenance'}</option>
                  <option value="misc">{isMm ? 'အထွေထွေစရိတ် (Misc)' : 'Miscellaneous'}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'အကြောင်းအရာ / ဖော်ပြချက်' : 'Description'}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Diesel 10 Gallons for shop generator"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'ကျသင့်ငွေ ပမာဏ (ကျပ်)' : 'Amount (MMK)'}
                </label>
                <input
                  type="number"
                  step="1000"
                  value={amountMMK || ''}
                  onChange={e => setAmountMMK(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="e.g. 50000"
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
                      onClick={() => setPaymentMethod(pm as any)}
                      className={`rounded-xl border p-2 text-center text-xs font-semibold uppercase ${
                        paymentMethod === pm
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
                  {isMm ? 'ပေးချေသူ / ဆိုင်အမည် (Vendor)' : 'Vendor / Recipient'}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Denko Fuel Station"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleAddExpense}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                {isMm ? 'မှတ်တမ်းတင်မည်' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
