import React, { useState, useMemo } from 'react';
import { TableRecord, Room, UserAccount } from '../../../types';
import { db } from '../../../db/database';
import { Language } from '../../../utils/translations';
import {
  Coffee,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  X,
  Save,
  Users,
  LayoutGrid,
} from 'lucide-react';
import { ConfirmDeactivateModal } from './ConfirmDeactivateModal';

interface TablesMasterTabProps {
  tables: TableRecord[];
  rooms: Room[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const TablesMasterTab: React.FC<TablesMasterTabProps> = ({
  tables,
  rooms,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableRecord | null>(null);

  const [formTableNumber, setFormTableNumber] = useState('');
  const [formName, setFormName] = useState('');
  const [formNameMm, setFormNameMm] = useState('');
  const [formRoomId, setFormRoomId] = useState('');
  const [formCapacity, setFormCapacity] = useState<number>(4);
  const [formStatus, setFormStatus] = useState<'available' | 'occupied' | 'reserved' | 'maintenance'>('available');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    item: TableRecord | null;
  }>({ isOpen: false, item: null });

  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const matchSearch =
        searchTerm === '' ||
        t.tableNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.nameMm && t.nameMm.includes(searchTerm));

      const matchStatus = statusFilter === 'all' || t.status === statusFilter;

      const matchActive =
        activeFilter === 'all'
          ? true
          : activeFilter === 'active'
          ? t.isActive !== false
          : t.isActive === false;

      return matchSearch && matchStatus && matchActive;
    });
  }, [tables, searchTerm, statusFilter, activeFilter]);

  const handleOpenAdd = () => {
    setEditingTable(null);
    setFormTableNumber(`T-${Date.now().toString().slice(-3)}`);
    setFormName('');
    setFormNameMm('');
    setFormRoomId('');
    setFormCapacity(4);
    setFormStatus('available');
    setFormIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (table: TableRecord) => {
    setEditingTable(table);
    setFormTableNumber(table.tableNumber);
    setFormName(table.name);
    setFormNameMm(table.nameMm || '');
    setFormRoomId(table.roomId || '');
    setFormCapacity(table.capacity || 4);
    setFormStatus(table.status);
    setFormIsActive(table.isActive !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formTableNumber.trim()) {
      setFormError(isMm ? 'စားပွဲနံပါတ် ထည့်သွင်းပေးပါ' : 'Table number is required');
      return;
    }
    if (!formName.trim()) {
      setFormError(isMm ? 'စားပွဲအမည် ထည့်သွင်းပေးပါ' : 'Table name is required');
      return;
    }

    const now = new Date().toISOString();

    try {
      if (editingTable) {
        await db.diningTables.update(editingTable.id, {
          tableNumber: formTableNumber.trim().toUpperCase(),
          name: formName.trim(),
          nameMm: formNameMm.trim() || undefined,
          roomId: formRoomId || undefined,
          capacity: Number(formCapacity) || 2,
          status: formStatus,
          isActive: formIsActive,
          updatedAt: now,
          updatedBy: currentUser.username,
        });
      } else {
        const newId = `tbl_${Date.now()}`;
        await db.diningTables.add({
          id: newId,
          tableNumber: formTableNumber.trim().toUpperCase(),
          name: formName.trim(),
          nameMm: formNameMm.trim() || undefined,
          roomId: formRoomId || undefined,
          capacity: Number(formCapacity) || 2,
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
      setFormError(err?.message || 'Error saving table');
    }
  };

  const handleToggleActive = async (table: TableRecord) => {
    try {
      await db.diningTables.update(table.id, {
        isActive: table.isActive === false,
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
            <Coffee className="h-5 w-5 text-amber-700" />
            <span>{isMm ? 'စားပွဲများ / ကောင်တာများ စီမံခန့်ခွဲမှု' : 'Tables & Counters Directory'}</span>
            <span className="ml-2 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5">
              {tables.length}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isMm
              ? 'ဧည့်ခန်း၊ စားသောက်ဧရိယာနှင့် Lounge စားပွဲများ သတ်မှတ်ခြင်း'
              : 'Configure dining tables, lounge seatings, linked rooms, and guest capacities.'}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-800 active:bg-amber-900 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{isMm ? 'စားပွဲအသစ် သတ်မှတ်ရန်' : 'Add New Table'}</span>
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
            placeholder={isMm ? 'စားပွဲနံပါတ်၊ အမည် ရှာရန်...' : 'Search table number, name...'}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'အခြေအနေ: အားလုံး' : 'Status: All'}</option>
            <option value="available">{isMm ? 'AVAILABLE (အားလပ်နေ)' : 'Available'}</option>
            <option value="occupied">{isMm ? 'OCCUPIED (ဧည့်သည်ရှိ)' : 'Occupied'}</option>
            <option value="reserved">{isMm ? 'RESERVED (ကြိုချိတ်)' : 'Reserved'}</option>
          </select>
        </div>

        <div>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none bg-white text-gray-700 font-medium"
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
                <th className="py-3 px-4">{isMm ? 'စားပွဲနံပါတ်' : 'Table No.'}</th>
                <th className="py-3 px-4">{isMm ? 'စားပွဲအမည်' : 'Table Name'}</th>
                <th className="py-3 px-4">{isMm ? 'ချိတ်ဆက်ထားသည့်အခန်း' : 'Linked Room'}</th>
                <th className="py-3 px-4">{isMm ? 'ဝင်ဆံ့ဦးရေ' : 'Capacity'}</th>
                <th className="py-3 px-4">{isMm ? 'လက်ရှိအခြေအနေ' : 'Status'}</th>
                <th className="py-3 px-4">{isMm ? 'စာရင်းဝင်' : 'Active'}</th>
                <th className="py-3 px-4 text-right">{isMm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredTables.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    {isMm ? 'စားပွဲမှတ်တမ်း ရှာမတွေ့ပါ' : 'No tables found.'}
                  </td>
                </tr>
              ) : (
                filteredTables.map((table) => {
                  const linkedRoomObj = rooms.find((r) => r.id === table.roomId);

                  return (
                    <tr
                      key={table.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        table.isActive === false ? 'opacity-60 bg-gray-50/50' : ''
                      }`}
                    >
                      {/* Table Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-900">
                        {table.tableNumber}
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{table.name}</div>
                        {table.nameMm && (
                          <div className="text-[11px] text-gray-500">{table.nameMm}</div>
                        )}
                      </td>

                      {/* Linked Room */}
                      <td className="py-3.5 px-4">
                        {linkedRoomObj ? (
                          <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                            <LayoutGrid className="h-3 w-3 text-slate-400" />
                            <span>{linkedRoomObj.name}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">{isMm ? 'သီးသန့်စားပွဲ' : 'Independent'}</span>
                        )}
                      </td>

                      {/* Capacity */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-gray-700 font-medium">
                          <Users className="h-3 w-3 text-gray-400" />
                          <span>{table.capacity || 2} Persons</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            table.status === 'available'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : table.status === 'occupied'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              table.status === 'available'
                                ? 'bg-emerald-500'
                                : table.status === 'occupied'
                                ? 'bg-rose-500'
                                : 'bg-blue-500'
                            }`}
                          />
                          <span className="capitalize">{table.status}</span>
                        </span>
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {table.isActive !== false ? (
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
                            onClick={() => handleOpenEdit(table)}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            title={isMm ? 'ပြင်ဆင်ရန်' : 'Edit'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                item: table,
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              table.isActive !== false
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {table.isActive !== false
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
                <Coffee className="h-5 w-5 text-amber-700" />
                <span>
                  {editingTable
                    ? isMm ? 'စားပွဲအချက်အလက် ပြင်ဆင်ခြင်း' : 'Edit Table'
                    : isMm ? 'စားပွဲအသစ် သတ်မှတ်ခြင်း' : 'Add New Table'}
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
                {/* Table Number */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'စားပွဲနံပါတ်' : 'Table Number / Code'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTableNumber}
                    onChange={(e) => setFormTableNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. T-01"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono uppercase focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none"
                  />
                </div>

                {/* Capacity */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ဆံ့ဝင်ဦးရေ' : 'Guest Capacity'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none"
                  />
                </div>
              </div>

              {/* Name EN */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'စားပွဲအမည် (အင်္ဂလိပ်)' : 'Table Name (EN)'} *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Lounge Table 1"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none"
                />
              </div>

              {/* Name MM */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'စားပွဲအမည် (မြန်မာ)' : 'Table Name (Myanmar)'}
                </label>
                <input
                  type="text"
                  value={formNameMm}
                  onChange={(e) => setFormNameMm(e.target.value)}
                  placeholder="ဥပမာ - နားနေဧည့်ခန်း စားပွဲ ၁"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none"
                />
              </div>

              {/* Linked Room & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ချိတ်ဆက်အခန်း' : 'Linked Room (Optional)'}
                  </label>
                  <select
                    value={formRoomId}
                    onChange={(e) => setFormRoomId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none bg-white font-medium text-gray-800"
                  >
                    <option value="">{isMm ? '-- သီးသန့်စားပွဲ --' : '-- Standalone Table --'}</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'အခြေအနေ' : 'Table Status'}
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as 'available' | 'occupied' | 'reserved')
                    }
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none bg-white font-medium text-gray-800"
                  >
                    <option value="available">AVAILABLE (အားလပ်နေ)</option>
                    <option value="occupied">OCCUPIED (ဧည့်သည်ရှိ)</option>
                    <option value="reserved">RESERVED (ကြိုချိတ်)</option>
                  </select>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="formIsActiveTable"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded text-amber-700 focus:ring-amber-600 border-gray-300"
                />
                <label htmlFor="formIsActiveTable" className="text-xs font-medium text-gray-700">
                  {isMm ? 'ဤစားပွဲကို အသုံးပြုခွင့်ပေးမည် (Active)' : 'Active for orders and service'}
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
                  className="flex items-center gap-1.5 rounded-xl bg-amber-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-800"
                >
                  <Save className="h-4 w-4" />
                  <span>{isMm ? 'သိမ်းဆည်းမည်' : 'Save Table'}</span>
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
          title={isMm ? 'စားပွဲ အခြေအနေပြောင်းလဲခြင်း' : 'Update Table Active Status'}
          itemName={confirmModal.item.name}
          currentStatus={confirmModal.item.isActive !== false}
          lang={lang}
        />
      )}
    </div>
  );
};
