import React, { useState, useMemo } from 'react';
import { Customer, UserAccount } from '../../../types';
import { db } from '../../../db/database';
import { Language } from '../../../utils/translations';
import { formatMMK } from '../../../domain/financial';
import {
  CreditCard,
  Search,
  Plus,
  Edit2,
  Phone,
  CheckCircle2,
  XCircle,
  X,
  Save,
  ShieldCheck,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { ConfirmDeactivateModal } from './ConfirmDeactivateModal';

interface CustomersMasterTabProps {
  customers: Customer[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const CustomersMasterTab: React.FC<CustomersMasterTabProps> = ({
  customers,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';

  const [searchTerm, setSearchTerm] = useState('');
  const [creditFilter, setCreditFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [formName, setFormName] = useState('');
  const [formNameMm, setFormNameMm] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCreditAllowed, setFormCreditAllowed] = useState(false);
  const [formCreditLimitMMK, setFormCreditLimitMMK] = useState<number>(0);
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    item: Customer | null;
  }>({ isOpen: false, item: null });

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch =
        searchTerm === '' ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.nameMm && c.nameMm.includes(searchTerm)) ||
        c.phone.includes(searchTerm) ||
        (c.notes && c.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCredit =
        creditFilter === 'all'
          ? true
          : creditFilter === 'allowed'
          ? c.creditAllowed === true
          : c.creditAllowed !== true;

      const matchStatus =
        statusFilter === 'all' || (c.status || 'active') === statusFilter;

      const matchActive =
        activeFilter === 'all'
          ? true
          : activeFilter === 'active'
          ? c.isActive !== false
          : c.isActive === false;

      return matchSearch && matchCredit && matchStatus && matchActive;
    });
  }, [customers, searchTerm, creditFilter, statusFilter, activeFilter]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormNameMm('');
    setFormPhone('');
    setFormCreditAllowed(false);
    setFormCreditLimitMMK(0);
    setFormNotes('');
    setFormStatus('active');
    setFormIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormName(customer.name);
    setFormNameMm(customer.nameMm || '');
    setFormPhone(customer.phone);
    setFormCreditAllowed(customer.creditAllowed || false);
    setFormCreditLimitMMK(customer.creditLimitMMK || 0);
    setFormNotes(customer.notes || '');
    setFormStatus(customer.status || 'active');
    setFormIsActive(customer.isActive !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError(isMm ? 'ဖောက်သည်အမည် ထည့်သွင်းပေးပါ' : 'Customer name is required');
      return;
    }
    if (!formPhone.trim()) {
      setFormError(isMm ? 'ဖုန်းနံပါတ် ထည့်သွင်းပေးပါ' : 'Phone number is required');
      return;
    }

    const now = new Date().toISOString();

    try {
      if (editingCustomer) {
        await db.customers.update(editingCustomer.id, {
          name: formName.trim(),
          nameMm: formNameMm.trim() || undefined,
          phone: formPhone.trim(),
          creditAllowed: formCreditAllowed,
          creditLimitMMK: formCreditAllowed ? Number(formCreditLimitMMK) || 0 : 0,
          notes: formNotes.trim() || undefined,
          status: formStatus,
          isActive: formIsActive,
          updatedAt: now,
          updatedBy: currentUser.username,
        });
      } else {
        const newId = `cust_${Date.now()}`;
        await db.customers.add({
          id: newId,
          name: formName.trim(),
          nameMm: formNameMm.trim() || undefined,
          phone: formPhone.trim(),
          creditAllowed: formCreditAllowed,
          creditLimitMMK: formCreditAllowed ? Number(formCreditLimitMMK) || 0 : 0,
          currentBalanceMMK: 0,
          notes: formNotes.trim() || undefined,
          status: formStatus,
          isActive: formIsActive,
          createdAt: now,
          updatedAt: now,
          createdBy: currentUser.username,
        });
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err?.message || 'Error saving customer');
    }
  };

  const handleToggleActive = async (customer: Customer) => {
    try {
      await db.customers.update(customer.id, {
        isActive: customer.isActive === false,
        status: customer.isActive === false ? 'active' : 'inactive',
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.username,
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-600" />
            <span>{isMm ? 'ဖောက်သည်များ စီမံခန့်ခွဲမှု' : 'Customer & Client Master'}</span>
            <span className="ml-2 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5">
              {customers.length}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isMm
              ? 'ဖောက်သည် အမည်၊ ဖုန်း၊ အကြွေးခွင့်ပြုချက် (Credit Allowed)၊ အကြွေးကန့်သတ်ချက်နှင့် အထူးမှတ်ချက်များ'
              : 'Client directory, contact numbers, credit allowance flags, limits, and customer profile notes.'}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{isMm ? 'ဖောက်သည်အသစ် ထည့်သွင်းရန်' : 'Add New Customer'}</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isMm ? 'အမည်၊ ဖုန်း၊ မှတ်ချက် ရှာရန်...' : 'Search name, phone, notes...'}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div>
          <select
            value={creditFilter}
            onChange={(e) => setCreditFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'အကြွေးခွင့်ပြုချက်: အားလုံး' : 'Credit Allowance: All'}</option>
            <option value="allowed">{isMm ? 'အကြွေးခွင့်ပြုထားသူများ' : 'Credit Allowed'}</option>
            <option value="disallowed">{isMm ? 'လက်ငင်းသာ (No Credit)' : 'No Credit'}</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'အဆင့်အတန်း: အားလုံး' : 'Status: All'}</option>
            <option value="active">{isMm ? 'ပုံမှန် (Active)' : 'Active'}</option>
            <option value="suspended">{isMm ? 'ဆိုင်းငံ့ထား (Suspended)' : 'Suspended'}</option>
            <option value="inactive">{isMm ? 'ရပ်နား (Inactive)' : 'Inactive'}</option>
          </select>
        </div>

        <div>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'အသုံးပြုခွင့်: အားလုံး' : 'Active Status: All'}</option>
            <option value="active">{isMm ? 'အသုံးပြုဆဲ (Active)' : 'Active Only'}</option>
            <option value="inactive">{isMm ? 'ပိတ်ထားသောစာရင်း (Inactive)' : 'Inactive Only'}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-slate-50 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                <th className="py-3 px-4">{isMm ? 'ဖောက်သည်အမည်' : 'Customer Name'}</th>
                <th className="py-3 px-4">{isMm ? 'ဖုန်းနံပါတ်' : 'Phone Number'}</th>
                <th className="py-3 px-4">{isMm ? 'အကြွေးခွင့်ပြုချက်' : 'Credit Allowed'}</th>
                <th className="py-3 px-4">{isMm ? 'အကြွေးကန့်သတ်ချက်' : 'Credit Limit'}</th>
                <th className="py-3 px-4">{isMm ? 'လက်ရှိကြွေးကျန်' : 'Current Balance'}</th>
                <th className="py-3 px-4">{isMm ? 'မှတ်ချက်' : 'Customer Notes'}</th>
                <th className="py-3 px-4">{isMm ? 'စာရင်းဝင်' : 'Active'}</th>
                <th className="py-3 px-4 text-right">{isMm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    {isMm ? 'ဖောက်သည်မှတ်တမ်း ရှာမတွေ့ပါ' : 'No customers found.'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  return (
                    <tr
                      key={cust.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        cust.isActive === false ? 'opacity-60 bg-gray-50/50' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{cust.name}</div>
                        {cust.nameMm && (
                          <div className="text-[11px] text-gray-500">{cust.nameMm}</div>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 font-medium text-gray-800">
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span>{cust.phone}</span>
                        </div>
                      </td>

                      {/* Credit Allowed */}
                      <td className="py-3.5 px-4">
                        {cust.creditAllowed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="h-3 w-3" />
                            <span>{isMm ? 'ခွင့်ပြုထား' : 'Allowed'}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">
                            {isMm ? 'လက်ငင်းသာ' : 'Cash Only'}
                          </span>
                        )}
                      </td>

                      {/* Credit Limit */}
                      <td className="py-3.5 px-4 font-medium text-gray-700">
                        {cust.creditAllowed && cust.creditLimitMMK
                          ? formatMMK(cust.creditLimitMMK)
                          : '-'}
                      </td>

                      {/* Current Balance */}
                      <td className="py-3.5 px-4 font-bold">
                        {(cust.currentBalanceMMK || 0) > 0 ? (
                          <span className="text-rose-600">
                            {formatMMK(cust.currentBalanceMMK)}
                          </span>
                        ) : (
                          <span className="text-emerald-700">0 MMK</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 max-w-xs text-gray-500 text-[11px] truncate">
                        {cust.notes || '-'}
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {cust.isActive !== false ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{isMm ? 'အသုံးပြုဆဲ' : 'Active'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400 font-semibold text-[11px]">
                            <XCircle className="h-3.5 w-3.5" />
                            <span>{isMm ? 'ပိတ်ထားသည်' : 'Inactive'}</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(cust)}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            title={isMm ? 'ပြင်ဆင်ရန်' : 'Edit'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                item: cust,
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              cust.isActive !== false
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {cust.isActive !== false
                              ? isMm ? 'ပိတ်မည်' : 'Deactivate'
                              : isMm ? 'ပြန်ဖွင့်' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                <span>
                  {editingCustomer
                    ? isMm ? 'ဖောက်သည် အချက်အလက် ပြင်ဆင်ခြင်း' : 'Edit Customer'
                    : isMm ? 'ဖောက်သည်အသစ် ထည့်သွင်းခြင်း' : 'Add New Customer'}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* Name EN */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'ဖောက်သည်အမည် (အင်္ဂလိပ်)' : 'Customer Name (EN)'} *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. U Thant Zin"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                />
              </div>

              {/* Name MM */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'ဖောက်သည်အမည် (မြန်မာ)' : 'Customer Name (Myanmar)'}
                </label>
                <input
                  type="text"
                  value={formNameMm}
                  onChange={(e) => setFormNameMm(e.target.value)}
                  placeholder="ဥပမာ - ဦးသန့်ဇင်"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'ဖုန်းနံပါတ်' : 'Phone Number'} *
                </label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="09-xxxxxxxxx"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                />
              </div>

              {/* Credit Allowance & Limit */}
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="formCreditAllowed"
                    checked={formCreditAllowed}
                    onChange={(e) => setFormCreditAllowed(e.target.checked)}
                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                  />
                  <label htmlFor="formCreditAllowed" className="text-xs font-bold text-gray-800">
                    {isMm ? 'အကြွေးဝယ်ယူခွင့် ပေးမည် (Credit Allowed Flag)' : 'Allow Credit Purchases'}
                  </label>
                </div>

                {formCreditAllowed && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {isMm ? 'အများဆုံးအကြွေး ကန့်သတ်ချက် (MMK)' : 'Credit Limit (MMK)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10000"
                      value={formCreditLimitMMK}
                      onChange={(e) => setFormCreditLimitMMK(Number(e.target.value))}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                    />
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'အခြေအနေ' : 'Account Status'}
                </label>
                <select
                  value={formStatus}
                  onChange={(e) =>
                    setFormStatus(e.target.value as 'active' | 'inactive')
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                >
                  <option value="active">{isMm ? 'ပုံမှန် (Active)' : 'Active'}</option>
                  <option value="inactive">{isMm ? 'ရပ်နား (Inactive)' : 'Inactive'}</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'ဖောက်သည်မှတ်ချက်' : 'Notes / Preferences'}
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={isMm ? 'ကြိုက်နှစ်သက်သည့် အခန်း/ဝန်ဆောင်မှု...' : 'Preferences, VIP notes...'}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="formIsActiveCust"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                />
                <label htmlFor="formIsActiveCust" className="text-xs font-medium text-gray-700">
                  {isMm ? 'ဤဖောက်သည်ကို စနစ်အတွင်း အသုံးပြုခွင့်ပေးမည် (Active)' : 'Active customer record'}
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  <Save className="h-4 w-4" />
                  <span>{isMm ? 'သိမ်းဆည်းမည်' : 'Save Customer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.item && (
        <ConfirmDeactivateModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal({ isOpen: false, item: null })}
          onConfirm={() => handleToggleActive(confirmModal.item!)}
          title={isMm ? 'ဖောက်သည် အခြေအနေပြောင်းလဲခြင်း' : 'Update Customer Active Status'}
          itemName={confirmModal.item.name}
          currentStatus={confirmModal.item.isActive !== false}
          lang={lang}
        />
      )}
    </div>
  );
};
