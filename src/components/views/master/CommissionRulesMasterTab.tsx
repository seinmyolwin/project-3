import React, { useState, useMemo } from 'react';
import {
  CommissionRuleRecord,
  CommissionType,
  CommissionTier,
  UserAccount,
  PerformanceBonusRuleRecord,
} from '../../../types';
import { db } from '../../../db/database';
import { syncManager } from '../../../services/syncManager';
import { Language } from '../../../utils/translations';
import { formatMMK } from '../../../domain/financial';
import {
  Percent,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  X,
  Save,
  ShieldAlert,
  GitBranch,
  Layers,
  Coins,
  History,
  Info,
  Trash2,
} from 'lucide-react';
import { ConfirmDeactivateModal } from './ConfirmDeactivateModal';

interface CommissionRulesMasterTabProps {
  commissionRules: CommissionRuleRecord[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const CommissionRulesMasterTab: React.FC<CommissionRulesMasterTabProps> = ({
  commissionRules,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Subtab State: Commission vs Performance Bonus Rules
  const [activeTab, setActiveTab] = useState<'commission' | 'performance_bonus'>('commission');
  const [pBonusRules, setPBonusRules] = useState<PerformanceBonusRuleRecord[]>([]);
  const [showPBonusModal, setShowPBonusModal] = useState(false);
  const [editingPBonus, setEditingPBonus] = useState<PerformanceBonusRuleRecord | null>(null);
  const [pbRuleName, setPbRuleName] = useState('Monthly Top Performer');
  const [pbMinRevenue, setPbMinRevenue] = useState(500000);
  const [pbMinSessions, setPbMinSessions] = useState(20);
  const [pbMinAttendance, setPbMinAttendance] = useState(22);
  const [pbBonusAmount, setPbBonusAmount] = useState(50000);
  const [pbIsActive, setPbIsActive] = useState(true);

  const loadPBonusRules = React.useCallback(async () => {
    try {
      const rules = await db.performanceBonusRules.toArray();
      setPBonusRules(rules);
    } catch (err) {
      console.error('Error loading performance bonus rules:', err);
    }
  }, []);

  React.useEffect(() => {
    loadPBonusRules();
  }, [loadPBonusRules]);

  const handleOpenPBonusAdd = () => {
    setEditingPBonus(null);
    setPbRuleName('Monthly Top Performer');
    setPbMinRevenue(500000);
    setPbMinSessions(20);
    setPbMinAttendance(22);
    setPbBonusAmount(50000);
    setPbIsActive(true);
    setShowPBonusModal(true);
  };

  const handleOpenPBonusEdit = (rule: PerformanceBonusRuleRecord) => {
    setEditingPBonus(rule);
    setPbRuleName(rule.ruleName);
    setPbMinRevenue(rule.minRevenueMMK || 0);
    setPbMinSessions(rule.minSessions || 0);
    setPbMinAttendance(rule.minAttendanceDays || 0);
    setPbBonusAmount(rule.bonusAmountMMK || 50000);
    setPbIsActive(rule.isActive !== false);
    setShowPBonusModal(true);
  };

  const handleSavePBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pbRuleName.trim()) return;
    try {
      const rule = await db.savePerformanceBonusRule({
        id: editingPBonus?.id,
        ruleName: pbRuleName.trim(),
        minRevenueMMK: Number(pbMinRevenue),
        minSessions: Number(pbMinSessions),
        minAttendanceDays: Number(pbMinAttendance),
        bonusAmountMMK: Number(pbBonusAmount),
        isActive: pbIsActive,
      });
      syncManager.executeMutation({
        operationType: 'PERFORMANCE_BONUS_RULE_SAVE',
        payload: rule,
        offlineMutationFn: () => db.savePerformanceBonusRule(rule),
      });
      setShowPBonusModal(false);
      loadPBonusRules();
    } catch (err: any) {
      alert('Error saving performance bonus rule: ' + err.message);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRuleRecord | null>(null);

  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<CommissionType>('percentage');
  const [formPercentage, setFormPercentage] = useState<number>(30);
  const [formFixedAmountMMK, setFormFixedAmountMMK] = useState<number>(5000);
  const [formFixedBonusMMK, setFormFixedBonusMMK] = useState<number>(2000);
  const [formTiers, setFormTiers] = useState<CommissionTier[]>([
    { minAmountMMK: 0, maxAmountMMK: 50000, type: 'percentage', value: 20 },
    { minAmountMMK: 50000, maxAmountMMK: undefined, type: 'percentage', value: 30 },
  ]);
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    item: CommissionRuleRecord | null;
  }>({ isOpen: false, item: null });

  const filteredRules = useMemo(() => {
    return commissionRules.filter((r) => {
      const matchSearch =
        searchTerm === '' ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchType = typeFilter === 'all' || r.type === typeFilter;

      const matchActive =
        activeFilter === 'all'
          ? true
          : activeFilter === 'active'
          ? r.isActive !== false
          : r.isActive === false;

      return matchSearch && matchType && matchActive;
    });
  }, [commissionRules, searchTerm, typeFilter, activeFilter]);

  const handleOpenAdd = () => {
    setEditingRule(null);
    setFormCode(`CR-${Date.now().toString().slice(-4)}`);
    setFormName('');
    setFormType('percentage');
    setFormPercentage(30);
    setFormFixedAmountMMK(5000);
    setFormFixedBonusMMK(2000);
    setFormTiers([
      { minAmountMMK: 0, maxAmountMMK: 50000, type: 'percentage', value: 20 },
      { minAmountMMK: 50000, maxAmountMMK: undefined, type: 'percentage', value: 30 },
    ]);
    setFormDescription('');
    setFormIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: CommissionRuleRecord) => {
    setEditingRule(rule);
    setFormCode(rule.code);
    setFormName(rule.name);
    setFormType(rule.type);
    setFormPercentage(rule.percentage || 30);
    setFormFixedAmountMMK(rule.fixedAmountMMK || 5000);
    setFormFixedBonusMMK(rule.fixedBonusMMK || 2000);
    setFormTiers(
      rule.tiers && rule.tiers.length > 0
        ? JSON.parse(JSON.stringify(rule.tiers))
        : [
            { minAmountMMK: 0, maxAmountMMK: 50000, type: 'percentage', value: 20 },
            { minAmountMMK: 50000, maxAmountMMK: undefined, type: 'percentage', value: 30 },
          ]
    );
    setFormDescription(rule.description || '');
    setFormIsActive(rule.isActive !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleAddTier = () => {
    const lastTier = formTiers[formTiers.length - 1];
    const newMin = lastTier?.maxAmountMMK || (lastTier ? lastTier.minAmountMMK + 50000 : 0);
    setFormTiers([
      ...formTiers,
      { minAmountMMK: newMin, maxAmountMMK: undefined, type: 'percentage', value: 35 },
    ]);
  };

  const handleRemoveTier = (index: number) => {
    if (formTiers.length <= 1) return;
    setFormTiers(formTiers.filter((_, i) => i !== index));
  };

  const handleTierChange = (index: number, field: keyof CommissionTier, value: any) => {
    const updated = [...formTiers];
    updated[index] = { ...updated[index], [field]: value };
    setFormTiers(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formCode.trim()) {
      setFormError(isMm ? 'စည်းမျဉ်းကုဒ် ထည့်သွင်းပေးပါ' : 'Rule code is required');
      return;
    }
    if (!formName.trim()) {
      setFormError(isMm ? 'စည်းမျဉ်းအမည် ထည့်သွင်းပေးပါ' : 'Rule name is required');
      return;
    }

    const now = new Date().toISOString();

    try {
      if (editingRule) {
        // Version-Safe Update: Increment version number and update record
        const nextVersion = (editingRule.version || 1) + 1;

        await db.commissionRulesMaster.update(editingRule.id, {
          code: formCode.trim().toUpperCase(),
          name: formName.trim(),
          type: formType,
          percentage:
            formType === 'percentage' || formType === 'percentage_plus_fixed'
              ? Number(formPercentage)
              : undefined,
          fixedAmountMMK: formType === 'fixed' ? Number(formFixedAmountMMK) : undefined,
          fixedBonusMMK:
            formType === 'percentage_plus_fixed' ? Number(formFixedBonusMMK) : undefined,
          tiers: formType === 'tiered' ? formTiers : undefined,
          version: nextVersion,
          description: formDescription.trim() || undefined,
          isActive: formIsActive,
          updatedAt: now,
          updatedBy: currentUser.username,
        });
      } else {
        const newId = `crule_${Date.now()}`;
        await db.commissionRulesMaster.add({
          id: newId,
          code: formCode.trim().toUpperCase(),
          name: formName.trim(),
          type: formType,
          percentage:
            formType === 'percentage' || formType === 'percentage_plus_fixed'
              ? Number(formPercentage)
              : undefined,
          fixedAmountMMK: formType === 'fixed' ? Number(formFixedAmountMMK) : undefined,
          fixedBonusMMK:
            formType === 'percentage_plus_fixed' ? Number(formFixedBonusMMK) : undefined,
          tiers: formType === 'tiered' ? formTiers : undefined,
          version: 1,
          description: formDescription.trim() || undefined,
          isActive: formIsActive,
          createdAt: now,
          updatedAt: now,
          createdBy: currentUser.username,
        });
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err?.message || 'Error saving commission rule');
    }
  };

  const handleToggleActive = async (rule: CommissionRuleRecord) => {
    try {
      await db.commissionRulesMaster.update(rule.id, {
        isActive: rule.isActive === false,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.username,
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const renderFormula = (rule: CommissionRuleRecord) => {
    switch (rule.type) {
      case 'percentage':
        return (
          <span className="font-bold text-amber-900 font-mono">
            {rule.percentage || 0}%
          </span>
        );
      case 'fixed':
        return (
          <span className="font-bold text-indigo-900 font-mono">
            {formatMMK(rule.fixedAmountMMK || 0)}
          </span>
        );
      case 'percentage_plus_fixed':
        return (
          <span className="font-bold text-emerald-900 font-mono">
            {rule.percentage || 0}% + {formatMMK(rule.fixedBonusMMK || 0)}
          </span>
        );
      case 'tiered':
        return (
          <div className="space-y-0.5 text-[11px] font-mono">
            {(rule.tiers || []).map((t, idx) => (
              <div key={idx} className="text-slate-700">
                {t.minAmountMMK.toLocaleString()} - {t.maxAmountMMK ? t.maxAmountMMK.toLocaleString() : '∞'} MMK: <strong className="text-amber-700">{t.value}{t.type === 'percentage' ? '%' : ' MMK'}</strong>
              </div>
            ))}
          </div>
        );
      default:
        return <span>-</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Percent className="h-5 w-5 text-amber-600" />
            <span>{isMm ? 'ကော်မရှင် စည်းမျဉ်းများ စီမံခန့်ခွဲမှု' : 'Commission Rules Master'}</span>
            <span className="ml-2 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5">
              {commissionRules.length}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isMm
              ? 'ရာခိုင်နှုန်း (Percentage)၊ ပုံသေနှုန်း (Fixed)၊ ရာခိုင်နှုန်း+ပုံသေဆုကြေး၊ အဆင့်လိုက်သတ်မှတ်ချက် (Tiered) နှင့် Version Safety စနစ်'
              : 'Configurable commission algorithms supporting percentage, fixed amounts, hybrid bonus, and tiered slabs with version tracking.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'commission' ? (
            <button
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 active:bg-amber-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>{isMm ? 'ကော်မရှင်စည်းမျဉ်းသစ်' : 'Add Commission Rule'}</span>
            </button>
          ) : (
            <button
              onClick={handleOpenPBonusAdd}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>{isMm ? 'ဆုကြေးစည်းမျဉ်းသစ်' : 'Add Performance Rule'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Subtab Switcher */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('commission')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'commission'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Percent className="h-4 w-4" />
          <span>{isMm ? 'ကော်မရှင် စည်းမျဉ်းများ' : 'Commission Rules'} ({commissionRules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('performance_bonus')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'performance_bonus'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Coins className="h-4 w-4" />
          <span>{isMm ? 'စွမ်းဆောင်ရည် ဆုကြေး စည်းမျဉ်းများ' : 'Performance Bonus Rules'} ({pBonusRules.length})</span>
        </button>
      </div>

      {/* Active Tab View */}
      {activeTab === 'performance_bonus' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-indigo-50/50">
              <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                <Coins className="h-4 w-4 text-indigo-600" />
                <span>{isMm ? 'စွမ်းဆောင်ရည် ဆုကြေး စည်းမျဉ်းများ စာရင်း' : 'Performance Bonus Rules List'}</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">{isMm ? 'စည်းမျဉ်းအမည်' : 'Rule Name'}</th>
                    <th className="px-4 py-3">{isMm ? 'အနည်းဆုံး ဝင်ငွေ (MMK)' : 'Min Revenue'}</th>
                    <th className="px-4 py-3">{isMm ? 'အနည်းဆုံး အလှည့်' : 'Min Sessions'}</th>
                    <th className="px-4 py-3">{isMm ? 'အနည်းဆုံး ရက်မှန်' : 'Min Attendance'}</th>
                    <th className="px-4 py-3">{isMm ? 'ဆုကြေးငွေ (MMK)' : 'Bonus Amount'}</th>
                    <th className="px-4 py-3">{isMm ? 'အခြေအနေ' : 'Status'}</th>
                    <th className="px-4 py-3 text-right">{isMm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {pBonusRules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        {isMm ? 'ဆုကြေးစည်းမျဉ်း သတ်မှတ်ထားခြင်း မရှိသေးပါ' : 'No performance bonus rules created yet.'}
                      </td>
                    </tr>
                  ) : (
                    pBonusRules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold text-gray-900">{rule.ruleName}</td>
                        <td className="px-4 py-3 font-mono text-gray-800">{formatMMK(rule.minRevenueMMK || 0)}</td>
                        <td className="px-4 py-3 font-mono text-gray-800">{rule.minSessions || 0}</td>
                        <td className="px-4 py-3 font-mono text-gray-800">{rule.minAttendanceDays || 0} {isMm ? 'ရက်' : 'days'}</td>
                        <td className="px-4 py-3 font-mono text-indigo-700 font-extrabold">{formatMMK(rule.bonusAmountMMK || 0)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${rule.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                            {rule.isActive !== false ? (isMm ? 'အသုံးပြုဆဲ' : 'Active') : (isMm ? 'ပိတ်ထားသည်' : 'Inactive')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleOpenPBonusEdit(rule)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Version Safety Info Card */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex items-start gap-3">
            <GitBranch className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <div className="font-bold">
                {isMm ? 'သမိုင်းဝင်တွက်ချက်မှု မပျက်စီးစေသော Version Safety စနစ်' : 'Version-Safe Historical Commission Protection'}
              </div>
              <p className="mt-0.5 text-amber-800 leading-relaxed">
                {isMm
                  ? 'ကော်မရှင်စည်းမျဉ်းတစ်ခုအား ပြင်ဆင်တိုင်း Version နံပါတ် အလိုအလျောက်တိုးသွားမည်ဖြစ်ပြီး၊ ယခင်ပြီးစီးခဲ့ပြီးသော အလှည့်/လစာရှင်းတမ်းမှတ်တမ်းများသည် မူရင်း Version ဖြင့်သာ တိကျစွာတည်ရှိနေပါမည်။'
                  : 'Modifying a commission rule automatically increments its version. Previous service sessions, commission slips, and staff ledger entries retain their historical snapshot and will never alter past payouts.'}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isMm ? 'ကုဒ်၊ စည်းမျဉ်းအမည် ရှာရန်...' : 'Search rule code, name...'}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'တွက်ချက်မှုပုံစံ: အားလုံး' : 'Rule Type: All'}</option>
            <option value="percentage">{isMm ? 'ရာခိုင်နှုန်း (Percentage)' : 'Percentage'}</option>
            <option value="fixed">{isMm ? 'ပုံသေနှုန်း (Fixed Amount)' : 'Fixed Amount'}</option>
            <option value="percentage_plus_fixed">{isMm ? 'ရာခိုင်နှုန်း + ပုံသေဆု (Hybrid)' : 'Percentage + Fixed'}</option>
            <option value="tiered">{isMm ? 'အဆင့်လိုက်သတ်မှတ်ချက် (Tiered)' : 'Tiered Slabs'}</option>
          </select>
        </div>

        <div>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white text-gray-700 font-medium"
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
                <th className="py-3 px-4">{isMm ? 'စည်းမျဉ်းအမည်' : 'Rule Name'}</th>
                <th className="py-3 px-4">{isMm ? 'တွက်ချက်ပုံစံ' : 'Calculation Type'}</th>
                <th className="py-3 px-4">{isMm ? 'တွက်ချက်နည်း ဖော်မြူလာ' : 'Payout Formula'}</th>
                <th className="py-3 px-4">{isMm ? 'ဗားရှင်း' : 'Version'}</th>
                <th className="py-3 px-4">{isMm ? 'စာရင်းဝင်' : 'Active'}</th>
                <th className="py-3 px-4 text-right">{isMm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    {isMm ? 'ကော်မရှင်စည်းမျဉ်း ရှာမတွေ့ပါ' : 'No commission rules found.'}
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => {
                  return (
                    <tr
                      key={rule.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        rule.isActive === false ? 'opacity-60 bg-gray-50/50' : ''
                      }`}
                    >
                      {/* Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-900">
                        {rule.code}
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{rule.name}</div>
                        {rule.description && (
                          <div className="text-[11px] text-gray-500 truncate max-w-xs">
                            {rule.description}
                          </div>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 capitalize">
                          {rule.type.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Formula */}
                      <td className="py-3.5 px-4">
                        {renderFormula(rule)}
                      </td>

                      {/* Version */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-[10px] font-mono font-bold">
                          <History className="h-3 w-3" />
                          <span>v{rule.version || 1}</span>
                        </span>
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {rule.isActive !== false ? (
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
                            onClick={() => handleOpenEdit(rule)}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            title={isMm ? 'ပြင်ဆင်ရန်' : 'Edit'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                item: rule,
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              rule.isActive !== false
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {rule.isActive !== false
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
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Percent className="h-5 w-5 text-amber-600" />
                <span>
                  {editingRule
                    ? isMm ? `ကော်မရှင် စည်းမျဉ်း ပြင်ဆင်ခြင်း (Next: v${(editingRule.version || 1) + 1})` : `Edit Commission Rule (Will bump to v${(editingRule.version || 1) + 1})`
                    : isMm ? 'ကော်မရှင် စည်းမျဉ်းသစ် ထည့်သွင်းခြင်း (v1)' : 'Add New Commission Rule (v1)'}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editingRule && (
              <div className="mb-4 rounded-xl bg-purple-50 p-3 text-xs text-purple-900 border border-purple-200 flex items-start gap-2">
                <Info className="h-4 w-4 text-purple-700 shrink-0 mt-0.5" />
                <div>
                  <strong>{isMm ? 'Version Safety သတိပေးချက်:' : 'Version Safety Active:'}</strong>{' '}
                  {isMm
                    ? `ဤစည်းမျဉ်းကို ပြင်ဆင်ပါက v${(editingRule.version || 1) + 1} အဖြစ် တိုးမြှင့်သိမ်းဆည်းပါမည်။ ယခင်ပြီးစီးခဲ့သော စာရင်းများ မပြောင်းလဲပါ။`
                    : `Saving will increment version to v${(editingRule.version || 1) + 1}. All existing sessions captured under v${editingRule.version || 1} will retain exact original calculations.`}
                </div>
              </div>
            )}

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
                    {isMm ? 'စည်းမျဉ်းကုဒ်' : 'Rule Code'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. CR-30PCT"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono uppercase focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'စည်းမျဉ်းအမည်' : 'Rule Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Standard 30% Therapist Rate"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Rule Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'ကော်မရှင်တွက်ချက်မှု ပုံစံ (Commission Type)' : 'Commission Algorithm Type'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'percentage', label: 'Percentage', sub: 'e.g. 30%' },
                    { id: 'fixed', label: 'Fixed MMK', sub: 'e.g. 5,000 MMK' },
                    { id: 'percentage_plus_fixed', label: '% + Bonus', sub: '20% + 2,000' },
                    { id: 'tiered', label: 'Tiered Slabs', sub: 'Tier 1 / 2' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormType(t.id as CommissionType)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        formType === t.id
                          ? 'border-amber-600 bg-amber-50/70 text-amber-900 ring-1 ring-amber-600'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{t.label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Inputs Based on Type */}
              {formType === 'percentage' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ကော်မရှင် ရာခိုင်နှုန်း (%)' : 'Commission Percentage (%)'} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    required
                    value={formPercentage}
                    onChange={(e) => setFormPercentage(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
              )}

              {formType === 'fixed' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ပုံသေနှုန်းထား (MMK per session)' : 'Fixed Payout (MMK per session)'} *
                  </label>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    required
                    value={formFixedAmountMMK}
                    onChange={(e) => setFormFixedAmountMMK(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
              )}

              {formType === 'percentage_plus_fixed' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {isMm ? 'အခြေခံ ရာခိုင်နှုန်း (%)' : 'Base Percentage (%)'} *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={formPercentage}
                      onChange={(e) => setFormPercentage(Number(e.target.value))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {isMm ? 'ပုံသေဆုကြေး (Fixed Bonus MMK)' : 'Fixed Bonus MMK'} *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      required
                      value={formFixedBonusMMK}
                      onChange={(e) => setFormFixedBonusMMK(Number(e.target.value))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {formType === 'tiered' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-800">
                      {isMm ? 'အဆင့်လိုက် သတ်မှတ်ချက်များ (Tiered Slabs)' : 'Tiered Slabs Configuration'}
                    </label>
                    <button
                      type="button"
                      onClick={handleAddTier}
                      className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-100/70 hover:bg-amber-100 px-2 py-1 rounded-lg"
                    >
                      <Plus className="h-3 w-3" />
                      <span>{isMm ? 'အဆင့်သစ် ထည့်ရန်' : 'Add Slab'}</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {formTiers.map((tier, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-200 text-xs"
                      >
                        <div className="w-full sm:w-1/3">
                          <label className="text-[10px] text-gray-500 block mb-0.5">
                            Min Amount (MMK)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="5000"
                            value={tier.minAmountMMK}
                            onChange={(e) =>
                              handleTierChange(idx, 'minAmountMMK', Number(e.target.value))
                            }
                            className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs"
                          />
                        </div>

                        <div className="w-full sm:w-1/3">
                          <label className="text-[10px] text-gray-500 block mb-0.5">
                            Max Amount (MMK)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="5000"
                            value={tier.maxAmountMMK || ''}
                            placeholder="Unlimited (∞)"
                            onChange={(e) =>
                              handleTierChange(
                                idx,
                                'maxAmountMMK',
                                e.target.value ? Number(e.target.value) : undefined
                              )
                            }
                            className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs"
                          />
                        </div>

                        <div className="w-full sm:w-1/3 flex items-end gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-500 block mb-0.5">
                              Rate ({tier.type === 'percentage' ? '%' : 'MMK'})
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={tier.value}
                              onChange={(e) =>
                                handleTierChange(idx, 'value', Number(e.target.value))
                              }
                              className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold"
                            />
                          </div>

                          {formTiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTier(idx)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'ဖော်ပြချက်' : 'Description / Notes'}
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={isMm ? 'စည်းမျဉ်းအသေးစိတ် အချက်အလက်...' : 'Rule details, eligible staff types...'}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="formIsActiveRule"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-gray-300"
                />
                <label htmlFor="formIsActiveRule" className="text-xs font-medium text-gray-700">
                  {isMm ? 'ဤကော်မရှင်စည်းမျဉ်းကို အသုံးပြုခွင့်ပေးမည် (Active)' : 'Active for dispatch assignment'}
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
                  <span>
                    {editingRule
                      ? isMm ? `v${(editingRule.version || 1) + 1} ဖြင့် သိမ်းမည်` : `Save as v${(editingRule.version || 1) + 1}`
                      : isMm ? 'သိမ်းဆည်းမည်' : 'Save Rule'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Performance Bonus Modal */}
      {showPBonusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Coins className="h-5 w-5 text-indigo-600" />
                <span>{editingPBonus ? (isMm ? 'ဆုကြေးစည်းမျဉ်း ပြင်ဆင်ရန်' : 'Edit Performance Rule') : (isMm ? 'ဆုကြေးစည်းမျဉ်းသစ် ထည့်ရန်' : 'Add Performance Bonus Rule')}</span>
              </h3>
              <button onClick={() => setShowPBonusModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSavePBonus} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{isMm ? 'စည်းမျဉ်းအမည်' : 'Rule Name'}</label>
                <input
                  type="text"
                  required
                  value={pbRuleName}
                  onChange={e => setPbRuleName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">{isMm ? 'အနည်းဆုံး ဝင်ငွေ (MMK)' : 'Min Revenue'}</label>
                  <input
                    type="number"
                    step="50000"
                    value={pbMinRevenue}
                    onChange={e => setPbMinRevenue(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono font-bold text-gray-900 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">{isMm ? 'အနည်းဆုံး အလှည့်' : 'Min Sessions'}</label>
                  <input
                    type="number"
                    value={pbMinSessions}
                    onChange={e => setPbMinSessions(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono font-bold text-gray-900 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">{isMm ? 'အနည်းဆုံး ရက်မှန်' : 'Min Attendance (Days)'}</label>
                  <input
                    type="number"
                    value={pbMinAttendance}
                    onChange={e => setPbMinAttendance(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono font-bold text-gray-900 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">{isMm ? 'ဆုကြေးငွေ (MMK)' : 'Bonus Amount (MMK)'}</label>
                  <input
                    type="number"
                    step="5000"
                    value={pbBonusAmount}
                    onChange={e => setPbBonusAmount(Number(e.target.value))}
                    className="w-full rounded-xl border border-indigo-300 bg-indigo-50/50 px-3 py-2 text-xs font-mono font-extrabold text-indigo-900 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pbIsActive"
                  checked={pbIsActive}
                  onChange={e => setPbIsActive(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <label htmlFor="pbIsActive" className="text-xs font-semibold text-gray-700">
                  {isMm ? 'အသုံးပြုမည် (Active)' : 'Active for performance calculation'}
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowPBonusModal(false)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm"
                >
                  {isMm ? 'သိမ်းဆည်းမည်' : 'Save Rule'}
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
          title={isMm ? 'ကော်မရှင်စည်းမျဉ်း အခြေအနေပြောင်းလဲခြင်း' : 'Update Commission Rule Active Status'}
          itemName={confirmModal.item.name}
          currentStatus={confirmModal.item.isActive !== false}
          lang={lang}
        />
      )}
    </div>
  );
};
