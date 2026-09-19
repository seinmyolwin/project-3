import React, { useState, useEffect, useMemo } from 'react';
import {
  Room,
  SessionRecord,
  StaffMember,
  ServiceItem,
  ProductItem,
  Customer,
  UserAccount,
  PaymentMethod,
  PaymentRecord,
  SessionOrderItem,
  Invoice,
  InvoiceItem,
  SessionStaffAssignment,
  SessionPricingRuleType,
} from '../../types';
import { db } from '../../db/database';
import {
  formatMMK,
  calculateDurationMinutes,
  calculateSessionPricing,
  calculateSessionRunningEstimate,
  calculateExtensionPricing,
  calculateInvoiceTotals,
  calculatePaymentChange,
  calculateStaffCommission,
} from '../../domain/financial';
import { Language } from '../../utils/translations';
import {
  Play,
  Clock,
  UserCheck,
  Plus,
  ShoppingBag,
  Sparkles,
  AlertCircle,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronRight,
  Printer,
  Trash2,
  Calendar,
  Search,
  CheckCircle2,
  Users,
  Timer,
  Maximize2,
  RefreshCw,
  FileText,
  DollarSign,
  Flame,
  ArrowUpRight,
  UserX,
  Info,
} from 'lucide-react';

interface RoomsViewProps {
  rooms: Room[];
  sessions: SessionRecord[];
  staff: StaffMember[];
  services: ServiceItem[];
  products: ProductItem[];
  customers: Customer[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
  onShowReceipt: (invoice: Invoice) => void;
}

type TabMode = 'rooms' | 'history';
type RoomFilter = 'all' | 'available' | 'occupied' | 'cleaning' | 'maintenance';

export const RoomsView: React.FC<RoomsViewProps> = ({
  rooms,
  sessions,
  staff,
  services,
  products,
  customers,
  currentUser,
  lang,
  onRefresh,
  onShowReceipt,
}) => {
  const isMm = lang === 'my';

  // Live timer tick every 5 seconds for smooth timestamp calculation
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  // View Navigation & Filters
  const [tabMode, setTabMode] = useState<TabMode>('rooms');
  const [roomFilter, setRoomFilter] = useState<RoomFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all');

  // Modal States
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [selectedRoomForStart, setSelectedRoomForStart] = useState<Room | null>(null);

  // Active Session Drawer State
  const [activeSessionDetail, setActiveSessionDetail] = useState<SessionRecord | null>(null);

  // Checkout Modal State
  const [checkoutSession, setCheckoutSession] = useState<SessionRecord | null>(null);

  // Extend Session State
  const [extendSessionModal, setExtendSessionModal] = useState<SessionRecord | null>(null);
  const [extendMinutes, setExtendMinutes] = useState<number>(30);
  const [extendCustomPrice, setExtendCustomPrice] = useState<number | ''>('');
  const [extendReason, setExtendReason] = useState<string>('');

  // Reassign Staff State
  const [reassignStaffModal, setReassignStaffModal] = useState<SessionRecord | null>(null);
  const [reassignStaffIds, setReassignStaffIds] = useState<string[]>([]);
  const [reassignReason, setReassignReason] = useState<string>('');

  // Cancel Session State
  const [cancelSessionModal, setCancelSessionModal] = useState<SessionRecord | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Void Session State
  const [voidSessionModal, setVoidSessionModal] = useState<SessionRecord | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');

  // Add Product to Session State
  const [orderProductModalSession, setOrderProductModalSession] = useState<SessionRecord | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [orderQty, setOrderQty] = useState<number>(1);

  // Start Session Form State
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer (ဧည့်သည်)');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [plannedDurationMinutes, setPlannedDurationMinutes] = useState<number>(60);
  const [pricingRule, setPricingRule] = useState<SessionPricingRuleType>('duration_based');
  const [customBasePrice, setCustomBasePrice] = useState<number | ''>('');
  const [sessionNotes, setSessionNotes] = useState<string>('');

  // Checkout Form State
  const [actualDuration, setActualDuration] = useState<number>(60);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [tenderedCash, setTenderedCash] = useState<number>(0);
  const [paymentReference, setPaymentReference] = useState<string>('');

  // History Filter
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Metrics Calculation
  const metrics = useMemo(() => {
    const totalRooms = rooms.length;
    const availableRooms = rooms.filter(r => r.status === 'available').length;
    const activeSessions = sessions.filter(
      s => s.status === 'active' || s.status === 'started' || s.status === 'extended'
    );
    const occupiedRooms = activeSessions.length;
    const cleaningRooms = rooms.filter(r => r.status === 'cleaning').length;
    const maintenanceRooms = rooms.filter(r => r.status === 'maintenance').length;

    let overtimeCount = 0;
    let totalRunningRevenue = 0;

    activeSessions.forEach(ses => {
      const room = rooms.find(r => r.id === ses.roomId);
      const est = calculateSessionRunningEstimate(ses, room?.hourlyRateMMK || 0);
      if (est.isOvertime) overtimeCount++;
      totalRunningRevenue += est.totalEstimatedMMK;
    });

    return {
      totalRooms,
      availableRooms,
      occupiedRooms,
      cleaningRooms,
      maintenanceRooms,
      overtimeCount,
      totalRunningRevenue,
    };
  }, [rooms, sessions]);

  // Handle Opening Start Session Modal
  const handleOpenStart = (room?: Room) => {
    const targetRoom = room || rooms.find(r => r.status === 'available') || rooms[0];
    setSelectedRoomForStart(targetRoom || null);
    setSelectedRoomId(targetRoom ? targetRoom.id : (rooms[0]?.id || ''));
    
    const initialService = services[0];
    setSelectedServiceId(initialService?.id || '');
    setPlannedDurationMinutes(initialService?.durationMinutes || 60);
    setPricingRule('duration_based');
    setCustomBasePrice('');

    const availableStaff = staff.filter(s => s.status === 'available');
    setSelectedStaffIds(availableStaff.length > 0 ? [availableStaff[0].id] : []);
    setCustomerName('Walk-in Customer (ဧည့်သည်)');
    setCustomerPhone('');
    setSelectedCustomerId('');
    setSessionNotes('');
    setIsStartModalOpen(true);
  };

  // Submit Start Session
  const handleConfirmStartSession = async () => {
    if (!selectedRoomId || !selectedServiceId || selectedStaffIds.length === 0) {
      alert(isMm ? 'ကျေးဇူးပြု၍ အခန်း၊ ဝန်ဆောင်မှုနှင့် အနည်းဆုံး ဝန်ထမ်း ၁ ဦး ရွေးချယ်ပါ' : 'Please select room, service and at least one staff member');
      return;
    }

    const room = rooms.find(r => r.id === selectedRoomId);
    const service = services.find(s => s.id === selectedServiceId);
    if (!room || !service) return;

    const basePrice = customBasePrice !== '' ? Number(customBasePrice) : service.priceMMK;

    // Build assigned staff snapshots
    const assignedStaff: SessionStaffAssignment[] = selectedStaffIds.map(stfId => {
      const s = staff.find(x => x.id === stfId);
      const rule = s?.customServiceCommissions?.[service.id] || s?.defaultCommissionRule || service.defaultCommissionRule;
      return {
        staffId: stfId,
        staffName: s?.name || 'Staff',
        staffRole: s?.role || 'therapist',
        commissionType: rule.type,
        commissionRate: rule.value,
        commissionAmountMMK: 0, // snapshot calculated at checkout
      };
    });

    try {
      await db.startSessionTransaction({
        session: {
          roomId: room.id,
          roomName: isMm ? room.nameMm : room.name,
          customerId: selectedCustomerId || undefined,
          customerName: customerName.trim() || 'Walk-in Customer (ဧည့်သည်)',
          customerPhone: customerPhone.trim() || undefined,
          serviceId: service.id,
          serviceName: (isMm && service.nameMm) ? service.nameMm : service.name,
          pricingRule,
          priceSnapshot: {
            pricingRule,
            basePriceMMK: basePrice,
            hourlyRateMMK: room.hourlyRateMMK || 0,
            roomSurchargeMMK: room.surchargeMMK || 0,
            specialPriceMMK: customBasePrice !== '' ? Number(customBasePrice) : undefined,
          },
          basePriceMMK: basePrice,
          roomSurchargeMMK: room.surchargeMMK || 0,
          plannedDurationMinutes: plannedDurationMinutes || service.durationMinutes,
          actualDurationMinutes: 0,
          startTime: new Date().toISOString(),
          status: 'active',
          assignedStaff,
          extensions: [],
          orderItems: [],
          notes: sessionNotes.trim() || undefined,
        },
        currentUser,
      });

      setIsStartModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert('Error starting session: ' + err.message);
    }
  };

  // Handle Extend Session
  const handleConfirmExtend = async () => {
    if (!extendSessionModal || extendMinutes <= 0) return;

    const room = rooms.find(r => r.id === extendSessionModal.roomId);
    const calculatedPrice = calculateExtensionPricing({
      extendedMinutes: extendMinutes,
      baseServicePriceMMK: extendSessionModal.basePriceMMK,
      plannedMinutes: extendSessionModal.plannedDurationMinutes,
      hourlyRateMMK: room?.hourlyRateMMK,
      customPriceMMK: extendCustomPrice !== '' ? Number(extendCustomPrice) : undefined,
    });

    try {
      await db.extendSessionTransaction({
        sessionId: extendSessionModal.id,
        extendedMinutes: extendMinutes,
        extensionPriceMMK: calculatedPrice,
        reason: extendReason.trim() || undefined,
        currentUser,
      });

      setExtendSessionModal(null);
      setExtendMinutes(30);
      setExtendCustomPrice('');
      setExtendReason('');
      onRefresh();
    } catch (err: any) {
      alert('Error extending session: ' + err.message);
    }
  };

  // Handle Reassign Staff
  const handleConfirmReassignStaff = async () => {
    if (!reassignStaffModal || reassignStaffIds.length === 0) {
      alert(isMm ? 'အနည်းဆုံး ဝန်ထမ်း ၁ ဦး ရွေးချယ်ပေးပါ' : 'Please select at least one staff member');
      return;
    }

    const service = services.find(s => s.id === reassignStaffModal.serviceId);

    const newAssignedStaff: SessionStaffAssignment[] = reassignStaffIds.map(stfId => {
      const s = staff.find(x => x.id === stfId);
      const rule = s?.customServiceCommissions?.[reassignStaffModal.serviceId] ||
        s?.defaultCommissionRule ||
        service?.defaultCommissionRule || { type: 'percentage', value: 30 };
      return {
        staffId: stfId,
        staffName: s?.name || 'Staff',
        staffRole: s?.role || 'therapist',
        commissionType: rule.type,
        commissionRate: rule.value,
        commissionAmountMMK: 0,
      };
    });

    try {
      await db.changeSessionStaffTransaction({
        sessionId: reassignStaffModal.id,
        newAssignedStaff,
        reason: reassignReason.trim() || undefined,
        currentUser,
      });

      setReassignStaffModal(null);
      setReassignStaffIds([]);
      setReassignReason('');
      onRefresh();
    } catch (err: any) {
      alert('Error changing staff: ' + err.message);
    }
  };

  // Handle Soft Cancel Session
  const handleConfirmCancel = async () => {
    if (!cancelSessionModal) return;
    if (!cancelReason.trim()) {
      alert(isMm ? 'ကျေးဇူးပြု၍ ပယ်ဖျက်ရသည့် အကြောင်းပြချက် ထည့်ပါ' : 'Please provide a cancellation reason');
      return;
    }

    try {
      await db.cancelSessionTransaction({
        sessionId: cancelSessionModal.id,
        reason: cancelReason.trim(),
        currentUser,
      });

      setCancelSessionModal(null);
      setCancelReason('');
      setActiveSessionDetail(null);
      onRefresh();
    } catch (err: any) {
      alert('Error cancelling session: ' + err.message);
    }
  };

  // Handle Void Session
  const handleConfirmVoid = async () => {
    if (!voidSessionModal) return;
    if (!voidReason.trim()) {
      alert(isMm ? 'ကျေးဇူးပြု၍ ဖျက်သိမ်းရသည့် အကြောင်းပြချက် ရေးပါ' : 'Please provide a void reason');
      return;
    }

    try {
      await db.voidSessionTransaction({
        sessionId: voidSessionModal.id,
        reason: voidReason.trim(),
        currentUser,
      });
      setVoidSessionModal(null);
      setVoidReason('');
      setActiveSessionDetail(null);
      onRefresh();
    } catch (err: any) {
      alert('Error voiding session: ' + err.message);
    }
  };

  // Handle Mark Cleaning Finished
  const handleMarkReady = async (roomId: string) => {
    await db.rooms.update(roomId, { status: 'available' });
    onRefresh();
  };

  // Open Checkout for a session
  const handleOpenCheckout = (session: SessionRecord) => {
    const elapsed = calculateDurationMinutes(session.startTime);
    const extensionsDuration = (session.extensions || []).reduce((sum, ext) => sum + ext.extendedMinutes, 0);
    const totalPlanned = session.plannedDurationMinutes + extensionsDuration;
    
    // Suggest elapsed or planned, whichever is higher
    const durationToBill = Math.max(totalPlanned, elapsed);
    setActualDuration(durationToBill);
    setDiscountValue(0);
    setPaymentMethod('cash');
    setPaymentReference('');

    const room = rooms.find(r => r.id === session.roomId);
    const totalExtensionsMMK = (session.extensions || []).reduce((sum, ext) => sum + ext.extensionPriceMMK, 0);
    const pricing = calculateSessionPricing({
      basePriceMMK: session.basePriceMMK,
      roomSurchargeMMK: session.roomSurchargeMMK,
      plannedMinutes: session.plannedDurationMinutes,
      actualMinutes: durationToBill,
      hourlyRateMMK: room?.hourlyRateMMK || 0,
      extensionsTotalMMK: totalExtensionsMMK,
      pricingRule: session.pricingRule,
    });

    const ordersTotal = (session.orderItems || []).reduce((sum, o) => sum + o.totalPriceMMK, 0);
    const estTotal = pricing.totalServicePriceMMK + ordersTotal;
    setTenderedCash(estTotal);

    setCheckoutSession(session);
    setActiveSessionDetail(null);
  };

  // Submit Checkout
  const handleConfirmCheckout = async () => {
    if (!checkoutSession) return;

    try {
      const room = rooms.find(r => r.id === checkoutSession.roomId);
      const totalExtensionsMMK = (checkoutSession.extensions || []).reduce(
        (sum, ext) => sum + ext.extensionPriceMMK,
        0
      );

      const pricing = calculateSessionPricing({
        basePriceMMK: checkoutSession.basePriceMMK,
        roomSurchargeMMK: checkoutSession.roomSurchargeMMK,
        plannedMinutes: checkoutSession.plannedDurationMinutes,
        actualMinutes: actualDuration,
        hourlyRateMMK: room?.hourlyRateMMK || 0,
        extensionsTotalMMK: totalExtensionsMMK,
        pricingRule: checkoutSession.pricingRule,
      });

      const invoiceItems: InvoiceItem[] = [
        {
          type: 'service' as const,
          description: `${checkoutSession.serviceName} (${actualDuration} mins)`,
          quantity: 1,
          unitPriceMMK: pricing.basePriceMMK,
          totalPriceMMK: pricing.basePriceMMK,
        },
      ];

      if (checkoutSession.extensions && checkoutSession.extensions.length > 0) {
        for (const ext of checkoutSession.extensions) {
          if (ext.extensionPriceMMK > 0) {
            invoiceItems.push({
              type: 'service' as const,
              description: `Time Extension (+${ext.extendedMinutes} mins${ext.reason ? ` - ${ext.reason}` : ''})`,
              quantity: 1,
              unitPriceMMK: ext.extensionPriceMMK,
              totalPriceMMK: ext.extensionPriceMMK,
            });
          }
        }
      }

      if (pricing.roomSurchargeMMK > 0) {
        invoiceItems.push({
          type: 'surcharge' as const,
          description: `Room Surcharge (${checkoutSession.roomName})`,
          quantity: 1,
          unitPriceMMK: pricing.roomSurchargeMMK,
          totalPriceMMK: pricing.roomSurchargeMMK,
        });
      }

      if (pricing.overtimeFeeMMK > 0) {
        invoiceItems.push({
          type: 'room_time' as const,
          description: `Overtime Service (${pricing.overtimeMinutes} mins)`,
          quantity: 1,
          unitPriceMMK: pricing.overtimeFeeMMK,
          totalPriceMMK: pricing.overtimeFeeMMK,
        });
      }

      for (const ord of checkoutSession.orderItems || []) {
        invoiceItems.push({
          type: 'product' as const,
          description: ord.name,
          quantity: ord.quantity,
          unitPriceMMK: ord.unitPriceMMK,
          costPriceMMK: ord.costPriceMMK,
          totalPriceMMK: ord.totalPriceMMK,
        });
      }

      const invTotals = calculateInvoiceTotals({
        items: invoiceItems,
        discountType,
        discountValue,
      });

      const payments: PaymentRecord[] = [];
      if (paymentMethod === 'cash') {
        const changeInfo = calculatePaymentChange(invTotals.totalMMK, tenderedCash);
        payments.push({
          id: 'pay_' + Date.now(),
          method: 'cash',
          amountMMK: invTotals.totalMMK,
          tenderedMMK: tenderedCash,
          changeMMK: changeInfo.changeMMK,
        });
      } else if (paymentMethod === 'credit') {
        payments.push({
          id: 'pay_' + Date.now(),
          method: 'credit',
          amountMMK: invTotals.totalMMK,
          notes: 'Customer debt account (အကြွေးစာရင်း)',
        });
      } else {
        payments.push({
          id: 'pay_' + Date.now(),
          method: paymentMethod,
          amountMMK: invTotals.totalMMK,
          referenceNo: paymentReference.trim() || undefined,
        });
      }

      const result = await db.checkoutSessionTransaction({
        sessionId: checkoutSession.id,
        actualDurationMinutes: actualDuration,
        payments,
        discountType,
        discountValue,
        currentUser,
      });

      setCheckoutSession(null);
      onRefresh();
      onShowReceipt(result.invoice);
    } catch (err: any) {
      alert('Checkout error: ' + err.message);
    }
  };

  // Add Product to Session
  const handleAddProductToSession = async () => {
    if (!orderProductModalSession || !selectedProductId || orderQty <= 0) return;
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    try {
      const orderItem: SessionOrderItem = {
        productId: prod.id,
        name: isMm && prod.nameMm ? prod.nameMm : prod.name,
        unitPriceMMK: prod.sellingPriceMMK,
        costPriceMMK: prod.costPriceMMK,
        quantity: orderQty,
        totalPriceMMK: prod.sellingPriceMMK * orderQty,
        addedAt: new Date().toISOString(),
      };

      await db.addOrderToSessionTransaction({
        sessionId: orderProductModalSession.id,
        items: [orderItem],
        currentUser,
      });

      setOrderProductModalSession(null);
      setSelectedProductId('');
      setOrderQty(1);
      onRefresh();
    } catch (err: any) {
      alert('Error adding order: ' + err.message);
    }
  };

  // Filtered Rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(r => {
      if (roomFilter === 'available' && r.status !== 'available') return false;
      if (roomFilter === 'occupied' && r.status !== 'occupied') return false;
      if (roomFilter === 'cleaning' && r.status !== 'cleaning') return false;
      if (roomFilter === 'maintenance' && r.status !== 'maintenance') return false;
      if (selectedRoomType !== 'all' && r.type !== selectedRoomType) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const active = sessions.find(s => s.roomId === r.id && (s.status === 'active' || s.status === 'extended'));
        const matchName = r.name.toLowerCase().includes(q) || (r.nameMm && r.nameMm.includes(q));
        const matchCustomer = active && active.customerName.toLowerCase().includes(q);
        const matchStaff = active && active.assignedStaff.some(st => st.staffName.toLowerCase().includes(q));
        const matchCode = active && active.sessionCode.toLowerCase().includes(q);
        return matchName || matchCustomer || matchStaff || matchCode;
      }

