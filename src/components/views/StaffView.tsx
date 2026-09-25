import React, { useState, useEffect, useCallback } from 'react';
import {
  StaffMember,
  StaffLedgerEntry,
  StaffSettlement,
  UserAccount,
  PaymentMethod,
  StaffScheduleRecord,
  StaffAttendanceRecord,
} from '../../types';
import { db } from '../../db/database';
import {
  formatMMK,
  calculateStaffLedgerTotals,
  calculateDetailedSettlementBreakdown,
} from '../../domain/financial';
import { Language } from '../../utils/translations';
import {
  Users,
  Plus,
  Coins,
  TrendingUp,
  Receipt,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  X,
  FileText,
  Calendar,
  UserCheck,
  Printer,
  RotateCcw,
  BarChart3,
  ShieldAlert,
} from 'lucide-react';

interface StaffViewProps {
  staff: StaffMember[];
  staffLedger: StaffLedgerEntry[];
  settlements: StaffSettlement[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const StaffView: React.FC<StaffViewProps> = ({
  staff,
  staffLedger,
  settlements,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';
  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedStaffId, setSelectedStaffId] = useState<string>(staff[0]?.id || '');
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'schedule' | 'attendance' | 'ledger' | 'settlements' | 'report'>('roster');
  const [rosterActiveFilter, setRosterActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [schedulesList, setSchedulesList] = useState<StaffScheduleRecord[]>([]);
  const [attendanceList, setAttendanceList] = useState<StaffAttendanceRecord[]>([]);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [schedStaffId, setSchedStaffId] = useState(staff[0]?.id || '');
  const [schedDate, setSchedDate] = useState(todayStr);
  const [schedStartTime, setSchedStartTime] = useState('09:00');
  const [schedEndTime, setSchedEndTime] = useState('18:00');
  const [schedBreakStart, setSchedBreakStart] = useState('12:00');
  const [schedBreakEnd, setSchedBreakEnd] = useState('13:00');
  const [schedStatus, setSchedStatus] = useState<'working' | 'off' | 'leave' | 'unavailable'>('working');
  const [schedNotes, setSchedNotes] = useState('');

  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attStaffId, setAttStaffId] = useState(staff[0]?.id || '');
  const [attDate, setAttDate] = useState(todayStr);
  const [attStatus, setAttStatus] = useState<'checked_in' | 'checked_out' | 'absent'>('checked_in');
  const [attCheckInTime, setAttCheckInTime] = useState('09:00');
  const [attCheckOutTime, setAttCheckOutTime] = useState('18:00');
  const [attNotes, setAttNotes] = useState('');

  const loadSchedulesAndAttendance = useCallback(async () => {
    try {
      const [schedules, atts] = await Promise.all([
        db.staffSchedules.toArray(),
        db.staffAttendance.toArray(),
      ]);
      setSchedulesList(schedules);
      setAttendanceList(atts);
    } catch (err) {
      console.error('Error loading schedule & attendance:', err);
    }
  }, []);

  useEffect(() => {
    loadSchedulesAndAttendance();
  }, [loadSchedulesAndAttendance]);

  const handleSaveSchedule = async () => {
    const targetStaff = staff.find(s => s.id === schedStaffId);
    if (!targetStaff) return;
    try {
      await db.recordStaffSchedule({
        staffId: targetStaff.id,
        staffName: targetStaff.name,
        date: schedDate,
        startTime: schedStartTime,
        endTime: schedEndTime,
        breakStart: schedBreakStart,
        breakEnd: schedBreakEnd,
        status: schedStatus,
        notes: schedNotes,
        currentUser: { id: currentUser.id, name: currentUser.name, role: currentUser.role },
      });
      setIsScheduleModalOpen(false);
      setSchedNotes('');
      loadSchedulesAndAttendance();
      onRefresh();
    } catch (err: any) {
      alert('Error saving schedule: ' + err.message);
    }
  };

  const handleSaveAttendance = async () => {
    const targetStaff = staff.find(s => s.id === attStaffId);
    if (!targetStaff) return;
    try {
      await db.recordStaffAttendance({
        staffId: targetStaff.id,
        staffName: targetStaff.name,
        date: attDate,
        checkInTime: attCheckInTime,
        checkOutTime: attCheckOutTime,
        status: attStatus,
        notes: attNotes,
        currentUser: { id: currentUser.id, name: currentUser.name, role: currentUser.role },
      });
      setIsAttendanceModalOpen(false);
      setAttNotes('');
      loadSchedulesAndAttendance();
      onRefresh();
    } catch (err: any) {
      alert('Error saving attendance: ' + err.message);
    }
  };

  // Modals
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [advanceReason, setAdvanceReason] = useState<string>('');

  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'bonus' | 'deduction'>('bonus');
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');

  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [salaryAmount, setSalaryAmount] = useState<number>(0);
  const [salaryMonthYear, setSalaryMonthYear] = useState<string>(todayStr.slice(0, 7));
  const [salaryReason, setSalaryReason] = useState<string>('');

  // Settlement Form State
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementPeriodStart, setSettlementPeriodStart] = useState<string>('2026-01-01');
  const [settlementPeriodEnd, setSettlementPeriodEnd] = useState<string>(todayStr);
  const [settlementDate, setSettlementDate] = useState<string>(todayStr);
  const [settlementPaymentMethod, setSettlementPaymentMethod] = useState<PaymentMethod>('cash');
  const [isPartialSettlement, setIsPartialSettlement] = useState<boolean>(false);
  const [customPayAmount, setCustomPayAmount] = useState<number>(0);
  const [settlementNotes, setSettlementNotes] = useState<string>('');

  // Settlement Reversal State
  const [reversingSettlement, setReversingSettlement] = useState<StaffSettlement | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');

  // Printable settlement voucher state
  const [viewVoucher, setViewVoucher] = useState<StaffSettlement | null>(null);

  const currentSelectedStaff = staff.find(s => s.id === selectedStaffId) || staff[0];

  // Ledger entries for currently selected staff
  const staffEntries = staffLedger.filter(e => e.staffId === currentSelectedStaff?.id);
  const ledgerTotals = calculateStaffLedgerTotals(staffEntries);

  // Filtered breakdown for settlement form
  const settlementBreakdown = calculateDetailedSettlementBreakdown(staffEntries, {
    periodStart: settlementPeriodStart,
    periodEnd: settlementPeriodEnd,
  });

  const netPayable = settlementBreakdown.netPayableBeforeMMK;
  const payAmount = isPartialSettlement && customPayAmount > 0 ? customPayAmount : netPayable;
  const remainingPayable = Math.max(0, netPayable - payAmount);

  // Handle Advance Submission
  const handleRecordAdvance = async () => {
    if (!currentSelectedStaff || advanceAmount <= 0) return;
    try {
      await db.recordStaffAdvanceTransaction({
        staffId: currentSelectedStaff.id,
        amountMMK: advanceAmount,
        reason: advanceReason.trim() || 'Staff cash advance (လစာကြိုထုတ်ငွေ)',
        currentUser,
      });
      setIsAdvanceModalOpen(false);
      setAdvanceAmount(0);
      setAdvanceReason('');
      onRefresh();
    } catch (err: any) {
      alert('Error recording advance: ' + err.message);
    }
  };

  // Handle Bonus/Deduction Submission
  const handleRecordAdjustment = async () => {
    if (!currentSelectedStaff || adjustmentAmount <= 0) return;
    try {
      await db.recordStaffAdjustmentTransaction({
        staffId: currentSelectedStaff.id,
        type: adjustmentType,
        amountMMK: adjustmentAmount,
        reason: adjustmentReason.trim() || (adjustmentType === 'bonus' ? 'Staff incentive bonus' : 'Staff penalty deduction'),
        currentUser,
      });
      setIsAdjustmentModalOpen(false);
      setAdjustmentAmount(0);
      setAdjustmentReason('');
      onRefresh();
    } catch (err: any) {
      alert('Error recording adjustment: ' + err.message);
    }
  };

  // Handle Monthly Salary Credit Submission
  const handleRecordSalary = async () => {
    if (!currentSelectedStaff || salaryAmount <= 0) return;
    try {
      await db.recordStaffSalaryTransaction({
        staffId: currentSelectedStaff.id,
        amountMMK: salaryAmount,
        monthYear: salaryMonthYear,
        reason: salaryReason.trim() || `Monthly Base Salary (${salaryMonthYear}) - အခြေခံလစာ`,
        currentUser,
      });
      setIsSalaryModalOpen(false);
      setSalaryAmount(0);
      setSalaryReason('');
      onRefresh();
    } catch (err: any) {
      alert('Error recording salary credit: ' + err.message);
    }
  };

  // Open Settlement Modal
  const handleOpenSettlementModal = (staffId?: string) => {
    if (staffId) setSelectedStaffId(staffId);
    const targetStaffId = staffId || selectedStaffId;
    const entries = staffLedger.filter(e => e.staffId === targetStaffId);
    const earliestDate = entries.length > 0 && entries[0].date ? entries[0].date : '2026-01-01';
    
    setSettlementPeriodStart(earliestDate);
    setSettlementPeriodEnd(todayStr);
    setSettlementDate(todayStr);
    setIsPartialSettlement(false);

    const bd = calculateDetailedSettlementBreakdown(entries, {
      periodStart: earliestDate,
      periodEnd: todayStr,
    });
    setCustomPayAmount(bd.netPayableBeforeMMK);
    setIsSettlementModalOpen(true);
  };

  // Handle Settlement Execution
  const handleConfirmSettlement = async () => {
    if (!currentSelectedStaff) return;
    try {
      const voucher = await db.recordStaffSettlementTransaction({
        staffId: currentSelectedStaff.id,
        periodStart: settlementPeriodStart,
        periodEnd: settlementPeriodEnd,
        settlementDate,
        amountMMK: isPartialSettlement ? customPayAmount : undefined,
        paymentMethod: settlementPaymentMethod,
        notes: settlementNotes.trim() || undefined,
        currentUser,
      });

      setIsSettlementModalOpen(false);
      setSettlementNotes('');
      onRefresh();
      setViewVoucher(voucher);
    } catch (err: any) {
      alert('Settlement error: ' + err.message);
    }
  };

  // Handle Reversal Execution
  const handleConfirmReversal = async () => {
    if (!reversingSettlement) return;
    if (!reversalReason.trim()) {
      alert('A reversal reason is mandatory for auditing.');
      return;
    }
    try {
      await db.reverseStaffSettlementTransaction({
        settlementId: reversingSettlement.id,
        reason: reversalReason.trim(),
        currentUser,
      });
      setReversingSettlement(null);
      setReversalReason('');
      onRefresh();
    } catch (err: any) {
      alert('Reversal error: ' + err.message);
    }
  };

  // Toggle staff status with active status awareness
  const handleToggleStaffStatus = async (staffId: string, currentStatus: string) => {
    const targetMember = staff.find(s => s.id === staffId);
    if (!targetMember) return;

    if (targetMember.isActive === false) {
      const confirmReactivate = window.confirm(
        isMm
          ? `ဤဝန်ထမ်း (${targetMember.name}) အား ဆက်တင်များ (Master Data) တွင် ပိတ်ထားပါသည် (Inactive)။ စနစ်တွင် ပြန်လည်အသုံးပြုပြီး တာဝန်ရှိ (Available) အဖြစ် သတ်မှတ်ရန် သေချာပါသလား?`
          : `Staff member "${targetMember.name}" is currently deactivated in Settings. Do you want to reactivate them and set to Available?`
      );
      if (confirmReactivate) {
        await db.staff.update(staffId, { isActive: true, status: 'available' });
        await db.recordAuditLog({
          entityType: 'staff',
          entityId: staffId,
          action: 'activate',
          details: `Reactivated staff "${targetMember.name}" from Staff Roster view`,
          currentUser: { id: currentUser.id, name: currentUser.name, role: currentUser.role },
        });
        onRefresh();
      }
      return;
    }

    const nextStatus = currentStatus === 'available' ? 'off_duty' : 'available';
    await db.staff.update(staffId, { status: nextStatus as any });
    await db.recordAuditLog({
      entityType: 'staff',
      entityId: staffId,
      action: 'update',
      details: `Changed staff "${targetMember.name}" status to ${nextStatus}`,
      currentUser: { id: currentUser.id, name: currentUser.name, role: currentUser.role },
    });
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {isMm ? 'ဝန်ထမ်းများနှင့် ကော်မရှင် စီမံခန့်ခွဲမှု' : 'Staff & Commission Settlement Engine'}
          </h2>
          <p className="text-xs text-gray-500">
            {isMm
              ? 'ဝန်ထမ်းကော်မရှင်၊ ကြိုထုတ်ငွေ၊ ဘောနပ်စ်/ဒဏ်ကြေးနှင့် စာရင်းရှင်းတမ်းများ'
              : 'Calculate staff earnings, advances, deductions, partial settlements, and ledger reversals'}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'roster', labelEn: 'Staff Roster', labelMm: 'ဝန်ထမ်းစာရင်း' },
            { id: 'schedule', labelEn: 'Shift Schedule', labelMm: 'အချိန်ဇယား' },
            { id: 'attendance', labelEn: 'Attendance Timecard', labelMm: 'တက်ရောက်မှု မှတ်တမ်း' },
            { id: 'ledger', labelEn: 'Staff Ledger', labelMm: 'ငွေစာရင်းမှတ်တမ်း' },
            { id: 'settlements', labelEn: 'Settlement History', labelMm: 'ရှင်းပြီးငွေစာရင်းများ' },
            { id: 'report', labelEn: 'Settlement Report', labelMm: 'ရှင်းတမ်း အစီရင်ခံစာ' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                activeSubTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isMm ? tab.labelMm : tab.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule View */}
      {activeSubTab === 'schedule' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-gray-900">{isMm ? 'ဝန်ထမ်း အချိန်ဇယားများ' : 'Staff Shift Roster & Schedules'}</h3>
              <p className="text-xs text-gray-500">{isMm ? 'နေ့စဉ် / အပတ်စဉ် ဝန်ထမ်းအလုပ်ချိန် စီမံခန့်ခွဲရန်' : 'Manage shift start, end times, breaks, and roster availability.'}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              <span>{isMm ? 'အလုပ်ချိန် သတ်မှတ်မည်' : 'Add Shift Schedule'}</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-slate-50 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">{isMm ? 'ရက်စွဲ' : 'Date'}</th>
                    <th className="py-3 px-4">{isMm ? 'ဝန်ထမ်းအမည်' : 'Staff Member'}</th>
                    <th className="py-3 px-4">{isMm ? 'အလုပ်ချိန်' : 'Shift Hours'}</th>
                    <th className="py-3 px-4">{isMm ? 'အနားယူချိန်' : 'Break'}</th>
                    <th className="py-3 px-4">{isMm ? 'အခြေအနေ' : 'Status'}</th>
                    <th className="py-3 px-4">{isMm ? 'မှတ်ချက်' : 'Notes'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {schedulesList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        {isMm ? 'အချိန်ဇယား မှတ်တမ်း မရှိသေးပါ' : 'No shift schedules recorded yet.'}
                      </td>
                    </tr>
                  ) : (
                    schedulesList.map(sch => (
                      <tr key={sch.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono">{sch.date}</td>
                        <td className="py-3 px-4 font-bold text-gray-900">{sch.staffName}</td>
                        <td className="py-3 px-4 font-mono">{sch.startTime} - {sch.endTime}</td>
                        <td className="py-3 px-4 font-mono text-gray-500">{sch.breakStart ? `${sch.breakStart} - ${sch.breakEnd}` : 'None'}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            sch.status === 'working' ? 'bg-emerald-100 text-emerald-800' :
                            sch.status === 'leave' ? 'bg-amber-100 text-amber-800' :
                            sch.status === 'unavailable' ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {sch.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500">{sch.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Attendance View */}
      {activeSubTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-gray-900">{isMm ? 'ဝန်ထမ်း တက်ရောက်မှု မှတ်တမ်း' : 'Staff Attendance & Timecard'}</h3>
              <p className="text-xs text-gray-500">{isMm ? 'ဝင်ရောက်ချိန် (Check-In) နှင့် ထွက်ခွာချိန် (Check-Out) မှတ်တမ်းများ' : 'Real attendance tracking, check-in, check-out, and punctuality.'}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAttendanceModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              <span>{isMm ? 'တက်ရောက်မှု မှတ်တမ်းတင်မည်' : 'Record Attendance'}</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-slate-50 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">{isMm ? 'ရက်စွဲ' : 'Date'}</th>
                    <th className="py-3 px-4">{isMm ? 'ဝန်ထမ်းအမည်' : 'Staff Member'}</th>
                    <th className="py-3 px-4">{isMm ? 'ဝင်ချိန်' : 'Check-In'}</th>
                    <th className="py-3 px-4">{isMm ? 'ထွက်ချိန်' : 'Check-Out'}</th>
                    <th className="py-3 px-4">{isMm ? 'အခြေအနေ' : 'Status'}</th>
                    <th className="py-3 px-4">{isMm ? 'မှတ်ချက်' : 'Notes'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {attendanceList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        {isMm ? 'တက်ရောက်မှု မှတ်တမ်း မရှိသေးပါ' : 'No attendance records found.'}
                      </td>
                    </tr>
                  ) : (
                    attendanceList.map(att => (
                      <tr key={att.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono">{att.date}</td>
                        <td className="py-3 px-4 font-bold text-gray-900">{att.staffName}</td>
                        <td className="py-3 px-4 font-mono text-emerald-600 font-semibold">{att.checkInTime || '-'}</td>
                        <td className="py-3 px-4 font-mono text-rose-600 font-semibold">{att.checkOutTime || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            att.status === 'checked_in' ? 'bg-emerald-100 text-emerald-800' :
                            att.status === 'checked_out' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {att.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500">{att.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Roster & Balance View */}
      {activeSubTab === 'roster' && (
        <div className="space-y-4">
          {/* Roster Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-700 mr-2">
                {isMm ? 'ဝန်ထမ်းစာရင်း စစ်ထုတ်ရန်:' : 'Filter Staff:'}
              </span>
              {[
                { id: 'all', labelMm: 'အားလုံး', labelEn: 'All Staff', count: staff.length },
                { id: 'active', labelMm: 'တာဝန်ထမ်းဆောင်ဆဲ (Active)', labelEn: 'Active', count: staff.filter(s => s.isActive !== false).length },
                { id: 'inactive', labelMm: 'ပိတ်ထားသော ဝန်ထမ်းများ', labelEn: 'Deactivated / Inactive', count: staff.filter(s => s.isActive === false).length },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setRosterActiveFilter(f.id as any)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    rosterActiveFilter === f.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{isMm ? f.labelMm : f.labelEn}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    rosterActiveFilter === f.id ? 'bg-emerald-800 text-white' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="text-[11px] text-gray-500">
              {isMm ? 'စနစ်အတွင်း ဝန်ထမ်းအချက်အလက်များကို Settings > Master Data တွင် အပြည့်အစုံ ပြင်ဆင်နိုင်ပါသည်' : 'Full staff management in Settings > Master Data'}
            </div>
          </div>

          {/* Roster Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {staff
              .filter(member => {
                if (rosterActiveFilter === 'active') return member.isActive !== false;
                if (rosterActiveFilter === 'inactive') return member.isActive === false;
                return true;
              })
              .map(member => {
                const memberEntries = staffLedger.filter(e => e.staffId === member.id);
                const totals = calculateStaffLedgerTotals(memberEntries);
                const isDeactivated = member.isActive === false;

                return (
                  <div
                    key={member.id}
                    className={`flex flex-col justify-between rounded-2xl border p-4 shadow-xs hover:shadow-md transition-all ${
                      isDeactivated
                        ? 'border-gray-300 bg-slate-50/80 opacity-80'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div>
                      {/* Header */}
                      <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                              {member.role}
                            </span>
                            {isDeactivated && (
                              <span className="inline-flex items-center rounded-md bg-rose-100 px-1.5 py-0.2 text-[9px] font-bold text-rose-800 uppercase">
                                {isMm ? 'ပိတ်ထားသည်' : 'Inactive'}
                              </span>
                            )}
                          </div>
                          <h3 className={`text-base font-bold ${isDeactivated ? 'text-gray-600' : 'text-gray-900'}`}>
                            {member.name}
                          </h3>
                          <p className="text-[11px] text-gray-500">{member.phone}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleStaffStatus(member.id, member.status)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-pointer transition-colors ${
                            isDeactivated
                              ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : member.status === 'available'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : member.status === 'in_service'
                              ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                          }`}
                          title={
                            isDeactivated
                              ? isMm
                                ? 'ဆက်တင်တွင် ပိတ်ထားသည် (နှိပ်၍ ပြန်ဖွင့်နိုင်သည်)'
                                : 'Deactivated in Settings (Click to reactivate)'
                              : isMm
                              ? 'တာဝန်အခြေအနေ ပြောင်းရန် နှိပ်ပါ'
                              : 'Click to toggle duty status'
                          }
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            isDeactivated
                              ? 'bg-rose-500'
                              : member.status === 'available'
                              ? 'bg-emerald-500'
                              : member.status === 'in_service'
                              ? 'bg-amber-500'
                              : 'bg-gray-400'
                          }`} />
                          {isDeactivated
                            ? (isMm ? 'အလုပ်ဆိုင်းငံ့/ပိတ်ထား' : 'Deactivated')
                            : member.status === 'available'
                            ? (isMm ? 'တာဝန်ရှိ' : 'Available')
                            : member.status === 'in_service'
                            ? (isMm ? 'အလုပ်လုပ်နေဆဲ' : 'In Service')
                            : (isMm ? 'အလုပ်ဆင်း' : 'Off Duty')}
                        </button>
                      </div>

                  {/* Commission Rule Info */}
                  <div className="mt-3 rounded-xl bg-gray-50 p-2.5 text-xs text-gray-700 border border-gray-100 space-y-1">
                    <div className="flex justify-between">
                      <span>{isMm ? 'ကော်မရှင် နှုန်းထား:' : 'Commission Rule:'}</span>
                      <span className="font-bold text-emerald-800">
                        {member.defaultCommissionRule.type === 'percentage'
                          ? `${member.defaultCommissionRule.value}% (ရာခိုင်နှုန်း)`
                          : `${formatMMK(member.defaultCommissionRule.value)} (သတ်မှတ်နှုန်း)`}
                      </span>
                    </div>
                    {member.baseSalaryMMK !== undefined && member.baseSalaryMMK > 0 && (
                      <div className="flex justify-between border-t border-gray-200/60 pt-1">
                        <span>{isMm ? 'အခြေခံ လစာ:' : 'Base Salary:'}</span>
                        <span className="font-bold text-indigo-700 font-mono">
                          {formatMMK(member.baseSalaryMMK)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Financial Metrics */}
                  <div className="mt-3 space-y-1.5 text-xs">
                    {totals.totalSalaryMMK > 0 && (
                      <div className="flex justify-between text-indigo-700 font-medium">
                        <span>{isMm ? 'ထည့်သွင်းပြီး လစာ:' : 'Total Salary Credited:'}</span>
                        <span className="font-bold font-mono">+{formatMMK(totals.totalSalaryMMK)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>{isMm ? 'ရရှိပြီး ကော်မရှင်စုစုပေါင်း:' : 'Total Commission:'}</span>
                      <span className="font-semibold text-gray-900">{formatMMK(totals.totalCommissionsMMK)}</span>
                    </div>
                    {totals.totalBonusesMMK > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>{isMm ? 'ဘောနပ်စ်:' : 'Total Bonuses:'}</span>
                        <span>+{formatMMK(totals.totalBonusesMMK)}</span>
                      </div>
                    )}
                    {totals.totalAdvancesMMK > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>{isMm ? 'လစာကြိုထုတ်ငွေ:' : 'Total Advances:'}</span>
                        <span>-{formatMMK(totals.totalAdvancesMMK)}</span>
                      </div>
                    )}
                    {totals.totalSettlementsPaidMMK > 0 && (
                      <div className="flex justify-between text-purple-700">
                        <span>{isMm ? 'ရှင်းပေးပြီးငွေ:' : 'Previous Settlements:'}</span>
                        <span>-{formatMMK(totals.totalSettlementsPaidMMK)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-gray-100 pt-2 font-bold text-sm">
                      <span className="text-gray-900">{isMm ? 'ထုတ်ပေးရန် ကျန်ငွေ:' : 'Net Payable:'}</span>
                      <span className="text-emerald-700">{formatMMK(totals.netPayableBalanceMMK)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-1.5 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStaffId(member.id);
                      setIsAdvanceModalOpen(true);
                    }}
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 py-2 text-center text-xs font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    {isMm ? 'ကြိုထုတ်ငွေ' : 'Advance'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStaffId(member.id);
                      setActiveSubTab('ledger');
                    }}
                    className="flex-1 rounded-xl bg-gray-900 py-2 text-center text-xs font-bold text-white hover:bg-black"
                  >
                    {isMm ? 'စာရင်းကြည့်' : 'Ledger'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenSettlementModal(member.id)}
                    className="flex-1 rounded-xl bg-emerald-600 py-2 text-center text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    {isMm ? 'ငွေရှင်းမည်' : 'Settle'}
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Staff Ledger Drill-Down View */}
      {activeSubTab === 'ledger' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          {/* Header & Staff Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-gray-600">{isMm ? 'ဝန်ထမ်း ရွေးပါ:' : 'Select Staff:'}</label>
              <select
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
                className="rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs font-bold text-gray-900"
              >
                {staff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (currentSelectedStaff) {
                    setSalaryAmount(currentSelectedStaff.baseSalaryMMK || 0);
                  }
                  setIsSalaryModalOpen(true);
                }}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
              >
                + {isMm ? 'လစာ ထည့်ရန်' : 'Record Salary'}
              </button>
              <button
                type="button"
                onClick={() => setIsAdvanceModalOpen(true)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                + {isMm ? 'ကြိုထုတ်ငွေ ထည့်ရန်' : 'Record Advance'}
              </button>
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(true)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                + {isMm ? 'ဘောနပ်စ်/ဒဏ်ကြေး' : 'Bonus / Deduction'}
              </button>
              <button
                type="button"
                disabled={ledgerTotals.netPayableBalanceMMK <= 0}
                onClick={() => handleOpenSettlementModal()}
                className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isMm ? 'ရှင်းတမ်းထုတ်မည်' : 'Process Settlement'}
              </button>
            </div>
          </div>

          {/* Balance Cards Bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl bg-indigo-50 p-3 border border-indigo-100">
              <span className="text-[11px] font-semibold text-indigo-800">{isMm ? 'လစာ' : 'Salary'}</span>
              <p className="text-base font-extrabold text-indigo-950 mt-0.5">{formatMMK(ledgerTotals.totalSalaryMMK)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
              <span className="text-[11px] font-semibold text-emerald-800">{isMm ? 'စုစုပေါင်း ကော်မရှင်' : 'Commissions'}</span>
              <p className="text-base font-extrabold text-emerald-950 mt-0.5">{formatMMK(ledgerTotals.totalCommissionsMMK)}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 border border-blue-100">
              <span className="text-[11px] font-semibold text-blue-800">{isMm ? 'ဘောနပ်စ်' : 'Bonuses'}</span>
              <p className="text-base font-extrabold text-blue-950 mt-0.5">{formatMMK(ledgerTotals.totalBonusesMMK)}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 border border-rose-100">
              <span className="text-[11px] font-semibold text-rose-800">{isMm ? 'ကြိုထုတ်ငွေ / ဒဏ်ကြေး' : 'Advances / Deductions'}</span>
              <p className="text-base font-extrabold text-rose-950 mt-0.5">
                {formatMMK(ledgerTotals.totalAdvancesMMK + ledgerTotals.totalDeductionsMMK)}
              </p>
            </div>
            <div className="rounded-xl bg-purple-50 p-3 border border-purple-100">
              <span className="text-[11px] font-semibold text-purple-800">{isMm ? 'ရှင်းပေးပြီးငွေ' : 'Paid Settlements'}</span>
              <p className="text-base font-extrabold text-purple-950 mt-0.5">{formatMMK(ledgerTotals.totalSettlementsPaidMMK)}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 border border-amber-200">
              <span className="text-[11px] font-semibold text-amber-800">{isMm ? 'ရှင်းရန်ကျန်ငွေ (Payable)' : 'Net Payable'}</span>
              <p className="text-base font-extrabold text-amber-950 mt-0.5">{formatMMK(ledgerTotals.netPayableBalanceMMK)}</p>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-y border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Credit (+)</th>
                  <th className="py-2.5 px-3">Debit (-)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Created By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      {isMm ? 'စာရင်းမှတ်တမ်း မရှိသေးပါ' : 'No ledger entries found'}
                    </td>
                  </tr>
                ) : (
                  staffEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50/80">
                      <td className="py-2.5 px-3 font-mono">{entry.date}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            entry.type === 'salary'
                              ? 'bg-indigo-100 text-indigo-800'
                              : entry.type === 'commission'
                              ? 'bg-emerald-100 text-emerald-800'
                              : entry.type === 'bonus'
                              ? 'bg-blue-100 text-blue-800'
                              : entry.type === 'advance'
                              ? 'bg-amber-100 text-amber-800'
                              : entry.type === 'settlement_payout' || entry.type === 'payout'
                              ? 'bg-purple-100 text-purple-800'
                              : entry.type === 'settlement_reversal'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {entry.type === 'salary' ? (isMm ? 'လစာ' : 'Salary') : entry.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-900">{entry.notes}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700 font-mono">
                        {entry.direction === 'credit' ? formatMMK(entry.amountMMK) : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-rose-600 font-mono">
                        {entry.direction === 'debit' ? formatMMK(entry.amountMMK) : '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            entry.isSettled
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {entry.isSettled ? (isMm ? 'ရှင်းပြီး' : 'Settled') : (isMm ? 'မရှင်းရသေး' : 'Unsettled')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">{entry.createdBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settlements History Subtab */}
      {activeSubTab === 'settlements' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-900">
              {isMm ? 'ဝန်ထမ်းလစာ/ကော်မရှင် ရှင်းပြီး မှတ်တမ်းများ' : 'Staff Settlement Vouchers & Ledger'}
            </h3>
            <span className="text-xs text-gray-500 font-medium">
              Total Vouchers: {settlements.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-y border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Voucher #</th>
                  <th className="py-2.5 px-3">Staff Name</th>
                  <th className="py-2.5 px-3">Period</th>
                  <th className="py-2.5 px-3">Commissions</th>
                  <th className="py-2.5 px-3">Advances/Deductions</th>
                  <th className="py-2.5 px-3">Amount Paid</th>
                  <th className="py-2.5 px-3">Remaining</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Paid By</th>
                  <th className="py-2.5 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {settlements.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-gray-400">
                      {isMm ? 'ရှင်းတမ်းမှတ်တမ်း မရှိသေးပါ' : 'No settlement records found'}
                    </td>
                  </tr>
                ) : (
                  settlements.map(set => {
                    const paidAmt = set.amountMMK || set.netPayoutMMK || 0;
                    const isReversed = set.status === 'reversed';

                    return (
                      <tr key={set.id} className={`hover:bg-gray-50/80 ${isReversed ? 'bg-rose-50/30' : ''}`}>
                        <td className="py-2.5 px-3 font-bold text-gray-900 font-mono">{set.settlementCode}</td>
                        <td className="py-2.5 px-3 font-medium">{set.staffName}</td>
                        <td className="py-2.5 px-3 font-mono text-gray-500">{set.periodStart} ~ {set.periodEnd}</td>
                        <td className="py-2.5 px-3 text-emerald-700 font-semibold">{formatMMK(set.grossCommissionMMK || set.totalCommissionMMK || 0)}</td>
                        <td className="py-2.5 px-3 text-rose-600 font-semibold">
                          -{formatMMK((set.totalAdvanceMMK || set.totalAdvanceDeductedMMK || 0) + (set.totalDeductionMMK || 0))}
                        </td>
                        <td className="py-2.5 px-3 text-base font-extrabold text-emerald-900 font-mono">
                          {formatMMK(paidAmt)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-gray-600">
                          {formatMMK(set.remainingPayableMMK || 0)}
                        </td>
                        <td className="py-2.5 px-3 uppercase text-[11px] font-semibold">{set.paymentMethod}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isReversed ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {set.status || 'completed'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-500">{set.paidBy}</td>
                        <td className="py-2.5 px-3 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewVoucher(set)}
                            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-gray-700 hover:bg-gray-100 text-[11px]"
                          >
                            <Printer className="h-3 w-3" />
                            <span>Voucher</span>
                          </button>
                          {!isReversed && (
                            <button
                              type="button"
                              onClick={() => setReversingSettlement(set)}
                              className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700 hover:bg-rose-100 text-[11px] font-medium"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Reverse</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settlement Report Subtab */}
      {activeSubTab === 'report' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {isMm ? 'ဝန်ထမ်း ရှင်းတမ်း စုစုပေါင်း အစီရင်ခံစာ' : 'Staff Settlement Summary Report'}
              </h3>
              <p className="text-xs text-gray-500">
                {isMm
                  ? 'ဝန်ထမ်းတစ်ဦးစီ၏ ရရှိငွေ၊ ကြိုထုတ်ငွေ၊ ဒဏ်ကြေး၊ ထုတ်ပေးပြီးငွေနှင့် ကျန်ငွေများ'
                  : 'Comprehensive breakdown of earned commissions, bonuses, advances, deductions, paid settlements, and net payable balances'}
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Report
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-y border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Staff Name</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Total Earned</th>
                  <th className="py-2.5 px-3">Advances</th>
                  <th className="py-2.5 px-3">Deductions</th>
                  <th className="py-2.5 px-3">Total Paid</th>
                  <th className="py-2.5 px-3">Outstanding Payable</th>
                  <th className="py-2.5 px-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {staff.map(m => {
                  const entries = staffLedger.filter(e => e.staffId === m.id);
                  const bd = calculateDetailedSettlementBreakdown(entries);

                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-sans font-bold text-gray-900">{m.name}</td>
                      <td className="py-2.5 px-3 font-sans text-gray-500">{m.role}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700">
                        {formatMMK(bd.totalEarnedMMK)}
                      </td>
                      <td className="py-2.5 px-3 text-rose-600">
                        -{formatMMK(bd.totalAdvanceMMK)}
                      </td>
                      <td className="py-2.5 px-3 text-rose-600">
                        -{formatMMK(bd.totalDeductionMMK)}
                      </td>
                      <td className="py-2.5 px-3 text-purple-700 font-bold">
                        {formatMMK(bd.previousSettlementsMMK)}
                      </td>
                      <td className="py-2.5 px-3 text-base font-extrabold text-emerald-900">
                        {formatMMK(bd.netPayableBeforeMMK)}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <button
                          type="button"
                          disabled={bd.netPayableBeforeMMK <= 0}
                          onClick={() => handleOpenSettlementModal(m.id)}
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                        >
                          Settle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECORD ADVANCE MODAL */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {isMm ? 'လစာ/ကော်မရှင် ကြိုထုတ်ငွေ ထည့်သွင်းခြင်း' : 'Record Staff Cash Advance'}
              </h3>
              <button onClick={() => setIsAdvanceModalOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4 text-xs">
              <p className="text-gray-600 font-semibold">
                Staff: <span className="text-emerald-800 font-bold">{currentSelectedStaff?.name}</span>
              </p>
              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'ထုတ်ယူငွေပမာဏ (ကျပ်)' : 'Advance Amount (MMK)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={advanceAmount || ''}
                  onChange={e => setAdvanceAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="e.g. 20000"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm font-bold text-gray-900"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[10000, 20000, 30000, 50000, 100000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAdvanceAmount(amt)}
                    className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    {formatMMK(amt)}
                  </button>
                ))}
              </div>
              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'အကြောင်းပြချက်' : 'Reason / Notes'}
                </label>
                <input
                  type="text"
                  value={advanceReason}
                  onChange={e => setAdvanceReason(e.target.value)}
                  placeholder="e.g. Emergency family medical expense"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setIsAdvanceModalOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleRecordAdvance}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                {isMm ? 'မှတ်တမ်းတင်မည်' : 'Save Advance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD ADJUSTMENT MODAL */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {isMm ? 'ဘောနပ်စ် သို့မဟုတ် ဒဏ်ကြေး ထည့်သွင်းခြင်း' : 'Add Bonus / Deduction'}
              </h3>
              <button onClick={() => setIsAdjustmentModalOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4 text-xs">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('bonus')}
                  className={`flex-1 rounded-xl py-2 font-bold ${
                    adjustmentType === 'bonus'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  + Bonus (ဘောနပ်စ်)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('deduction')}
                  className={`flex-1 rounded-xl py-2 font-bold ${
                    adjustmentType === 'deduction'
                      ? 'bg-rose-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  - Deduction (ဒဏ်ကြေး)
                </button>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'ပမာဏ (ကျပ်)' : 'Amount (MMK)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustmentAmount || ''}
                  onChange={e => setAdjustmentAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-sm font-bold text-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'အကြောင်းပြချက်' : 'Reason'}
                </label>
                <input
                  type="text"
                  value={adjustmentReason}
                  onChange={e => setAdjustmentReason(e.target.value)}
                  placeholder={adjustmentType === 'bonus' ? 'e.g. Excellent customer review' : 'e.g. Late attendance'}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleRecordAdjustment}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                {isMm ? 'အတည်ပြုမည်' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD SALARY MODAL */}
      {isSalaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span className="text-indigo-600 font-extrabold text-lg">MMK</span>
                <span>{isMm ? 'လစာ စာရင်းထည့်သွင်းခြင်း' : 'Record Monthly Salary Credit'}</span>
              </h3>
              <button onClick={() => setIsSalaryModalOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4 text-xs">
              <p className="text-gray-600 font-semibold">
                Staff: <span className="text-indigo-800 font-bold">{currentSelectedStaff?.name}</span>
                {currentSelectedStaff?.baseSalaryMMK ? (
                  <span className="ml-2 text-gray-500 font-normal">
                    (Base: {formatMMK(currentSelectedStaff.baseSalaryMMK)})
                  </span>
                ) : null}
              </p>
              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'လစာ ကာလ (ခုနှစ်-လ)' : 'Salary Month / Period'}
                </label>
                <input
                  type="month"
                  value={salaryMonthYear}
                  onChange={e => setSalaryMonthYear(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs font-bold text-gray-900 font-mono"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'လစာ ပမာဏ (ကျပ်)' : 'Salary Amount (MMK)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={salaryAmount || ''}
                  onChange={e => setSalaryAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="e.g. 250000"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm font-bold text-indigo-900 font-mono"
                />
              </div>
              {currentSelectedStaff?.baseSalaryMMK && (
                <button
                  type="button"
                  onClick={() => setSalaryAmount(currentSelectedStaff.baseSalaryMMK || 0)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold underline"
                >
                  {isMm ? 'သတ်မှတ်ထားသော အခြေခံလစာ သုံးမည်' : 'Set to default base salary'} ({formatMMK(currentSelectedStaff.baseSalaryMMK)})
                </button>
              )}
              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'မှတ်ချက်' : 'Notes / Description'}
                </label>
                <input
                  type="text"
                  value={salaryReason}
                  onChange={e => setSalaryReason(e.target.value)}
                  placeholder={`e.g. Monthly salary for ${salaryMonthYear}`}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setIsSalaryModalOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleRecordSalary}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                {isMm ? 'အတည်ပြုမည်' : 'Save Salary Credit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL / PARTIAL SETTLEMENT MODAL */}
      {isSettlementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {isMm ? 'ဝန်ထမ်း ရှင်းတမ်းနှင့် ငွေပေးချေခြင်း' : 'Staff Settlement & Payout Engine'}
              </h3>
              <button onClick={() => setIsSettlementModalOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Staff & Date Parameters */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">{isMm ? 'ဝန်ထမ်း' : 'Staff Member'}</label>
                  <select
                    value={selectedStaffId}
                    onChange={e => {
                      setSelectedStaffId(e.target.value);
                      const entries = staffLedger.filter(l => l.staffId === e.target.value);
                      const bd = calculateDetailedSettlementBreakdown(entries, {
                        periodStart: settlementPeriodStart,
                        periodEnd: settlementPeriodEnd,
                      });
                      setCustomPayAmount(bd.netPayableBeforeMMK);
                    }}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-bold text-gray-900"
                  >
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">{isMm ? 'ရှင်းတမ်း ရက်စွဲ' : 'Settlement Date'}</label>
                  <input
                    type="date"
                    value={settlementDate}
                    onChange={e => setSettlementDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-mono text-gray-900"
                  />
                </div>
              </div>

              {/* Period Filter */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">{isMm ? 'ကာလ စတင်ရက်' : 'Period Start'}</label>
                  <input
                    type="date"
                    value={settlementPeriodStart}
                    onChange={e => setSettlementPeriodStart(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-mono text-gray-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">{isMm ? 'ကာလ ပြီးဆုံးရက်' : 'Period End'}</label>
                  <input
                    type="date"
                    value={settlementPeriodEnd}
                    onChange={e => setSettlementPeriodEnd(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-mono text-gray-900"
                  />
                </div>
              </div>

              {/* Summary Calculation Breakdown */}
              <div className="space-y-1.5 rounded-xl bg-gray-50 p-3 border border-gray-200">
                {settlementBreakdown.totalSalaryMMK > 0 && (
                  <div className="flex justify-between text-indigo-700">
                    <span>{isMm ? 'အခြေခံလစာ ပေါင်းငွေ:' : 'Base Salary:'}</span>
                    <span className="font-bold font-mono">+{formatMMK(settlementBreakdown.totalSalaryMMK)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>{isMm ? 'ကော်မရှင် စုစုပေါင်း (Gross):' : 'Gross Commission:'}</span>
                  <span className="font-bold text-emerald-800 font-mono">
                    +{formatMMK(settlementBreakdown.grossCommissionMMK)}
                  </span>
                </div>
                {settlementBreakdown.totalBonusMMK > 0 && (
                  <div className="flex justify-between text-blue-700">
                    <span>{isMm ? 'ဘောနပ်စ် ပေါင်းငွေ:' : 'Bonus:'}</span>
                    <span className="font-bold font-mono">+{formatMMK(settlementBreakdown.totalBonusMMK)}</span>
                  </div>
                )}
                {settlementBreakdown.totalDeductionMMK > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>{isMm ? 'ဒဏ်ကြေး နုတ်ငွေ:' : 'Deductions:'}</span>
                    <span className="font-bold font-mono">-{formatMMK(settlementBreakdown.totalDeductionMMK)}</span>
                  </div>
                )}
                {settlementBreakdown.totalAdvanceMMK > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>{isMm ? 'ကြိုထုတ်ငွေ နုတ်ငွေ:' : 'Advances:'}</span>
                    <span className="font-bold font-mono">-{formatMMK(settlementBreakdown.totalAdvanceMMK)}</span>
                  </div>
                )}
                {settlementBreakdown.previousSettlementsMMK > 0 && (
                  <div className="flex justify-between text-purple-700">
                    <span>{isMm ? 'ယခင် ထုတ်ပေးပြီးငွေ:' : 'Previous Payments:'}</span>
                    <span className="font-bold font-mono">-{formatMMK(settlementBreakdown.previousSettlementsMMK)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-extrabold text-gray-900">
                  <span>{isMm ? 'အမှန်တကယ် ပေးရန်ကျန်ငွေ:' : 'NET PAYABLE:'}</span>
                  <span className="text-emerald-700 font-mono">{formatMMK(netPayable)}</span>
                </div>
              </div>

              {/* Settlement Type & Amount Selector */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800">{isMm ? 'ပေးချေမည့် ပမာဏ' : 'Payout Amount'}</span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPartialSettlement}
                        onChange={e => {
                          setIsPartialSettlement(e.target.checked);
                          if (!e.target.checked) setCustomPayAmount(netPayable);
                        }}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      {isMm ? 'အစိတ်ပိုင်း ပေးချေမည် (Partial)' : 'Partial Payment'}
                    </label>
                  </div>
                </div>

                {isPartialSettlement ? (
                  <div className="space-y-1">
                    <input
                      type="number"
                      min="0"
                      max={netPayable}
                      step="1000"
                      value={customPayAmount || ''}
                      onChange={e => setCustomPayAmount(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="Enter payout amount"
                      className="w-full rounded-xl border border-gray-300 bg-white p-2.5 text-base font-extrabold text-emerald-900 font-mono"
                    />
                    <div className="flex justify-between text-[11px] text-gray-600 font-mono">
                      <span>Paying: {formatMMK(payAmount)}</span>
                      <span>Remaining Balance: <strong className="text-amber-800">{formatMMK(remainingPayable)}</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-sm font-bold text-emerald-900 font-mono">
                    <span>Full Payout Amount:</span>
                    <span>{formatMMK(netPayable)}</span>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'ငွေပေးချေမှု နည်းလမ်း' : 'Payment Method'}
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: 'cash', label: 'Cash' },
                    { id: 'bank', label: 'Bank' },
                    { id: 'kpay', label: 'KBZ Pay' },
                    { id: 'wave', label: 'Wave' },
                    { id: 'other', label: 'Other' },
                  ].map(pm => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setSettlementPaymentMethod(pm.id as any)}
                      className={`rounded-xl border py-2 text-center text-[11px] font-bold ${
                        settlementPaymentMethod === pm.id
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'ရှင်းတမ်း မှတ်ချက်' : 'Notes'}
                </label>
                <input
                  type="text"
                  value={settlementNotes}
                  onChange={e => setSettlementNotes(e.target.value)}
                  placeholder="e.g. Weekly settlement payout"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={netPayable <= 0 || payAmount <= 0}
                onClick={handleConfirmSettlement}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{isMm ? 'ငွေပေးချေမှု အတည်ပြုမည်' : 'Approve & Pay Staff'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVERSAL MODAL */}
      {reversingSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-bold">
                <ShieldAlert className="h-5 w-5" />
                <h3>{isMm ? 'ရှင်းတမ်း ပြန်လည်ပယ်ဖျက်ခြင်း' : 'Reverse Staff Settlement'}</h3>
              </div>
              <button onClick={() => setReversingSettlement(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-600">
                You are about to reverse settlement <strong className="text-gray-900 font-mono">{reversingSettlement.settlementCode}</strong> for <strong>{reversingSettlement.staffName}</strong>.
              </p>
              <div className="rounded-xl bg-rose-50 p-3 border border-rose-100 space-y-1 font-mono text-rose-900">
                <div className="flex justify-between">
                  <span>Reversal Amount:</span>
                  <strong>{formatMMK(reversingSettlement.amountMMK || reversingSettlement.netPayoutMMK || 0)}</strong>
                </div>
                <div className="flex justify-between text-[11px] text-rose-700">
                  <span>Method:</span>
                  <span>{reversingSettlement.paymentMethod.toUpperCase()}</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-gray-800">
                  {isMm ? 'ပယ်ဖျက်ရသည့် အကြောင်းပြချက် (မဖြစ်မနေ)' : 'Mandatory Reversal Reason *'}
                </label>
                <input
                  type="text"
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  placeholder="e.g. Correction of incorrect commission rate or duplicate payment"
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 p-2.5 text-xs font-medium text-gray-900 focus:bg-white"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setReversingSettlement(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReversal}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 shadow-xs"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE SETTLEMENT VOUCHER MODAL */}
      {viewVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {isMm ? 'ဝန်ထမ်း ငွေရှင်းတမ်း ဘောက်ချာ' : 'Staff Settlement Voucher'}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </button>
                <button onClick={() => setViewVoucher(null)}>
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="border border-dashed border-gray-300 p-4 text-xs font-mono space-y-2">
              <div className="text-center">
                <h4 className="font-bold text-sm">SHWE THIRI SPA & KTV</h4>
                <p className="text-[10px] text-gray-500">STAFF COMMISSION SETTLEMENT VOUCHER</p>
                <div className="my-1 border-b border-dashed border-gray-300" />
              </div>

              <div className="flex justify-between">
                <span>Voucher #:</span>
                <span className="font-bold">{viewVoucher.settlementCode}</span>
              </div>
              <div className="flex justify-between">
                <span>Staff:</span>
                <span className="font-semibold">{viewVoucher.staffName}</span>
              </div>
              <div className="flex justify-between">
                <span>Period:</span>
                <span>{viewVoucher.periodStart} ~ {viewVoucher.periodEnd}</span>
              </div>
              <div className="flex justify-between">
                <span>Settlement Date:</span>
                <span>{viewVoucher.settlementDate || viewVoucher.paidAt.split('T')[0]}</span>
              </div>
              <div className="my-1 border-b border-dashed border-gray-300" />

              <div className="flex justify-between">
                <span>Gross Commissions:</span>
                <span>+{formatMMK(viewVoucher.grossCommissionMMK || viewVoucher.totalCommissionMMK || 0)}</span>
              </div>
              {viewVoucher.totalBonusMMK > 0 && (
                <div className="flex justify-between">
                  <span>Bonuses:</span>
                  <span>+{formatMMK(viewVoucher.totalBonusMMK)}</span>
                </div>
              )}
              {viewVoucher.totalAdvanceMMK || viewVoucher.totalAdvanceDeductedMMK ? (
                <div className="flex justify-between text-rose-600">
                  <span>Advances Deducted:</span>
                  <span>-{formatMMK(viewVoucher.totalAdvanceMMK || viewVoucher.totalAdvanceDeductedMMK || 0)}</span>
                </div>
              ) : null}
              {viewVoucher.totalDeductionMMK > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Penalties/Deductions:</span>
                  <span>-{formatMMK(viewVoucher.totalDeductionMMK)}</span>
                </div>
              )}
              {(viewVoucher.previousSettlementsMMK || 0) > 0 && (
                <div className="flex justify-between text-purple-700">
                  <span>Previous Settlements:</span>
                  <span>-{formatMMK(viewVoucher.previousSettlementsMMK || 0)}</span>
                </div>
              )}
              <div className="my-1 border-b border-dashed border-gray-300" />

              <div className="flex justify-between font-bold text-sm">
                <span>AMOUNT PAID:</span>
                <span>{formatMMK(viewVoucher.amountMMK || viewVoucher.netPayoutMMK || 0)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Remaining Balance:</span>
                <span>{formatMMK(viewVoucher.remainingPayableMMK || 0)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 pt-2 border-t border-dashed border-gray-200">
                <span>Method: {viewVoucher.paymentMethod.toUpperCase()}</span>
                <span>Approved by: {viewVoucher.paidBy}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD SHIFT SCHEDULE MODAL */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">{isMm ? 'ဝန်ထမ်း အချိန်ဇယား သတ်မှတ်ရန်' : 'Add Shift Schedule'}</h3>
              <button onClick={() => setIsScheduleModalOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-gray-700">{isMm ? 'ဝန်ထမ်း' : 'Staff Member'}</label>
                <select
                  value={schedStaffId}
                  onChange={e => setSchedStaffId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 bg-white"
                >
                  {staff.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-bold text-gray-700">{isMm ? 'ရက်စွဲ' : 'Date'}</label>
                  <input
                    type="date"
                    value={schedDate}
                    onChange={e => setSchedDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-2 font-mono text-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-gray-700">{isMm ? 'အခြေအနေ' : 'Status'}</label>
                  <select
                    value={schedStatus}
                    onChange={e => setSchedStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-gray-200 p-2 font-medium text-gray-900 bg-white"
                  >
                    <option value="working">Working</option>
                    <option value="off">Off</option>
                    <option value="leave">Leave</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-bold text-gray-700">{isMm ? 'စတင်ချိန်' : 'Start Time'}</label>
                  <input
                    type="time"
                    value={schedStartTime}
                    onChange={e => setSchedStartTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-2 font-mono text-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-gray-700">{isMm ? 'ပြီးဆုံးချိန်' : 'End Time'}</label>
                  <input
                    type="time"
                    value={schedEndTime}
                    onChange={e => setSchedEndTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-2 font-mono text-gray-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-bold text-gray-700">{isMm ? 'အနားယူစတင်' : 'Break Start'}</label>
                  <input
                    type="time"
                    value={schedBreakStart}
                    onChange={e => setSchedBreakStart(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-2 font-mono text-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-gray-700">{isMm ? 'အနားယူပြီးဆုံး' : 'Break End'}</label>
                  <input
                    type="time"
                    value={schedBreakEnd}
                    onChange={e => setSchedBreakEnd(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-2 font-mono text-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-bold text-gray-700">{isMm ? 'မှတ်ချက်' : 'Notes'}</label>
                <input
                  type="text"
                  value={schedNotes}
                  onChange={e => setSchedNotes(e.target.value)}
                  placeholder="Optional shift notes..."
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-gray-900"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSchedule}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD ATTENDANCE MODAL */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">{isMm ? 'တက်ရောက်မှု မှတ်တမ်းတင်ရန်' : 'Record Attendance Timecard'}</h3>
              <button onClick={() => setIsAttendanceModalOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-gray-700">{isMm ? 'ဝန်ထမ်း' : 'Staff Member'}</label>
                <select
                  value={attStaffId}
                  onChange={e => setAttStaffId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 font-medium text-gray-900 bg-white"
                >
                  {staff.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-bold text-gray-700">{isMm ? 'ရက်စွဲ' : 'Date'}</label>
                  <input
                    type="date"
                    value={attDate}
                    onChange={e => setAttDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-2 font-mono text-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-gray-700">{isMm ? 'အခြေအနေ' : 'Status'}</label>
                  <select
                    value={attStatus}
                    onChange={e => setAttStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-gray-200 p-2 font-medium text-gray-900 bg-white"
                  >
                    <option value="checked_in">Checked In</option>
                    <option value="checked_out">Checked Out</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-bold text-gray-700">{isMm ? 'ဝင်ချိန် (Check-In)' : 'Check-In Time'}</label>
                  <input
                    type="time"
                    value={attCheckInTime}
                    onChange={e => setAttCheckInTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-2 font-mono text-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-gray-700">{isMm ? 'ထွက်ချိန် (Check-Out)' : 'Check-Out Time'}</label>
                  <input
                    type="time"
                    value={attCheckOutTime}
                    onChange={e => setAttCheckOutTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-2 font-mono text-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-bold text-gray-700">{isMm ? 'မှတ်ချက်' : 'Notes'}</label>
                <input
                  type="text"
                  value={attNotes}
                  onChange={e => setAttNotes(e.target.value)}
                  placeholder="Optional punctuality or attendance notes..."
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-gray-900"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setIsAttendanceModalOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAttendance}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
              >
                Save Attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
