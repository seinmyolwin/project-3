import React, { useState, useMemo } from 'react';
import { ExpenseCategoryRecord, UserAccount } from '../../../types';
import { db } from '../../../db/database';
import { Language } from '../../../utils/translations';
import {
  Receipt,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  X,
  Save,
  Tag,
  DollarSign,
} from 'lucide-react';
import { ConfirmDeactivateModal } from './ConfirmDeactivateModal';

interface ExpenseCategoriesMasterTabProps {
  categories: ExpenseCategoryRecord[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const ExpenseCategoriesMasterTab: React.FC<ExpenseCategoriesMasterTabProps> = ({
  categories,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategoryRecord | null>(null);

  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formNameMm, setFormNameMm] = useState('');
  const [formIsDeductible, setFormIsDeductible] = useState(true);
  const [formSortOrder, setFormSortOrder] = useState<number>(1);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    item: ExpenseCategoryRecord | null;
  }>({ isOpen: false, item: null });

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const matchSearch =
        searchTerm === '' ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.nameMm && c.nameMm.includes(searchTerm)) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase());

      const matchActive =
        activeFilter === 'all'
          ? true
          : activeFilter === 'active'
          ? c.isActive !== false
          : c.isActive === false;

      return matchSearch && matchActive;
    });
  }, [categories, searchTerm, activeFilter]);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormCode(`EXP-${Date.now().toString().slice(-4)}`);
    setFormName('');
    setFormNameMm('');
    setFormIsDeductible(true);
    setFormSortOrder(categories.length + 1);
    setFormIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category: ExpenseCategoryRecord) => {
    setEditingCategory(category);
    setFormCode(category.code);
    setFormName(category.name);
    setFormNameMm(category.nameMm || '');
    setFormIsDeductible(category.isDeductible !== false);
    setFormSortOrder(category.sortOrder || 1);
    setFormIsActive(category.isActive !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formCode.trim()) {
      setFormError(isMm ? 'အသုံးစရိတ်ကုဒ် ထည့်သွင်းပေးပါ' : 'Expense category code is required');
      return;
    }
    if (!formName.trim()) {
      setFormError(isMm ? 'အသုံးစရိတ်ကဏ္ဍအမည် ထည့်သွင်းပေးပါ' : 'Category name is required');
      return;
    }

    const now = new Date().toISOString();

    try {
      if (editingCategory) {
        await db.expenseCategoriesMaster.update(editingCategory.id, {
          code: formCode.trim().toUpperCase(),
          name: formName.trim(),
          nameMm: formNameMm.trim() || formName.trim(),
          isDeductible: formIsDeductible,
          sortOrder: Number(formSortOrder) || 1,
          isActive: formIsActive,
          updatedAt: now,
          updatedBy: currentUser.username,
        });
      } else {
        const newId = `expc_${Date.now()}`;
        await db.expenseCategoriesMaster.add({
          id: newId,
          code: formCode.trim().toUpperCase(),
          name: formName.trim(),
          nameMm: formNameMm.trim() || formName.trim(),
          isDeductible: formIsDeductible,
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
      setFormError(err?.message || 'Error saving expense category');
    }
  };

  const handleToggleActive = async (category: ExpenseCategoryRecord) => {
    try {
      await db.expenseCategoriesMaster.update(category.id, {
        isActive: category.isActive === false,
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
            <Receipt className="h-5 w-5 text-rose-600" />
            <span>{isMm ? 'အသုံးစရိတ် ကဏ္ဍများ စီမံခန့်ခွဲမှု' : 'Expense Categories Master'}</span>
            <span className="ml-2 rounded-full bg-rose-100 text-rose-800 text-xs font-semibold px-2.5 py-0.5">
              {categories.length}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isMm
              ? 'လုပ်ငန်းလည်ပတ်မှု ကုန်ကျစရိတ်များ (မီး/ရေ/အင်တာနက်၊ အခန်းငှားရမ်းခ၊ ပစ္စည်းဝယ်ယူစရိတ်၊ ဝန်ထမ်းကြိုထုတ်ငွေ)'
              : 'Categorize operational cash outflows, utilities, rental, stock acquisitions, and store maintenance.'}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{isMm ? 'အသုံးစရိတ်ကဏ္ဍသစ် ထည့်ရန်' : 'Add Expense Category'}</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isMm ? 'ကုဒ်၊ ကဏ္ဍအမည်၊ ဖော်ပြချက် ရှာရန်...' : 'Search code, category name...'}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
          />
        </div>

        <div>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none bg-white text-gray-700 font-medium"
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
                <th className="py-3 px-4">{isMm ? 'ကဏ္ဍအမည်' : 'Category Name'}</th>
                <th className="py-3 px-4">{isMm ? 'အခွန်နုတ်ပယ်စရိတ်' : 'Tax Deductible'}</th>
                <th className="py-3 px-4">{isMm ? 'အစဉ်လိုက်' : 'Sort Order'}</th>
                <th className="py-3 px-4">{isMm ? 'စာရင်းဝင်' : 'Active'}</th>
                <th className="py-3 px-4 text-right">{isMm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    {isMm ? 'အသုံးစရိတ်ကဏ္ဍ ရှာမတွေ့ပါ' : 'No expense categories found.'}
                  </td>
                </tr>
              ) : (
                filteredCategories.map((c) => {
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        c.isActive === false ? 'opacity-60 bg-gray-50/50' : ''
                      }`}
                    >
                      {/* Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-rose-900">
                        {c.code}
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{c.name}</div>
                        {c.nameMm && (
                          <div className="text-[11px] text-gray-500">{c.nameMm}</div>
                        )}
                      </td>

                      {/* Is Deductible */}
                      <td className="py-3.5 px-4">
                        {c.isDeductible !== false ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            {isMm ? 'နုတ်ပယ်ခွင့်ရှိ' : 'Deductible'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            {isMm ? 'ပုံမှန်' : 'Non-deductible'}
                          </span>
                        )}
                      </td>

                      {/* Sort Order */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-gray-700">
                        #{c.sortOrder || 1}
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {c.isActive !== false ? (
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
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            title={isMm ? 'ပြင်ဆင်ရန်' : 'Edit'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                item: c,
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              c.isActive !== false
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {c.isActive !== false
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
                <Receipt className="h-5 w-5 text-rose-600" />
                <span>
                  {editingCategory
                    ? isMm ? 'အသုံးစရိတ်ကဏ္ဍ ပြင်ဆင်ခြင်း' : 'Edit Expense Category'
                    : isMm ? 'အသုံးစရိတ်ကဏ္ဍ အသစ်ထည့်ခြင်း' : 'Add Expense Category'}
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
                    {isMm ? 'ကဏ္ဍကုဒ်' : 'Code'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. EXP-UTIL"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono uppercase focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
                  />
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
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
                  />
                </div>
              </div>

              {/* Name EN */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'ကဏ္ဍအမည် (အင်္ဂလိပ်)' : 'Category Name (EN)'} *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Utilities & Electricity"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
                />
              </div>

              {/* Name MM */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'ကဏ္ဍအမည် (မြန်မာ)' : 'Category Name (Myanmar)'}
                </label>
                <input
                  type="text"
                  value={formNameMm}
                  onChange={(e) => setFormNameMm(e.target.value)}
                  placeholder="ဥပမာ - မီးဖိုး/ရေဖိုး/အင်တာနက်"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
                />
              </div>

              {/* Tax Deductible Checkbox */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="formIsDeductibleExpCat"
                  checked={formIsDeductible}
                  onChange={(e) => setFormIsDeductible(e.target.checked)}
                  className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500 border-gray-300"
                />
                <label htmlFor="formIsDeductibleExpCat" className="text-xs font-medium text-gray-700">
                  {isMm ? 'လုပ်ငန်းအခွန်တွက်ချက်ရာတွင် နုတ်ပယ်စရိတ်အဖြစ် သတ်မှတ်မည် (Tax Deductible)' : 'Classify as Tax-Deductible Business Expense'}
                </label>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="formIsActiveExpCat"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500 border-gray-300"
                />
                <label htmlFor="formIsActiveExpCat" className="text-xs font-medium text-gray-700">
                  {isMm ? 'ဤကဏ္ဍကို အသုံးစရိတ်မှတ်ရာတွင် အသုံးပြုခွင့်ပေးမည် (Active)' : 'Active category for daily expense entry'}
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
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700"
                >
                  <Save className="h-4 w-4" />
                  <span>{isMm ? 'သိမ်းဆည်းမည်' : 'Save Category'}</span>
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
          title={isMm ? 'အသုံးစရိတ်ကဏ္ဍ အခြေအနေပြောင်းလဲခြင်း' : 'Update Expense Category Active Status'}
          itemName={confirmModal.item.name}
          currentStatus={confirmModal.item.isActive !== false}
          lang={lang}
        />
      )}
    </div>
  );
};