      return true;
    });
  }, [rooms, sessions, roomFilter, selectedRoomType, searchQuery]);

  // Filtered History
  const filteredHistorySessions = useMemo(() => {
    return sessions
      .filter(s => {
        if (s.status === 'active' || s.status === 'started' || s.status === 'extended') return false;
        if (historyStatusFilter !== 'all' && s.status !== historyStatusFilter) return false;
        if (historySearchQuery.trim()) {
          const q = historySearchQuery.toLowerCase();
          return (
            s.sessionCode.toLowerCase().includes(q) ||
            s.customerName.toLowerCase().includes(q) ||
            s.roomName.toLowerCase().includes(q) ||
            s.serviceName.toLowerCase().includes(q) ||
            s.assignedStaff.some(st => st.staffName.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sessions, historyStatusFilter, historySearchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Header & View Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">
              {isMm ? 'ဆက်ရှင်နှင့် အခန်း စီမံခန့်ခွဲမှု' : 'Session & Room Operations'}
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              {isMm
                ? 'အချိန်နှင့်တပြေးညီ အခန်းအခြေအနေ၊ ကြာချိန်၊ ကော်မရှင်နှင့် ငွေရှင်းလွှာ'
                : 'Real-time room occupancy, live timers, staff commissions & instant checkout'}
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-2xl bg-gray-100 p-1 border border-gray-200/60">
            <button
              onClick={() => setTabMode('rooms')}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                tabMode === 'rooms'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>{isMm ? 'လက်ရှိ အခန်းများ' : 'Active Rooms'}</span>
            </button>
            <button
              onClick={() => setTabMode('history')}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                tabMode === 'history'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>{isMm ? 'ဆက်ရှင် မှတ်တမ်း' : 'Session History'}</span>
            </button>
          </div>

          <button
            onClick={() => handleOpenStart()}
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 transition-all"
          >
            <Play className="h-4 w-4 fill-white" />
            <span>{isMm ? 'ဧည့်သည် ဆက်ရှင်စတင်မည်' : 'Check-in & Start'}</span>
          </button>
        </div>
      </div>

      {/* Real-time KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">{isMm ? 'စုစုပေါင်း အခန်း' : 'Total Rooms'}</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100 text-gray-700 text-xs font-bold">
              {metrics.totalRooms}
            </span>
          </div>
          <p className="mt-2 text-xl font-black text-gray-900">{metrics.totalRooms}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">{isMm ? 'အားနေသော အခန်း' : 'Available'}</span>
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-200" />
          </div>
          <p className="mt-2 text-xl font-black text-emerald-950">{metrics.availableRooms}</p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800">{isMm ? 'အသုံးပြုနေဆဲ' : 'In Service'}</span>
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-amber-200" />
          </div>
          <p className="mt-2 text-xl font-black text-amber-950">{metrics.occupiedRooms}</p>
        </div>

        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800">{isMm ? 'အချိန်လွန်နေသည်' : 'Overtime Alert'}</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-xl font-black text-rose-950">{metrics.overtimeCount}</p>
        </div>

        <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800">{isMm ? 'သန့်ရှင်းရေး' : 'Cleaning / Prep'}</span>
            <Sparkles className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-xl font-black text-blue-950">{metrics.cleaningRooms}</p>
        </div>

        <div className="rounded-2xl border border-emerald-300 bg-linear-to-br from-emerald-900 to-teal-950 p-3.5 text-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-200">{isMm ? 'ခန့်မှန်းရငွေ' : 'Running Value'}</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-base font-black truncate">{formatMMK(metrics.totalRunningRevenue)}</p>
        </div>
      </div>

      {tabMode === 'rooms' ? (
        <>
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-200/80 shadow-xs">
            {/* Status Pills */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: isMm ? 'အားလုံး' : 'All Rooms' },
                { id: 'available', label: isMm ? 'အားနေသည်' : 'Available' },
                { id: 'occupied', label: isMm ? 'အသုံးပြုနေသည်' : 'In Service' },
                { id: 'cleaning', label: isMm ? 'သန့်ရှင်းရေး' : 'Cleaning' },
                { id: 'maintenance', label: isMm ? 'ပြင်ဆင်ဆဲ' : 'Maintenance' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setRoomFilter(f.id as RoomFilter)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    roomFilter === f.id
                      ? 'bg-gray-900 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px] max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isMm ? 'အခန်း၊ ဧည့်သည်၊ ဝန်ထမ်း ရှာရန်...' : 'Search room, customer, staff...'}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/80 pl-9 pr-3 py-1.5 text-xs text-gray-900 focus:border-emerald-600 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredRooms.map(room => {
              const activeSession = sessions.find(
                s =>
                  s.roomId === room.id &&
                  (s.status === 'active' || s.status === 'started' || s.status === 'extended')
              );

              const runningEstimate = activeSession
                ? calculateSessionRunningEstimate(activeSession, room.hourlyRateMMK || 0)
                : null;

              const elapsedMins = runningEstimate ? runningEstimate.elapsedMinutes : 0;
              const totalPlannedMins = runningEstimate ? runningEstimate.totalPlannedMinutes : 60;
              const isOvertime = runningEstimate ? runningEstimate.isOvertime : false;

              // Progress percentage
              const progressPct = Math.min(100, Math.round((elapsedMins / Math.max(1, totalPlannedMins)) * 100));

              let statusBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
              let statusLabel = isMm ? 'အဆင်သင့်ရှိ' : 'Available';

              if (room.status === 'occupied' || activeSession) {
                if (isOvertime) {
                  statusBadgeColor = 'bg-rose-100 text-rose-900 border-rose-300 animate-pulse';
                  statusLabel = isMm ? 'အချိန်လွန်နေသည်' : 'Overtime';
                } else if (activeSession?.status === 'extended') {
                  statusBadgeColor = 'bg-purple-100 text-purple-900 border-purple-300';
                  statusLabel = isMm ? 'အချိန်တိုးထားသည်' : 'Extended';
                } else {
                  statusBadgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
                  statusLabel = isMm ? 'အသုံးပြုနေဆဲ' : 'In Service';
                }
              } else if (room.status === 'cleaning') {
                statusBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
                statusLabel = isMm ? 'သန့်ရှင်းရေး' : 'Cleaning';
              } else if (room.status === 'maintenance') {
                statusBadgeColor = 'bg-gray-100 text-gray-700 border-gray-300';
                statusLabel = isMm ? 'ပြင်ဆင်ဆဲ' : 'Maintenance';
              }

              return (
                <div
                  key={room.id}
                  className={`flex flex-col justify-between rounded-3xl border bg-white p-4.5 shadow-xs transition-all hover:shadow-md ${
                    room.status === 'occupied' || activeSession
                      ? isOvertime
                        ? 'border-rose-300 ring-2 ring-rose-400/20'
                        : 'border-amber-300 ring-2 ring-amber-400/20'
                      : 'border-gray-200/90'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {room.type.replace('_', ' ')} {room.surchargeMMK ? `(+${formatMMK(room.surchargeMMK)})` : ''}
                        </span>
                        <h3 className="text-base font-black text-gray-900">
                          {isMm ? room.nameMm : room.name}
                        </h3>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadgeColor}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {statusLabel}
                      </span>
                    </div>

                    {/* Active Session Content */}
                    {activeSession && runningEstimate ? (
                      <div className="mt-3 space-y-3">
                        {/* Session code & Customer info */}
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <span className="text-[11px] font-mono font-bold text-gray-500">
                              {activeSession.sessionCode}
                            </span>
                            <p className="truncate text-xs font-bold text-gray-900">
                              {activeSession.customerName}
                            </p>
                          </div>
                          <button
                            onClick={() => setActiveSessionDetail(activeSession)}
                            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            title="View Full Detail"
                          >
                            <Maximize2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Service Name & Extensions Badge */}
                        <div className="rounded-xl bg-gray-50 p-2.5 border border-gray-100 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-gray-900 truncate">
                              {activeSession.serviceName}
                            </span>
                            <span className="font-semibold text-gray-600">
                              {totalPlannedMins}m
                            </span>
                          </div>

                          {/* Live Timer Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-medium text-gray-500">
                              <span className="flex items-center gap-1 font-mono font-bold text-gray-800">
                                <Clock className="h-3 w-3 text-emerald-600" />
                                {elapsedMins} mins elapsed
                              </span>
                              <span className={isOvertime ? 'font-bold text-rose-600' : 'text-gray-500'}>
                                {isOvertime
                                  ? `+${runningEstimate.overtimeMinutes}m OT`
                                  : `${Math.max(0, totalPlannedMins - elapsedMins)}m left`}
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  isOvertime
                                    ? 'bg-rose-500'
                                    : progressPct > 80
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, progressPct)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Assigned Staff */}
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <div className="flex items-center gap-1 truncate">
                            <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate font-semibold">
                              {activeSession.assignedStaff.map(s => s.staffName).join(', ')}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setReassignStaffModal(activeSession);
                              setReassignStaffIds(activeSession.assignedStaff.map(s => s.staffId));
                              setReassignReason('');
                            }}
                            className="text-[10px] font-bold text-emerald-700 hover:underline shrink-0"
                          >
                            {isMm ? 'ဝန်ထမ်းပြောင်း' : 'Change'}
                          </button>
                        </div>

                        {/* Running Estimate Live Bar */}
                        <div className="flex items-center justify-between rounded-xl bg-emerald-50/80 px-2.5 py-1.5 border border-emerald-200/60 text-xs">
                          <span className="font-semibold text-emerald-900">
                            {isMm ? 'လက်ရှိကျသင့်ငွေ:' : 'Running Total:'}
                          </span>
                          <span className="font-black text-emerald-950">
                            {formatMMK(runningEstimate.totalEstimatedMMK)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="my-8 text-center text-xs text-gray-400">
                        {room.status === 'cleaning' ? (
                          <div className="space-y-1">
                            <Sparkles className="mx-auto h-6 w-6 text-blue-500" />
                            <p className="font-semibold text-blue-700">
                              {isMm ? 'သန့်ရှင်းရေး ပြုလုပ်နေသည်' : 'Being cleaned / Sanitized'}
                            </p>
                          </div>
                        ) : room.status === 'maintenance' ? (
                          <div className="space-y-1">
                            <AlertCircle className="mx-auto h-6 w-6 text-gray-400" />
                            <p className="font-semibold text-gray-600">
                              {isMm ? 'ပြုပြင်ထိန်းသိမ်းနေသည်' : 'Under Maintenance'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500" />
                            <p className="font-semibold text-gray-700">
                              {isMm ? 'ဧည့်သည် လက်ခံရန် အသင့်ရှိသည်' : 'Ready for Next Customer'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    {activeSession ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => {
                              setExtendSessionModal(activeSession);
                              setExtendMinutes(30);
                              setExtendCustomPrice('');
                              setExtendReason('');
                            }}
                            className="flex items-center justify-center gap-1 rounded-xl border border-purple-200 bg-purple-50 py-1.5 text-xs font-bold text-purple-800 hover:bg-purple-100"
                            title="Extend session duration"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>{isMm ? 'အချိန်တိုး' : '+Extend'}</span>
                          </button>

                          <button
                            onClick={() => setOrderProductModalSession(activeSession)}
                            className="flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-gray-50 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                            title="Add food or drinks"
                          >
                            <ShoppingBag className="h-3.5 w-3.5 text-emerald-600" />
                            <span>{isMm ? 'အချိုရည်' : '+Order'}</span>
                          </button>
                        </div>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleOpenCheckout(activeSession)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800"
                          >
                            <Banknote className="h-4 w-4" />
                            <span>{isMm ? 'ငွေရှင်းမည်' : 'Checkout & Bill'}</span>
                          </button>

                          <button
                            onClick={() => {
                              setCancelSessionModal(activeSession);
                              setCancelReason('');
                            }}
                            className="rounded-xl border border-gray-200 p-2 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Cancel Session"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : room.status === 'cleaning' ? (
                      <button
                        onClick={() => handleMarkReady(room.id)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>{isMm ? 'သန့်ရှင်းရေးပြီးပြီ (အသင့်ဖွင့်မည်)' : 'Mark Ready / Available'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenStart(room)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gray-900 py-2.5 text-xs font-bold text-white hover:bg-black shadow-xs"
                      >
                        <Play className="h-4 w-4 fill-white" />
                        <span>{isMm ? 'ဧည့်သည် နေရာချမည်' : 'Check-in Customer'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* HISTORY TAB */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="flex flex-wrap gap-2">
              {['all', 'completed', 'cancelled', 'voided'].map(st => (
                <button
                  key={st}
                  onClick={() => setHistoryStatusFilter(st)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition-all ${
                    historyStatusFilter === st
                      ? 'bg-gray-900 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={historySearchQuery}
                onChange={e => setHistorySearchQuery(e.target.value)}
                placeholder={isMm ? 'ကုဒ်၊ ဧည့်သည်၊ အခန်း ရှာရန်...' : 'Search code, customer, room...'}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-1.5 text-xs text-gray-900 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">{isMm ? 'ဆက်ရှင် ကုဒ်' : 'Code'}</th>
                  <th className="px-4 py-3">{isMm ? 'အခန်း / နေရာ' : 'Room'}</th>
                  <th className="px-4 py-3">{isMm ? 'ဧည့်သည်' : 'Customer'}</th>
                  <th className="px-4 py-3">{isMm ? 'ဝန်ဆောင်မှု' : 'Service'}</th>
                  <th className="px-4 py-3">{isMm ? 'ဝန်ထမ်း' : 'Staff'}</th>
                  <th className="px-4 py-3">{isMm ? 'ကြာချိန်' : 'Duration'}</th>
                  <th className="px-4 py-3">{isMm ? 'အခြေအနေ' : 'Status'}</th>
                  <th className="px-4 py-3 text-right">{isMm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredHistorySessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-xs text-gray-400">
                      {isMm ? 'မှတ်တမ်း မရှိပါ' : 'No historical sessions found'}
                    </td>
                  </tr>
                ) : (
                  filteredHistorySessions.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 font-mono font-bold text-gray-900">{s.sessionCode}</td>
                      <td className="px-4 py-3 font-semibold">{s.roomName}</td>
                      <td className="px-4 py-3">{s.customerName}</td>
                      <td className="px-4 py-3">{s.serviceName}</td>
                      <td className="px-4 py-3 font-medium">
                        {s.assignedStaff.map(st => st.staffName).join(', ')}
                      </td>
                      <td className="px-4 py-3">
                        {s.actualDurationMinutes || s.plannedDurationMinutes}m
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            s.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.status === 'cancelled'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActiveSessionDetail(s)}
                            className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                          >
                            {isMm ? 'အသေးစိတ်' : 'Details'}
                          </button>
                          {s.invoiceId && (
                            <button
                              onClick={async () => {
                                const inv = await db.invoices.get(s.invoiceId!);
                                if (inv) onShowReceipt(inv);
                              }}
                              className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                              title="Print Receipt"
                            >
                              <Printer className="h-3.5 w-3.5 inline" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* START SESSION MODAL */}
      {isStartModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                  <Play className="h-5 w-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    {isMm ? 'ဆက်ရှင် အသစ်စတင်ခြင်း' : 'Start New Service Session'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {isMm ? 'အခန်း၊ ဝန်ဆောင်မှုနှင့် ဝန်ထမ်း သတ်မှတ်ပါ' : 'Select room, service and assign staff'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStartModalOpen(false)}
                className="rounded-xl p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Room Selection */}
              <div>
                <label className="mb-1 block font-bold text-gray-700">
                  {isMm ? 'အခန်း / နေရာ ရွေးပါ' : 'Select Room / Area'}
                </label>
                <select
                  value={selectedRoomId}
                  onChange={e => setSelectedRoomId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900 focus:border-emerald-600 focus:bg-white focus:outline-hidden"
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.id} disabled={r.status === 'occupied'}>
                      {isMm ? r.nameMm : r.name} — {r.type.toUpperCase()} ({r.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-gray-700">
                    {isMm ? 'ဧည့်သည် အမည်' : 'Customer Name'}
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900 focus:border-emerald-600 focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-gray-700">
                    {isMm ? 'ဖုန်းနံပါတ် (ရှိပါက)' : 'Phone (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="09-..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900 focus:border-emerald-600 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Service Selection */}
              <div>
                <label className="mb-1 block font-bold text-gray-700">
                  {isMm ? 'ဝန်ဆောင်မှု အမျိုးအစား' : 'Select Service'}
                </label>
                <select
                  value={selectedServiceId}
                  onChange={e => {
                    const sId = e.target.value;
                    setSelectedServiceId(sId);
                    const s = services.find(x => x.id === sId);
                    if (s) setPlannedDurationMinutes(s.durationMinutes);
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900 focus:border-emerald-600 focus:bg-white focus:outline-hidden"
                >
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {isMm ? s.nameMm : s.name} — {formatMMK(s.priceMMK)} ({s.durationMinutes} mins)
                    </option>
                  ))}
                </select>
              </div>

              {/* Pricing Rule */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-gray-700">
                    {isMm ? 'ဈေးနှုန်းသတ်မှတ်ပုံ' : 'Pricing Rule'}
                  </label>
                  <select
                    value={pricingRule}
                    onChange={e => setPricingRule(e.target.value as SessionPricingRuleType)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs"
                  >
                    <option value="duration_based">Duration Based (ပုံမှန်)</option>
                    <option value="hourly">Hourly Rate (တစ်နာရီနှုန်း)</option>
                    <option value="fixed">Fixed Session (သတ်မှတ်ဈေး)</option>
                    <option value="special">Special / Custom (အထူးဈေး)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-gray-700">
                    {isMm ? 'ဈေးနှုန်း (ကျပ် - စိတ်ကြိုက်)' : 'Custom Base Price (MMK)'}
                  </label>
                  <input
                    type="number"
                    value={customBasePrice}
                    onChange={e => setCustomBasePrice(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                    placeholder="Auto from service"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs"
                  />
                </div>
              </div>

              {/* Duration Buttons */}
              <div>
                <label className="mb-1 block font-bold text-gray-700">
                  {isMm ? 'သတ်မှတ်ကြာချိန် (မိနစ်)' : 'Planned Duration (Minutes)'}
                </label>
                <div className="flex gap-2">
                  {[30, 45, 60, 90, 120].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setPlannedDurationMinutes(mins)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-all ${
                        plannedDurationMinutes === mins
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Staff Assignment */}
              <div>
                <label className="mb-1 block font-bold text-gray-700">
                  {isMm ? 'ဝန်ထမ်း တာဝန်ပေးရန် (အနည်းဆုံး ၁ ဦး)' : 'Assign Staff / Therapists (Multi-Select)'}
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-44 overflow-y-auto p-1">
                  {staff.map(s => {
                    const isSelected = selectedStaffIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStaffIds(selectedStaffIds.filter(id => id !== s.id));
                          } else {
                            setSelectedStaffIds([...selectedStaffIds, s.id]);
                          }
                        }}
                        className={`flex flex-col items-start rounded-xl border p-2 text-left transition-all ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600/20'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-bold truncate w-full">{s.name}</span>
                        <span className="text-[10px] text-gray-500">
                          {s.defaultCommissionRule.type === 'percentage'
                            ? `${s.defaultCommissionRule.value}%`
                            : formatMMK(s.defaultCommissionRule.value)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block font-bold text-gray-700">
                  {isMm ? 'မှတ်ချက်' : 'Notes / Special Requests'}
                </label>
                <input
                  type="text"
                  value={sessionNotes}
                  onChange={e => setSessionNotes(e.target.value)}
                  placeholder="e.g. Focus on neck & shoulders, medium pressure"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs text-gray-900 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setIsStartModalOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmStartSession}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
              >
                {isMm ? 'ဆက်ရှင် ဖွင့်မည်' : 'Confirm & Start Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXTEND SESSION MODAL */}
      {extendSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-800">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    {isMm ? 'ဆက်ရှင် အချိန်တိုးခြင်း' : 'Extend Session Duration'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {extendSessionModal.sessionCode} • {extendSessionModal.roomName}
                  </p>
                </div>
              </div>
              <button onClick={() => setExtendSessionModal(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-bold text-gray-700">
                  {isMm ? 'တိုးမည့် အချိန် ရွေးပါ (မိနစ်)' : 'Additional Minutes'}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setExtendMinutes(mins)}
                      className={`rounded-xl border py-2 text-center text-xs font-bold ${
                        extendMinutes === mins
                          ? 'border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-600/20'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      +{mins}m
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-gray-700">
                  {isMm ? 'ထပ်ဆောင်း ကျသင့်ငွေ (ကျပ် - စိတ်ကြိုက်)' : 'Extension Fee (MMK - Custom Override)'}
                </label>
                <input
                  type="number"
                  value={extendCustomPrice}
                  onChange={e => setExtendCustomPrice(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                  placeholder="Auto-calculated"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-gray-700">
                  {isMm ? 'အကြောင်းပြချက်' : 'Reason / Note'}
                </label>
                <input
                  type="text"
                  value={extendReason}
                  onChange={e => setExtendReason(e.target.value)}
                  placeholder="Customer requested extra massage time"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setExtendSessionModal(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmExtend}
                className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-xs"
              >
                {isMm ? 'အချိန်တိုး အတည်ပြုမည်' : 'Confirm Extension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REASSIGN STAFF MODAL */}
      {reassignStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    {isMm ? 'ဝန်ထမ်း ပြောင်းလဲသတ်မှတ်ခြင်း' : 'Change / Reassign Staff'}
                  </h3>
                  <p className="text-xs text-gray-500">{reassignStaffModal.sessionCode}</p>
                </div>
              </div>
              <button onClick={() => setReassignStaffModal(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-bold text-gray-700">
                  {isMm ? 'တာဝန်ယူမည့် ဝန်ထမ်းများ ရွေးပါ' : 'Select Assigned Staff'}
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1">
                  {staff.map(s => {
                    const isSelected = reassignStaffIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setReassignStaffIds(reassignStaffIds.filter(id => id !== s.id));
                          } else {
                            setReassignStaffIds([...reassignStaffIds, s.id]);
                          }
                        }}
                        className={`rounded-xl border p-2 text-left transition-all ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600/20'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-bold block truncate">{s.name}</span>
                        <span className="text-[10px] text-gray-500">
                          {s.status === 'in_service' && !isSelected ? 'Busy' : 'Available'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-gray-700">
                  {isMm ? 'အကြောင်းပြချက်' : 'Reason for Staff Reassignment'}
                </label>
                <input
                  type="text"
                  value={reassignReason}
                  onChange={e => setReassignReason(e.target.value)}
                  placeholder="Staff swap / relief"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setReassignStaffModal(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmReassignStaff}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
              >
                {isMm ? 'ဝန်ထမ်း ပြောင်းလဲမည်' : 'Save Staff Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SESSION DETAIL DRAWER */}
      {activeSessionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 p-0 sm:p-4 backdrop-blur-xs">
          <div className="h-full w-full max-w-lg rounded-none sm:rounded-3xl bg-white p-6 shadow-2xl overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <span className="font-mono text-xs font-bold text-gray-400">
                    {activeSessionDetail.sessionCode}
                  </span>
                  <h3 className="text-lg font-black text-gray-900">
                    {activeSessionDetail.roomName}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveSessionDetail(null)}
                  className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Detail Content */}
              <div className="mt-4 space-y-4 text-xs">
                {/* Customer Card */}
                <div className="rounded-2xl bg-gray-50 p-3.5 border border-gray-100 space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Customer Information</span>
                  <p className="text-sm font-bold text-gray-900">{activeSessionDetail.customerName}</p>
                  {activeSessionDetail.customerPhone && (
                    <p className="text-gray-500 font-mono">{activeSessionDetail.customerPhone}</p>
                  )}
                </div>

                {/* Service & Pricing Snapshot */}
                <div className="rounded-2xl bg-gray-50 p-3.5 border border-gray-100 space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Service & Pricing Snapshot</span>
                  <div className="flex justify-between font-bold text-gray-900">
                    <span>{activeSessionDetail.serviceName}</span>
                    <span>{formatMMK(activeSessionDetail.basePriceMMK)}</span>
                  </div>
                  {activeSessionDetail.roomSurchargeMMK > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Room Surcharge:</span>
                      <span>{formatMMK(activeSessionDetail.roomSurchargeMMK)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Planned Duration:</span>
                    <span>{activeSessionDetail.plannedDurationMinutes} mins</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Start Timestamp:</span>
                    <span className="font-mono">{new Date(activeSessionDetail.startTime).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Extensions History */}
                {activeSessionDetail.extensions && activeSessionDetail.extensions.length > 0 && (
                  <div className="rounded-2xl bg-purple-50 p-3.5 border border-purple-100 space-y-2">
                    <span className="text-[10px] font-bold text-purple-800 uppercase">Extensions Recorded</span>
                    <div className="space-y-1.5">
                      {activeSessionDetail.extensions.map((ext, i) => (
                        <div key={i} className="flex justify-between text-purple-950 font-medium">
                          <span>
                            +{ext.extendedMinutes}m ({ext.reason || 'Extended'})
                          </span>
                          <span className="font-bold">{formatMMK(ext.extensionPriceMMK)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assigned Staff */}
                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Assigned Staff & Commission Snapshot</span>
                  <div className="space-y-1">
                    {activeSessionDetail.assignedStaff.map(st => (
                      <div key={st.staffId} className="flex justify-between text-slate-800">
                        <span className="font-semibold">{st.staffName}</span>
                        <span className="text-slate-500 font-mono">
                          {st.commissionType === 'percentage' ? `${st.commissionRate}%` : formatMMK(st.commissionRate)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ordered Items */}
                {activeSessionDetail.orderItems && activeSessionDetail.orderItems.length > 0 && (
                  <div className="rounded-2xl bg-gray-50 p-3.5 border border-gray-100 space-y-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Ordered Products / Drinks</span>
                    <div className="space-y-1">
                      {activeSessionDetail.orderItems.map((it, i) => (
                        <div key={i} className="flex justify-between">
                          <span>
                            {it.name} x {it.quantity}
                          </span>
                          <span className="font-bold">{formatMMK(it.totalPriceMMK)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-6 border-t border-gray-100 pt-4 flex gap-2">
              <button
                onClick={() => handleOpenCheckout(activeSessionDetail)}
                className="flex-1 rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white hover:bg-emerald-700 shadow-sm"
              >
                {isMm ? 'ငွေရှင်းမည်' : 'Proceed to Checkout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ORDER MODAL */}
      {orderProductModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-black text-gray-900">
                  {isMm ? 'အချိုရည် / အစားအသောက် ထည့်ရန်' : 'Add Item to Session'}
                </h3>
              </div>
              <button onClick={() => setOrderProductModalSession(null)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-700" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-bold text-gray-700">
                  {isMm ? 'ပစ္စည်း ရွေးပါ' : 'Select Product'}
                </label>
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                >
                  <option value="">{isMm ? '-- ပစ္စည်းရွေးပါ --' : '-- Select Product --'}</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id} disabled={p.stockQty <= 0}>
                      {isMm ? p.nameMm : p.name} — {formatMMK(p.sellingPriceMMK)} ({p.stockQty} in stock)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-gray-700">
                  {isMm ? 'အရေအတွက်' : 'Quantity'}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setOrderQty(Math.max(1, orderQty - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-base font-bold text-gray-700"
                  >
                    -
                  </button>
                  <span className="text-base font-black text-gray-900 w-12 text-center">{orderQty}</span>
                  <button
                    type="button"
                    onClick={() => setOrderQty(orderQty + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-base font-bold text-gray-700"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setOrderProductModalSession(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleAddProductToSession}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
              >
                {isMm ? 'ဘေလ်ထဲ ထည့်မည်' : 'Add to Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {checkoutSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Banknote className="h-6 w-6 text-emerald-600" />
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    {isMm ? 'ငွေရှင်းခြင်းနှင့် ဘောက်ချာထုတ်ခြင်း' : 'Checkout & Generate Voucher'}
                  </h3>
                  <p className="text-xs text-gray-500">{checkoutSession.sessionCode} • {checkoutSession.roomName}</p>
                </div>
              </div>
              <button onClick={() => setCheckoutSession(null)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-700" />
              </button>
            </div>

            {/* Calculations */}
            {(() => {
              const room = rooms.find(r => r.id === checkoutSession.roomId);
              const totalExtensionsMMK = (checkoutSession.extensions || []).reduce(
                (sum, ext) => sum + ext.extensionPriceMMK,
                0
              );

              const pricing = calculateSessionPricing({
                basePriceMMK: checkoutSession.basePriceMMK,
                roomSurchargeMMK: checkoutSession.roomSurchargeMMK,
                plannedMinutes: checkoutSession.plannedDurationMinutes,
                actualMinutes: actualDuration,
                hourlyRateMMK: room?.hourlyRateMMK || 0,
                extensionsTotalMMK: totalExtensionsMMK,
                pricingRule: checkoutSession.pricingRule,
              });

              const items: InvoiceItem[] = [
                {
                  type: 'service' as const,
                  description: `${checkoutSession.serviceName} (${actualDuration} mins)`,
                  quantity: 1,
                  unitPriceMMK: pricing.basePriceMMK,
                  totalPriceMMK: pricing.basePriceMMK,
                },
              ];

              if (checkoutSession.extensions && checkoutSession.extensions.length > 0) {
                for (const ext of checkoutSession.extensions) {
                  if (ext.extensionPriceMMK > 0) {
                    items.push({
                      type: 'service' as const,
                      description: `Time Extension (+${ext.extendedMinutes} mins${ext.reason ? ` - ${ext.reason}` : ''})`,
                      quantity: 1,
                      unitPriceMMK: ext.extensionPriceMMK,
                      totalPriceMMK: ext.extensionPriceMMK,
                    });
                  }
                }
              }

              if (pricing.roomSurchargeMMK > 0) {
                items.push({
                  type: 'surcharge' as const,
                  description: 'Room Surcharge',
                  quantity: 1,
                  unitPriceMMK: pricing.roomSurchargeMMK,
                  totalPriceMMK: pricing.roomSurchargeMMK,
                });
              }

              if (pricing.overtimeFeeMMK > 0) {
                items.push({
                  type: 'room_time' as const,
                  description: `Overtime (${pricing.overtimeMinutes} mins)`,
                  quantity: 1,
                  unitPriceMMK: pricing.overtimeFeeMMK,
                  totalPriceMMK: pricing.overtimeFeeMMK,
                });
              }

              for (const ord of checkoutSession.orderItems || []) {
                items.push({
                  type: 'product' as const,
                  description: ord.name,
                  quantity: ord.quantity,
                  unitPriceMMK: ord.unitPriceMMK,
                  costPriceMMK: ord.costPriceMMK,
                  totalPriceMMK: ord.totalPriceMMK,
                });
              }

              const invTotals = calculateInvoiceTotals({
                items,
                discountType,
                discountValue,
              });

              const changeInfo = calculatePaymentChange(invTotals.totalMMK, tenderedCash);

              return (
                <div className="space-y-4 text-xs">
                  {/* Duration input */}
                  <div>
                    <label className="mb-1 block font-bold text-gray-700">
                      {isMm ? 'အမှန်တကယ် ကုန်ဆုံးချိန် (မိနစ်)' : 'Actual Duration (Minutes)'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={actualDuration}
                        onChange={e => setActualDuration(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-28 rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs font-bold text-gray-900"
                      />
                      <span className="text-gray-500">
                        {isMm ? 'မိနစ် (အချိန်ပိုလွန်ပါက အလိုအလျောက် တွက်ချက်သည်)' : 'mins (overtime auto-calculated)'}
                      </span>
                    </div>
                  </div>

                  {/* Itemized list */}
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3.5 space-y-1.5">
                    {items.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{it.description}</span>
                        <span className="font-bold">{formatMMK(it.totalPriceMMK)}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 pt-2 flex justify-between font-black text-gray-900">
                      <span>{isMm ? 'ကျသင့်ငွေ စုစုပေါင်း:' : 'Subtotal:'}</span>
                      <span>{formatMMK(invTotals.subtotalMMK)}</span>
                    </div>
                  </div>

                  {/* Discount */}
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-gray-700 whitespace-nowrap">
                      {isMm ? 'လျှော့ဈေး:' : 'Discount:'}
                    </label>
                    <select
                      value={discountType}
                      onChange={e => setDiscountType(e.target.value as any)}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs font-semibold"
                    >
                      <option value="percentage">% Percentage</option>
                      <option value="fixed">MMK Fixed</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={discountValue}
                      onChange={e => setDiscountValue(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-24 rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs font-bold"
                    />
                    {invTotals.discountAmountMMK > 0 && (
                      <span className="text-emerald-700 font-bold">
                        -{formatMMK(invTotals.discountAmountMMK)}
                      </span>
                    )}
                  </div>

                  {/* Total Banner */}
                  <div className="flex items-center justify-between rounded-2xl bg-emerald-50 p-3.5 border border-emerald-200">
                    <span className="text-sm font-black text-emerald-950">
                      {isMm ? 'ပေးချေရမည့် စုစုပေါင်း:' : 'TOTAL PAYABLE:'}
                    </span>
                    <span className="text-xl font-black text-emerald-900">
                      {formatMMK(invTotals.totalMMK)}
                    </span>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="mb-1 block font-bold text-gray-700">
                      {isMm ? 'ငွေပေးချေမှု နည်းလမ်း' : 'Payment Method'}
                    </label>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {[
                        { id: 'cash', label: 'Cash (ငွေသား)' },
                        { id: 'kpay', label: 'KPay' },
                        { id: 'wave', label: 'WavePay' },
                        { id: 'cbpay', label: 'CB Pay' },
                        { id: 'credit', label: 'Credit (အကြွေး)' },
                      ].map(pm => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setPaymentMethod(pm.id as any)}
                          className={`rounded-xl border p-2 text-center text-xs font-bold transition-all ${
                            paymentMethod === pm.id
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cash Change Calculator */}
                  {paymentMethod === 'cash' ? (
                    <div className="rounded-2xl bg-gray-50 p-3.5 border border-gray-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-gray-700">
                          {isMm ? 'လက်ခံရရှိငွေ (ကျပ်)' : 'Cash Tendered (MMK)'}
                        </label>
                        <input
                          type="number"
                          value={tenderedCash}
                          onChange={e => setTenderedCash(parseInt(e.target.value) || 0)}
                          className="w-36 rounded-xl border border-gray-200 bg-white p-2 text-right text-xs font-black text-gray-900"
                        />
                      </div>
                      {/* Quick Tender Chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          invTotals.totalMMK,
                          Math.ceil(invTotals.totalMMK / 10000) * 10000,
                          Math.ceil(invTotals.totalMMK / 50000) * 50000,
                          100000,
                        ]
                          .filter((v, i, a) => v >= invTotals.totalMMK && a.indexOf(v) === i)
                          .map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setTenderedCash(val)}
                              className="rounded-lg bg-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-300"
                            >
                              {formatMMK(val)}
                            </button>
                          ))}
                      </div>
                      <div className="flex items-center justify-between border-t border-gray-200 pt-2 font-black">
                        <span>{isMm ? 'ပြန်အမ်းငွေ:' : 'Change Returned:'}</span>
                        <span className="text-emerald-700 text-base">
                          {formatMMK(changeInfo.changeMMK)}
                        </span>
                      </div>
                    </div>
                  ) : paymentMethod !== 'credit' ? (
                    <div>
                      <label className="mb-1 block font-bold text-gray-700">
                        {isMm ? 'ငွေလွှဲ အမှတ် / Ref ID' : 'Transfer Reference No'}
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={e => setPaymentReference(e.target.value)}
                        placeholder="e.g. KP-90812489"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs text-gray-900"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl bg-amber-50 p-3 border border-amber-200 text-amber-900 text-xs">
                      {isMm
                        ? 'ဤငွေပမာဏကို ဧည့်သည်၏ အကြွေးစာရင်းထဲသို့ ပေါင်းထည့်မည်ဖြစ်ပါသည်။'
                        : 'This amount will be added to the customer credit debt ledger.'}
                    </div>
                  )}

                  {/* Staff Commission snapshot preview */}
                  <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200 text-[11px]">
                    <span className="font-bold text-slate-800 block mb-1.5">
                      {isMm ? 'ဝန်ထမ်း ကော်မရှင် ခွဲဝေမှု:' : 'Staff Commission Allocation:'}
                    </span>
                    <div className="space-y-1">
                      {checkoutSession.assignedStaff.map(stf => {
                        const comm = calculateStaffCommission({
                          servicePriceMMK: pricing.basePriceMMK + totalExtensionsMMK + pricing.overtimeFeeMMK,
                          rule: { type: stf.commissionType, value: stf.commissionRate },
                          staffCount: checkoutSession.assignedStaff.length,
                        });
                        return (
                          <div key={stf.staffId} className="flex justify-between text-slate-600">
                            <span>
                              {stf.staffName} ({stf.commissionRate}
                              {stf.commissionType === 'percentage' ? '%' : ' MMK'})
                            </span>
                            <span className="font-bold text-slate-900">{formatMMK(comm)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setCheckoutSession(null)}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600"
                    >
                      {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmCheckout}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700 shadow-xs"
                    >
                      <Printer className="h-4 w-4" />
                      <span>{isMm ? 'ငွေလက်ခံပြီး ဘောက်ချာထုတ်မည်' : 'Complete & Print Voucher'}</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* CANCEL SESSION MODAL */}
      {cancelSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-5 w-5" />
                <h3 className="text-base font-black text-gray-900">
                  {isMm ? 'ဆက်ရှင် ပယ်ဖျက်မည်' : 'Cancel Active Session'}
                </h3>
              </div>
              <button onClick={() => setCancelSessionModal(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              {isMm
                ? 'ဤလုပ်ဆောင်ချက်သည် ဆက်ရှင်ကို ရပ်တန့်စေပြီး အခန်းနှင့် ဝန်ထမ်းများကို ပြန်လည် အားလပ်စေမည်ဖြစ်ပါသည်။'
                : 'This will free the room and staff without creating financial billing. Soft cancellation will be recorded in audit log.'}
            </p>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder={isMm ? 'ပယ်ဖျက်ရသည့် အကြောင်းပြချက် ရေးပါ...' : 'Reason for cancellation...'}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900 focus:outline-hidden"
              rows={3}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setCancelSessionModal(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Close'}
              </button>
              <button
                onClick={handleConfirmCancel}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
              >
                {isMm ? 'ပယ်ဖျက်မှု အတည်ပြုမည်' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID SESSION MODAL */}
      {voidSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertCircle className="h-5 w-5" />
                <h3 className="text-base font-black text-gray-900">
                  {isMm ? 'ဆက်ရှင် ဖျက်သိမ်းမည် (Void)' : 'Void Session / Voucher'}
                </h3>
              </div>
              <button onClick={() => setVoidSessionModal(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              {isMm
                ? 'ဤလုပ်ဆောင်ချက်သည် စာရင်းစစ်မှတ်တမ်းတွင် သိမ်းဆည်းမည်ဖြစ်ပြီး ဘောက်ချာနှင့် ကော်မရှင်များကို ပြန်လည်နှုတ်ပယ်မည်ဖြစ်ပါသည်။'
                : 'This will reverse staff commissions, void the invoice, restock inventory, and record an immutable audit trail.'}
            </p>
            <textarea
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
              placeholder={isMm ? 'ဖျက်သိမ်းရသည့် အကြောင်းပြချက် ရေးပါ...' : 'Reason for void...'}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900 focus:border-rose-500 focus:outline-hidden"
              rows={3}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setVoidSessionModal(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmVoid}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                {isMm ? 'ဖျက်သိမ်းမှု အတည်ပြုမည်' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
