import React, { useState, useMemo } from 'react';
import {
  StaffMember,
  StaffType,
  CommissionRuleRecord,
  UserAccount,
  StaffStatus,
} from '../../../types';
import { db } from '../../../db/database';
import { Language } from '../../../utils/translations';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Phone,
  MapPin,
  Calendar,
  Percent,
  CheckCircle2,
  XCircle,
  X,
  Save,
  Clock,
  Briefcase,
} from 'lucide-react';
import { ConfirmDeactivateModal } from './ConfirmDeactivateModal';

interface StaffMasterTabProps {
  staff: StaffMember[];
  staffTypes: StaffType[];
  commissionRules: CommissionRuleRecord[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const StaffMasterTab: React.FC<StaffMasterTabProps> = ({
  staff,
  staffTypes,
  commissionRules,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formNameMm, setFormNameMm] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formStaffTypeId, setFormStaffTypeId] = useState('');
  const [formJoinedDate, setFormJoinedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [formStatus, setFormStatus] = useState<StaffStatus>('available');
  const [formCommissionRuleId, setFormCommissionRuleId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    item: StaffMember | null;
  }>({ isOpen: false, item: null });

  // Filtered List
  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      const matchSearch =
        searchTerm === '' ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.nameMm && s.nameMm.includes(searchTerm)) ||
        s.phone.includes(searchTerm) ||
        (s.address && s.address.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus =
        statusFilter === 'all' || s.status === statusFilter;

      const matchType =
        typeFilter === 'all' || s.staffTypeId === typeFilter || s.role === typeFilter;

      const matchActive =
        activeFilter === 'all'
          ? true
          : activeFilter === 'active'
          ? s.isActive !== false
          : s.isActive === false;

      return matchSearch && matchStatus && matchType && matchActive;
    });
  }, [staff, searchTerm, statusFilter, typeFilter, activeFilter]);

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setFormName('');
    setFormNameMm('');
    setFormPhone('');
    setFormAddress('');
    setFormStaffTypeId(staffTypes[0]?.id || '');
    setFormJoinedDate(new Date().toISOString().split('T')[0]);
    setFormStatus('available');
    setFormCommissionRuleId(commissionRules[0]?.id || '');
    setFormNotes('');
    setFormIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (member: StaffMember) => {
    setEditingStaff(member);
    setFormName(member.name);
    setFormNameMm(member.nameMm || '');
    setFormPhone(member.phone);
    setFormAddress(member.address || '');
    setFormStaffTypeId(member.staffTypeId || '');
    setFormJoinedDate(
      member.joinedDate || new Date().toISOString().split('T')[0]
    );
    setFormStatus(member.status || 'available');
    setFormCommissionRuleId(
      member.commissionRuleId || member.defaultCommissionRule?.ruleId || ''
    );
    setFormNotes(member.notes || '');
    setFormIsActive(member.isActive !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError(isMm ? 'ဝန်ထမ်းအမည် ထည့်သွင်းပေးပါ' : 'Staff name is required');
      return;
    }
    if (!formPhone.trim()) {
      setFormError(isMm ? 'ဖုန်းနံပါတ် ထည့်သွင်းပေးပါ' : 'Phone number is required');
      return;
    }

    const matchedRule = commissionRules.find(
      (r) => r.id === formCommissionRuleId
    );

    const commissionSnapshot = matchedRule
      ? {
          type: matchedRule.type,
          value: matchedRule.percentage || matchedRule.fixedAmountMMK || 0,
          ruleId: matchedRule.id,
          version: matchedRule.version || 1,
          fixedBonusMMK: matchedRule.fixedBonusMMK,
          tiers: matchedRule.tiers,
        }
      : editingStaff?.defaultCommissionRule || {
          type: 'percentage' as const,
          value: 30,
        };

    const matchedType = staffTypes.find((t) => t.id === formStaffTypeId);
    const roleSlug = matchedType
      ? (matchedType.code.toLowerCase().replace(/[^a-z0-9]/g, '_') as any)
      : 'therapist';

    try {
      if (editingStaff) {
        // Update
        await db.staff.update(editingStaff.id, {
          name: formName.trim(),
          nameMm: formNameMm.trim() || undefined,
          phone: formPhone.trim(),
          address: formAddress.trim(),
          staffTypeId: formStaffTypeId || undefined,
          role: roleSlug,
          joinedDate: formJoinedDate,
          status: formStatus,
          commissionRuleId: formCommissionRuleId || undefined,
          defaultCommissionRule: commissionSnapshot,
          notes: formNotes.trim(),
          isActive: formIsActive,
        });
      } else {
        // Create new
        const newStaffId = `stf_${Date.now()}`;
        await db.staff.add({
          id: newStaffId,
          name: formName.trim(),
          nameMm: formNameMm.trim() || undefined,
          phone: formPhone.trim(),
          address: formAddress.trim(),
          staffTypeId: formStaffTypeId || undefined,
          role: roleSlug,
          joinedDate: formJoinedDate,
          status: formStatus,
          commissionRuleId: formCommissionRuleId || undefined,
          defaultCommissionRule: commissionSnapshot,
          notes: formNotes.trim(),
          isActive: formIsActive,
        });
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err?.message || 'Error saving staff record');
    }
  };

  const handleToggleActive = async (member: StaffMember) => {
    try {
      const nextActive = member.isActive === false;
      await db.staff.update(member.id, {
        isActive: nextActive,
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-600" />
            <span>{isMm ? 'ဝန်ထမ်းများ စီမံခန့်ခွဲမှု' : 'Staff Members Directory'}</span>
            <span className="ml-2 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5">
              {staff.length}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isMm
              ? 'ဝန်ထမ်းအချက်အလက်၊ ရာထူးအမျိုးအစား၊ ဖုန်းနံပါတ်၊ နေရပ်လိပ်စာနှင့် ပုံသေကော်မရှင်သတ်မှတ်ချက်များ'
              : 'Manage employee profiles, contact details, staff classifications and default commission rules.'}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 active:bg-amber-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{isMm ? 'ဝန်ထမ်းအသစ် ထည့်သွင်းရန်' : 'Add New Staff'}</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isMm ? 'အမည်၊ ဖုန်း၊ လိပ်စာ ရှာရန်...' : 'Search by name, phone, address...'}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'အလုပ်အခြေအနေ: အားလုံး' : 'Status: All'}</option>
            <option value="available">{isMm ? 'အားလပ်နေသည် (Available)' : 'Available'}</option>
            <option value="busy">{isMm ? 'ဝန်ဆောင်မှုပေးနေသည် (Busy)' : 'Busy'}</option>
            <option value="break">{isMm ? 'ခေတ္တနားနေသည် (Break)' : 'Break'}</option>
            <option value="off">{isMm ? 'အလုပ်ပိတ်ရက် (Off)' : 'Off'}</option>
          </select>
        </div>

        {/* Staff Type Filter */}
        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'ရာထူးအမျိုးအစား: အားလုံး' : 'Staff Type: All'}</option>
            {staffTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {isMm && t.nameMm ? t.nameMm : t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Active / Inactive Filter */}
        <div>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'စာရင်းဝင်အခြေအနေ: အားလုံး' : 'Master Status: All'}</option>
            <option value="active">{isMm ? 'အသုံးပြုနေဆဲ (Active)' : 'Active Only'}</option>
            <option value="inactive">{isMm ? 'ပိတ်ထားသောစာရင်း (Inactive)' : 'Inactive Only'}</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-slate-50 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                <th className="py-3 px-4">{isMm ? 'ဝန်ထမ်းအမည်' : 'Staff Member'}</th>
                <th className="py-3 px-4">{isMm ? 'ဆက်သွယ်ရန်' : 'Contact & Address'}</th>
                <th className="py-3 px-4">{isMm ? 'ရာထူးအမျိုးအစား' : 'Staff Classification'}</th>
                <th className="py-3 px-4">{isMm ? 'လက်ရှိအခြေအနေ' : 'Live Status'}</th>
                <th className="py-3 px-4">{isMm ? 'ကော်မရှင်စည်းမျဉ်း' : 'Default Commission'}</th>
                <th className="py-3 px-4">{isMm ? 'ဝင်ရောက်ရက်' : 'Joined Date'}</th>
                <th className="py-3 px-4">{isMm ? 'စာရင်းအခြေအနေ' : 'Active Status'}</th>
                <th className="py-3 px-4 text-right">{isMm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    {isMm ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ဝန်ထမ်းမှတ်တမ်း မရှိပါ' : 'No staff members found matching criteria.'}
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => {
                  const staffTypeObj = staffTypes.find((t) => t.id === member.staffTypeId);
                  const commRuleObj = commissionRules.find(
                    (r) => r.id === (member.commissionRuleId || member.defaultCommissionRule?.ruleId)
                  );

                  return (
                    <tr
                      key={member.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        member.isActive === false ? 'opacity-60 bg-gray-50/50' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{member.name}</div>
                        {member.nameMm && (
                          <div className="text-[11px] text-gray-500">{member.nameMm}</div>
                        )}
                      </td>

                      {/* Phone & Address (Privacy Safe) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-gray-800">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span>{member.phone}</span>
                        </div>
                        {member.address && (
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5 max-w-[180px] truncate">
                            <MapPin className="h-3 w-3 text-gray-400 shrink-0" />
                            <span className="truncate">{member.address}</span>
                          </div>
                        )}
                      </td>

                      {/* Staff Type */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                          <Briefcase className="h-3 w-3" />
                          <span>
                            {staffTypeObj
                              ? isMm && staffTypeObj.nameMm
                                ? staffTypeObj.nameMm
                                : staffTypeObj.name
                              : member.role || 'Therapist'}
                          </span>
                        </span>
                      </td>

                      {/* Live Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            member.status === 'available'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : member.status === 'in_service'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              member.status === 'available'
                                ? 'bg-emerald-500'
                                : member.status === 'in_service'
                                ? 'bg-rose-500'
                                : 'bg-gray-400'
                            }`}
                          />
                          <span>
                            {member.status === 'available'
                              ? isMm ? 'အားလပ်' : 'Available'
                              : member.status === 'in_service'
                              ? isMm ? 'ဝန်ဆောင်မှုပေးနေ' : 'In Service'
                              : isMm ? 'ပိတ်ရက်' : 'Off Duty'}
                          </span>
                        </span>
                      </td>

                      {/* Commission Rule */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-700">
                          <Percent className="h-3 w-3 text-amber-600" />
                          <span>
                            {commRuleObj
                              ? commRuleObj.name
                              : member.defaultCommissionRule?.type === 'percentage'
                              ? `${member.defaultCommissionRule.value}%`
                              : `${member.defaultCommissionRule?.value || 0} MMK`}
                          </span>
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-4 text-[11px] text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          <span>{member.joinedDate || '-'}</span>
                        </div>
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {member.isActive !== false ? (
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
                            onClick={() => handleOpenEdit(member)}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            title={isMm ? 'ပြင်ဆင်ရန်' : 'Edit Staff'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                item: member,
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              member.isActive !== false
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                            title={
                              member.isActive !== false
                                ? isMm ? 'အသုံးမပြုတော့ရန် ပိတ်မည်' : 'Deactivate'
                                : isMm ? 'ပြန်လည်ဖွင့်မည်' : 'Reactivate'
                            }
                          >
                            {member.isActive !== false
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
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-600" />
                <span>
                  {editingStaff
                    ? isMm ? 'ဝန်ထမ်းအချက်အလက် ပြင်ဆင်ခြင်း' : 'Edit Staff Member'
                    : isMm ? 'ဝန်ထမ်းအသစ် ထည့်သွင်းခြင်း' : 'Add New Staff Member'}
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
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ဝန်ထမ်းအမည် (အင်္ဂလိပ်)' : 'Staff Name (EN)'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Ma Hnin Nu"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>

                {/* Name Myanmar */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ဝန်ထမ်းအမည် (မြန်မာ)' : 'Staff Name (Myanmar)'}
                  </label>
                  <input
                    type="text"
                    value={formNameMm}
                    onChange={(e) => setFormNameMm(e.target.value)}
                    placeholder="ဥပမာ - မနှင်းနု"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>

                {/* Joined Date */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'အလုပ်ဝင်သည့်ရက်စွဲ' : 'Joined Date'}
                  </label>
                  <input
                    type="date"
                    value={formJoinedDate}
                    onChange={(e) => setFormJoinedDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'နေရပ်လိပ်စာ' : 'Address / Residence'}
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder={isMm ? 'မြို့နယ်၊ တိုင်းဒေသကြီး' : 'Township, City'}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Staff Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ရာထူးသတ်မှတ်ချက်' : 'Staff Type / Classification'}
                  </label>
                  <select
                    value={formStaffTypeId}
                    onChange={(e) => setFormStaffTypeId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white font-medium text-gray-800"
                  >
                    <option value="">{isMm ? '-- ရာထူးရွေးချယ်ပါ --' : '-- Select Type --'}</option>
                    {staffTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {isMm && t.nameMm ? t.nameMm : t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'လက်ရှိအခြေအနေ' : 'Operational Status'}
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(
                        e.target.value as StaffStatus
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white font-medium text-gray-800"
                  >
                    <option value="available">{isMm ? 'အားလပ်နေသည် (Available)' : 'Available'}</option>
                    <option value="in_service">{isMm ? 'ဝန်ဆောင်မှုပေးနေသည် (In Service)' : 'In Service'}</option>
                    <option value="off_duty">{isMm ? 'အလုပ်ပိတ်ရက် (Off Duty)' : 'Off Duty'}</option>
                  </select>
                </div>
              </div>

              {/* Commission Rule */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'မူလသတ်မှတ်ထားသော ကော်မရှင်စည်းမျဉ်း' : 'Default Commission Rule'}
                </label>
                <select
                  value={formCommissionRuleId}
                  onChange={(e) => setFormCommissionRuleId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white font-medium text-gray-800"
                >
                  <option value="">{isMm ? '-- ကော်မရှင်စည်းမျဉ်း ရွေးချယ်ပါ --' : '-- Select Commission Rule --'}</option>
                  {commissionRules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.name} ({rule.type === 'percentage' ? `${rule.percentage || 0}%` : `${rule.fixedAmountMMK || 0} MMK`}) [v{rule.version}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'မှတ်ချက်' : 'Notes / Specialization'}
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={isMm ? 'ကျွမ်းကျင်မှု၊ အထူးပြုဝန်ဆောင်မှုများ...' : 'Skills, customer preferences, remarks...'}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="formIsActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-gray-300"
                />
                <label htmlFor="formIsActive" className="text-xs font-medium text-gray-700">
                  {isMm
                    ? 'ဤဝန်ထမ်းစာရင်းကို စနစ်အတွင်း အသုံးပြုမည် (Active)'
                    : 'Active for session assignments and roster'}
                </label>
              </div>

              {/* Modal Buttons */}
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
                  className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
                >
                  <Save className="h-4 w-4" />
                  <span>{isMm ? 'သိမ်းဆည်းမည်' : 'Save Staff'}</span>
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
          title={isMm ? 'ဝန်ထမ်းစာရင်း အခြေအနေပြောင်းလဲခြင်း' : 'Update Staff Active Status'}
          itemName={confirmModal.item.name}
          currentStatus={confirmModal.item.isActive !== false}
          lang={lang}
        />
      )}
    </div>
  );
};
