import React, { useState, useMemo } from 'react';
import { Room, UserAccount, RoomStatus } from '../../../types';
import { db } from '../../../db/database';
import { Language } from '../../../utils/translations';
import { formatMMK } from '../../../domain/financial';
import {
  LayoutGrid,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  X,
  Save,
  Wrench,
  Users,
  Layers,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { ConfirmDeactivateModal } from './ConfirmDeactivateModal';

interface RoomsMasterTabProps {
  rooms: Room[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const RoomsMasterTab: React.FC<RoomsMasterTabProps> = ({
  rooms,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Form states
  const [formRoomNumber, setFormRoomNumber] = useState('');
  const [formName, setFormName] = useState('');
  const [formNameMm, setFormNameMm] = useState('');
  const [formType, setFormType] = useState<Room['type']>('vip_suite');
  const [formCapacity, setFormCapacity] = useState<number>(2);
  const [formHourlyRateMMK, setFormHourlyRateMMK] = useState<number>(25000);
  const [formSurchargeMMK, setFormSurchargeMMK] = useState<number>(0);
  const [formBasePriceMMK, setFormBasePriceMMK] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<RoomStatus>('available');
  const [formMaintenanceNotes, setFormMaintenanceNotes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    item: Room | null;
  }>({ isOpen: false, item: null });

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchSearch =
        searchTerm === '' ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.nameMm && r.nameMm.includes(searchTerm)) ||
        (r.roomNumber && r.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus =
        statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase();

      const matchType = typeFilter === 'all' || r.type === typeFilter;

      const matchActive =
        activeFilter === 'all'
          ? true
          : activeFilter === 'active'
          ? r.isActive !== false
          : r.isActive === false;

      return matchSearch && matchStatus && matchType && matchActive;
    });
  }, [rooms, searchTerm, statusFilter, typeFilter, activeFilter]);

  const handleOpenAdd = () => {
    setEditingRoom(null);
    setFormRoomNumber(`R-${Date.now().toString().slice(-3)}`);
    setFormName('');
    setFormNameMm('');
    setFormType('vip_suite');
    setFormCapacity(2);
    setFormHourlyRateMMK(25000);
    setFormSurchargeMMK(0);
    setFormBasePriceMMK(0);
    setFormStatus('available');
    setFormMaintenanceNotes('');
    setFormIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (room: Room) => {
    setEditingRoom(room);
    setFormRoomNumber(room.roomNumber || '');
    setFormName(room.name);
    setFormNameMm(room.nameMm || '');
    setFormType(room.type);
    setFormCapacity(room.capacity || 2);
    setFormHourlyRateMMK(room.hourlyRateMMK || 0);
    setFormSurchargeMMK(room.surchargeMMK || 0);
    setFormBasePriceMMK(room.basePriceMMK || 0);
    setFormStatus(room.status);
    setFormMaintenanceNotes(room.maintenanceNotes || '');
    setFormIsActive(room.isActive !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError(isMm ? 'အခန်းအမည် ထည့်သွင်းပေးပါ' : 'Room name is required');
      return;
    }

    try {
      if (editingRoom) {
        await db.rooms.update(editingRoom.id, {
          roomNumber: formRoomNumber.trim() || undefined,
          name: formName.trim(),
          nameMm: formNameMm.trim() || formName.trim(),
          type: formType,
          capacity: Number(formCapacity) || 1,
          hourlyRateMMK: Number(formHourlyRateMMK) || 0,
          surchargeMMK: Number(formSurchargeMMK) || 0,
          basePriceMMK: Number(formBasePriceMMK) || 0,
          status: formStatus,
          maintenanceNotes: formMaintenanceNotes.trim() || undefined,
          isActive: formIsActive,
        });
      } else {
        const newId = `rm_${Date.now()}`;
        await db.rooms.add({
          id: newId,
          roomNumber: formRoomNumber.trim() || undefined,
          name: formName.trim(),
          nameMm: formNameMm.trim() || formName.trim(),
          type: formType,
          capacity: Number(formCapacity) || 1,
          hourlyRateMMK: Number(formHourlyRateMMK) || 0,
          surchargeMMK: Number(formSurchargeMMK) || 0,
          basePriceMMK: Number(formBasePriceMMK) || 0,
          status: formStatus,
          maintenanceNotes: formMaintenanceNotes.trim() || undefined,
          isActive: formIsActive,
        });
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err?.message || 'Error saving room');
    }
  };

  const handleToggleActive = async (room: Room) => {
    try {
      await db.rooms.update(room.id, {
        isActive: room.isActive === false,
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickStatusChange = async (room: Room, newStatus: RoomStatus) => {
    try {
      await db.rooms.update(room.id, {
        status: newStatus,
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
            <LayoutGrid className="h-5 w-5 text-emerald-600" />
            <span>{isMm ? 'အခန်းများ စီမံခန့်ခွဲမှု' : 'Rooms & Suites Directory'}</span>
            <span className="ml-2 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5">
              {rooms.length}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isMm
              ? 'အခန်းအမျိုးအစား၊ နံပါတ်၊ ဝင်ဆံ့ဦးရေ၊ အချိန်အလိုက်ဈေးနှုန်းနှင့် ပြုပြင်ထိန်းသိမ်းမှု (Maintenance) အခြေအနေ'
              : 'Configure room types, pricing reference, capacities, and maintenance status tracking.'}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{isMm ? 'အခန်းအသစ် သတ်မှတ်ရန်' : 'Add New Room'}</span>
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
            placeholder={isMm ? 'အခန်းအမည်၊ နံပါတ် ရှာရန်...' : 'Search room name, number...'}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'အခန်းအခြေအနေ: အားလုံး' : 'Status: All'}</option>
            <option value="available">{isMm ? 'AVAILABLE (အားလပ်နေ)' : 'AVAILABLE'}</option>
            <option value="occupied">{isMm ? 'OCCUPIED (အသုံးပြုနေ)' : 'OCCUPIED'}</option>
            <option value="reserved">{isMm ? 'RESERVED (ကြိုတင်ချိတ်)' : 'RESERVED'}</option>
            <option value="maintenance">{isMm ? 'MAINTENANCE (ပြင်ဆင်နေ)' : 'MAINTENANCE'}</option>
          </select>
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'အခန်းအမျိုးအစား: အားလုံး' : 'Room Type: All'}</option>
            <option value="vip_suite">VIP Suite</option>
            <option value="massage_bed">Massage Bed</option>
            <option value="foot_hall">Foot Reflexology Hall</option>
            <option value="ktv_large">Large KTV</option>
            <option value="ktv_medium">Medium KTV</option>
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
                <th className="py-3 px-4">{isMm ? 'အခန်းနံပါတ် / အမည်' : 'Room No. / Name'}</th>
                <th className="py-3 px-4">{isMm ? 'အမျိုးအစား' : 'Category / Type'}</th>
                <th className="py-3 px-4">{isMm ? 'ဝင်ဆံ့ဦးရေ' : 'Capacity'}</th>
                <th className="py-3 px-4">{isMm ? 'အချိန်အလိုက်နှုန်းထား' : 'Pricing Reference'}</th>
                <th className="py-3 px-4">{isMm ? 'အခန်းအခြေအနေ' : 'Status'}</th>
                <th className="py-3 px-4">{isMm ? 'ပြုပြင်ထိန်းသိမ်းမှု' : 'Maintenance Status'}</th>
                <th className="py-3 px-4">{isMm ? 'စာရင်းဝင်' : 'Active'}</th>
                <th className="py-3 px-4 text-right">{isMm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    {isMm ? 'အခန်းမှတ်တမ်း ရှာမတွေ့ပါ' : 'No rooms found.'}
                  </td>
                </tr>
              ) : (
                filteredRooms.map((room) => {
                  const statusUpper = room.status.toUpperCase();
                  const isMaint = room.status === 'maintenance';

                  return (
                    <tr
                      key={room.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        room.isActive === false ? 'opacity-60 bg-gray-50/50' : ''
                      }`}
                    >
                      {/* Room Number & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {room.roomNumber && (
                            <span className="font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md text-[11px]">
                              {room.roomNumber}
                            </span>
                          )}
                          <span className="font-bold text-gray-900">{room.name}</span>
                        </div>
                        {room.nameMm && (
                          <div className="text-[11px] text-gray-500 mt-0.5">{room.nameMm}</div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 capitalize">
                          <Layers className="h-3 w-3" />
                          <span>{room.type.replace('_', ' ')}</span>
                        </span>
                      </td>

                      {/* Capacity */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-gray-700 font-medium">
                          <Users className="h-3 w-3 text-gray-400" />
                          <span>{room.capacity || 1} Persons</span>
                        </span>
                      </td>

                      {/* Pricing Reference */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">
                          {room.hourlyRateMMK > 0
                            ? `${formatMMK(room.hourlyRateMMK)} / hr`
                            : isMm ? 'အခမဲ့ / ဝန်ဆောင်မှုဖြင့်တွဲ' : 'Included in service'}
                        </div>
                        {room.surchargeMMK > 0 && (
                          <div className="text-[11px] text-amber-700 font-medium">
                            + {formatMMK(room.surchargeMMK)} Surcharge
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            statusUpper === 'AVAILABLE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : statusUpper === 'OCCUPIED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : statusUpper === 'RESERVED'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : statusUpper === 'MAINTENANCE'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              statusUpper === 'AVAILABLE'
                                ? 'bg-emerald-500'
                                : statusUpper === 'OCCUPIED'
                                ? 'bg-rose-500'
                                : statusUpper === 'RESERVED'
                                ? 'bg-blue-500'
                                : statusUpper === 'MAINTENANCE'
                                ? 'bg-amber-500'
                                : 'bg-purple-500'
                            }`}
                          />
                          <span>{statusUpper}</span>
                        </span>
                      </td>

                      {/* Maintenance Status */}
                      <td className="py-3.5 px-4">
                        {isMaint ? (
                          <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-[11px]">
                            <Wrench className="h-3.5 w-3.5 text-amber-600" />
                            <span>{room.maintenanceNotes || (isMm ? 'ပြင်ဆင်နေဆဲ' : 'Under Maintenance')}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">
                            {isMm ? 'ပုံမှန်' : 'Normal'}
                          </span>
                        )}
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {room.isActive !== false ? (
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
                          {/* Quick Maintenance Toggle */}
                          <button
                            onClick={() =>
                              handleQuickStatusChange(
                                room,
                                isMaint ? 'available' : 'maintenance'
                              )
                            }
                            className={`p-1.5 rounded-lg text-xs transition-colors ${
                              isMaint
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'text-amber-600 hover:bg-amber-50'
                            }`}
                            title={isMaint ? 'Mark as Available' : 'Set to Maintenance'}
                          >
                            <Wrench className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(room)}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            title={isMm ? 'ပြင်ဆင်ရန်' : 'Edit'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                item: room,
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              room.isActive !== false
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {room.isActive !== false
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
                <LayoutGrid className="h-5 w-5 text-emerald-600" />
                <span>
                  {editingRoom
                    ? isMm ? 'အခန်းအချက်အလက် ပြင်ဆင်ခြင်း' : 'Edit Room Details'
                    : isMm ? 'အခန်းအသစ် သတ်မှတ်ခြင်း' : 'Add New Room'}
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
                {/* Room Number */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'အခန်းနံပါတ်' : 'Room Number / Code'}
                  </label>
                  <input
                    type="text"
                    value={formRoomNumber}
                    onChange={(e) => setFormRoomNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. VIP-01"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-mono text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                  />
                </div>

                {/* Capacity */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ဆံ့ဝင်နိုင်သည့်ဦးရေ' : 'Guest Capacity'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Name EN */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'အခန်းအမည် (အင်္ဂလိပ်)' : 'Room Name (EN)'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. VIP Suite 1 (Rose)"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                  />
                </div>

                {/* Name MM */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'အခန်းအမည် (မြန်မာ)' : 'Room Name (Myanmar)'}
                  </label>
                  <input
                    type="text"
                    value={formNameMm}
                    onChange={(e) => setFormNameMm(e.target.value)}
                    placeholder="ဥပမာ - နှင်းဆီ (VIP အခန်း ၁)"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Room Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'အခန်းအမျိုးအစား' : 'Room Type'}
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                  >
                    <option value="vip_suite">VIP Suite</option>
                    <option value="massage_bed">Massage Bed</option>
                    <option value="foot_hall">Foot Reflexology Lounge</option>
                    <option value="ktv_large">Large KTV Room</option>
                    <option value="ktv_medium">Medium KTV Room</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'အခန်းအခြေအနေ' : 'Room Status'}
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                  >
                    <option value="available">AVAILABLE (အားလပ်နေ)</option>
                    <option value="occupied">OCCUPIED (အသုံးပြုနေ)</option>
                    <option value="reserved">RESERVED (ကြိုတင်ချိတ်)</option>
                    <option value="maintenance">MAINTENANCE (ပြင်ဆင်နေ)</option>
                    <option value="cleaning">CLEANING (သန့်ရှင်းရေး)</option>
                  </select>
                </div>
              </div>

              {/* Pricing References */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'အချိန်အလိုက် နှုန်းထား (MMK / နာရီ)' : 'Hourly Rate (MMK / hr)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formHourlyRateMMK}
                    onChange={(e) => setFormHourlyRateMMK(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'အခန်းထပ်ဆောင်းကြေး (MMK)' : 'Room Surcharge (MMK)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={formSurchargeMMK}
                    onChange={(e) => setFormSurchargeMMK(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                  />
                </div>
              </div>

              {/* Maintenance Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isMm ? 'ပြင်ဆင်ထိန်းသိမ်းမှု မှတ်ချက်' : 'Maintenance Status & Notes'}
                </label>
                <input
                  type="text"
                  value={formMaintenanceNotes}
                  onChange={(e) => setFormMaintenanceNotes(e.target.value)}
                  placeholder={isMm ? 'ဥပမာ - အဲကွန်း ပြုပြင်နေဆဲ' : 'e.g. AC servicing, sound test'}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="formIsActiveRoom"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                />
                <label htmlFor="formIsActiveRoom" className="text-xs font-medium text-gray-700">
                  {isMm ? 'ဤအခန်းကို အသုံးပြုခွင့်ပေးမည် (Active)' : 'Active for check-in and booking'}
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
                  <span>{isMm ? 'သိမ်းဆည်းမည်' : 'Save Room'}</span>
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
          title={isMm ? 'အခန်းစာရင်း အခြေအနေပြောင်းလဲခြင်း' : 'Update Room Active Status'}
          itemName={confirmModal.item.name}
          currentStatus={confirmModal.item.isActive !== false}
          lang={lang}
        />
      )}
    </div>
  );
};
