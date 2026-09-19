import React, { useState, useMemo } from 'react';
import {
  ServiceItem,
  ServiceCategory,
  CommissionRuleRecord,
  UserAccount,
} from '../../../types';
import { db } from '../../../db/database';
import { Language } from '../../../utils/translations';
import { formatMMK } from '../../../domain/financial';
import {
  Sparkles,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  X,
  Save,
  Clock,
  Coins,
  Percent,
  Tag,
} from 'lucide-react';
import { ConfirmDeactivateModal } from './ConfirmDeactivateModal';

interface ServicesMasterTabProps {
  services: ServiceItem[];
  serviceCategories: ServiceCategory[];
  commissionRules: CommissionRuleRecord[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const ServicesMasterTab: React.FC<ServicesMasterTabProps> = ({
  services,
  serviceCategories,
  commissionRules,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [pricingFilter, setPricingFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

  const [formName, setFormName] = useState('');
  const [formNameMm, setFormNameMm] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formPricingMethod, setFormPricingMethod] = useState<
    'duration_based' | 'fixed' | 'hourly'
  >('duration_based');
  const [formPriceMMK, setFormPriceMMK] = useState<number>(30000);
  const [formDurationMinutes, setFormDurationMinutes] = useState<number>(60);
  const [formCommissionRuleId, setFormCommissionRuleId] = useState('');
  const [formCommissionValue, setFormCommissionValue] = useState<number>(30);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    item: ServiceItem | null;
  }>({ isOpen: false, item: null });

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchSearch =
        searchTerm === '' ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.nameMm && s.nameMm.includes(searchTerm)) ||
        s.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory =
        categoryFilter === 'all' ||
        s.categoryId === categoryFilter ||
        s.category.toLowerCase() === categoryFilter.toLowerCase();

      const matchPricing =
        pricingFilter === 'all' || s.pricingMethod === pricingFilter;

      const matchActive =
        activeFilter === 'all'
          ? true
          : activeFilter === 'active'
          ? s.isActive !== false
          : s.isActive === false;

      return matchSearch && matchCategory && matchPricing && matchActive;
    });
  }, [services, searchTerm, categoryFilter, pricingFilter, activeFilter]);

  const handleOpenAdd = () => {
    setEditingService(null);
    setFormName('');
    setFormNameMm('');
    setFormCategoryId(serviceCategories[0]?.id || '');
    setFormPricingMethod('duration_based');
    setFormPriceMMK(30000);
    setFormDurationMinutes(60);
    setFormCommissionRuleId(commissionRules[0]?.id || '');
    setFormCommissionValue(30);
    setFormIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (service: ServiceItem) => {
    setEditingService(service);
    setFormName(service.name);
    setFormNameMm(service.nameMm || '');
    setFormCategoryId(service.categoryId || '');
    setFormPricingMethod(service.pricingMethod || 'duration_based');
    setFormPriceMMK(service.priceMMK);
    setFormDurationMinutes(service.durationMinutes);
    setFormCommissionRuleId(service.commissionRuleId || '');
    setFormCommissionValue(service.defaultCommissionRule?.value || 30);
    setFormIsActive(service.isActive !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError(isMm ? 'ဝန်ဆောင်မှုအမည် ထည့်သွင်းပေးပါ' : 'Service name is required');
      return;
    }
    if (formPriceMMK <= 0) {
      setFormError(isMm ? 'ဈေးနှုန်းမှာ သုညထက်ကြီးရမည်' : 'Price must be greater than 0');
      return;
    }

    const matchedCat = serviceCategories.find((c) => c.id === formCategoryId);
    const categoryName = matchedCat ? matchedCat.name : 'Spa & Massage';
    const matchedRule = commissionRules.find((r) => r.id === formCommissionRuleId);

    const commissionRuleObj = {
      type: (matchedRule?.type || 'percentage') as any,
      value: Number(formCommissionValue) || 0,
      fixedBonusMMK: matchedRule?.fixedBonusMMK,
      tiers: matchedRule?.tiers,
      ruleId: formCommissionRuleId || undefined,
    };

    try {
      if (editingService) {
        await db.services.update(editingService.id, {
          name: formName.trim(),
          nameMm: formNameMm.trim() || undefined,
          categoryId: formCategoryId || undefined,
          category: categoryName,
          pricingMethod: formPricingMethod,
          priceMMK: Number(formPriceMMK),
          durationMinutes: Number(formDurationMinutes) || 60,
          commissionRuleId: formCommissionRuleId || undefined,
          defaultCommissionRule: commissionRuleObj,
          isActive: formIsActive,
        });
      } else {
        const newId = `srv_${Date.now()}`;
        await db.services.add({
          id: newId,
          name: formName.trim(),
          nameMm: formNameMm.trim() || undefined,
          categoryId: formCategoryId || undefined,
          category: categoryName,
          pricingMethod: formPricingMethod,
          priceMMK: Number(formPriceMMK),
          durationMinutes: Number(formDurationMinutes) || 60,
          commissionRuleId: formCommissionRuleId || undefined,
          defaultCommissionRule: commissionRuleObj,
          isActive: formIsActive,
        });
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err?.message || 'Error saving service');
    }
  };

  const handleToggleActive = async (service: ServiceItem) => {
    try {
      await db.services.update(service.id, {
        isActive: service.isActive === false,
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
            <Sparkles className="h-5 w-5 text-amber-600" />
            <span>{isMm ? 'ဝန်ဆောင်မှု မီနူး စီမံခန့်ခွဲမှု' : 'Services & Treatments Catalog'}</span>
            <span className="ml-2 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5">
              {services.length}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isMm
              ? 'အနှိပ်၊ စပါ၊ အလှပြင်နှင့် KTV ဝန်ဆောင်မှုဈေးနှုန်းများ၊ ကြာချိန်နှင့် ကော်မရှင်နှုန်းထား သတ်မှတ်ခြင်း'
              : 'Define treatments, durations, pricing methods, and default commission percentages.'}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 active:bg-amber-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{isMm ? 'ဝန်ဆောင်မှုအသစ် ထည့်ရန်' : 'Add New Service'}</span>
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
            placeholder={isMm ? 'ဝန်ဆောင်မှုအမည်၊ အမျိုးအစား ရှာရန်...' : 'Search service name, category...'}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'ကဏ္ဍ: အားလုံး' : 'Category: All'}</option>
            {serviceCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {isMm && c.nameMm ? c.nameMm : c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={pricingFilter}
            onChange={(e) => setPricingFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'တွက်ချက်နည်း: အားလုံး' : 'Pricing: All'}</option>
            <option value="duration_based">{isMm ? 'ကြာချိန်အလိုက် (Duration)' : 'Duration Based'}</option>
            <option value="fixed">{isMm ? 'ပုံသေနှုန်းထား (Fixed)' : 'Fixed'}</option>
            <option value="hourly">{isMm ? 'နာရီအလိုက် (Hourly)' : 'Hourly'}</option>
            <option value="custom">{isMm ? 'စိတ်ကြိုက်သတ်မှတ် (Custom)' : 'Custom'}</option>
          </select>
        </div>

        <div>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white text-gray-700 font-medium"
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
                <th className="py-3 px-4">{isMm ? 'ဝန်ဆောင်မှုအမည်' : 'Service Treatment'}</th>
                <th className="py-3 px-4">{isMm ? 'ကဏ္ဍ' : 'Category'}</th>
                <th className="py-3 px-4">{isMm ? 'တွက်ချက်နည်း' : 'Pricing Method'}</th>
                <th className="py-3 px-4">{isMm ? 'ပုံမှန်ကြာချိန်' : 'Standard Duration'}</th>
                <th className="py-3 px-4">{isMm ? 'သတ်မှတ်ဈေးနှုန်း' : 'Default Price (MMK)'}</th>
                <th className="py-3 px-4">{isMm ? 'ကော်မရှင်' : 'Commission'}</th>
                <th className="py-3 px-4">{isMm ? 'စာရင်းဝင်' : 'Active'}</th>
                <th className="py-3 px-4 text-right">{isMm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    {isMm ? 'ဝန်ဆောင်မှုမှတ်တမ်း ရှာမတွေ့ပါ' : 'No services found.'}
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => {
                  const catObj = serviceCategories.find((c) => c.id === service.categoryId);

                  return (
                    <tr
                      key={service.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        service.isActive === false ? 'opacity-60 bg-gray-50/50' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{service.name}</div>
                        {service.nameMm && (
                          <div className="text-[11px] text-gray-500">{service.nameMm}</div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                          <Tag className="h-3 w-3 text-slate-400" />
                          <span>{catObj ? (isMm && catObj.nameMm ? catObj.nameMm : catObj.name) : service.category}</span>
                        </span>
                      </td>

                      {/* Pricing Method */}
                      <td className="py-3.5 px-4">
                        <span className="capitalize text-slate-700 font-medium">
                          {(service.pricingMethod || 'duration_based').replace('_', ' ')}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 text-slate-700 font-medium">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          <span>{service.durationMinutes} mins</span>
                        </div>
                      </td>

                      {/* Default Price */}
                      <td className="py-3.5 px-4 font-bold text-amber-900">
                        {formatMMK(service.priceMMK)}
                      </td>

                      {/* Commission */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 font-semibold text-slate-700">
                          <Percent className="h-3 w-3 text-amber-600" />
                          <span>{service.defaultCommissionRule?.value || 30}%</span>
                        </div>
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {service.isActive !== false ? (
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
                            onClick={() => handleOpenEdit(service)}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            title={isMm ? 'ပြင်ဆင်ရန်' : 'Edit'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                item: service,
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              service.isActive !== false
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {service.isActive !== false
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
                <Sparkles className="h-5 w-5 text-amber-600" />
                <span>
                  {editingService
                    ? isMm ? 'ဝန်ဆောင်မှု ပြင်ဆင်ခြင်း' : 'Edit Service Treatment'
                    : isMm ? 'ဝန်ဆောင်မှု အသစ်ထည့်သွင်းခြင်း' : 'Add New Service'}
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
                {/* Name EN */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ဝန်ဆောင်မှုအမည် (အင်္ဂလိပ်)' : 'Service Name (EN)'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Traditional Thai Massage"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>

                {/* Name MM */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ဝန်ဆောင်မှုအမည် (မြန်မာ)' : 'Service Name (Myanmar)'}
                  </label>
                  <input
                    type="text"
                    value={formNameMm}
                    onChange={(e) => setFormNameMm(e.target.value)}
                    placeholder="ဥပမာ - ထိုင်းရိုးရာအကြောပြင်အနှိပ်"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ဝန်ဆောင်မှုကဏ္ဍ' : 'Service Category'}
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white font-medium text-gray-800"
                  >
                    <option value="">{isMm ? '-- ကဏ္ဍရွေးချယ်ပါ --' : '-- Select Category --'}</option>
                    {serviceCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {isMm && c.nameMm ? c.nameMm : c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pricing Method */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'တွက်ချက်နည်း' : 'Pricing Method'}
                  </label>
                  <select
                    value={formPricingMethod}
                    onChange={(e) =>
                      setFormPricingMethod(
                        e.target.value as 'duration_based' | 'fixed' | 'hourly'
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white font-medium text-gray-800"
                  >
                    <option value="duration_based">Duration Based (အချိန်အလိုက်)</option>
                    <option value="fixed">Fixed Price (ပုံသေဈေး)</option>
                    <option value="hourly">Hourly Rate (နာရီအလိုက်)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Default Price */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'သတ်မှတ်ဈေးနှုန်း (MMK)' : 'Default Price (MMK)'} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1000"
                    required
                    value={formPriceMMK}
                    onChange={(e) => setFormPriceMMK(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>

                {/* Duration Minutes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ပုံမှန်ကြာချိန် (မိနစ်)' : 'Standard Duration (Mins)'}
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={formDurationMinutes}
                    onChange={(e) => setFormDurationMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Commission Rule / Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ချိတ်ဆက် ကော်မရှင်စည်းမျဉ်း' : 'Commission Rule'}
                  </label>
                  <select
                    value={formCommissionRuleId}
                    onChange={(e) => setFormCommissionRuleId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white font-medium text-gray-800"
                  >
                    <option value="">{isMm ? '-- ပုံသေရာခိုင်နှုန်းဖြင့် သုံးမည် --' : '-- Default Standard Rate --'}</option>
                    {commissionRules.map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {rule.name} ({rule.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ပုံသေ ကော်မရှင် (%)' : 'Default Commission (%)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formCommissionValue}
                    onChange={(e) => setFormCommissionValue(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="formIsActiveService"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-gray-300"
                />
                <label htmlFor="formIsActiveService" className="text-xs font-medium text-gray-700">
                  {isMm ? 'ဤဝန်ဆောင်မှုကို ရွေးချယ်ခွင့်ပြုမည် (Active)' : 'Active for dispatch and billing'}
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
                  className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
                >
                  <Save className="h-4 w-4" />
                  <span>{isMm ? 'သိမ်းဆည်းမည်' : 'Save Service'}</span>
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
          title={isMm ? 'ဝန်ဆောင်မှု အခြေအနေပြောင်းလဲခြင်း' : 'Update Service Active Status'}
          itemName={confirmModal.item.name}
          currentStatus={confirmModal.item.isActive !== false}
          lang={lang}
        />
      )}
    </div>
  );
};
