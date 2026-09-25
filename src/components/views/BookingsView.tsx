/**
 * ============================================================================
 * PHASE 31: BOOKINGS & APPOINTMENT MANAGEMENT VIEW
 * 100% Offline-First & LAN-Authoritative Resource Scheduling
 * Provides Day, Week, Timeline, and List views, Conflict Prevention,
 * Lifecycle State Transitions (Pending, Confirmed, Check-in, In-Service,
 * Completed, Cancelled, No-Show), and Customer Rebooking.
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
  RotateCcw,
  Sparkles,
  UserX,
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

type ViewMode = 'timeline' | 'day' | 'week' | 'list';

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
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBookingForAction, setSelectedBookingForAction] = useState<BookingRecord | null>(null);
  const [actionType, setActionType] = useState<'checkin' | 'cancel' | 'reschedule' | 'noshow' | 'complete' | null>(null);
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
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formDiscount, setFormDiscount] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<BookingStatus>('CONFIRMED');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formDepositMMK, setFormDepositMMK] = useState<number>(0);
  const [formDepositMethod, setFormDepositMethod] = useState<string>('cash');

  // Reschedule form state
  const [rescheduleDate, setRescheduleDate] = useState<string>(todayStr);
  const [rescheduleStartTime, setRescheduleStartTime] = useState<string>('10:00');
  const [rescheduleRoomId, setRescheduleRoomId] = useState<string>('');
  const [rescheduleStaffId, setRescheduleStaffId] = useState<string>('');
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Calculate form end time
  const formEndTime = useMemo(() => {
    const [h, m] = formStartTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '11:00';
    const totalMinutes = h * 60 + m + formDurationMinutes;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }, [formStartTime, formDurationMinutes]);

  // Calculate reschedule end time
  const rescheduleEndTime = useMemo(() => {
    if (!selectedBookingForAction) return '11:00';
    const [h, m] = rescheduleStartTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '11:00';
    const totalMinutes = h * 60 + m + selectedBookingForAction.durationMinutes;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }, [rescheduleStartTime, selectedBookingForAction]);

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

  // Week days around selectedDate (Monday to Sunday)
  const weekDays = useMemo(() => {
    const curr = new Date(selectedDate);
    const dayIndex = curr.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = dayIndex === 0 ? -6 : 1 - dayIndex;
    const monday = new Date(curr);
    monday.setDate(curr.getDate() + diffToMonday);

    const days: Array<{ date: string; dayName: string; dayNumber: number; isToday: boolean; isSelected: boolean }> = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const mmDayNames = ['တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ', 'တနင်္ဂနွေ'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = d.toISOString().split('T')[0];
      days.push({
        date: dStr,
        dayName: isMm ? mmDayNames[i] : dayNames[i],
        dayNumber: d.getDate(),
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDate,
      });
    }
    return days;
  }, [selectedDate, isMm, todayStr]);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Date filter
      if (viewMode === 'timeline' || viewMode === 'day') {
        if (b.date !== selectedDate) return false;
      } else if (viewMode === 'week') {
        const weekDates = weekDays.map((w) => w.date);
        if (!weekDates.includes(b.date)) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;

      // Room filter
      if (roomFilter !== 'ALL' && b.roomId !== roomFilter) return false;

      // Staff filter
      if (staffFilter !== 'ALL' && b.staffId !== staffFilter) return false;

      // Service filter
      if (serviceFilter !== 'ALL' && b.serviceId !== serviceFilter) return false;

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
  }, [bookings, selectedDate, viewMode, statusFilter, roomFilter, staffFilter, serviceFilter, searchQuery, weekDays]);

  // Open Create Modal
  const openCreateModal = () => {
    setSelectedBookingForAction(null);
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormCustomerId(undefined);
    const initialService = services[0];
    setFormServiceId(initialService?.id || '');
    setFormPrice(initialService?.priceMMK || 0);
    setFormDiscount(0);
    setFormRoomId(rooms[0]?.id || '');
    setFormStaffId(staff[0]?.id || '');
    setFormDate(selectedDate || todayStr);
    setFormStartTime('14:00');
    setFormDurationMinutes(initialService?.durationMinutes || 60);
    setFormStatus('CONFIRMED');
    setFormNotes('');
    setFormDepositMMK(0);
    setFormDepositMethod('cash');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Open Rebook Modal (Prefilled from existing booking)
  const openRebookModal = (b: BookingRecord) => {
    setSelectedBookingForAction(null);
    setFormCustomerName(b.customerName);
    setFormCustomerPhone(b.customerPhone || '');
    setFormCustomerId(b.customerId);
    setFormServiceId(b.serviceId || '');
    const service = services.find((s) => s.id === b.serviceId);
    setFormPrice(b.price || service?.priceMMK || 0);
    setFormDiscount(0);
    setFormRoomId(b.roomId || rooms[0]?.id || '');
    setFormStaffId(b.staffId || staff[0]?.id || '');
    setFormDate(selectedDate || todayStr);
    setFormStartTime('14:00');
    setFormDurationMinutes(b.durationMinutes || 60);
    setFormStatus('CONFIRMED');
    setFormNotes(`Rebook from ${b.bookingCode}`);
    setFormDepositMMK(0);
    setFormDepositMethod('cash');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (b: BookingRecord) => {
    setSelectedBookingForAction(b);
    setFormCustomerName(b.customerName);
    setFormCustomerPhone(b.customerPhone || '');
    setFormCustomerId(b.customerId);
    setFormServiceId(b.serviceId || '');
    setFormPrice(b.price || 0);
    setFormDiscount(b.discount || 0);
    setFormRoomId(b.roomId || '');
    setFormStaffId(b.staffId || '');
    setFormDate(b.date);
    setFormStartTime(b.startTime);
    setFormDurationMinutes(b.durationMinutes);
    setFormStatus(b.status);
    setFormNotes(b.notes || '');
    setFormDepositMMK(b.depositAmountMMK || 0);
    setFormDepositMethod(b.depositPaymentMethod || 'cash');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Open Reschedule Modal
  const openRescheduleModal = (b: BookingRecord) => {
    setSelectedBookingForAction(b);
    setRescheduleDate(b.date);
    setRescheduleStartTime(b.startTime);
    setRescheduleRoomId(b.roomId || '');
    setRescheduleStaffId(b.staffId || '');
    setRescheduleError(null);
    setActionType('reschedule');
  };

  const handleServiceSelect = (serviceId: string) => {
    setFormServiceId(serviceId);
    const s = services.find((x) => x.id === serviceId);
    if (s) {
      if (s.durationMinutes) setFormDurationMinutes(s.durationMinutes);
      if (s.priceMMK) setFormPrice(s.priceMMK);
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
      const finalAmt = Math.max(0, formPrice - formDiscount);

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
          price: formPrice,
          discount: formDiscount,
          finalAmount: finalAmt,
          status: formStatus,
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
          price: formPrice,
          discount: formDiscount,
          finalAmount: finalAmt,
          status: formStatus,
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
        hourlyRateMMK: room?.hourlyRateMMK || selectedBookingForAction.finalAmount || selectedBookingForAction.price || 0,
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

  const handleConfirmBooking = async (booking: BookingRecord) => {
    setIsSubmitting(true);
    try {
      const res = await bookingManager.confirmBooking(booking.id, currentUser?.name || 'Operator');
      if (!res.success) {
        alert(res.error || 'Failed to confirm booking');
      } else {
        await onRefreshData();
      }
    } catch (err: any) {
      alert(err.message || 'Confirm failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkNoShow = async () => {
    if (!selectedBookingForAction) return;
    setIsSubmitting(true);
    try {
      const res = await bookingManager.markNoShow(selectedBookingForAction.id, currentUser?.name || 'Operator');
      if (!res.success) {
        alert(res.error || 'Failed to mark as no-show');
      } else {
        await onRefreshData();
        setActionType(null);
        setSelectedBookingForAction(null);
      }
    } catch (err: any) {
      alert(err.message || 'No-show operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteBooking = async (booking: BookingRecord) => {
    if (!window.confirm(isMm ? 'ဤဘိုကင်အား ဝန်ဆောင်မှုပြီးဆုံးကြောင်း သတ်မှတ်မည်လား?' : 'Mark this booking as completed?')) return;
    setIsSubmitting(true);
    try {
      const res = await bookingManager.completeBooking({
        bookingId: booking.id,
        completedBy: currentUser?.name || 'Operator',
      });
      if (!res.success) {
        alert(res.error || 'Failed to complete booking');
      } else {
        await onRefreshData();
      }
    } catch (err: any) {
      alert(err.message || 'Complete failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForAction) return;

    setIsSubmitting(true);
    setRescheduleError(null);
    try {
      const selectedRoom = rooms.find((r) => r.id === rescheduleRoomId);
      const selectedStaff = staff.find((s) => s.id === rescheduleStaffId);

      const res = await bookingManager.rescheduleBooking({
        bookingId: selectedBookingForAction.id,
        newDate: rescheduleDate,
        newStartTime: rescheduleStartTime,
        newEndTime: rescheduleEndTime,
        newRoomId: rescheduleRoomId || undefined,
        newRoomName: selectedRoom?.name,
        newStaffId: rescheduleStaffId || undefined,
        newStaffName: selectedStaff?.name,
        updatedBy: currentUser?.name || 'Operator',
      });

      if (!res.success) {
        setRescheduleError(res.error || 'Reschedule conflict detected');
        setIsSubmitting(false);
        return;
      }

      await onRefreshData();
      setActionType(null);
      setSelectedBookingForAction(null);
    } catch (err: any) {
      setRescheduleError(err.message || 'Reschedule failed');
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
        reason: cancelReason || 'Customer requested cancellation',
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
      case 'PENDING':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800/60">PENDING</span>;
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
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">NO SHOW</span>;
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
    <div className="space-y-3.5 sm:space-y-5 pb-10">
      {/* Top Header & Quick Action Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0b0f19] p-3 sm:p-4 rounded-xl border border-cyan-900/40 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 shadow-xs shrink-0">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-wide">
              {isMm ? 'ကြိုတင်ချိန်းဆိုမှု စီမံခန့်ခွဲမှု' : 'Bookings & Resource Scheduling'}
            </h1>
            <p className="text-[11px] sm:text-xs text-cyan-300/70">
              {isMm ? 'အချိန်ထပ်မံမှု ကာကွယ်ခြင်းနှင့် အခန်း/ဝန်ထမ်း နေရာချခြင်း' : 'Anti-conflict scheduling & resource reservation'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Date Selector Navigation */}
          <div className="flex items-center bg-[#07090e] rounded-xl border border-cyan-900/40 p-1 shadow-inner">
            <button
              onClick={() => changeDateBy(-1)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-cyan-950/40 rounded-lg transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white text-xs font-semibold px-2 py-1 outline-none font-mono cursor-pointer"
            />
            <button
              onClick={() => changeDateBy(1)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-cyan-950/40 rounded-lg transition-colors"
              title="Next Day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="ml-1 px-2.5 py-1 text-[11px] font-bold bg-cyan-950 text-cyan-300 hover:bg-cyan-900 rounded-md border border-cyan-800/50 transition-colors"
            >
              {isMm ? 'ယနေ့' : 'Today'}
            </button>
          </div>

          {/* New Booking Button */}
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-950/50 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{isMm ? 'ဘိုကင်အသစ်' : 'New Booking'}</span>
          </button>
        </div>
      </div>

      {/* Control Bar: View Switcher, Search, and Multi-Level Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0b0f19] p-3 sm:p-4 rounded-xl border border-cyan-900/40 text-xs">
        {/* View Switcher: Timeline, Day, Week, List */}
        <div className="flex items-center bg-[#07090e] p-1 rounded-xl border border-cyan-900/40">
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'timeline'
                ? 'bg-cyan-600 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isMm ? 'အခန်းပြက္ခဒိန်' : 'Timeline'}
          </button>
          <button
            onClick={() => setViewMode('day')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'day'
                ? 'bg-cyan-600 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isMm ? 'နေ့စဉ်စာရင်း' : 'Day View'}
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'week'
                ? 'bg-cyan-600 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isMm ? 'အပတ်စဉ်' : 'Week View'}
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'list'
                ? 'bg-cyan-600 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isMm ? 'အားလုံးစာရင်း' : 'List All'}
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder={isMm ? 'ဧည့်သည်/ဖုန်း/ကုဒ် ရှာဖွေပါ...' : 'Search guest, phone, code...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#07090e] border border-cyan-900/40 rounded-xl pl-9 pr-3 py-1.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#07090e] border border-cyan-900/40 rounded-xl px-3 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="ALL">{isMm ? 'အခြေအနေ အားလုံး' : 'All Statuses'}</option>
          <option value="PENDING">PENDING</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="CHECKED_IN">CHECKED IN</option>
          <option value="IN_SERVICE">IN SERVICE</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="NO_SHOW">NO SHOW</option>
        </select>

        {/* Room Filter */}
        <select
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
          className="bg-[#07090e] border border-cyan-900/40 rounded-xl px-3 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="ALL">{isMm ? 'အခန်း အားလုံး' : 'All Rooms'}</option>
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
          className="bg-[#07090e] border border-cyan-900/40 rounded-xl px-3 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="ALL">{isMm ? 'ဝန်ထမ်း အားလုံး' : 'All Staff'}</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.role})
            </option>
          ))}
        </select>

        {/* Service Filter */}
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="bg-[#07090e] border border-cyan-900/40 rounded-xl px-3 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="ALL">{isMm ? 'ဝန်ဆောင်မှု အားလုံး' : 'All Services'}</option>
          {services.map((svc) => (
            <option key={svc.id} value={svc.id}>
              {svc.name}
            </option>
          ))}
        </select>
      </div>

      {/* Main Content Area */}

      {/* 1. TIMELINE VIEW */}
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
                                if (b.status === 'CONFIRMED' || b.status === 'PENDING') {
                                  setActionType('checkin');
                                } else if (b.status === 'CHECKED_IN') {
                                  setActionType('checkin');
                                }
                              }}
                              className={`p-2 rounded-lg text-xs font-medium cursor-pointer shadow-md transition-transform hover:scale-[1.02] border ${
                                b.status === 'CONFIRMED'
                                  ? 'bg-cyan-950/90 text-cyan-200 border-cyan-700/60'
                                  : b.status === 'IN_SERVICE'
                                  ? 'bg-purple-950/90 text-purple-200 border-purple-700/60'
                                  : b.status === 'CHECKED_IN'
                                  ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700/60'
                                  : b.status === 'PENDING'
                                  ? 'bg-amber-950/90 text-amber-200 border-amber-700/60'
                                  : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold truncate text-white">{b.customerName}</span>
                                <span className="text-[10px] font-mono bg-black/40 px-1 rounded text-cyan-300">
                                  {b.startTime}-{b.endTime}
                                </span>
                              </div>
                              <div className="text-[11px] text-cyan-300/80 truncate mt-0.5">
                                {b.serviceName || 'Standard Service'}
                              </div>
                              {b.staffName && (
                                <div className="text-[10px] text-slate-300 truncate flex items-center gap-1 mt-0.5">
                                  <User className="h-3 w-3" /> {b.staffName}
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/10 text-[10px]">
                                {getStatusBadge(b.status)}
                                {b.finalAmount && b.finalAmount > 0 ? (
                                  <span className="font-mono text-emerald-300 font-semibold">{b.finalAmount.toLocaleString()} Ks</span>
                                ) : null}
                              </div>
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

      {/* 2. WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-[#0b0f19] rounded-2xl border border-cyan-900/40 p-4 shadow-xl overflow-x-auto">
          <div className="grid grid-cols-7 gap-3 min-w-[900px]">
            {weekDays.map((w) => {
              const dayBookings = filteredBookings.filter((b) => b.date === w.date);

              return (
                <div
                  key={w.date}
                  className={`flex flex-col rounded-xl border p-2.5 transition-colors ${
                    w.isSelected
                      ? 'bg-[#0f172a] border-cyan-500/60 shadow-md'
                      : w.isToday
                      ? 'bg-[#0b1324] border-cyan-900/60'
                      : 'bg-[#07090e] border-cyan-950/50'
                  }`}
                >
                  {/* Day Header */}
                  <div
                    onClick={() => setSelectedDate(w.date)}
                    className="flex items-center justify-between pb-2 border-b border-cyan-900/30 cursor-pointer"
                  >
                    <div>
                      <div className="text-[11px] font-bold text-cyan-400 uppercase">{w.dayName}</div>
                      <div className="text-sm font-extrabold text-white">{w.dayNumber}</div>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                      {dayBookings.length}
                    </span>
                  </div>

                  {/* Day Bookings List */}
                  <div className="space-y-2 mt-2 flex-1 min-h-[140px]">
                    {dayBookings.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => openEditModal(b)}
                        className="p-2 rounded-lg bg-[#0b0f19] border border-cyan-900/40 hover:border-cyan-500/40 cursor-pointer text-xs transition-all shadow"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-white truncate">{b.customerName}</span>
                          <span className="text-[10px] font-mono text-cyan-300">{b.startTime}</span>
                        </div>
                        <div className="text-[11px] text-slate-300 truncate mt-0.5">{b.serviceName}</div>
                        <div className="flex items-center justify-between mt-1 text-[10px]">
                          <span className="text-slate-400 truncate">{b.roomName || 'No Room'}</span>
                          {getStatusBadge(b.status)}
                        </div>
                      </div>
                    ))}

                    {dayBookings.length === 0 && (
                      <div className="flex items-center justify-center h-full text-[11px] text-slate-600">
                        {isMm ? 'ဘိုကင်မရှိပါ' : 'No bookings'}
                      </div>
                    )}
                  </div>

                  {/* Quick Add For Day */}
                  <button
                    onClick={() => {
                      setSelectedDate(w.date);
                      openCreateModal();
                      setFormDate(w.date);
                    }}
                    className="mt-2 w-full py-1 text-[11px] font-semibold text-cyan-400 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/60 rounded-lg border border-cyan-900/40 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> {isMm ? 'ထည့်မည်' : 'Add'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. DAY VIEW & LIST ALL VIEW */}
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
                      <div className="text-xs text-slate-300">{b.customerPhone}</div>
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
                  {b.finalAmount !== undefined && b.finalAmount > 0 ? (
                    <div className="flex items-center justify-between border-t border-cyan-900/30 pt-1.5 mt-1.5">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-400" /> {isMm ? 'ကျသင့်ငွေ' : 'Amount'}:
                      </span>
                      <span className="font-bold text-emerald-300 font-mono">
                        {b.finalAmount.toLocaleString()} MMK
                      </span>
                    </div>
                  ) : null}
                  {b.depositAmountMMK && b.depositAmountMMK > 0 ? (
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 flex items-center gap-1.5 font-medium">
                        <DollarSign className="h-3.5 w-3.5" /> {isMm ? 'စရန်ငွေ' : 'Deposit'}:
                      </span>
                      <span className="font-bold text-amber-300">
                        {b.depositAmountMMK.toLocaleString()} MMK ({b.depositPaymentMethod || 'cash'})
                      </span>
                    </div>
                  ) : null}
                  {b.notes && (
                    <div className="text-[11px] text-slate-300 italic mt-1 border-t border-cyan-900/30 pt-1">
                      "{b.notes}"
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons based on status */}
              <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-cyan-900/40">
                {/* PENDING ACTIONS */}
                {b.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleConfirmBooking(b)}
                      disabled={isSubmitting}
                      className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" /> {isMm ? 'အတည်ပြုမည်' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => openRescheduleModal(b)}
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> {isMm ? 'အချိန်ပြောင်း' : 'Reschedule'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBookingForAction(b);
                        setActionType('cancel');
                      }}
                      className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" /> {isMm ? 'ပယ်ဖျက်' : 'Cancel'}
                    </button>
                  </>
                )}

                {/* CONFIRMED ACTIONS */}
                {b.status === 'CONFIRMED' && (
                  <>
                    <button
                      onClick={() => {
                        setSelectedBookingForAction(b);
                        setActionType('checkin');
                      }}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> {isMm ? 'Check-in' : 'Check-in'}
                    </button>
                    <button
                      onClick={() => openRescheduleModal(b)}
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> {isMm ? 'အချိန်ပြောင်း' : 'Reschedule'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBookingForAction(b);
                        setActionType('noshow');
                      }}
                      className="px-2.5 py-1.5 bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-800/60 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <UserX className="h-3.5 w-3.5" /> {isMm ? 'မလာရောက်' : 'No-Show'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBookingForAction(b);
                        setActionType('cancel');
                      }}
                      className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" /> {isMm ? 'ပယ်ဖျက်' : 'Cancel'}
                    </button>
                  </>
                )}

                {/* CHECKED_IN ACTIONS */}
                {b.status === 'CHECKED_IN' && (
                  <>
                    <button
                      onClick={() => {
                        setSelectedBookingForAction(b);
                        setActionType('checkin');
                      }}
                      className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow transition-colors"
                    >
                      <PlayCircle className="h-3.5 w-3.5" /> {isMm ? 'Session စတင်မည်' : 'Start Session'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBookingForAction(b);
                        setActionType('cancel');
                      }}
                      className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" /> {isMm ? 'ပယ်ဖျက်' : 'Cancel'}
                    </button>
                  </>
                )}

                {/* IN_SERVICE ACTIONS */}
                {b.status === 'IN_SERVICE' && (
                  <>
                    {b.roomId && onNavigateToRoom && (
                      <button
                        onClick={() => onNavigateToRoom(b.roomId!)}
                        className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow transition-colors"
                      >
                        <DoorClosed className="h-3.5 w-3.5" /> {isMm ? 'အခန်းသို့သွားရန်' : 'View Room'}
                      </button>
                    )}
                    <button
                      onClick={() => handleCompleteBooking(b)}
                      disabled={isSubmitting}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" /> {isMm ? 'ပြီးဆုံး' : 'Complete'}
                    </button>
                  </>
                )}

                {/* TERMINAL STATUSES: REBOOK */}
                {['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(b.status) && (
                  <button
                    onClick={() => openRebookModal(b)}
                    className="px-3 py-1.5 bg-cyan-700/80 hover:bg-cyan-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                    {isMm ? 'ထပ်မံ Booking ပြုလုပ်မည်' : 'Rebook'}
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
              <p className="text-xs text-slate-400 mt-1">
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
                <label className="text-slate-200 font-semibold">{isMm ? 'ဧည့်သည် ရွေးချယ်ရန် / အမည်' : 'Customer Name *'}</label>
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
                <label className="text-slate-200 font-semibold">{isMm ? 'ဖုန်းနံပါတ်' : 'Phone Number'}</label>
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
                <label className="text-slate-200 font-semibold">{isMm ? 'ဝန်ဆောင်မှု ရွေးချယ်ရန်' : 'Service'}</label>
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

              {/* Price, Discount & Final Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#07090e] p-2.5 rounded-xl border border-cyan-900/30">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">{isMm ? 'ဈေးနှုန်း (ကျပ်)' : 'Base Price (MMK)'}</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value) || 0)}
                    className="w-full bg-[#0b0f19] border border-cyan-900/50 rounded-lg p-1.5 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">{isMm ? 'လျှော့ဈေး (ကျပ်)' : 'Discount (MMK)'}</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={formDiscount}
                    onChange={(e) => setFormDiscount(Number(e.target.value) || 0)}
                    className="w-full bg-[#0b0f19] border border-cyan-900/50 rounded-lg p-1.5 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">{isMm ? 'ကျသင့်ငွေ' : 'Final Amount'}</label>
                  <div className="p-1.5 bg-[#0b0f19] border border-cyan-900/50 rounded-lg text-emerald-300 font-bold font-mono">
                    {Math.max(0, formPrice - formDiscount).toLocaleString()} MMK
                  </div>
                </div>
              </div>

              {/* Room & Staff Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-200 font-semibold">{isMm ? 'အခန်း' : 'Room / Resource'}</label>
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
                  <label className="text-slate-200 font-semibold">{isMm ? 'ဝန်ထမ်း / Therapist' : 'Staff / Therapist'}</label>
                  <select
                    value={formStaffId}
                    onChange={(e) => setFormStaffId(e.target.value)}
                    className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">{isMm ? '-- ဝန်ထမ်း မသတ်မှတ်ပါ --' : '-- No Staff --'}</option>
                    {staff.filter(st => st.isActive !== false).map((st) => (
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
                  <label className="text-slate-200 font-semibold">{isMm ? 'ရက်စွဲ' : 'Date'}</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-200 font-semibold">{isMm ? 'စတင်ချိန်' : 'Start Time'}</label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-200 font-semibold">{isMm ? 'ကြာချိန် (မိနစ်)' : 'Duration (min)'}</label>
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

              {/* Status Selector */}
              <div className="space-y-1">
                <label className="text-slate-200 font-semibold">{isMm ? 'ဘိုကင်အခြေအနေ' : 'Booking Status'}</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as BookingStatus)}
                  className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="CONFIRMED">CONFIRMED (အတည်ပြုပြီး)</option>
                  <option value="PENDING">PENDING (စောင့်ဆိုင်းဆဲ)</option>
                </select>
              </div>

              {/* Deposit MMK */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-cyan-900/40 pt-3">
                <div className="space-y-1">
                  <label className="text-slate-200 font-semibold">{isMm ? 'စရန်ငွေ (ကျပ်)' : 'Deposit Amount (MMK)'}</label>
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
                  <label className="text-slate-200 font-semibold">{isMm ? 'စရန်ငွေ ပေးချေပုံ' : 'Deposit Method'}</label>
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
                <label className="text-slate-200 font-semibold">{isMm ? 'မှတ်ချက်' : 'Notes / Special Requests'}</label>
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

      {/* RESCHEDULE ACTION MODAL */}
      {actionType === 'reschedule' && selectedBookingForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b0f19] border border-cyan-500/40 rounded-2xl shadow-2xl max-w-md w-full p-6 text-white">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 text-cyan-300">
              <RotateCcw className="h-5 w-5" />
              {isMm ? 'ဘိုကင် ရက်စွဲ/အချိန် ပြောင်းလဲခြင်း' : 'Reschedule Appointment'}
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              {isMm ? 'ဘိုကင်အမှတ်' : 'Booking'}: <span className="font-mono text-cyan-400 font-bold">{selectedBookingForAction.bookingCode}</span> - {selectedBookingForAction.customerName}
            </p>

            {rescheduleError && (
              <div className="mb-4 p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-200 text-xs">
                {rescheduleError}
              </div>
            )}

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-200 font-semibold">{isMm ? 'ရက်စွဲသစ်' : 'New Date *'}</label>
                  <input
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-200 font-semibold">{isMm ? 'စတင်ချိန်သစ်' : 'New Start Time *'}</label>
                  <input
                    type="time"
                    required
                    value={rescheduleStartTime}
                    onChange={(e) => setRescheduleStartTime(e.target.value)}
                    className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="bg-[#07090e] p-2 rounded-lg text-xs font-mono text-cyan-300 flex justify-between items-center border border-cyan-900/30">
                <span>{isMm ? 'ပြီးဆုံးမည့်အချိန်သစ်' : 'New End Time'}:</span>
                <span className="font-bold text-white text-sm">{rescheduleEndTime}</span>
              </div>

              <div className="space-y-1">
                <label className="text-slate-200 font-semibold">{isMm ? 'အခန်း ပြောင်းရန်' : 'Room'}</label>
                <select
                  value={rescheduleRoomId}
                  onChange={(e) => setRescheduleRoomId(e.target.value)}
                  className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white"
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
                <label className="text-slate-200 font-semibold">{isMm ? 'ဝန်ထမ်း ပြောင်းရန်' : 'Staff'}</label>
                <select
                  value={rescheduleStaffId}
                  onChange={(e) => setRescheduleStaffId(e.target.value)}
                  className="w-full bg-[#07090e] border border-cyan-900/50 rounded-lg p-2 text-white"
                >
                  <option value="">{isMm ? '-- ဝန်ထမ်း မသတ်မှတ်ပါ --' : '-- No Staff --'}</option>
                  {staff.filter(s => s.isActive !== false).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-cyan-900/40">
                <button
                  type="button"
                  onClick={() => {
                    setActionType(null);
                    setSelectedBookingForAction(null);
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded-xl font-medium"
                >
                  {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl shadow-lg transition-colors flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" /> {isMm ? 'အချိန်ပြောင်းမည်' : 'Save Reschedule'}
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

      {/* NO-SHOW ACTION MODAL */}
      {actionType === 'noshow' && selectedBookingForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b0f19] border border-amber-500/40 rounded-2xl shadow-2xl max-w-md w-full p-6 text-white">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 text-amber-400">
              <UserX className="h-5 w-5" />
              {isMm ? 'ဧည့်သည် မလာရောက်ကြောင်း သတ်မှတ်မည်လား?' : 'Mark as No-Show?'}
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              {isMm ? 'ဘိုကင်အမှတ်' : 'Booking'}: <span className="font-mono text-amber-300 font-bold">{selectedBookingForAction.bookingCode}</span> - {selectedBookingForAction.customerName}
            </p>
            <p className="text-xs text-slate-400 mb-5">
              {isMm
                ? 'မလာရောက်ကြောင်း သတ်မှတ်ပါက အခန်းနှင့် ဝန်ထမ်း အချိန်စာရင်းများကို အခြားဖောက်သည်များအတွက် ပြန်လည်ဖွင့်ပေးပါမည်။'
                : 'Marking as no-show will release the room and therapist scheduling for other guests.'}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setActionType(null);
                  setSelectedBookingForAction(null);
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                onClick={handleMarkNoShow}
                disabled={isSubmitting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-lg transition-colors flex items-center gap-1.5"
              >
                {isMm ? 'မလာရောက်ကြောင်း သတ်မှတ်မည်' : 'Confirm No-Show'}
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
              <label className="text-xs text-slate-200 font-semibold">{isMm ? 'ပယ်ဖျက်ရသည့် အကြောင်းအရင်း *' : 'Cancellation Reason *'}</label>
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
