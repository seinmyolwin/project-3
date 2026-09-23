/**
 * ============================================================================
 * PHASE 25: BOOKINGS & APPOINTMENT MANAGEMENT VIEW
 * 100% Offline-First & LAN-Authoritative Resource Scheduling
 * Provides Day, Week, Timeline views, Conflict Prevention, and Check-in to Session.
 * ============================================================================
 */

import React, { useState, useMemo } from 'react';
import {
  BookingRecord,
  BookingStatus,
  Room,
  StaffMember,
  ServiceItem,
  Customer,
  UserAccount,
} from '../../types';
import { Language } from '../../utils/translations';
import { bookingManager } from '../../services/bookingManager';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  DoorClosed,
  Scissors,
  DollarSign,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  CalendarDays,
  Check,
  Ban,
  CalendarRange,
} from 'lucide-react';

interface BookingsViewProps {
  bookings: BookingRecord[];
  rooms: Room[];
  staff: StaffMember[];
  services: ServiceItem[];
  customers: Customer[];
  currentUser: UserAccount | null;
  lang: Language;
  onRefreshData: () => Promise<void>;
  onNavigateToRoom?: (roomId: string) => void;
}

type ViewMode = 'day' | 'timeline' | 'list';

export const BookingsView: React.FC<BookingsViewProps> = ({
  bookings,
  rooms,
  staff,
  services,
  customers,
  currentUser,
  lang,
  onRefreshData,
  onNavigateToRoom,
}) => {
  const isMm = lang === 'my';
  const todayStr = new Date().toISOString().split('T')[0];

  // View state
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roomFilter, setRoomFilter] = useState<string>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBookingForAction, setSelectedBookingForAction] = useState<BookingRecord | null>(null);
  const [actionType, setActionType] = useState<'checkin' | 'cancel' | 'edit' | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state for new / edit booking
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formCustomerId, setFormCustomerId] = useState<string | undefined>(undefined);
  const [formServiceId, setFormServiceId] = useState<string>('');
  const [formRoomId, setFormRoomId] = useState<string>('');
  const [formStaffId, setFormStaffId] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(todayStr);
  const [formStartTime, setFormStartTime] = useState<string>('10:00');
  const [formDurationMinutes, setFormDurationMinutes] = useState<number>(60);
  const [formNotes, setFormNotes] = useState<string>('');
  const [formDepositMMK, setFormDepositMMK] = useState<number>(0);
  const [formDepositMethod, setFormDepositMethod] = useState<string>('cash');

  // Calculate form end time
  const formEndTime = useMemo(() => {
    const [h, m] = formStartTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '11:00';
    const totalMinutes = h * 60 + m + formDurationMinutes;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }, [formStartTime, formDurationMinutes]);

  // Live conflict warning in form
  const liveConflict = useMemo(() => {
    if (!formDate || !formStartTime || !formEndTime) return null;
    for (const b of bookings) {
      if (selectedBookingForAction && b.id === selectedBookingForAction.id) continue;
      if (b.date !== formDate || ['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(b.status)) continue;

      const isOverlap = b.startTime < formEndTime && b.endTime > formStartTime;
      if (isOverlap) {
        if (formRoomId && b.roomId === formRoomId) {
          return `အခန်း (${b.roomName || formRoomId}) သည် ${b.startTime}-${b.endTime} တွင် ကြိုတင်စာရင်းရှိပါသည်`;
        }
        if (formStaffId && b.staffId === formStaffId) {
          return `ဝန်ထမ်း (${b.staffName || formStaffId}) သည် ${b.startTime}-${b.endTime} တွင် တာဝန်ရှိပါသည်`;
        }
      }
    }
    return null;
  }, [bookings, formDate, formStartTime, formEndTime, formRoomId, formStaffId, selectedBookingForAction]);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Date filter
      if (viewMode !== 'list' && b.date !== selectedDate) return false;

      // Status filter
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;

      // Room filter
      if (roomFilter !== 'ALL' && b.roomId !== roomFilter) return false;

      // Staff filter
      if (staffFilter !== 'ALL' && b.staffId !== staffFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = b.customerName?.toLowerCase().includes(q);
        const matchPhone = b.customerPhone?.toLowerCase().includes(q);
        const matchCode = b.bookingCode?.toLowerCase().includes(q);
        const matchService = b.serviceName?.toLowerCase().includes(q);
        const matchRoom = b.roomName?.toLowerCase().includes(q);
        const matchStaff = b.staffName?.toLowerCase().includes(q);
        return matchName || matchPhone || matchCode || matchService || matchRoom || matchStaff;
      }

      return true;
    });
  }, [bookings, selectedDate, viewMode, statusFilter, roomFilter, staffFilter, searchQuery]);

  // Reset form
  const openCreateModal = () => {
    setSelectedBookingForAction(null);
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormCustomerId(undefined);
    setFormServiceId(services[0]?.id || '');
    setFormRoomId(rooms[0]?.id || '');
    setFormStaffId(staff[0]?.id || '');
    setFormDate(selectedDate || todayStr);
    setFormStartTime('14:00');
    setFormDurationMinutes(services[0]?.durationMinutes || 60);
    setFormNotes('');
    setFormDepositMMK(0);
    setFormDepositMethod('cash');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleServiceSelect = (serviceId: string) => {
    setFormServiceId(serviceId);
    const s = services.find((x) => x.id === serviceId);
    if (s && s.durationMinutes) {
      setFormDurationMinutes(s.durationMinutes);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    setFormCustomerId(customerId);
    const c = customers.find((x) => x.id === customerId);
    if (c) {
      setFormCustomerName(c.name);
      setFormCustomerPhone(c.phone || '');
    }
  };

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) {
      setFormError(isMm ? 'ဧည့်သည်အမည် ထည့်သွင်းပါ' : 'Please enter customer name');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const selectedService = services.find((s) => s.id === formServiceId);
      const selectedRoom = rooms.find((r) => r.id === formRoomId);
      const selectedStaff = staff.find((st) => st.id === formStaffId);

      if (selectedBookingForAction) {
        // Edit existing
        const res = await bookingManager.updateBooking({
          bookingId: selectedBookingForAction.id,
          customerName: formCustomerName,
          customerPhone: formCustomerPhone,
          serviceId: formServiceId || undefined,
          serviceName: selectedService?.name,
          roomId: formRoomId || undefined,
          roomName: selectedRoom?.name,
          staffId: formStaffId || undefined,
          staffName: selectedStaff?.name,
          date: formDate,
          startTime: formStartTime,
          endTime: formEndTime,
          durationMinutes: formDurationMinutes,
          notes: formNotes,
          updatedBy: currentUser?.name || 'Operator',
        });

        if (!res.success) {
          setFormError(res.error || 'Failed to update booking');
          setIsSubmitting(false);
          return;
        }
      } else {
        // Create new
        const res = await bookingManager.createBooking({
          customerId: formCustomerId,
          customerName: formCustomerName,
          customerPhone: formCustomerPhone,
          serviceId: formServiceId || undefined,
          serviceName: selectedService?.name,
          roomId: formRoomId || undefined,
          roomName: selectedRoom?.name,
          staffId: formStaffId || undefined,
          staffName: selectedStaff?.name,
          date: formDate,
          startTime: formStartTime,
          endTime: formEndTime,
          durationMinutes: formDurationMinutes,
          notes: formNotes,
          depositAmountMMK: formDepositMMK,
          depositPaymentMethod: formDepositMMK > 0 ? formDepositMethod : undefined,
          createdBy: currentUser?.name || 'Operator',
        });

        if (!res.success) {
          setFormError(res.error || 'Failed to create booking');
          setIsSubmitting(false);
          return;
        }
      }

      await onRefreshData();
      setIsCreateModalOpen(false);
      setSelectedBookingForAction(null);
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async (startSession: boolean) => {
    if (!selectedBookingForAction) return;
    setIsSubmitting(true);
    try {
      const room = rooms.find((r) => r.id === selectedBookingForAction.roomId);
      const res = await bookingManager.checkInBooking({
        bookingId: selectedBookingForAction.id,
        startSession,
        hourlyRateMMK: room?.hourlyRateMMK || 0,
        checkedInBy: currentUser?.name || 'Operator',
      });

      if (!res.success) {
        alert(res.error || 'Check-in failed');
      } else {
        await onRefreshData();
        setActionType(null);
        setSelectedBookingForAction(null);
        if (startSession && selectedBookingForAction.roomId && onNavigateToRoom) {
          onNavigateToRoom(selectedBookingForAction.roomId);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Check-in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!selectedBookingForAction) return;
    setIsSubmitting(true);
    try {
      const res = await bookingManager.cancelBooking({
        bookingId: selectedBookingForAction.id,
        reason: cancelReason || 'Customer request',
        cancelledBy: currentUser?.name || 'Operator',
      });

      if (!res.success) {
        alert(res.error || 'Cancellation failed');
      } else {
        await onRefreshData();
        setActionType(null);
        setSelectedBookingForAction(null);
        setCancelReason('');
      }
    } catch (err: any) {
      alert(err.message || 'Cancel failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60">CONFIRMED</span>;
      case 'CHECKED_IN':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60">CHECKED IN</span>;
      case 'IN_SERVICE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-950 text-purple-300 border border-purple-800/60">IN SERVICE</span>;
      case 'COMPLETED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-800/60">COMPLETED</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800/60">CANCELLED</span>;
      case 'NO_SHOW':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800/60">NO SHOW</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-300">{status}</span>;
    }
  };

  const changeDateBy = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Time slots for Day Timeline (08:00 to 22:00)
  const timeHours = Array.from({ length: 15 }, (_, i) => i + 8);

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header & Quick Action Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0b0f19] p-4 sm:p-6 rounded-2xl border border-cyan-900/40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 shadow-md">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
              {isMm ? 'ကြိုတင်ချိန်းဆိုမှုနှင့် အခန်းစီမံခန့်ခွဲမှု' : 'Bookings & Resource Scheduling'}
            </h1>
            <p className="text-xs sm:text-sm text-cyan-300/70">
              {isMm ? 'အချိန်ထပ်မံမှု ကာကွယ်ခြင်းနှင့် အခန်း/ဝန်ထမ်း အလိုအလျောက် နေရာချခြင်း' : 'Anti-conflict timeline, room & therapist resource reservation'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Date Selector Navigation */}
          <div className="flex items-center bg-[#07090e] border border-cyan-900/60 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => changeDateBy(-1)}
              className="p-1.5 text-cyan-400 hover:text-white hover:bg-cyan-900/40 rounded-lg transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-semibold text-white px-2 py-1 focus:outline-none cursor-pointer"
            />
            <button
              onClick={() => changeDateBy(1)}
              className="p-1.5 text-cyan-400 hover:text-white hover:bg-cyan-900/40 rounded-lg transition-colors"
              title="Next Day"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="text-xs px-2 py-1 text-cyan-300 hover:bg-cyan-900/40 rounded font-medium border-l border-cyan-900/60 ml-1"
            >
              {isMm ? 'ယနေ့' : 'Today'}
            </button>
          </div>

          {/* View Mode Buttons */}
          <div className="flex bg-[#07090e] border border-cyan-900/60 rounded-xl p-1">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'timeline' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              {isMm ? 'အချိန်ဇယား' : 'Timeline'}
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'day' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              {isMm ? 'ကတ်များ' : 'Cards'}
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              {isMm ? 'အားလုံး' : 'All List'}
            </button>
          </div>

          {/* New Booking Button */}
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-cyan-900/30 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {isMm ? 'ဘိုကင်အသစ်' : 'New Booking'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-[#0b0f19]/80 p-3 rounded-xl border border-cyan-900/30">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={isMm ? 'ဧည့်သည်၊ ဖုန်း၊ ဘိုကင်ကုတ် ရှာဖွေပါ...' : 'Search customer, phone, code...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg pl-9 pr-3 py-1.5 text-xs sm:text-sm text-white focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#07090e] border border-cyan-900/50 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="ALL">{isMm ? 'အခြေအနေအားလုံး' : 'All Statuses'}</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="CHECKED_IN">CHECKED_IN</option>
          <option value="IN_SERVICE">IN_SERVICE</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        {/* Room Filter */}
        <select
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
          className="bg-[#07090e] border border-cyan-900/50 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="ALL">{isMm ? 'အခန်းအားလုံး' : 'All Rooms'}</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        {/* Staff Filter */}
        <select
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
          className="bg-[#07090e] border border-cyan-900/50 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="ALL">{isMm ? 'ဝန်ထမ်းအားလုံး' : 'All Staff'}</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.role})
            </option>
          ))}
        </select>
      </div>

      {/* Main Content Area */}
      {viewMode === 'timeline' && (
        <div className="bg-[#0b0f19] rounded-2xl border border-cyan-900/40 p-4 shadow-xl overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header: Rooms columns */}
            <div className="grid grid-cols-[100px_repeat(auto-fit,minmax(140px,1fr))] gap-2 pb-3 border-b border-cyan-900/40 text-xs font-bold text-cyan-400 uppercase tracking-wider">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" /> {isMm ? 'အချိန်' : 'Time'}
              </div>
              {rooms.map((r) => (
                <div key={r.id} className="text-center bg-[#07090e] py-1.5 rounded-lg border border-cyan-900/40">
                  <div className="text-white font-semibold truncate px-1">{r.name}</div>
                  <div className="text-[10px] text-cyan-400/80 font-normal">
                    {r.type} • {r.hourlyRateMMK.toLocaleString()} MMK
                  </div>
                </div>
              ))}
            </div>

            {/* Time Rows */}
            <div className="divide-y divide-cyan-950/40 mt-2">
              {timeHours.map((hour) => {
                const hourStr = `${String(hour).padStart(2, '0')}:00`;
                const nextHourStr = `${String(hour + 1).padStart(2, '0')}:00`;

                return (
                  <div key={hour} className="grid grid-cols-[100px_repeat(auto-fit,minmax(140px,1fr))] gap-2 py-3 min-h-[70px] items-stretch">
                    {/* Time Label */}
                    <div className="text-xs font-mono font-medium text-slate-400 self-start pt-1">
                      {hourStr}
                    </div>

                    {/* Room Slots */}
                    {rooms.map((room) => {
                      // Find bookings in this hour slot for this room
                      const slotBookings = filteredBookings.filter((b) => {
                        if (b.roomId !== room.id) return false;
                        return b.startTime < nextHourStr && b.endTime > hourStr;
                      });

                      return (
                        <div
                          key={room.id}
                          className="bg-[#07090e]/60 rounded-xl border border-cyan-900/20 p-1.5 flex flex-col gap-1 min-h-[55px] relative group hover:border-cyan-500/40 transition-colors"
                        >
                          {slotBookings.map((b) => (
                            <div
                              key={b.id}
                              onClick={() => {
                                setSelectedBookingForAction(b);
                                setActionType('checkin');
                              }}
                              className={`p-2 rounded-lg text-xs font-medium cursor-pointer shadow-md transition-transform hover:scale-[1.02] border ${
                                b.status === 'CONFIRMED'
                                  ? 'bg-cyan-950/90 text-cyan-200 border-cyan-700/60'
                                  : b.status === 'IN_SERVICE'
                                  ? 'bg-purple-950/90 text-purple-200 border-purple-700/60'
                                  : b.status === 'CHECKED_IN'
                                  ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700/60'
                                  : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold truncate">{b.customerName}</span>
                                <span className="text-[10px] font-mono bg-black/40 px-1 rounded">
                                  {b.startTime}-{b.endTime}
                                </span>
                              </div>
                              <div className="text-[11px] text-cyan-300/80 truncate mt-0.5">
                                {b.serviceName || 'Standard Service'}
                              </div>
                              {b.staffName && (
                                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                                  <User className="h-3 w-3" /> {b.staffName}
                                </div>
                              )}
                            </div>
                          ))}

                          {slotBookings.length === 0 && (
                            <button
                              onClick={() => {
                                openCreateModal();
                                setFormRoomId(room.id);
                                setFormStartTime(hourStr);
                              }}
                              className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-full w-full text-[11px] text-cyan-400 hover:bg-cyan-950/40 rounded transition-opacity"
                            >
                              + {isMm ? 'ကြိုတင်' : 'Book'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Cards View & All List View */}
      {(viewMode === 'day' || viewMode === 'list') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBookings.map((b) => (
            <div
              key={b.id}
              className="bg-[#0b0f19] rounded-2xl border border-cyan-900/40 p-5 shadow-lg flex flex-col justify-between hover:border-cyan-500/40 transition-all"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="text-xs font-mono text-cyan-400 font-semibold">{b.bookingCode}</div>
                    <h3 className="text-base font-bold text-white mt-0.5">{b.customerName}</h3>
                    {b.customerPhone && (
                      <div className="text-xs text-slate-400">{b.customerPhone}</div>
                    )}
                  </div>
                  <div>{getStatusBadge(b.status)}</div>
                </div>

                {/* Details Grid */}
                <div className="space-y-2 bg-[#07090e] p-3 rounded-xl border border-cyan-900/30 text-xs text-slate-300 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 text-cyan-400" /> {isMm ? 'ရက်စွဲ' : 'Date'}:
                    </span>
                    <span className="font-semibold text-white">{b.date}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-cyan-400" /> {isMm ? 'အချိန်' : 'Time'}:
                    </span>
                    <span className="font-semibold text-cyan-300 font-mono">
                      {b.startTime} - {b.endTime} ({b.durationMinutes} min)
                    </span>
                  </div>
                  {b.serviceName && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Scissors className="h-3.5 w-3.5 text-cyan-400" /> {isMm ? 'ဝန်ဆောင်မှု' : 'Service'}:
                      </span>
                      <span className="font-semibold text-white truncate max-w-[150px]">{b.serviceName}</span>
                    </div>
                  )}
                  {b.roomName && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <DoorClosed className="h-3.5 w-3.5 text-cyan-400" /> {isMm ? 'အခန်း' : 'Room'}:
                      </span>
                      <span className="font-semibold text-white">{b.roomName}</span>
                    </div>
                  )}
                  {b.staffName && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-cyan-400" /> {isMm ? 'ဝန်ထမ်း' : 'Staff'}:
                      </span>
                      <span className="font-semibold text-white">{b.staffName}</span>
                    </div>
                  )}
                  {b.depositAmountMMK && b.depositAmountMMK > 0 ? (
                    <div className="flex items-center justify-between border-t border-cyan-900/30 pt-1.5 mt-1.5">
                      <span className="text-amber-400 flex items-center gap-1.5 font-medium">
                        <DollarSign className="h-3.5 w-3.5" /> {isMm ? 'စရန်ငွေ' : 'Deposit'}:
                      </span>
                      <span className="font-bold text-amber-300">
                        {b.depositAmountMMK.toLocaleString()} MMK ({b.depositPaymentMethod || 'cash'})
                      </span>
                    </div>
                  ) : null}
                  {b.notes && (
                    <div className="text-[11px] text-slate-400 italic mt-1 border-t border-cyan-900/30 pt-1">
                      "{b.notes}"
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-cyan-900/40">
                {b.status === 'CONFIRMED' && (
                  <>
                    <button
                      onClick={() => {
                        setSelectedBookingForAction(b);
                        setActionType('checkin');
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> {isMm ? 'Check-in ဝင်မည်' : 'Check-in'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBookingForAction(b);
                        setActionType('cancel');
                      }}
                      className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" /> {isMm ? 'ပယ်ဖျက်' : 'Cancel'}
                    </button>
                  </>
                )}

                {b.status === 'CHECKED_IN' && (
                  <button
                    onClick={() => {
                      setSelectedBookingForAction(b);
                      setActionType('checkin');
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow transition-colors"
                  >
                    <PlayCircle className="h-3.5 w-3.5" /> {isMm ? 'Session စတင်မည်' : 'Start Session'}
                  </button>
                )}

                {b.status === 'IN_SERVICE' && b.roomId && onNavigateToRoom && (
                  <button
                    onClick={() => onNavigateToRoom(b.roomId!)}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow transition-colors"
                  >
                    <DoorClosed className="h-3.5 w-3.5" /> {isMm ? 'အခန်းသို့သွားရန်' : 'View Room'}
                  </button>
                )}
              </div>
            </div>
          ))}

          {filteredBookings.length === 0 && (
            <div className="col-span-full py-16 text-center bg-[#0b0f19] rounded-2xl border border-cyan-900/40">
              <CalendarDays className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <div className="text-base font-semibold text-slate-300">
                {isMm ? 'ကြိုတင်စာရင်း မရှိသေးပါ' : 'No bookings found for selected criteria'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {isMm ? 'ဘိုကင်အသစ် ဖန်တီးရန် ခလုတ်ကို နှိပ်ပါ' : 'Click "New Booking" to schedule a customer'}
              </p>
              <button
                onClick={openCreateModal}
                className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors inline-flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> {isMm ? 'ဘိုကင်အသစ် ဖန်တီးမည်' : 'Create Booking'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT BOOKING MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0b0f19] border border-cyan-500/40 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-cyan-900/40 mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-cyan-300">
                <CalendarDays className="h-5 w-5" />
                {selectedBookingForAction
                  ? isMm ? 'ဘိုကင် ပြင်ဆင်ခြင်း' : 'Edit Booking'
                  : isMm ? 'ဘိုကင်အသစ် ဖန်တီးခြင်း' : 'Create New Booking'}
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {liveConflict && (
              <div className="mb-4 p-3 bg-amber-950/80 border border-amber-500/50 rounded-xl text-amber-200 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">{isMm ? 'အချိန်ထပ်မံမှု သတိပေးချက်' : 'Schedule Conflict Warning'}:</div>
                  <div>{liveConflict}</div>
                </div>
              </div>
            )}

            {formError && (
              <div className="mb-4 p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-200 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveBooking} className="space-y-4 text-xs">
              {/* Customer Selector / Input */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isMm ? 'ဧည့်သည် ရွေးချယ်ရန် / အမည်' : 'Customer Name *'}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={formCustomerId || ''}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    className="bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">{isMm ? '-- ရှိပြီးသားဖောက်သည် --' : '-- Existing Customer --'}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone || 'No phone'})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    placeholder={isMm ? 'ဧည့်သည် အမည်' : 'Customer Name'}
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    className="bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Customer Phone */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isMm ? 'ဖုန်းနံပါတ်' : 'Phone Number'}</label>
                <input
                  type="text"
                  placeholder="09..."
                  value={formCustomerPhone}
                  onChange={(e) => setFormCustomerPhone(e.target.value)}
                  className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Service Selection */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isMm ? 'ဝန်ဆောင်မှု ရွေးချယ်ရန်' : 'Service'}</label>
                <select
                  value={formServiceId}
                  onChange={(e) => handleServiceSelect(e.target.value)}
                  className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">{isMm ? '-- ဝန်ဆောင်မှု ရွေးရန် --' : '-- Select Service --'}</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.durationMinutes} min - {s.priceMMK?.toLocaleString()} MMK)
                    </option>
                  ))}
                </select>
              </div>

              {/* Room & Staff Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">{isMm ? 'အခန်း' : 'Room / Resource'}</label>
                  <select
                    value={formRoomId}
                    onChange={(e) => setFormRoomId(e.target.value)}
                    className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">{isMm ? '-- အခန်း မသတ်မှတ်ပါ --' : '-- No Room --'}</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">{isMm ? 'ဝန်ထမ်း / Therapist' : 'Staff / Therapist'}</label>
                  <select
                    value={formStaffId}
                    onChange={(e) => setFormStaffId(e.target.value)}
                    className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">{isMm ? '-- ဝန်ထမ်း မသတ်မှတ်ပါ --' : '-- No Staff --'}</option>
                    {staff.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date, Start Time & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">{isMm ? 'ရက်စွဲ' : 'Date'}</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">{isMm ? 'စတင်ချိန်' : 'Start Time'}</label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">{isMm ? 'ကြာချိန် (မိနစ်)' : 'Duration (min)'}</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={formDurationMinutes}
                    onChange={(e) => setFormDurationMinutes(Number(e.target.value) || 60)}
                    className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="bg-[#07090e] p-2.5 rounded-lg text-xs font-mono text-cyan-300 flex justify-between items-center border border-cyan-900/30">
                <span>{isMm ? 'ပြီးဆုံးမည့်အချိန်' : 'Calculated End Time'}:</span>
                <span className="font-bold text-white text-sm">{formEndTime}</span>
              </div>

              {/* Deposit MMK */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-cyan-900/40 pt-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">{isMm ? 'စရန်ငွေ (ကျပ်)' : 'Deposit Amount (MMK)'}</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formDepositMMK}
                    onChange={(e) => setFormDepositMMK(Number(e.target.value) || 0)}
                    className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">{isMm ? 'စရန်ငွေ ပေးချေပုံ' : 'Deposit Method'}</label>
                  <select
                    value={formDepositMethod}
                    onChange={(e) => setFormDepositMethod(e.target.value)}
                    className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="cash">Cash (လက်ငင်း)</option>
                    <option value="kpay">KBZPay</option>
                    <option value="wave">WavePay</option>
                    <option value="cbpay">CBPay</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isMm ? 'မှတ်ချက်' : 'Notes / Special Requests'}</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={isMm ? 'အပိုတောင်းဆိုချက်များ...' : 'Special notes...'}
                  className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-cyan-900/40">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded-xl font-medium transition-colors"
                >
                  {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <span className="inline-block animate-spin">⏳</span>
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {isMm ? 'အတည်ပြုသိမ်းဆည်းမည်' : 'Confirm & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHECK-IN ACTION MODAL */}
      {actionType === 'checkin' && selectedBookingForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b0f19] border border-cyan-500/40 rounded-2xl shadow-2xl max-w-md w-full p-6 text-white">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              {isMm ? 'ဧည့်သည် Check-in နှင့် Session စတင်ခြင်း' : 'Guest Check-in & Session Start'}
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              {isMm ? 'ဘိုကင်အမှတ်' : 'Booking'}: <span className="font-mono text-cyan-400 font-bold">{selectedBookingForAction.bookingCode}</span> - {selectedBookingForAction.customerName}
            </p>

            <div className="bg-[#07090e] p-3 rounded-xl border border-cyan-900/30 text-xs space-y-1.5 mb-5">
              <div><span className="text-slate-400">{isMm ? 'အခန်း' : 'Room'}:</span> <span className="font-semibold text-white">{selectedBookingForAction.roomName || 'Not set'}</span></div>
              <div><span className="text-slate-400">{isMm ? 'ဝန်ထမ်း' : 'Staff'}:</span> <span className="font-semibold text-white">{selectedBookingForAction.staffName || 'Not set'}</span></div>
              <div><span className="text-slate-400">{isMm ? 'အချိန်' : 'Time'}:</span> <span className="font-semibold text-cyan-300">{selectedBookingForAction.startTime} - {selectedBookingForAction.endTime}</span></div>
            </div>

            <div className="space-y-3">
              {selectedBookingForAction.roomId && (
                <button
                  onClick={() => handleCheckIn(true)}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <PlayCircle className="h-5 w-5" />
                  {isMm ? 'Check-in ဝင်ပြီး Session စတင်မည်' : 'Check-in & Start Room Session'}
                </button>
              )}

              <button
                onClick={() => handleCheckIn(false)}
                disabled={isSubmitting}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Check className="h-4 w-4" />
                {isMm ? 'Check-in သာ ပြုလုပ်မည် (Session မဖွင့်ပါ)' : 'Check-in Only (No Session Start)'}
              </button>

              <button
                onClick={() => {
                  setActionType(null);
                  setSelectedBookingForAction(null);
                }}
                className="w-full py-2 text-slate-400 hover:text-white text-xs text-center"
              >
                {isMm ? 'ပိတ်မည်' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCELLATION MODAL */}
      {actionType === 'cancel' && selectedBookingForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b0f19] border border-rose-500/40 rounded-2xl shadow-2xl max-w-md w-full p-6 text-white">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 text-rose-400">
              <Ban className="h-5 w-5" />
              {isMm ? 'ဘိုကင် ပယ်ဖျက်ခြင်း' : 'Cancel Booking'}
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              {isMm ? 'ဘိုကင်အမှတ်' : 'Booking'}: <span className="font-mono text-rose-300 font-bold">{selectedBookingForAction.bookingCode}</span> - {selectedBookingForAction.customerName}
            </p>

            <div className="space-y-2 mb-5">
              <label className="text-xs text-slate-300 font-semibold">{isMm ? 'ပယ်ဖျက်ရသည့် အကြောင်းအရင်း *' : 'Cancellation Reason *'}</label>
              <textarea
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={isMm ? 'အကြောင်းအရင်း ထည့်သွင်းပါ...' : 'Enter reason...'}
                className="w-full bg-[#07090e] border border-rose-900/50 rounded-xl p-3 text-xs text-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setActionType(null);
                  setSelectedBookingForAction(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Back'}
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={isSubmitting || !cancelReason.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg transition-colors flex items-center gap-1.5"
              >
                {isMm ? 'ပယ်ဖျက်မည်' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
