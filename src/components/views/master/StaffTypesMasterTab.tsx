import React, { useState, useMemo } from 'react';
import { StaffType, StaffMember, UserAccount, CommissionType } from '../../../types';
import { db } from '../../../db/database';
import { Language } from '../../../utils/translations';
import { formatMMK } from '../../../domain/financial';
import {
  Briefcase,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  X,
  Save,
  Percent,
  Coins,
  DollarSign,
  Users,
} from 'lucide-react';
import { ConfirmDeactivateModal } from './ConfirmDeactivateModal';

interface StaffTypesMasterTabProps {
  staffTypes: StaffType[];
  staff: StaffMember[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const StaffTypesMasterTab: React.FC<StaffTypesMasterTabProps> = ({
  staffTypes,
  staff,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<StaffType | null>(null);

  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formNameMm, setFormNameMm] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCommissionType, setFormCommissionType] = useState<CommissionType>('percentage');
  const [formCommissionValue, setFormCommissionValue] = useState<number>(35);
  const [formBaseSalaryMMK, setFormBaseSalaryMMK] = useState<number>(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    item: StaffType | null;
  }>({ isOpen: false, item: null });

  const filteredTypes = useMemo(() => {
    return staffTypes.filter((t) => {
      const matchSearch =
        searchTerm === '' ||
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.nameMm && t.nameMm.includes(searchTerm)) ||
        t.code.toLowerCase().includes(searchTerm.toLowerCase());

      const matchActive =
        activeFilter === 'all'
          ? true
          : activeFilter === 'active'
          ? t.isActive !== false
          : t.isActive === false;

      return matchSearch && matchActive;
    });
  }, [staffTypes, searchTerm, activeFilter]);

