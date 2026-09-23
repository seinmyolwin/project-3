import React, { useState, useEffect } from 'react';
import { Customer, Room, Staff, ServiceItem, UserAccount } from '../../types';
import { bookingManager } from '../../services/bookingManager';
import { Language } from '../../utils/translations';
import { X, Calendar, Clock, User, Scissors, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CustomerRebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  prefillService?: {
    id?: string;
    name?: string;
    staffId?: string;
    staffName?: string;
    durationMinutes?: number;
  };
  services: ServiceItem[];
  staff: Staff[];
  rooms: Room[];
  currentUser: UserAccount;
  lang: Language;
  onSuccess: () => void;
}

export const CustomerRebookModal: React.FC<CustomerRebookModalProps> = ({
  isOpen,
  onClose,
  customer,
  prefillService,
  services,
  staff,
  rooms,
  currentUser,
  lang,
  onSuccess,
}) => {
  const isMm = lang === 'my';

  const [serviceId, setServiceId] = useState<string>('');
  const [serviceName, setServiceName] = useState<string>('');
  const [staffId, setStaffId] = useState<string>('');
  const [roomId, setRoomsId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('10:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const defaultDate = tomorrow.toISOString().split('T')[0];
      setDate(defaultDate);

      // Match service
      if (prefillService?.name) {
        const found = services.find(
          s => s.id === prefillService.id || s.name.toLowerCase() === prefillService.name?.toLowerCase()
        );
        if (found) {
          setServiceId(found.id);
          setServiceName(found.name);
          setDurationMinutes(found.durationMinutes || prefillService.durationMinutes || 60);
        } else {
          setServiceId(prefillService.id || '');
          setServiceName(prefillService.name);
          setDurationMinutes(prefillService.durationMinutes || 60);
        }
      } else if (services.length > 0) {
        setServiceId(services[0].id);
        setServiceName(services[0].name);
        setDurationMinutes(services[0].durationMinutes || 60);
      }

      // Match staff
      if (prefillService?.staffId) {
        setStaffId(prefillService.staffId);
      } else if (customer.preferences?.preferredStaffId) {
        setStaffId(customer.preferences.preferredStaffId);
      } else {
        setStaffId('');
      }

      if (rooms.length > 0) {
        setRoomsId(rooms[0].id);
      }

      setNotes(`Rebooked from previous service: ${prefillService?.name || 'Service'}`);
      setConflictWarning(null);
    }
  }, [isOpen, prefillService, services, rooms, customer]);

  if (!isOpen) return null;

  // Calculate end time
  const calculateEndTime = (start: string, duration: number): string => {
    const [h, m] = start.split(':').map(Number);
    const totalMins = (h || 0) * 60 + (m || 0) + duration;
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  const handleCheckConflict = async () => {
    if (!date || !startTime) return;
    const endTime = calculateEndTime(startTime, durationMinutes);
    const conflict = await bookingManager.checkConflict({
      date,
      startTime,
      endTime,
      roomId: roomId || undefined,
      staffId: staffId || undefined,
    });

    if (conflict.hasConflict) {
      setConflictWarning(conflict.reason || 'Time conflict detected with another booking');
    } else {
      setConflictWarning(null);
      alert(isMm ? 'အချိန်သတ်မှတ်မှု လွတ်လပ်သည် (အဆင်ပြေပါသည်)' : 'Slot is available! No conflict.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim() || !date || !startTime) {
      alert(isMm ? 'ဝန်ဆောင်မှု၊ ရက်စွဲနှင့် အချိန် ထည့်သွင်းပေးပါ' : 'Please select service, date, and time');
      return;
    }

    setIsSubmitting(true);
    try {
      const endTime = calculateEndTime(startTime, durationMinutes);
      const selectedStaff = staff.find(s => s.id === staffId);
      const selectedRoom = rooms.find(r => r.id === roomId);

      await bookingManager.createBooking({
        businessId: customer.businessId || 'default',
        branchId: customer.branchId || 'main',
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        serviceId: serviceId || undefined,
        serviceName,
        staffId: staffId || undefined,
        staffName: selectedStaff?.name,
        roomId: roomId || undefined,
        roomName: selectedRoom?.name,
        date,
        startTime,
        endTime,
        durationMinutes,
        notes,
        createdBy: currentUser.name || 'Staff',
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Error creating rebooking: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-gray-100 bg-linear-to-r from-emerald-600 to-teal-700 px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {isMm ? 'ဝန်ဆောင်မှု ပြန်လည်ရက်ချိန်းယူခြင်း (Rebooking)' : 'Rebook Customer Appointment'}
              </h3>
              <p className="text-xs text-white/80">
                {customer.name} ({customer.phone})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {conflictWarning && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>{conflictWarning}</span>
            </div>
          )}

          {/* Service Selection */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              {isMm ? 'ရွေးချယ်ထားသော ဝန်ဆောင်မှု' : 'Service Item'}
            </label>
            <div className="grid grid-cols-1 gap-2">
              <select
                value={serviceId}
                onChange={e => {
                  const s = services.find(srv => srv.id === e.target.value);
                  if (s) {
                    setServiceId(s.id);
                    setServiceName(s.name);
                    setDurationMinutes(s.durationMinutes || 60);
                  }
                }}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:outline-hidden"
              >
                {services.map(srv => (
                  <option key={srv.id} value={srv.id}>
                    {srv.name} ({srv.durationMinutes || 60}m) - {srv.priceMMK?.toLocaleString()} MMK
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Staff & Room */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                {isMm ? 'ကြိုက်နှစ်သက်ရာ ဝန်ထမ်း' : 'Preferred Staff'}
              </label>
              <select
                value={staffId}
                onChange={e => setStaffId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:outline-hidden"
              >
                <option value="">{isMm ? '-- မည်သူမဆို (Any Staff) --' : '-- Any Available Staff --'}</option>
                {staff.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                {isMm ? 'အခန်း / နေရာ' : 'Room / Bed'}
              </label>
              <select
                value={roomId}
                onChange={e => setRoomsId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:outline-hidden"
              >
                <option value="">{isMm ? '-- အခန်းမရွေး --' : '-- Any Room --'}</option>
                {rooms.map(rm => (
                  <option key={rm.id} value={rm.id}>
                    {rm.name} ({rm.type || 'Room'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date, Start Time & Duration */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                {isMm ? 'ရက်စွဲ' : 'Date'}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                {isMm ? 'စတင်ချိန်' : 'Start Time'}
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                {isMm ? 'ကြာချိန် (မိနစ်)' : 'Duration (min)'}
              </label>
              <input
                type="number"
                min={15}
                step={15}
                required
                value={durationMinutes}
                onChange={e => setDurationMinutes(Number(e.target.value) || 60)}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-gray-500">
              {isMm ? 'ပြီးဆုံးမည့်အချိန် ခန့်မှန်း:' : 'Estimated End:'}{' '}
              <strong className="text-gray-900 font-mono">{calculateEndTime(startTime, durationMinutes)}</strong>
            </span>
            <button
              type="button"
              onClick={handleCheckConflict}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
            >
              {isMm ? 'အချိန်အားလပ်မှု စစ်ဆေးမည်' : 'Check Availability'}
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              {isMm ? 'မှတ်ချက် (Notes)' : 'Booking Notes'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={isMm ? 'အထူးမှာကြားချက်များ...' : 'Special requests or preferences...'}
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm text-gray-900 focus:border-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-300 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting
                ? isMm ? 'သိမ်းဆည်းနေပါသည်...' : 'Creating Booking...'
                : isMm ? 'ရက်ချိန်း အတည်ပြုမည်' : 'Confirm Rebooking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
