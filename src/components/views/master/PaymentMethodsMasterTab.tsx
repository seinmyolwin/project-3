import React, { useState, useMemo } from 'react';
import { PaymentMethodRecord, PaymentMethod, UserAccount } from '../../../types';
import { db } from '../../../db/database';
import { Language } from '../../../utils/translations';
import {
  Wallet,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  X,
  Save,
  CreditCard,
  Building,
  Smartphone,
  Banknote,
} from 'lucide-react';
import { ConfirmDeactivateModal } from './ConfirmDeactivateModal';

interface PaymentMethodsMasterTabProps {
  paymentMethods: PaymentMethodRecord[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const PaymentMethodsMasterTab: React.FC<PaymentMethodsMasterTabProps> = ({
  paymentMethods,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethodRecord | null>(null);

  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formNameMm, setFormNameMm] = useState('');
  const [formType, setFormType] = useState<PaymentMethodRecord['type']>('digital_wallet');
  const [formAccountName, setFormAccountName] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formSortOrder, setFormSortOrder] = useState<number>(1);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    item: PaymentMethodRecord | null;
  }>({ isOpen: false, item: null });

  const filteredMethods = useMemo(() => {
    return paymentMethods.filter((m) => {
      const matchSearch =
        searchTerm === '' ||
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.nameMm && m.nameMm.includes(searchTerm)) ||
        m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.accountNumber && m.accountNumber.includes(searchTerm));

      const matchType = typeFilter === 'all' || m.type === typeFilter;

      const matchActive =
        activeFilter === 'all'
          ? true
          : activeFilter === 'active'
          ? m.isActive !== false
          : m.isActive === false;

      return matchSearch && matchType && matchActive;
    });
  }, [paymentMethods, searchTerm, typeFilter, activeFilter]);

  const handleOpenAdd = () => {
    setEditingMethod(null);
    setFormCode(`PAY-${Date.now().toString().slice(-4)}`);
    setFormName('');
    setFormNameMm('');
    setFormType('digital_wallet');
    setFormAccountName('');
    setFormAccountNumber('');
    setFormSortOrder(paymentMethods.length + 1);
    setFormIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (method: PaymentMethodRecord) => {
    setEditingMethod(method);
    setFormCode(method.code);
    setFormName(method.name);
    setFormNameMm(method.nameMm || '');
    setFormType(method.type);
    setFormAccountName(method.accountName || '');
    setFormAccountNumber(method.accountNumber || '');
    setFormSortOrder(method.sortOrder || 1);
    setFormIsActive(method.isActive !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formCode.trim()) {
      setFormError(isMm ? 'ငွေပေးချေမှုကုဒ် ထည့်သွင်းပေးပါ' : 'Payment code is required');
      return;
    }
    if (!formName.trim()) {
      setFormError(isMm ? 'ငွေပေးချေမှုအမည် ထည့်သွင်းပေးပါ' : 'Payment name is required');
      return;
    }

    const now = new Date().toISOString();

    try {
      if (editingMethod) {
        await db.paymentMethods.update(editingMethod.id, {
          code: formCode.trim().toLowerCase() as PaymentMethod,
          name: formName.trim(),
          nameMm: formNameMm.trim() || formName.trim(),
          type: formType,
          accountName: formAccountName.trim() || undefined,
          accountNumber: formAccountNumber.trim() || undefined,
          sortOrder: Number(formSortOrder) || 1,
          isActive: formIsActive,
          updatedAt: now,
          updatedBy: currentUser.username,
        });
      } else {
        const newId = `pm_${Date.now()}`;
        await db.paymentMethods.add({
          id: newId,
          code: formCode.trim().toLowerCase() as PaymentMethod,
          name: formName.trim(),
          nameMm: formNameMm.trim() || formName.trim(),
          type: formType,
          accountName: formAccountName.trim() || undefined,
          accountNumber: formAccountNumber.trim() || undefined,
          sortOrder: Number(formSortOrder) || 1,
          isActive: formIsActive,
          createdAt: now,
          updatedAt: now,
          createdBy: currentUser.username,
        });
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err?.message || 'Error saving payment method');
    }
  };

  const handleToggleActive = async (method: PaymentMethodRecord) => {
    try {
      await db.paymentMethods.update(method.id, {
        isActive: method.isActive === false,
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
            <Wallet className="h-5 w-5 text-indigo-600" />
            <span>{isMm ? 'ငွေပေးချေမှု နည်းလမ်းများ စီမံခန့်ခွဲမှု' : 'Payment Methods Master'}</span>
            <span className="ml-2 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5">
              {paymentMethods.length}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isMm
              ? 'ငွေသား (Cash)၊ KPay၊ WavePay၊ ဘဏ်လွှဲနှင့် အကြွေး (Credit) အကောင့်နံပါတ်များ စီစဉ်သတ်မှတ်ခြင်း'
              : 'Configure payment channels, mobile wallets, QR payee accounts, and customer credit ledger mappings.'}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{isMm ? 'ငွေပေးချေမှုနည်းလမ်းသစ် ထည့်ရန်' : 'Add Payment Method'}</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isMm ? 'ကုဒ်၊ အမည်၊ အကောင့်နံပါတ် ရှာရန်...' : 'Search code, name, account...'}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'အမျိုးအစား: အားလုံး' : 'Type: All'}</option>
            <option value="cash">{isMm ? 'ငွေသား (Cash)' : 'Cash'}</option>
            <option value="digital_wallet">{isMm ? 'မိုဘိုင်းပိုက်ဆံအိတ် (Digital Wallet)' : 'Digital Wallet'}</option>
            <option value="bank_transfer">{isMm ? 'ဘဏ်လွှဲ (Bank Transfer)' : 'Bank Transfer'}</option>
            <option value="credit">{isMm ? 'ဖောက်သည်အကြွေး (Credit)' : 'Credit'}</option>
          </select>
        </div>

        <div>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'အခြေအနေ: အားလုံး' : 'Status: All'}</option>
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
                <th className="py-3 px-4">{isMm ? 'ကုဒ်' : 'Code'}</th>
                <th className="py-3 px-4">{isMm ? 'နည်းလမ်းအမည်' : 'Payment Method Name'}</th>
                <th className="py-3 px-4">{isMm ? 'အမျိုးအစား' : 'Channel Type'}</th>
                <th className="py-3 px-4">{isMm ? 'အကောင့်ပိုင်ရှင်နှင့် နံပါတ်' : 'Payee Account Info'}</th>
                <th className="py-3 px-4">{isMm ? 'အစဉ်လိုက်' : 'Sort Order'}</th>
                <th className="py-3 px-4">{isMm ? 'စာရင်းဝင်' : 'Active'}</th>
                <th className="py-3 px-4 text-right">{isMm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredMethods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    {isMm ? 'ငွေပေးချေမှုနည်းလမ်း ရှာမတွေ့ပါ' : 'No payment methods found.'}
                  </td>
                </tr>
              ) : (
                filteredMethods.map((m) => {
                  return (
                    <tr
                      key={m.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        m.isActive === false ? 'opacity-60 bg-gray-50/50' : ''
                      }`}
                    >
                      {/* Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-900">
                        {m.code}
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{m.name}</div>
                        {m.nameMm && (
                          <div className="text-[11px] text-gray-500">{m.nameMm}</div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full capitalize">
                          {m.type === 'cash' ? (
                            <Banknote className="h-3 w-3 text-emerald-600" />
                          ) : m.type === 'digital_wallet' ? (
                            <Smartphone className="h-3 w-3 text-blue-600" />
                          ) : m.type === 'bank_transfer' ? (
                            <Building className="h-3 w-3 text-purple-600" />
                          ) : (
                            <CreditCard className="h-3 w-3 text-amber-600" />
                          )}
                          <span>{m.type.replace('_', ' ')}</span>
                        </span>
                      </td>

                      {/* Account Info */}
                      <td className="py-3.5 px-4">
                        {m.accountNumber ? (
                          <div>
                            <div className="font-mono font-medium text-slate-900">
                              {m.accountNumber}
                            </div>
                            {m.accountName && (
                              <div className="text-[11px] text-gray-500">
                                {m.accountName}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Sort Order */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-gray-700">
                        #{m.sortOrder || 1}
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {m.isActive !== false ? (
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
                            onClick={() => handleOpenEdit(m)}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            title={isMm ? 'ပြင်ဆင်ရန်' : 'Edit'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                item: m,
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              m.isActive !== false
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {m.isActive !== false
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
                <Wallet className="h-5 w-5 text-indigo-600" />
                <span>
                  {editingMethod
                    ? isMm ? 'ငွေပေးချေမှုနည်းလမ်း ပြင်ဆင်ခြင်း' : 'Edit Payment Method'
                    : isMm ? 'ငွေပေးချေမှုနည်းလမ်း အသစ်ထည့်ခြင်း' : 'Add Payment Method'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Code */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'နည်းလမ်းကုဒ်' : 'Code'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. KPAY"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'အမျိုးအစား' : 'Channel Type'}
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white font-medium text-gray-800"
                  >
                    <option value="cash">Cash (ငွေသား)</option>
                    <option value="digital_wallet">Digital Wallet (KPay/Wave)</option>
                    <option value="bank_transfer">Bank Transfer (ဘဏ်လွှဲ)</option>
                    <option value="credit">Credit (ဖောက်သည်အကြွေး)</option>
                  </select>
                </div>
              </div>

              {/* Name EN */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'နည်းလမ်းအမည် (အင်္ဂလိပ်)' : 'Method Name (EN)'} *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. KBZPay Official"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Name MM */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'နည်းလမ်းအမည် (မြန်မာ)' : 'Method Name (Myanmar)'}
                </label>
                <input
                  type="text"
                  value={formNameMm}
                  onChange={(e) => setFormNameMm(e.target.value)}
                  placeholder="ဥပမာ - ကေဘီဇက်ပေး"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Account Number & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'အကောင့်နံပါတ်' : 'Account / Phone No.'}
                  </label>
                  <input
                    type="text"
                    value={formAccountNumber}
                    onChange={(e) => setFormAccountNumber(e.target.value)}
                    placeholder="09-xxxxxxxxx"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'အကောင့်ပိုင်ရှင်အမည်' : 'Account Holder Name'}
                  </label>
                  <input
                    type="text"
                    value={formAccountName}
                    onChange={(e) => setFormAccountName(e.target.value)}
                    placeholder="e.g. Shwe Thiri Spa"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'အစဉ်လိုက် (#)' : 'Sort Order'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="formIsActivePMethod"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <label htmlFor="formIsActivePMethod" className="text-xs font-medium text-gray-700">
                  {isMm ? 'ဤငွေပေးချေမှုနည်းလမ်းကို ရွေးချယ်ခွင့်ပေးမည် (Active)' : 'Active for invoice checkout'}
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
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                >
                  <Save className="h-4 w-4" />
                  <span>{isMm ? 'သိမ်းဆည်းမည်' : 'Save Payment Method'}</span>
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
          title={isMm ? 'ငွေပေးချေမှုနည်းလမ်း အခြေအနေပြောင်းလဲခြင်း' : 'Update Payment Method Active Status'}
          itemName={confirmModal.item.name}
          currentStatus={confirmModal.item.isActive !== false}
          lang={lang}
        />
      )}
    </div>
  );
};