  const handleOpenAdd = () => {
    setEditingType(null);
    setFormCode(`ST-${Date.now().toString().slice(-4)}`);
    setFormName('');
    setFormNameMm('');
    setFormDescription('');
    setFormCommissionType('percentage');
    setFormCommissionValue(35);
    setFormBaseSalaryMMK(250000);
    setFormIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (type: StaffType) => {
    setEditingType(type);
    setFormCode(type.code);
    setFormName(type.name);
    setFormNameMm(type.nameMm || '');
    setFormDescription(type.description || '');
    setFormCommissionType(type.defaultCommissionType || 'percentage');
    setFormCommissionValue(type.defaultCommissionValue ?? 35);
    setFormBaseSalaryMMK(type.baseSalaryMMK || 0);
    setFormIsActive(type.isActive !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formCode.trim()) {
      setFormError(isMm ? 'ရာထူးကုဒ် ထည့်သွင်းပေးပါ' : 'Staff type code is required');
      return;
    }
    if (!formName.trim()) {
      setFormError(isMm ? 'ရာထူးအမည် ထည့်သွင်းပေးပါ' : 'Staff type name is required');
      return;
    }

    const now = new Date().toISOString();

    try {
      if (editingType) {
        await db.staffTypes.update(editingType.id, {
          code: formCode.trim().toUpperCase(),
          name: formName.trim(),
          nameMm: formNameMm.trim() || undefined,
          description: formDescription.trim() || undefined,
          defaultCommissionType: formCommissionType,
          defaultCommissionValue: Number(formCommissionValue) || 0,
          baseSalaryMMK: Number(formBaseSalaryMMK) || 0,
          isActive: formIsActive,
          updatedAt: now,
        });
      } else {
        const newId = `stype_${Date.now()}`;
        await db.staffTypes.add({
          id: newId,
          code: formCode.trim().toUpperCase(),
          name: formName.trim(),
          nameMm: formNameMm.trim() || undefined,
          description: formDescription.trim() || undefined,
          defaultCommissionType: formCommissionType,
          defaultCommissionValue: Number(formCommissionValue) || 0,
          baseSalaryMMK: Number(formBaseSalaryMMK) || 0,
          isActive: formIsActive,
          createdAt: now,
          updatedAt: now,
          createdBy: currentUser.name,
        });
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err?.message || 'Error saving staff type');
    }
  };

  const handleToggleActive = async (type: StaffType) => {
    try {
      await db.staffTypes.update(type.id, {
        isActive: type.isActive === false,
        updatedAt: new Date().toISOString(),
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
            <Briefcase className="h-5 w-5 text-indigo-600" />
            <span>{isMm ? 'ဝန်ထမ်းရာထူး အမျိုးအစားများ' : 'Staff Classifications & Types'}</span>
            <span className="ml-2 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5">
              {staffTypes.length}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isMm
              ? 'ရာထူးအဆင့်ဆင့် သတ်မှတ်ခြင်း၊ ပုံသေကော်မရှင်နှုန်းထားနှင့် အခြေခံလစာစံနှုန်းများ'
              : 'Define staff roles, standard base salaries, and baseline commission structures.'}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{isMm ? 'ရာထူးအသစ် သတ်မှတ်ရန်' : 'Add Staff Type'}</span>
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
            placeholder={isMm ? 'ရာထူးကုဒ်၊ အမည်ဖြင့် ရှာရန်...' : 'Search by code, role title...'}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
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
                <th className="py-3 px-4">{isMm ? 'ရာထူးကုဒ်' : 'Code'}</th>
                <th className="py-3 px-4">{isMm ? 'ရာထူးအမည်' : 'Staff Type Title'}</th>
                <th className="py-3 px-4">{isMm ? 'ဖော်ပြချက်' : 'Description'}</th>
                <th className="py-3 px-4">{isMm ? 'ပုံသေကော်မရှင်' : 'Default Commission'}</th>
                <th className="py-3 px-4">{isMm ? 'အခြေခံလစာ' : 'Base Salary (MMK)'}</th>
                <th className="py-3 px-4">{isMm ? 'လက်ရှိဝန်ထမ်းဦးရေ' : 'Headcount'}</th>
                <th className="py-3 px-4">{isMm ? 'အခြေအနေ' : 'Status'}</th>
                <th className="py-3 px-4 text-right">{isMm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredTypes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    {isMm ? 'ရာထူးအမျိုးအစား ရှာမတွေ့ပါ' : 'No staff types found.'}
                  </td>
                </tr>
              ) : (
                filteredTypes.map((t) => {
                  const memberCount = staff.filter(
                    (s) => s.staffTypeId === t.id || s.role === t.code.toLowerCase()
                  ).length;

                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        t.isActive === false ? 'opacity-60 bg-gray-50/50' : ''
                      }`}
                    >
                      {/* Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                        {t.code}
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{t.name}</div>
                        {t.nameMm && (
                          <div className="text-[11px] text-gray-500">{t.nameMm}</div>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 max-w-xs text-gray-600 text-[11px] truncate">
                        {t.description || '-'}
                      </td>

                      {/* Default Commission */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {t.defaultCommissionType === 'percentage'
                          ? `${t.defaultCommissionValue}%`
                          : formatMMK(t.defaultCommissionValue || 0)}
                      </td>

                      {/* Base Salary */}
                      <td className="py-3.5 px-4 font-semibold text-gray-800">
                        {t.baseSalaryMMK ? formatMMK(t.baseSalaryMMK) : '-'}
                      </td>

                      {/* Headcount */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                          <Users className="h-3 w-3" />
                          <span>{memberCount}</span>
                        </span>
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {t.isActive !== false ? (
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
                            onClick={() => handleOpenEdit(t)}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            title={isMm ? 'ပြင်ဆင်ရန်' : 'Edit'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                item: t,
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              t.isActive !== false
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {t.isActive !== false
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
                <Briefcase className="h-5 w-5 text-indigo-600" />
                <span>
                  {editingType
                    ? isMm ? 'ရာထူးအမျိုးအစား ပြင်ဆင်ခြင်း' : 'Edit Staff Type'
                    : isMm ? 'ရာထူးအမျိုးအစား အသစ်သတ်မှတ်ခြင်း' : 'Add New Staff Type'}
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
                    {isMm ? 'ရာထူးကုဒ်' : 'Code / Identifier'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="ST-6874"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-mono text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none uppercase"
                  />
                </div>

                {/* Base Salary */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'အခြေခံလစာ (MMK)' : 'Base Salary (MMK)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formBaseSalaryMMK}
                    onChange={(e) => setFormBaseSalaryMMK(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
                  />
                </div>
              </div>

              {/* Title EN */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'ရာထူးအမည် (အင်္ဂလိပ်)' : 'Type Title (EN)'} *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Senior Therapist"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>

              {/* Title MM */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'ရာထူးအမည် (မြန်မာ)' : 'Type Title (Myanmar)'}
                </label>
                <input
                  type="text"
                  value={formNameMm}
                  onChange={(e) => setFormNameMm(e.target.value)}
                  placeholder="ဥပမာ - ဝါရင့် အကြောပြင်ပညာရှင်"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>

              {/* Commission Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ကော်မရှင်အမျိုးအစား' : 'Commission Type'}
                  </label>
                  <select
                    value={formCommissionType}
                    onChange={(e) =>
                      setFormCommissionType(
                        e.target.value as 'percentage' | 'fixed' | 'percentage_plus_fixed' | 'tiered'
                      )
                    }
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
                  >
                    <option value="percentage">{isMm ? 'ရာခိုင်နှုန်း (%)' : 'Percentage (%)'}</option>
                    <option value="fixed">{isMm ? 'ပုံသေငွေပမာဏ (MMK)' : 'Fixed Amount (MMK)'}</option>
                    <option value="percentage_plus_fixed">{isMm ? 'ရာခိုင်နှုန်း + အပိုဆု' : 'Percent + Bonus'}</option>
                    <option value="tiered">{isMm ? 'အဆင့်လိုက် (Tiered)' : 'Tiered'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {formCommissionType === 'percentage'
                      ? isMm ? 'ကော်မရှင် (%)' : 'Percentage (%)'
                      : isMm ? 'ပမာဏ (MMK)' : 'Value (MMK)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formCommissionValue}
                    onChange={(e) => setFormCommissionValue(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'တာဝန်ဖော်ပြချက်' : 'Job Scope / Description'}
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={isMm ? 'လုပ်ငန်းတာဝန် အသေးစိတ်...' : 'Responsibilities, experience required...'}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="formIsActiveType"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <label htmlFor="formIsActiveType" className="text-xs font-medium text-gray-700">
                  {isMm
                    ? 'ဤရာထူးအမျိုးအစားကို အသုံးပြုခွင့်ပေးမည် (Active)'
                    : 'Active for staff assignment'}
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
                  <span>{isMm ? 'သိမ်းဆည်းမည်' : 'Save Staff Type'}</span>
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
          title={isMm ? 'ရာထူးအမျိုးအစား အခြေအနေပြောင်းလဲခြင်း' : 'Update Staff Type Status'}
          itemName={confirmModal.item.name}
          currentStatus={confirmModal.item.isActive !== false}
          lang={lang}
        />
      )}
    </div>
  );
};
