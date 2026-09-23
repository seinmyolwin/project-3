import React, { useState, useMemo, useEffect } from 'react';
import {
  ProductItem,
  ServiceItem,
  Room,
  SessionRecord,
  StaffMember,
  Customer,
  UserAccount,
  PaymentMethod,
  PaymentRecord,
  Invoice,
  InvoiceItem,
  InvoiceItemType,
  ShopSettings,
  CustomerMembership,
  CustomerPackage,
  GiftCard,
} from '../../types';
import { db } from '../../db/database';
import { localServerClient } from '../../services/localServerClient';
import {
  formatMMK,
  calculateInvoiceTotals,
  calculatePaymentChange,
  calculatePaymentSummary,
  validateDiscount,
  roundMMK,
  calculateDurationMinutes,
  calculateSessionPricing,
  calculateStaffCommission,
} from '../../domain/financial';
import { Language } from '../../utils/translations';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Banknote,
  Search,
  User,
  Printer,
  Sparkles,
  Clock,
  DollarSign,
  Receipt,
  FileText,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  CreditCard,
  Lock,
  Tag,
  Layers,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Phone,
  Percent,
  Gift,
  Package,
  HeartHandshake,
} from 'lucide-react';

import { verifyPin } from '../../utils/cryptoAuth';

interface PosViewProps {
  products: ProductItem[];
  services?: ServiceItem[];
  rooms?: Room[];
  sessions?: SessionRecord[];
  staff?: StaffMember[];
  customers: Customer[];
  invoices?: Invoice[];
  settings?: ShopSettings | null;
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
  onShowReceipt: (invoice: Invoice) => void;
}

interface CartLineItem {
  id: string;
  type: InvoiceItemType;
  productId?: string;
  serviceId?: string;
  name: string;
  nameMm?: string;
  quantity: number;
  unitPriceMMK: number;
  costPriceMMK?: number;
  discountMMK?: number;
}

interface SplitPaymentRow {
  id: string;
  method: PaymentMethod;
  amountMMK: number;
  tenderedMMK?: number;
  referenceNo?: string;
  notes?: string;
}

export const PosView: React.FC<PosViewProps> = ({
  products = [],
  services = [],
  rooms = [],
  sessions = [],
  staff = [],
  customers = [],
  invoices = [],
  settings = null,
  currentUser,
  lang,
  onRefresh,
  onShowReceipt,
}) => {
  const isMm = lang === 'my';

  // Navigation Subtabs
  const [activeSubTab, setActiveSubTab] = useState<'direct' | 'sessions' | 'history'>('direct');

  // Direct POS State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartLineItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer (ဧည့်သည်)');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  
  // Discounts
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountPin, setDiscountPin] = useState<string>('');
  const [isDiscountAuthorized, setIsDiscountAuthorized] = useState<boolean>(false);
  const [showDiscountPinModal, setShowDiscountPinModal] = useState<boolean>(false);
  const [discountAuthError, setDiscountAuthError] = useState<string>('');

  // Tax & Service Charge
  const [applyTax, setApplyTax] = useState<boolean>(false);
  const [applyServiceCharge, setApplyServiceCharge] = useState<boolean>(false);

  // Multi-Payment Split Tender State
  const [splitPayments, setSplitPayments] = useState<SplitPaymentRow[]>([
    { id: 'pmt_1', method: 'cash', amountMMK: 0, tenderedMMK: 0 },
  ]);
  const [isMultiPaymentMode, setIsMultiPaymentMode] = useState<boolean>(false);
  const [singlePaymentMethod, setSinglePaymentMethod] = useState<PaymentMethod>('cash');
  const [singleTenderedCash, setSingleTenderedCash] = useState<number>(0);
  const [singlePaymentRef, setSinglePaymentRef] = useState<string>('');

  // Customer Value Assets (Membership, Packages, Gift Cards)
  const [customerActiveMembership, setCustomerActiveMembership] = useState<CustomerMembership | null>(null);
  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([]);
  const [customerGiftCards, setCustomerGiftCards] = useState<GiftCard[]>([]);
  const [selectedGiftCardForPayment, setSelectedGiftCardForPayment] = useState<GiftCard | null>(null);
  const [giftCardNumberInput, setGiftCardNumberInput] = useState<string>('');
  const [giftCardCheckError, setGiftCardCheckError] = useState<string>('');

  // Gratuity / Staff Tips
  const [showTipSection, setShowTipSection] = useState<boolean>(false);
  const [tipStaffId, setTipStaffId] = useState<string>('');
  const [tipAmountMMK, setTipAmountMMK] = useState<number>(0);
  const [tipPaymentMethod, setTipPaymentMethod] = useState<PaymentMethod>('cash');

  // Modals & Drawers
  const [showCustomItemModal, setShowCustomItemModal] = useState<boolean>(false);
  const [customItemType, setCustomItemType] = useState<InvoiceItemType>('service');
  const [customItemName, setCustomItemName] = useState<string>('');
  const [customItemPrice, setCustomItemPrice] = useState<number>(0);
  const [customItemQty, setCustomItemQty] = useState<number>(1);

  // Active Session Checkout Modal
  const [selectedSessionForCheckout, setSelectedSessionForCheckout] = useState<SessionRecord | null>(null);
  const [sessionExtraItems, setSessionExtraItems] = useState<CartLineItem[]>([]);
  const [sessionDiscountType, setSessionDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [sessionDiscountValue, setSessionDiscountValue] = useState<number>(0);
  const [sessionPaymentMethod, setSessionPaymentMethod] = useState<PaymentMethod>('cash');
  const [sessionTenderedCash, setSessionTenderedCash] = useState<number>(0);
  const [sessionPaymentRef, setSessionPaymentRef] = useState<string>('');

  // History & Bill Management State
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [selectedBillForDetail, setSelectedBillForDetail] = useState<Invoice | null>(null);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<Invoice | null>(null);
  const [subsequentPaymentMethod, setSubsequentPaymentMethod] = useState<PaymentMethod>('cash');
  const [subsequentPaymentAmount, setSubsequentPaymentAmount] = useState<number>(0);
  const [subsequentPaymentRef, setSubsequentPaymentRef] = useState<string>('');
  const [subsequentPaymentNotes, setSubsequentPaymentNotes] = useState<string>('');

  // Void Modal State
  const [billToVoid, setBillToVoid] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');
  const [voidPin, setVoidPin] = useState<string>('');
  const [voidError, setVoidError] = useState<string>('');

  // 1. Calculate Active Running Sessions
  const activeSessions = useMemo(() => {
    return sessions.filter(s => s.status === 'active' || s.status === 'extended');
  }, [sessions]);

  // 2. Filter Products and Services for Catalog
  const filteredCatalog = useMemo(() => {
    const list: Array<{
      id: string;
      type: InvoiceItemType;
      name: string;
      nameMm?: string;
      priceMMK: number;
      costPriceMMK?: number;
      category: string;
      stockQty?: number;
      unit?: string;
    }> = [];

    // Add Services
    if (selectedCategory === 'all' || selectedCategory === 'service') {
      services.forEach(s => {
        if (s.isActive) {
          list.push({
            id: s.id,
            type: 'service',
            name: s.name,
            nameMm: s.nameMm,
            priceMMK: s.priceMMK,
            costPriceMMK: 0,
            category: 'service',
          });
        }
      });
    }

    // Add Products
    products.forEach(p => {
      if (!p.isActive) return;
      if (selectedCategory !== 'all' && selectedCategory !== 'service' && p.category !== selectedCategory) {
        return;
      }
      if (selectedCategory === 'service') return;

      let itemType: InvoiceItemType = 'product';
      if (p.category === 'drink') itemType = 'drink';
      else if (p.category === 'food') itemType = 'food';

      list.push({
        id: p.id,
        type: itemType,
        name: p.name,
        nameMm: p.nameMm,
        priceMMK: p.sellingPriceMMK,
        costPriceMMK: p.costPriceMMK,
        category: p.category,
        stockQty: p.stockQty,
        unit: isMm ? p.unitMm : p.unit,
      });
    });

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(item => {
      return (
        item.name.toLowerCase().includes(q) ||
        (item.nameMm && item.nameMm.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [services, products, selectedCategory, searchQuery, isMm]);

  // Cart Management
  const addToCart = (item: {
    id: string;
    type: InvoiceItemType;
    name: string;
    nameMm?: string;
    priceMMK: number;
    costPriceMMK?: number;
  }) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(ci => ci.id === item.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + 1,
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: item.id,
          type: item.type,
          productId: item.type !== 'service' ? item.id : undefined,
          serviceId: item.type === 'service' ? item.id : undefined,
          name: item.name,
          nameMm: item.nameMm,
          quantity: 1,
          unitPriceMMK: item.priceMMK,
          costPriceMMK: item.costPriceMMK,
        },
      ];
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.id === id) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartLineItem[]
    );
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountValue(0);
    setIsDiscountAuthorized(false);
    setSelectedCustomerId('');
    setCustomerName('Walk-in Customer (ဧည့်သည်)');
    setCustomerPhone('');
    setSplitPayments([{ id: 'pmt_1', method: 'cash', amountMMK: 0, tenderedMMK: 0 }]);
    setIsMultiPaymentMode(false);
    setSingleTenderedCash(0);
    setSinglePaymentRef('');
    setGiftCardNumberInput('');
    setSelectedGiftCardForPayment(null);
    setGiftCardCheckError('');
    setTipAmountMMK(0);
    setTipStaffId('');
  };

  // Sync selected customer's active membership, packages, and gift cards
  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerActiveMembership(null);
      setCustomerPackages([]);
      setCustomerGiftCards([]);
      return;
    }
    db.customerMemberships
      .where('customerId')
      .equals(selectedCustomerId)
      .filter(m => m.status === 'active')
      .first()
      .then(m => setCustomerActiveMembership(m || null));

    db.customerPackages
      .where('customerId')
      .equals(selectedCustomerId)
      .filter(p => p.remainingQty > 0)
      .toArray()
      .then(setCustomerPackages);

    db.giftCards
      .where('customerId')
      .equals(selectedCustomerId)
      .filter(g => g.currentBalanceMMK > 0)
      .toArray()
      .then(setCustomerGiftCards);
  }, [selectedCustomerId]);

  // Compute Cart Invoice Totals
  const invoiceItems: InvoiceItem[] = useMemo(() => {
    return cart.map(item => ({
      type: item.type,
      itemId: item.productId || item.serviceId,
      description: isMm && item.nameMm ? item.nameMm : item.name,
      quantity: item.quantity,
      unitPriceMMK: item.unitPriceMMK,
      costPriceMMK: item.costPriceMMK,
      discountMMK: item.discountMMK,
      totalPriceMMK: Math.max(0, item.quantity * item.unitPriceMMK - (item.discountMMK || 0)),
    }));
  }, [cart, isMm]);

  const taxPercent = applyTax ? (settings?.taxPercent || 5) : 0;
  const serviceChargePercent = applyServiceCharge ? (settings?.serviceChargePercent || 5) : 0;

  const directTotals = useMemo(() => {
    return calculateInvoiceTotals({
      items: invoiceItems,
      discountType,
      discountValue,
      serviceChargePercent,
      taxPercent,
    });
  }, [invoiceItems, discountType, discountValue, serviceChargePercent, taxPercent]);

  // Single Tender Change
  const singleChangeInfo = useMemo(() => {
    return calculatePaymentChange(directTotals.totalMMK, singleTenderedCash || directTotals.totalMMK);
  }, [directTotals.totalMMK, singleTenderedCash]);

  // Split Payments Total
  const splitTotalPaid = useMemo(() => {
    return splitPayments.reduce((sum, p) => sum + roundMMK(p.amountMMK), 0);
  }, [splitPayments]);

  const splitBalanceDue = Math.max(0, directTotals.totalMMK - splitTotalPaid);

  // Add Custom Item to Cart
  const handleAddCustomItem = () => {
    if (!customItemName.trim() || customItemPrice <= 0 || customItemQty <= 0) return;
    const customId = 'custom_' + Date.now();
    setCart(prev => [
      ...prev,
      {
        id: customId,
        type: customItemType,
        name: customItemName.trim(),
        nameMm: customItemName.trim(),
        quantity: customItemQty,
        unitPriceMMK: customItemPrice,
      },
    ]);
    setShowCustomItemModal(false);
    setCustomItemName('');
    setCustomItemPrice(0);
    setCustomItemQty(1);
  };

  // Discount Authorization Handler
  const handleAuthorizeDiscount = () => {
    if (currentUser.role === 'owner' || currentUser.role === 'manager' || (currentUser.role as string) === 'admin') {
      setIsDiscountAuthorized(true);
      setShowDiscountPinModal(false);
      setDiscountAuthError('');
      return;
    }
    // Check manager/user PIN securely using salted hash verification
    const isValidPin = verifyPin(discountPin, currentUser.pinHash, currentUser.pinSalt, currentUser.pin);
    if (isValidPin) {
      setIsDiscountAuthorized(true);
      setShowDiscountPinModal(false);
      setDiscountAuthError('');
      setDiscountPin('');
    } else {
      setDiscountAuthError(isMm ? 'မန်နေဂျာ PIN မှားယွင်းနေပါသည်' : 'Invalid Manager PIN');
    }
  };

  // Direct Checkout Execution
  const handleExecuteDirectCheckout = async () => {
    if (cart.length === 0) return;

    // Verify discount permission if setting enabled
    if (settings?.requirePinForDiscount && directTotals.discountAmountMMK > 0 && !isDiscountAuthorized && currentUser.role === 'cashier') {
      setShowDiscountPinModal(true);
      return;
    }

    try {
      let finalPayments: PaymentRecord[] = [];

      if (isMultiPaymentMode) {
        finalPayments = splitPayments
          .filter(p => p.amountMMK > 0)
          .map((p, idx) => ({
            id: `pay_${Date.now()}_${idx}`,
            method: p.method,
            amountMMK: p.amountMMK,
            tenderedMMK: p.tenderedMMK,
            changeMMK: p.tenderedMMK && p.tenderedMMK > p.amountMMK ? p.tenderedMMK - p.amountMMK : 0,
            referenceNo: p.referenceNo,
            notes: p.notes,
            paidAt: new Date().toISOString(),
          }));

        if (finalPayments.length === 0) {
          throw new Error('Please specify payment amount');
        }
      } else {
        if (singlePaymentMethod === 'cash') {
          finalPayments.push({
            id: 'pay_' + Date.now(),
            method: 'cash',
            amountMMK: directTotals.totalMMK,
            tenderedMMK: singleTenderedCash || directTotals.totalMMK,
            changeMMK: singleChangeInfo.changeMMK,
            paidAt: new Date().toISOString(),
          });
        } else if (singlePaymentMethod === 'credit') {
          finalPayments.push({
            id: 'pay_' + Date.now(),
            method: 'credit',
            amountMMK: directTotals.totalMMK,
            notes: 'Walk-in Credit Sale (အကြွေးအရောင်း)',
            paidAt: new Date().toISOString(),
          });
        } else if (singlePaymentMethod === 'gift_card') {
          const cardNum = (selectedGiftCardForPayment?.cardNumber || giftCardNumberInput || singlePaymentRef).trim();
          if (!cardNum) throw new Error(isMm ? 'လက်ဆောင်ကတ် နံပါတ် ထည့်သွင်းပေးပါ' : 'Please select or enter a Gift Card Number');
          finalPayments.push({
            id: 'pay_' + Date.now(),
            method: 'gift_card',
            amountMMK: directTotals.totalMMK,
            referenceNo: cardNum,
            notes: `Gift Card: ${cardNum}`,
            paidAt: new Date().toISOString(),
          });
        } else {
          finalPayments.push({
            id: 'pay_' + Date.now(),
            method: singlePaymentMethod,
            amountMMK: directTotals.totalMMK,
            referenceNo: singlePaymentRef.trim() || undefined,
            paidAt: new Date().toISOString(),
          });
        }
      }

      const invoice = await db.createDirectSaleTransaction({
        items: cart.map(it => ({
          productId: it.productId,
          itemId: it.serviceId || it.productId,
          type: it.type,
          name: isMm && it.nameMm ? it.nameMm : it.name,
          description: isMm && it.nameMm ? it.nameMm : it.name,
          quantity: it.quantity,
          unitPriceMMK: it.unitPriceMMK,
          costPriceMMK: it.costPriceMMK,
          discountMMK: it.discountMMK,
        })),
        payments: finalPayments,
        customerId: selectedCustomerId || undefined,
        customerName: customerName.trim() || 'Walk-in Customer (ဧည့်သည်)',
        customerPhone: customerPhone.trim() || undefined,
        discountType,
        discountValue,
        discountAuthorizedBy: isDiscountAuthorized ? 'Manager PIN' : undefined,
        serviceChargePercent,
        taxPercent,
        currentUser,
      });

      // Record staff tip if specified
      if (tipAmountMMK > 0 && tipStaffId) {
        try {
          const chosenStaff = staff?.find(s => s.id === tipStaffId);
          await localServerClient.recordTip({
            staffId: tipStaffId,
            staffName: chosenStaff?.name || 'Staff',
            amountMMK: tipAmountMMK,
            paymentMethod: tipPaymentMethod,
            invoiceId: invoice.id,
            notes: `Gratuity for Bill ${invoice.invoiceCode}`,
            recordedBy: currentUser.name,
          });
        } catch (tipErr) {
          console.warn('Tip recording notice:', tipErr);
        }
      }

      clearCart();
      onRefresh();
      onShowReceipt(invoice);
    } catch (err: any) {
      alert('Billing Error: ' + err.message);
    }
  };

  // Active Session Checkout Handling
  const handleOpenSessionCheckout = (session: SessionRecord) => {
    setSelectedSessionForCheckout(session);
    setSessionExtraItems(
      (session.orderItems || []).map((ord, idx) => ({
        id: `ord_${idx}`,
        type: 'product',
        productId: ord.productId,
        name: ord.name || (ord as any).productName || 'Item',
        nameMm: ord.name || (ord as any).productName || 'Item',
        quantity: ord.quantity,
        unitPriceMMK: ord.unitPriceMMK,
        totalPriceMMK: ord.totalPriceMMK,
      }))
    );
    setSessionDiscountValue(0);
    setSessionPaymentMethod('cash');
    setSessionTenderedCash(0);
    setSessionPaymentRef('');
  };

  const computedSessionTotals = useMemo(() => {
    if (!selectedSessionForCheckout) return null;
    const session = selectedSessionForCheckout;
    const now = new Date();
    const elapsedMinutes = calculateDurationMinutes(session.startTime, now.toISOString());

    const basePrice = session.priceSnapshot?.basePriceMMK ?? session.basePriceMMK ?? 0;
    const roomSurcharge = session.priceSnapshot?.roomSurchargeMMK ?? session.roomSurchargeMMK ?? 0;
    const hourlyRate = session.priceSnapshot?.hourlyRateMMK ?? 0;

    const pricing = calculateSessionPricing({
      basePriceMMK: basePrice,
      roomSurchargeMMK: roomSurcharge,
      plannedMinutes: session.plannedDurationMinutes,
      actualMinutes: Math.max(session.plannedDurationMinutes, elapsedMinutes),
      hourlyRateMMK: hourlyRate,
      gracePeriodMinutes: 10,
    });

    const totalExtensionsMMK = (session.extensions || []).reduce((sum, ext) => sum + (ext.extensionPriceMMK || 0), 0);

    const items: InvoiceItem[] = [
      {
        type: 'service',
        description: `${session.serviceName} (${session.plannedDurationMinutes} mins)`,
        quantity: 1,
        unitPriceMMK: pricing.basePriceMMK,
        totalPriceMMK: pricing.basePriceMMK,
      },
    ];

    if (pricing.roomSurchargeMMK > 0) {
      items.push({
        type: 'surcharge',
        description: `Room Surcharge (${session.roomName})`,
        quantity: 1,
        unitPriceMMK: pricing.roomSurchargeMMK,
        totalPriceMMK: pricing.roomSurchargeMMK,
      });
    }

    if (totalExtensionsMMK > 0) {
      items.push({
        type: 'service',
        description: `Session Extensions (${(session.extensions || []).length}x)`,
        quantity: 1,
        unitPriceMMK: totalExtensionsMMK,
        totalPriceMMK: totalExtensionsMMK,
      });
    }

    if (pricing.overtimeFeeMMK > 0) {
      items.push({
        type: 'overtime',
        description: `Overtime Surcharge (${pricing.overtimeMinutes} mins)`,
        quantity: 1,
        unitPriceMMK: pricing.overtimeFeeMMK,
        totalPriceMMK: pricing.overtimeFeeMMK,
      });
    }

    // Extra ordered products
    sessionExtraItems.forEach(ord => {
      items.push({
        type: ord.type,
        itemId: ord.productId,
        description: ord.name,
        quantity: ord.quantity,
        unitPriceMMK: ord.unitPriceMMK,
        totalPriceMMK: ord.quantity * ord.unitPriceMMK,
      });
    });

    const invoiceCalc = calculateInvoiceTotals({
      items,
      discountType: sessionDiscountType,
      discountValue: sessionDiscountValue,
      serviceChargePercent: settings?.serviceChargePercent || 0,
      taxPercent: settings?.taxPercent || 0,
    });

    return {
      elapsedMinutes,
      pricing,
      items,
      invoiceCalc,
    };
  }, [selectedSessionForCheckout, sessionExtraItems, sessionDiscountType, sessionDiscountValue, settings]);

  const handleExecuteSessionCheckout = async () => {
    if (!selectedSessionForCheckout || !computedSessionTotals) return;

    try {
      const session = selectedSessionForCheckout;
      const totalAmount = computedSessionTotals.invoiceCalc.totalMMK;

      const payments: PaymentRecord[] = [];
      if (sessionPaymentMethod === 'cash') {
        payments.push({
          id: 'pay_' + Date.now(),
          method: 'cash',
          amountMMK: totalAmount,
          tenderedMMK: sessionTenderedCash || totalAmount,
          changeMMK: sessionTenderedCash && sessionTenderedCash > totalAmount ? sessionTenderedCash - totalAmount : 0,
          paidAt: new Date().toISOString(),
        });
      } else if (sessionPaymentMethod === 'credit') {
        payments.push({
          id: 'pay_' + Date.now(),
          method: 'credit',
          amountMMK: totalAmount,
          notes: `Session Credit for ${session.customerName}`,
          paidAt: new Date().toISOString(),
        });
      } else {
        payments.push({
          id: 'pay_' + Date.now(),
          method: sessionPaymentMethod,
          amountMMK: totalAmount,
          referenceNo: sessionPaymentRef.trim() || undefined,
          paidAt: new Date().toISOString(),
        });
      }

      const result = await db.checkoutSessionTransaction({
        sessionId: session.id,
        actualDurationMinutes: computedSessionTotals.elapsedMinutes,
        payments,
        discountType: sessionDiscountType,
        discountValue: sessionDiscountValue,
        serviceChargePercent: settings?.serviceChargePercent || 0,
        taxPercent: settings?.taxPercent || 0,
        currentUser,
      });

      setSelectedSessionForCheckout(null);
      onRefresh();
      onShowReceipt(result.invoice);
    } catch (err: any) {
      alert('Session Checkout Error: ' + err.message);
    }
  };

  // Add Subsequent Payment to Existing Bill
  const handleExecuteSubsequentPayment = async () => {
    if (!selectedBillForPayment || subsequentPaymentAmount <= 0) return;

    try {
      const pmtRecord: PaymentRecord = {
        id: 'pmt_' + Date.now(),
        method: subsequentPaymentMethod,
        amountMMK: subsequentPaymentAmount,
        referenceNo: subsequentPaymentRef.trim() || undefined,
        notes: subsequentPaymentNotes.trim() || undefined,
        receivedBy: currentUser.name,
        paidAt: new Date().toISOString(),
      };

      const updated = await db.addPaymentToInvoiceTransaction({
        invoiceId: selectedBillForPayment.id,
        payments: [pmtRecord],
        notes: subsequentPaymentNotes,
        currentUser,
      });

      setSelectedBillForPayment(null);
      setSubsequentPaymentAmount(0);
      setSubsequentPaymentRef('');
      setSubsequentPaymentNotes('');
      onRefresh();
      onShowReceipt(updated);
    } catch (err: any) {
      alert('Payment Error: ' + err.message);
    }
  };

  // Void Bill Execution
  const handleExecuteVoidBill = async () => {
    if (!billToVoid) return;
    if (!voidReason.trim()) {
      setVoidError(isMm ? 'ပယ်ဖျက်ရသည့် အကြောင်းပြချက် ထည့်သွင်းပေးပါ' : 'Please provide a void reason');
      return;
    }

    if (settings?.requirePinForVoid && currentUser.role === 'cashier') {
      const isValidVoidPin = verifyPin(voidPin, currentUser.pinHash, currentUser.pinSalt, currentUser.pin);
      if (!isValidVoidPin) {
        setVoidError(isMm ? 'မန်နေဂျာ PIN မှားယွင်းနေပါသည်' : 'Invalid Manager PIN');
        return;
      }
    }

    try {
      await db.voidInvoiceTransaction({
        invoiceId: billToVoid.id,
        reason: voidReason.trim(),
        currentUser,
      });

      setBillToVoid(null);
      setVoidReason('');
      setVoidPin('');
      setVoidError('');
      onRefresh();
    } catch (err: any) {
      setVoidError(err.message);
    }
  };

  // Filtered History Invoices
  const filteredHistoryInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (historyStatusFilter !== 'all') {
        if (inv.status.toLowerCase() !== historyStatusFilter.toLowerCase()) {
          return false;
        }
      }
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        return (
          inv.invoiceCode.toLowerCase().includes(q) ||
          (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
          (inv.cashierName && inv.cashierName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [invoices, historyStatusFilter, historySearch]);

  // Overall POS KPI Statistics
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayInvoices = invoices.filter(i => i.createdAt.startsWith(todayDateStr) && i.status !== 'voided');
  const todayTotalRevenue = todayInvoices.reduce((sum, i) => sum + i.paidAmountMMK, 0);
  const totalOutstandingBalance = invoices
    .filter(i => i.status !== 'voided')
    .reduce((sum, i) => sum + (i.balanceDueMMK || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-emerald-800">
            <Receipt className="h-6 w-6 text-emerald-600" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              {isMm ? 'အရောင်းနှင့် ဘေလ်စီမံခန့်ခွဲမှု (POS & Billing)' : 'Billing & Point of Sale (POS)'}
            </h1>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {isMm
              ? 'တိုက်ရိုက်အရောင်း၊ အခန်းနှင့် ဝန်ဆောင်မှုဘေလ်ရှင်းခြင်း၊ အကြွေးနှင့် ဘေလ်မှတ်တမ်းများ'
              : 'Direct sales, session checkout, split tender payments, credit management, and billing ledger.'}
          </p>
        </div>

        {/* Quick KPI Counters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              {isMm ? 'ယနေ့ အရောင်းရငွေ' : "Today's Revenue"}
            </span>
            <span className="text-sm font-extrabold text-emerald-900">{formatMMK(todayTotalRevenue)}</span>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-700">
              {isMm ? 'ရရန်ကျန်ငွေ / အကြွေး' : 'Outstanding Balance'}
            </span>
            <span className="text-sm font-extrabold text-amber-900">{formatMMK(totalOutstandingBalance)}</span>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-700">
              {isMm ? 'လက်ရှိ ဝန်ဆောင်မှုများ' : 'Active Sessions'}
            </span>
            <span className="text-sm font-extrabold text-blue-900">{activeSessions.length}</span>
          </div>
        </div>
      </div>

      {/* Main Module Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveSubTab('direct')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-all ${
            activeSubTab === 'direct'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          <span>{isMm ? 'တိုက်ရိုက် အရောင်း (Direct Sales / Walk-in)' : 'Direct POS Sales'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('sessions')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-all relative ${
            activeSubTab === 'sessions'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>{isMm ? 'အခန်း / ဝန်ဆောင်မှု ဘေလ်ရှင်းရန်' : 'Active Sessions Billing'}</span>
          {activeSessions.length > 0 && (
            <span className="rounded-full bg-emerald-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
              {activeSessions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-all ${
            activeSubTab === 'history'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>{isMm ? 'ဘေလ်မှတ်တမ်းနှင့် ငွေပေးချေမှု (Invoices & Ledger)' : 'Bills & Ledger History'}</span>
          <span className="rounded-full bg-gray-200 px-1.5 py-0.2 text-[10px] font-bold text-gray-700">
            {invoices.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DIRECT POS SALES & WALK-IN BILLING */}
      {/* ========================================================================= */}
      {activeSubTab === 'direct' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Product & Service Catalog (7 or 8 cols on lg) */}
          <div className="space-y-4 lg:col-span-7 xl:col-span-8">
            {/* Search & Category Filter */}
            <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={
                    isMm
                      ? 'ပစ္စည်း သို့မဟုတ် ဝန်ဆောင်မှု ရှာဖွေရန် (ဘီယာ၊ အအေး၊ အနှိပ်၊ သောက်စရာ)...'
                      : 'Search services, drinks, food, products...'
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2 text-xs text-gray-900 focus:border-emerald-600 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
                {[
                  { id: 'all', labelEn: 'All Items', labelMm: 'အားလုံး' },
                  { id: 'service', labelEn: 'Services', labelMm: 'ဝန်ဆောင်မှု' },
                  { id: 'drink', labelEn: 'Drinks / Beer', labelMm: 'အအေး/ဘီယာ' },
                  { id: 'food', labelEn: 'Food', labelMm: 'အစားအသောက်' },
                  { id: 'oil_cosmetic', labelEn: 'Spa Oils', labelMm: 'နှိပ်နယ်ဆီ' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {isMm ? cat.labelMm : cat.labelEn}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setShowCustomItemModal(true)}
                  className="whitespace-nowrap flex items-center gap-1 rounded-xl border border-dashed border-emerald-500 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isMm ? 'သီးသန့် ထည့်ရန်' : 'Custom Item'}</span>
                </button>
              </div>
            </div>

            {/* Product & Service Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 max-h-[640px] overflow-y-auto pr-1">
              {filteredCatalog.map(item => {
                const isOutOfStock = item.type !== 'service' && typeof item.stockQty === 'number' && item.stockQty <= 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => addToCart(item)}
                    className={`flex flex-col justify-between rounded-2xl border bg-white p-3.5 text-left shadow-xs transition-all hover:border-emerald-500 hover:shadow-md active:scale-98 ${
                      isOutOfStock ? 'opacity-50 grayscale cursor-not-allowed border-gray-200' : 'border-gray-200/90'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            item.type === 'service'
                              ? 'bg-purple-100 text-purple-800'
                              : item.type === 'drink'
                              ? 'bg-blue-100 text-blue-800'
                              : item.type === 'food'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.type}
                        </span>
                        {item.type !== 'service' && typeof item.stockQty === 'number' && (
                          <span
                            className={`text-[10px] font-semibold ${
                              item.stockQty <= 5 ? 'text-rose-600 font-bold' : 'text-gray-400'
                            }`}
                          >
                            {item.stockQty} {item.unit}
                          </span>
                        )}
                      </div>
                      <h4 className="mt-1.5 text-xs font-bold text-gray-900 line-clamp-2">
                        {isMm && item.nameMm ? item.nameMm : item.name}
                      </h4>
                    </div>

                    <div className="mt-3 flex items-end justify-between border-t border-gray-100 pt-2">
                      <span className="text-xs font-extrabold text-emerald-700">{formatMMK(item.priceMMK)}</span>
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                        <Plus className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: POS Bill & Split-Tender Checkout (5 or 4 cols on lg) */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xs lg:col-span-5 xl:col-span-4 flex flex-col justify-between">
            <div>
              {/* Cart Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-gray-900">
                    {isMm ? 'ကျသင့်ငွေစာရင်း (Bill / Cart)' : 'Bill & Order Cart'}
                  </h3>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                    {cart.reduce((sum, i) => sum + i.quantity, 0)}
                  </span>
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-[11px] text-gray-400 hover:text-rose-600 font-medium"
                  >
                    {isMm ? 'ရှင်းလင်းမည်' : 'Clear'}
                  </button>
                )}
              </div>

              {/* Customer Selection with Debt Balance Indicator */}
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-gray-600">
                    {isMm ? 'ဝယ်ယူသူ ဖောက်သည်' : 'Customer'}
                  </label>
                  {selectedCustomerId && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                      {isMm ? 'လက်ရှိအကြွေးကျန်:' : 'Current Debt:'}{' '}
                      {formatMMK(customers.find(c => c.id === selectedCustomerId)?.currentBalanceMMK || 0)}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Customer Name"
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-900 focus:bg-white focus:outline-hidden"
                  />
                  <select
                    value={selectedCustomerId}
                    onChange={e => {
                      const cId = e.target.value;
                      setSelectedCustomerId(cId);
                      const cust = customers.find(c => c.id === cId);
                      if (cust) {
                        setCustomerName(cust.name);
                        setCustomerPhone(cust.phone || '');
                      }
                    }}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 focus:bg-white"
                  >
                    <option value="">{isMm ? 'VIP ရွေးရန်' : 'Select Customer'}</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.currentBalanceMMK > 0 ? `(${formatMMK(c.currentBalanceMMK)} debt)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Customer Value Assets Banner (Membership / Packages / Gift Cards) */}
                {selectedCustomerId && (customerActiveMembership || customerPackages.length > 0 || customerGiftCards.length > 0) && (
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-2.5 space-y-1.5 text-[11px]">
                    {customerActiveMembership && (
                      <div className="flex items-center justify-between text-cyan-950 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-cyan-700" />
                          <span>{customerActiveMembership.planName} ({customerActiveMembership.discountPercent}% OFF)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setDiscountType('percentage');
                            setDiscountValue(customerActiveMembership.discountPercent);
                          }}
                          className="rounded bg-cyan-700 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-cyan-800"
                        >
                          {isMm ? 'အဖွဲ့ဝင် လျှော့ဈေးထည့်' : 'Apply Discount'}
                        </button>
                      </div>
                    )}

                    {customerPackages.length > 0 && (
                      <div className="space-y-1 pt-0.5 border-t border-cyan-200/60">
                        {customerPackages.map(pkg => (
                          <div key={pkg.id} className="flex items-center justify-between text-indigo-950">
                            <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                              <Package className="h-3.5 w-3.5 text-indigo-700 shrink-0" />
                              <span className="truncate">{pkg.packageName}: <b>{pkg.remainingQty}</b> left</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const svcIndex = cart.findIndex(c => c.type === 'service' && (!c.discountMMK || c.discountMMK === 0));
                                if (svcIndex >= 0) {
                                  const updated = [...cart];
                                  updated[svcIndex] = {
                                    ...updated[svcIndex],
                                    discountMMK: updated[svcIndex].unitPriceMMK,
                                  };
                                  setCart(updated);
                                } else {
                                  alert(isMm ? 'ကာတ်ထဲတွင် ဝန်ဆောင်မှု မရှိသေးပါ' : 'No service line item found in cart to apply package session to');
                                }
                              }}
                              className="rounded bg-indigo-700 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-indigo-800"
                            >
                              {isMm ? '၁ ကြိမ် အသုံးပြု' : 'Redeem 1'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {customerGiftCards.length > 0 && (
                      <div className="space-y-1 pt-0.5 border-t border-cyan-200/60">
                        {customerGiftCards.map(gc => (
                          <div key={gc.id} className="flex items-center justify-between text-emerald-950">
                            <span className="flex items-center gap-1.5">
                              <Gift className="h-3.5 w-3.5 text-emerald-700" />
                              <span className="font-mono text-[10px]">{gc.cardNumber}: {formatMMK(gc.currentBalanceMMK)}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSinglePaymentMethod('gift_card');
                                setSelectedGiftCardForPayment(gc);
                                setGiftCardNumberInput(gc.cardNumber);
                              }}
                              className="rounded bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-800"
                            >
                              {isMm ? 'ကတ်ဖြင့်ပေး' : 'Use Card'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="mt-4 max-h-52 space-y-2 overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    <ShoppingBag className="mx-auto h-7 w-7 text-gray-300 mb-1.5" />
                    <p>{isMm ? 'ပစ္စည်း ရွေးချယ်ထားခြင်း မရှိသေးပါ' : 'Your cart is empty'}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {isMm ? 'ဘယ်ဘက်မှ ပစ္စည်းများကို နှိပ်၍ ထည့်ပါ' : 'Click items on the left to add'}
                    </p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/80 p-2.5 text-xs"
                    >
                      <div className="flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-gray-200/80 px-1 py-0.2 text-[9px] font-bold text-gray-700 uppercase">
                            {item.type}
                          </span>
                          <h5 className="font-semibold text-gray-900 line-clamp-1">
                            {isMm && item.nameMm ? item.nameMm : item.name}
                          </h5>
                        </div>
                        <span className="text-[11px] text-gray-500 font-mono">
                          {formatMMK(item.unitPriceMMK)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, -1)}
                          className="flex h-5 w-5 items-center justify-center rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center font-bold text-gray-900">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, 1)}
                          className="flex h-5 w-5 items-center justify-center rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="ml-1 text-gray-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bill Summary, Discounts, and Multi-Payment Controls */}
            <div className="mt-4 border-t border-gray-100 pt-3 space-y-3 text-xs">
              {/* Discount Selector */}
              <div className="rounded-xl bg-gray-50 p-2.5 border border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-gray-700">
                    <Tag className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{isMm ? 'လျှော့ဈေး (Discount)' : 'Discount'}</span>
                  </div>
                  <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setDiscountType('percentage')}
                      className={`rounded px-1.5 py-0.5 font-bold ${
                        discountType === 'percentage' ? 'bg-emerald-600 text-white' : 'text-gray-600'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`rounded px-1.5 py-0.5 font-bold ${
                        discountType === 'fixed' ? 'bg-emerald-600 text-white' : 'text-gray-600'
                      }`}
                    >
                      MMK
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={discountValue || ''}
                    onChange={e => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder={discountType === 'percentage' ? 'Discount %' : 'Discount MMK'}
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-900"
                  />
                  <div className="flex gap-1">
                    {discountType === 'percentage' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setDiscountValue(5)}
                          className="rounded bg-gray-200 px-1.5 py-1 text-[10px] font-semibold hover:bg-gray-300"
                        >
                          5%
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountValue(10)}
                          className="rounded bg-gray-200 px-1.5 py-1 text-[10px] font-semibold hover:bg-gray-300"
                        >
                          10%
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountValue(15)}
                          className="rounded bg-gray-200 px-1.5 py-1 text-[10px] font-semibold hover:bg-gray-300"
                        >
                          15%
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setDiscountValue(5000)}
                          className="rounded bg-gray-200 px-1.5 py-1 text-[10px] font-semibold hover:bg-gray-300"
                        >
                          5K
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountValue(10000)}
                          className="rounded bg-gray-200 px-1.5 py-1 text-[10px] font-semibold hover:bg-gray-300"
                        >
                          10K
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Taxes and Totals Breakdown */}
              <div className="space-y-1 text-gray-600">
                <div className="flex justify-between">
                  <span>{isMm ? 'စုစုပေါင်း (Subtotal):' : 'Subtotal:'}</span>
                  <span className="font-semibold text-gray-900 font-mono">{formatMMK(directTotals.subtotalMMK)}</span>
                </div>

                {directTotals.discountAmountMMK > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>
                      {isMm ? 'လျှော့ဈေး' : 'Discount'} ({discountValue}
                      {discountType === 'percentage' ? '%' : ' MMK'}):
                    </span>
                    <span className="font-mono">-{formatMMK(directTotals.discountAmountMMK)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyServiceCharge}
                      onChange={e => setApplyServiceCharge(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Service Charge ({settings?.serviceChargePercent || 5}%)</span>
                  </label>
                  <span className="font-mono">{formatMMK(directTotals.serviceChargeAmountMMK)}</span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyTax}
                      onChange={e => setApplyTax(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Commercial Tax ({settings?.taxPercent || 5}%)</span>
                  </label>
                  <span className="font-mono">{formatMMK(directTotals.taxAmountMMK)}</span>
                </div>

                <div className="flex justify-between border-t border-gray-200 pt-1.5 text-base font-extrabold text-gray-900">
                  <span>{isMm ? 'ကျသင့်ငွေ စုစုပေါင်း:' : 'GRAND TOTAL:'}</span>
                  <span className="text-emerald-700 font-mono">{formatMMK(directTotals.totalMMK)}</span>
                </div>
              </div>

              {/* Payment Mode Selector: Single Payment vs Multi-Payment Split */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-gray-700">{isMm ? 'ငွေပေးချေမှု နည်းလမ်း' : 'Payment Method'}</span>
                  <button
                    type="button"
                    onClick={() => setIsMultiPaymentMode(!isMultiPaymentMode)}
                    className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <Layers className="h-3 w-3" />
                    <span>
                      {isMultiPaymentMode
                        ? isMm
                          ? 'တစ်ခုတည်း ပေးချေမည်'
                          : 'Single Payment'
                        : isMm
                        ? 'ခွဲခြား ပေးချေမည် (Split Tender)'
                        : 'Split Tender Payment'}
                    </span>
                  </button>
                </div>

                {!isMultiPaymentMode ? (
                  /* Single Payment Flow */
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'cash', label: 'Cash' },
                        { id: 'kpay', label: 'KBZ Pay' },
                        { id: 'wave', label: 'Wave' },
                        { id: 'bank', label: 'Bank' },
                        { id: 'gift_card', label: 'Gift Card' },
                        { id: 'credit', label: 'Credit' },
                      ].map(pm => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setSinglePaymentMethod(pm.id as any)}
                          className={`rounded-lg py-1.5 text-center font-semibold text-xs transition-all ${
                            singlePaymentMethod === pm.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {pm.label}
                        </button>
                      ))}
                    </div>

                    {singlePaymentMethod === 'cash' && directTotals.totalMMK > 0 && (
                      <div className="rounded-xl bg-gray-50 p-2 border border-gray-100 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">{isMm ? 'လက်ခံရရှိငွေ (Tendered):' : 'Tendered Cash:'}</span>
                          <input
                            type="number"
                            value={singleTenderedCash || directTotals.totalMMK}
                            onChange={e => setSingleTenderedCash(parseInt(e.target.value) || 0)}
                            className="w-28 rounded-lg border border-gray-200 bg-white p-1 text-right text-xs font-bold font-mono"
                          />
                        </div>
                        <div className="flex justify-between items-center font-bold">
                          <span>{isMm ? 'ပြန်အမ်းငွေ (Change):' : 'Change:'}</span>
                          <span className="text-emerald-700 font-mono">
                            {formatMMK(singleChangeInfo.changeMMK)}
                          </span>
                        </div>
                      </div>
                    )}

                    {singlePaymentMethod === 'gift_card' && (
                      <div className="rounded-xl bg-amber-50/60 p-2.5 border border-amber-200 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                          <span className="flex items-center gap-1">
                            <Gift className="h-3.5 w-3.5 text-amber-700" />
                            <span>{isMm ? 'လက်ဆောင်ကတ်ဖြင့် ရှင်းမည်' : 'Gift Card Payment'}</span>
                          </span>
                          {selectedGiftCardForPayment && (
                            <span className="font-mono text-emerald-800">
                              {formatMMK(selectedGiftCardForPayment.currentBalanceMMK)}
                            </span>
                          )}
                        </div>

                        {customerGiftCards.length > 0 && (
                          <div className="flex gap-1 overflow-x-auto pb-1">
                            {customerGiftCards.map(gc => (
                              <button
                                key={gc.id}
                                type="button"
                                onClick={() => {
                                  setSelectedGiftCardForPayment(gc);
                                  setGiftCardNumberInput(gc.cardNumber);
                                }}
                                className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold border ${
                                  giftCardNumberInput === gc.cardNumber
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-white text-gray-700 border-gray-200'
                                }`}
                              >
                                {gc.cardNumber} ({formatMMK(gc.currentBalanceMMK)})
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={giftCardNumberInput}
                            onChange={e => setGiftCardNumberInput(e.target.value)}
                            placeholder="Enter Card # (e.g. GC-2026-XXXX)"
                            className="flex-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-mono font-bold text-gray-900"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const num = giftCardNumberInput.trim();
                              if (!num) return;
                              const card = await db.giftCards.where('cardNumber').equals(num).first();
                              if (card) {
                                setSelectedGiftCardForPayment(card);
                                setGiftCardCheckError('');
                              } else {
                                setGiftCardCheckError(isMm ? 'လက်ဆောင်ကတ် မတွေ့ပါ' : 'Card not found');
                              }
                            }}
                            className="rounded-lg bg-amber-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-700"
                          >
                            {isMm ? 'စစ်ဆေးမည်' : 'Check'}
                          </button>
                        </div>
                        {giftCardCheckError && (
                          <p className="text-[10px] text-rose-600 font-semibold">{giftCardCheckError}</p>
                        )}
                      </div>
                    )}

                    {singlePaymentMethod !== 'cash' && singlePaymentMethod !== 'credit' && singlePaymentMethod !== 'gift_card' && (
                      <input
                        type="text"
                        value={singlePaymentRef}
                        onChange={e => setSinglePaymentRef(e.target.value)}
                        placeholder="Transaction / Ref #"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-900"
                      />
                    )}
                  </div>
                ) : (
                  /* Multi-Payment Split Tender Flow */
                  <div className="rounded-xl bg-gray-50 p-2.5 border border-gray-100 space-y-2">
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {splitPayments.map((pmt, idx) => (
                        <div key={pmt.id} className="flex items-center gap-1.5">
                          <select
                            value={pmt.method}
                            onChange={e => {
                              const m = e.target.value as PaymentMethod;
                              setSplitPayments(rows =>
                                rows.map(r => (r.id === pmt.id ? { ...r, method: m } : r))
                              );
                            }}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold"
                          >
                            <option value="cash">Cash</option>
                            <option value="kpay">KBZ Pay</option>
                            <option value="wave">Wave</option>
                            <option value="bank">Bank</option>
                            <option value="gift_card">Gift Card</option>
                            <option value="credit">Credit (Debt)</option>
                          </select>

                          <input
                            type="number"
                            value={pmt.amountMMK || ''}
                            onChange={e => {
                              const amt = Math.max(0, parseInt(e.target.value) || 0);
                              setSplitPayments(rows =>
                                rows.map(r => (r.id === pmt.id ? { ...r, amountMMK: amt } : r))
                              );
                            }}
                            placeholder="Amount MMK"
                            className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-mono font-bold"
                          />

                          {splitPayments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setSplitPayments(rows => rows.filter(r => r.id !== pmt.id))}
                              className="text-gray-400 hover:text-rose-600 p-1"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-200 pt-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSplitPayments(rows => [
                            ...rows,
                            {
                              id: 'pmt_' + Date.now(),
                              method: 'kpay',
                              amountMMK: splitBalanceDue,
                            },
                          ])
                        }
                        className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        <span>{isMm ? 'ငွေပေးချေမှု လိုင်းထပ်ထည့်မည်' : 'Add Split Line'}</span>
                      </button>

                      <div className="text-right text-[11px]">
                        <span className="text-gray-500">
                          {isMm ? 'ကျန်ငွေ:' : 'Remaining Due:'}{' '}
                        </span>
                        <span
                          className={`font-bold font-mono ${
                            splitBalanceDue > 0 ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {formatMMK(splitBalanceDue)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Gratuity & Staff Tip Section */}
              <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowTipSection(!showTipSection)}
                    className="flex items-center gap-1.5 text-xs font-bold text-rose-900 hover:text-rose-950"
                  >
                    <HeartHandshake className="h-4 w-4 text-rose-600" />
                    <span>{isMm ? 'ဝန်ထမ်း ဘောက်ဆူး ပေးမည် (Staff Gratuity / Tip)' : 'Staff Tip / Gratuity'}</span>
                  </button>
                  {tipAmountMMK > 0 && (
                    <span className="font-mono text-xs font-bold text-rose-800">
                      +{formatMMK(tipAmountMMK)}
                    </span>
                  )}
                </div>

                {showTipSection && (
                  <div className="space-y-2 pt-1 border-t border-rose-200/60 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-600 block mb-0.5">
                          {isMm ? 'ရရှိမည့် ဝန်ထမ်း' : 'Staff Member'}
                        </label>
                        <select
                          value={tipStaffId}
                          onChange={e => setTipStaffId(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800"
                        >
                          <option value="">{isMm ? 'ဝန်ထမ်းရွေးရန်' : 'Select Staff'}</option>
                          {(staff || []).map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.role})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-gray-600 block mb-0.5">
                          {isMm ? 'ဘောက်ဆူး ပမာဏ (MMK)' : 'Tip Amount (MMK)'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={tipAmountMMK || ''}
                          onChange={e => setTipAmountMMK(Math.max(0, parseInt(e.target.value) || 0))}
                          placeholder="e.g. 5,000"
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-mono font-bold text-rose-800"
                        />
                      </div>
                    </div>

                    <div className="flex gap-1.5 items-center">
                      <span className="text-[10px] text-gray-500">{isMm ? 'အမြန်ရွေး:' : 'Quick:'}</span>
                      {[2000, 5000, 10000, 20000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setTipAmountMMK(amt)}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${
                            tipAmountMMK === amt ? 'bg-rose-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
                          }`}
                        >
                          {amt / 1000}K
                        </button>
                      ))}
                      {tipAmountMMK > 0 && (
                        <button
                          type="button"
                          onClick={() => setTipAmountMMK(0)}
                          className="text-[10px] text-gray-400 hover:text-gray-600 ml-auto"
                        >
                          {isMm ? 'ဖျက်မည်' : 'Clear'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Checkout Action Button */}
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={handleExecuteDirectCheckout}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Printer className="h-4 w-4" />
                <span>
                  {isMm
                    ? 'ငွေရှင်းပြီး ဘောက်ချာထုတ်မည် (Checkout & Print)'
                    : 'Complete Sale & Print Receipt'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ACTIVE SESSIONS & ROOM CHECKOUT HUB */}
      {/* ========================================================================= */}
      {activeSubTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span>
                {isMm
                  ? 'လက်ရှိ ဝန်ဆောင်မှုဆောင်ရွက်ဆဲ အခန်းများ (Active Sessions)'
                  : 'Active Sessions & Rooms'}
              </span>
            </h2>
            <span className="text-xs text-gray-500">
              {activeSessions.length} {isMm ? 'ခု လည်ပတ်နေပါသည်' : 'active'}
            </span>
          </div>

          {activeSessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-400">
              <Clock className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm font-semibold">
                {isMm ? 'လက်ရှိ ဝန်ဆောင်မှုပေးနေသော အခန်း မရှိသေးပါ' : 'No active sessions currently running'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {isMm
                  ? 'Rooms view မှတစ်ဆင့် Session အသစ် စတင်နိုင်ပါသည်'
                  : 'You can start new sessions from the Rooms tab.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {activeSessions.map(sess => {
                const now = new Date();
                const elapsedMins = calculateDurationMinutes(sess.startTime, now.toISOString());
                const isOvertime = elapsedMins > sess.plannedDurationMinutes;

                // Estimate charge
                const basePrice = sess.priceSnapshot?.basePriceMMK ?? sess.basePriceMMK ?? 0;
                const roomSurcharge = sess.priceSnapshot?.roomSurchargeMMK ?? sess.roomSurchargeMMK ?? 0;
                const hourlyRate = sess.priceSnapshot?.hourlyRateMMK ?? 0;

                const pricing = calculateSessionPricing({
                  basePriceMMK: basePrice,
                  roomSurchargeMMK: roomSurcharge,
                  plannedMinutes: sess.plannedDurationMinutes,
                  actualMinutes: Math.max(sess.plannedDurationMinutes, elapsedMins),
                  hourlyRateMMK: hourlyRate,
                });

                const foodDrinksTotal = (sess.orderItems || []).reduce((s, o) => s + o.totalPriceMMK, 0);
                const estimatedTotal = pricing.totalServicePriceMMK + foodDrinksTotal;

                return (
                  <div
                    key={sess.id}
                    className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition-all ${
                      isOvertime ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-200'
                    }`}
                  >
                    <div>
                      {/* Session Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            {sess.roomName}
                          </span>
                          <h3 className="mt-1 text-sm font-bold text-gray-900">{sess.serviceName}</h3>
                          <p className="text-xs text-gray-500">
                            {isMm ? 'ဧည့်သည်:' : 'Guest:'} <span className="font-semibold text-gray-800">{sess.customerName}</span>
                          </p>
                        </div>
                        <span className="font-mono text-[11px] text-gray-400">{sess.sessionCode}</span>
                      </div>

                      {/* Timer & Duration Breakdown */}
                      <div className="mt-3 rounded-xl bg-gray-50 p-3 border border-gray-100 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">{isMm ? 'ကြာချိန်:' : 'Elapsed Duration:'}</span>
                          <span className={`font-bold font-mono ${isOvertime ? 'text-amber-600' : 'text-gray-900'}`}>
                            {elapsedMins} / {sess.plannedDurationMinutes} mins
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">{isMm ? 'တာဝန်ကျ ဝန်ထမ်း:' : 'Staff Assigned:'}</span>
                          <span className="font-semibold text-gray-800">
                            {sess.assignedStaff.map(s => s.staffName).join(', ') || 'N/A'}
                          </span>
                        </div>

                        {foodDrinksTotal > 0 && (
                          <div className="flex justify-between items-center text-blue-700">
                            <span>{isMm ? 'စားသောက်ဖွယ်ရာများ:' : 'Food & Drinks:'}</span>
                            <span className="font-mono font-semibold">{formatMMK(foodDrinksTotal)}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center border-t border-gray-200 pt-1 font-bold">
                          <span className="text-gray-700">{isMm ? 'ခန့်မှန်း ကျသင့်ငွေ:' : 'Est. Charge:'}</span>
                          <span className="text-emerald-700 font-mono">{formatMMK(estimatedTotal)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Checkout Button */}
                    <div className="mt-4 pt-2">
                      <button
                        type="button"
                        onClick={() => handleOpenSessionCheckout(sess)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                      >
                        <Receipt className="h-4 w-4" />
                        <span>{isMm ? 'ဘေလ်ရှင်းမည် (Checkout Bill)' : 'Checkout & Bill'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BILLS & INVOICE MANAGEMENT / LEDGER */}
      {/* ========================================================================= */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder={
                  isMm
                    ? 'ဘေလ်နံပါတ်၊ ဖောက်သည်အမည်၊ ငွေကိုင် ရှာဖွေရန်...'
                    : 'Search bill #, customer, cashier...'
                }
                className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2 text-xs text-gray-900 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {[
                { id: 'all', labelEn: 'All Bills', labelMm: 'အားလုံး' },
                { id: 'unpaid', labelEn: 'Unpaid', labelMm: 'မပေးရသေး' },
                { id: 'partial', labelEn: 'Partial', labelMm: 'တစ်စိတ်တစ်ပိုင်း' },
                { id: 'paid', labelEn: 'Paid', labelMm: 'ပေးချေပြီး' },
                { id: 'credit', labelEn: 'Credit', labelMm: 'အကြွေး' },
                { id: 'voided', labelEn: 'Voided', labelMm: 'ပယ်ဖျက်ပြီး' },
              ].map(st => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setHistoryStatusFilter(st.id)}
                  className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    historyStatusFilter === st.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isMm ? st.labelMm : st.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Invoices Table */}
          <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3">{isMm ? 'ဘေလ်နံပါတ်' : 'Bill #'}</th>
                    <th className="px-4 py-3">{isMm ? 'ရက်စွဲနှင့် အချိန်' : 'Date & Time'}</th>
                    <th className="px-4 py-3">{isMm ? 'ဖောက်သည်' : 'Customer'}</th>
                    <th className="px-4 py-3 text-right">{isMm ? 'ကျသင့်ငွေ' : 'Total'}</th>
                    <th className="px-4 py-3 text-right">{isMm ? 'ပေးချေပြီး' : 'Paid'}</th>
                    <th className="px-4 py-3 text-right">{isMm ? 'ကျန်ငွေ' : 'Balance Due'}</th>
                    <th className="px-4 py-3 text-center">{isMm ? 'အခြေအနေ' : 'Status'}</th>
                    <th className="px-4 py-3 text-right">{isMm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredHistoryInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-gray-400">
                        {isMm ? 'ဘေလ်မှတ်တမ်း မရှိပါ' : 'No bills found matching your criteria'}
                      </td>
                    </tr>
                  ) : (
                    filteredHistoryInvoices.map(bill => {
                      const isVoid = bill.status === 'voided';
                      return (
                        <tr
                          key={bill.id}
                          className={`hover:bg-gray-50/80 transition-colors ${
                            isVoid ? 'bg-gray-50/60 opacity-60' : ''
                          }`}
                        >
                          <td className="px-4 py-3 font-mono font-bold text-gray-900">
                            {bill.invoiceCode}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(bill.createdAt).toLocaleDateString()}{' '}
                            <span className="text-[10px]">
                              {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {bill.customerName}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                            {formatMMK(bill.totalMMK)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-700">
                            {formatMMK(bill.paidAmountMMK)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold">
                            <span className={bill.balanceDueMMK > 0 ? 'text-rose-600' : 'text-gray-400'}>
                              {formatMMK(bill.balanceDueMMK)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                bill.status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : bill.status === 'partial'
                                  ? 'bg-amber-100 text-amber-800'
                                  : bill.status === 'credit'
                                  ? 'bg-purple-100 text-purple-800'
                                  : bill.status === 'voided'
                                  ? 'bg-gray-200 text-gray-700 line-through'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {bill.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right space-x-1">
                            <button
                              type="button"
                              onClick={() => setSelectedBillForDetail(bill)}
                              title="View Breakdown"
                              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            >
                              <FileText className="h-4 w-4" />
                            </button>

                            {!isVoid && bill.balanceDueMMK > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBillForPayment(bill);
                                  setSubsequentPaymentAmount(bill.balanceDueMMK);
                                }}
                                title="Add Payment"
                                className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800"
                              >
                                <DollarSign className="h-4 w-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onShowReceipt(bill)}
                              title="Print Receipt"
                              className="rounded-lg p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                            >
                              <Printer className="h-4 w-4" />
                            </button>

                            {!isVoid && (
                              <button
                                type="button"
                                onClick={() => setBillToVoid(bill)}
                                title="Void / Cancel Bill"
                                className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                              >
                                <RotateCcw className="h-4 w-4" />
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CUSTOM LINE ITEM CREATOR */}
      {/* ========================================================================= */}
      {showCustomItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-sm font-bold text-gray-900">
                {isMm ? 'သီးသန့် ပစ္စည်း / ဝန်ဆောင်မှု ထည့်သွင်းရန်' : 'Add Custom Line Item'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomItemModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-gray-700">{isMm ? 'အမျိုးအစား' : 'Type'}</label>
                <select
                  value={customItemType}
                  onChange={e => setCustomItemType(e.target.value as any)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-semibold"
                >
                  <option value="service">Service (ဝန်ဆောင်မှု)</option>
                  <option value="product">Product (ပစ္စည်း)</option>
                  <option value="food">Food (အစားအသောက်)</option>
                  <option value="drink">Drink (အအေး/ဘီယာ)</option>
                  <option value="other">Other (အခြား)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'အမည် / ဖော်ပြချက်' : 'Description'}
                </label>
                <input
                  type="text"
                  value={customItemName}
                  onChange={e => setCustomItemName(e.target.value)}
                  placeholder="e.g. VIP Room Charge, Special Drink"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">
                    {isMm ? 'နှုန်းထား (Unit Price MMK)' : 'Unit Price MMK'}
                  </label>
                  <input
                    type="number"
                    value={customItemPrice || ''}
                    onChange={e => setCustomItemPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">{isMm ? 'အရေအတွက်' : 'Quantity'}</label>
                  <input
                    type="number"
                    min="1"
                    value={customItemQty}
                    onChange={e => setCustomItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-mono font-bold text-center"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomItemModal(false)}
                className="flex-1 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-200"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleAddCustomItem}
                disabled={!customItemName.trim() || customItemPrice <= 0}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isMm ? 'ထည့်မည်' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ACTIVE SESSION CHECKOUT DRAWER */}
      {/* ========================================================================= */}
      {selectedSessionForCheckout && computedSessionTotals && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-2xl space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  {selectedSessionForCheckout.roomName}
                </span>
                <h3 className="text-base font-bold text-gray-900 mt-0.5">
                  {isMm ? 'ဝန်ဆောင်မှု ဘေလ်ရှင်းရန်' : 'Session Checkout & Payment'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionForCheckout(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Session Info Details */}
            <div className="rounded-xl bg-gray-50 p-3.5 border border-gray-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">{isMm ? 'ဖောက်သည် အမည်:' : 'Customer:'}</span>
                <span className="font-bold text-gray-900">{selectedSessionForCheckout.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{isMm ? 'ဝန်ဆောင်မှု:' : 'Service:'}</span>
                <span className="font-semibold text-gray-800">{selectedSessionForCheckout.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{isMm ? 'ကြာချိန်:' : 'Actual Duration:'}</span>
                <span className="font-mono font-bold text-emerald-700">
                  {computedSessionTotals.elapsedMinutes} mins ({selectedSessionForCheckout.plannedDurationMinutes} mins planned)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{isMm ? 'တာဝန်ကျ ဝန်ထမ်း:' : 'Staff Assigned:'}</span>
                <span className="font-semibold text-gray-800">
                  {selectedSessionForCheckout.assignedStaff.map(s => s.staffName).join(', ')}
                </span>
              </div>
            </div>

            {/* Itemized Line Items Breakdown */}
            <div className="space-y-1.5 text-xs">
              <span className="font-bold text-gray-700 uppercase text-[10px] tracking-wider block">
                {isMm ? 'ကျသင့်ငွေ အသေးစိတ်' : 'Line Items'}
              </span>
              <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                {computedSessionTotals.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between p-2.5">
                    <div>
                      <span className="font-semibold text-gray-900">{it.description}</span>
                      {it.quantity > 1 && (
                        <span className="text-[10px] text-gray-500 block">
                          {it.quantity} x {formatMMK(it.unitPriceMMK)}
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-gray-800">{formatMMK(it.totalPriceMMK)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Discount and Payment Controls */}
            <div className="space-y-2 border-t border-gray-100 pt-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-700">{isMm ? 'လျှော့ဈေး' : 'Discount:'}</span>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="0"
                    value={sessionDiscountValue || ''}
                    onChange={e => setSessionDiscountValue(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="Discount MMK"
                    className="w-32 rounded-lg border border-gray-200 p-1 text-right font-mono font-bold text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-between text-base font-extrabold text-gray-900 border-t border-gray-200 pt-2">
                <span>{isMm ? 'စုစုပေါင်း ကျသင့်ငွေ:' : 'TOTAL AMOUNT:'}</span>
                <span className="text-emerald-700 font-mono">
                  {formatMMK(computedSessionTotals.invoiceCalc.totalMMK)}
                </span>
              </div>

              <div className="pt-2">
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'ငွေပေးချေမှု နည်းလမ်း' : 'Payment Method'}
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {['cash', 'kpay', 'wave', 'credit'].map(pm => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setSessionPaymentMethod(pm as any)}
                      className={`rounded-lg py-1.5 text-center font-semibold text-xs transition-all ${
                        sessionPaymentMethod === pm
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pm.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {sessionPaymentMethod === 'cash' && (
                <div className="flex justify-between items-center rounded-xl bg-gray-50 p-2">
                  <span className="text-gray-600">{isMm ? 'လက်ခံရရှိငွေ:' : 'Tendered Cash:'}</span>
                  <input
                    type="number"
                    value={sessionTenderedCash || computedSessionTotals.invoiceCalc.totalMMK}
                    onChange={e => setSessionTenderedCash(parseInt(e.target.value) || 0)}
                    className="w-28 rounded-lg border border-gray-200 bg-white p-1 text-right text-xs font-bold font-mono"
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSelectedSessionForCheckout(null)}
                className="flex-1 rounded-xl bg-gray-100 py-3 text-xs font-bold text-gray-700 hover:bg-gray-200"
              >
                {isMm ? 'ပိတ်မည်' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleExecuteSessionCheckout}
                className="flex-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{isMm ? 'ငွေရှင်းပြီး အခန်းသိမ်းမည်' : 'Checkout & Finish'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUBSEQUENT PAYMENT MODAL */}
      {/* ========================================================================= */}
      {selectedBillForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-sm font-bold text-gray-900">
                {isMm ? 'ငွေထပ်ဆောင်းသွင်းရန်' : 'Record Subsequent Payment'}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedBillForPayment(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl bg-gray-50 p-3 border border-gray-100 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Bill #:</span>
                <span className="font-bold text-gray-900">{selectedBillForPayment.invoiceCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{isMm ? 'ဖောက်သည်:' : 'Customer:'}</span>
                <span className="font-semibold text-gray-800">{selectedBillForPayment.customerName}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 font-bold">
                <span>{isMm ? 'ပေးရန်ကျန်ငွေ:' : 'Outstanding Balance:'}</span>
                <span className="text-rose-600 font-mono">
                  {formatMMK(selectedBillForPayment.balanceDueMMK)}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'ငွေပေးချေမှု နည်းလမ်း' : 'Payment Method'}
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {['cash', 'kpay', 'wave', 'bank'].map(pm => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setSubsequentPaymentMethod(pm as any)}
                      className={`rounded-lg py-1.5 text-center font-semibold text-xs ${
                        subsequentPaymentMethod === pm
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pm.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'ပေးချေမည့် ပမာဏ' : 'Payment Amount MMK'}
                </label>
                <input
                  type="number"
                  value={subsequentPaymentAmount || ''}
                  onChange={e => setSubsequentPaymentAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'မှတ်ချက် / Transaction Ref' : 'Notes / Reference'}
                </label>
                <input
                  type="text"
                  value={subsequentPaymentNotes}
                  onChange={e => setSubsequentPaymentNotes(e.target.value)}
                  placeholder="e.g. Paid via KPay mobile"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBillForPayment(null)}
                className="flex-1 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-200"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleExecuteSubsequentPayment}
                disabled={subsequentPaymentAmount <= 0}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isMm ? 'သိမ်းဆည်းမည်' : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BILL BREAKDOWN & DETAIL */}
      {/* ========================================================================= */}
      {selectedBillForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white p-6 shadow-2xl space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {selectedBillForDetail.invoiceCode}
                </h3>
                <p className="text-xs text-gray-500">
                  {new Date(selectedBillForDetail.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBillForDetail(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-gray-50 p-3 border border-gray-100 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer:</span>
                  <span className="font-semibold text-gray-900">{selectedBillForDetail.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cashier:</span>
                  <span className="font-semibold text-gray-900">{selectedBillForDetail.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span className="font-bold uppercase tracking-wider text-emerald-700">
                    {selectedBillForDetail.status}
                  </span>
                </div>
              </div>

              {/* Line Items List */}
              <div className="space-y-1.5">
                <span className="font-bold text-gray-700 uppercase text-[10px] tracking-wider block">
                  Purchased Items (Preserved Historical Prices)
                </span>
                <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {selectedBillForDetail.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between p-2.5">
                      <div>
                        <span className="font-semibold text-gray-900">{it.description}</span>
                        {it.quantity > 1 && (
                          <span className="text-[10px] text-gray-500 block">
                            {it.quantity} x {formatMMK(it.unitPriceMMK)}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold">{formatMMK(it.totalPriceMMK)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payments History */}
              <div className="space-y-1.5">
                <span className="font-bold text-gray-700 uppercase text-[10px] tracking-wider block">
                  Payments Breakdown
                </span>
                <div className="rounded-xl bg-gray-50 p-2.5 border border-gray-100 space-y-1">
                  {(selectedBillForDetail.payments || []).map((p, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span className="uppercase text-gray-600">{p.method}:</span>
                      <span className="font-mono font-semibold text-gray-900">{formatMMK(p.amountMMK)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Totals */}
              <div className="border-t border-gray-200 pt-2 space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatMMK(selectedBillForDetail.subtotalMMK)}</span>
                </div>
                {selectedBillForDetail.discountAmountMMK > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span className="font-mono">-{formatMMK(selectedBillForDetail.discountAmountMMK)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-gray-900 border-t border-gray-200 pt-1">
                  <span>TOTAL:</span>
                  <span className="text-emerald-700 font-mono">{formatMMK(selectedBillForDetail.totalMMK)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => onShowReceipt(selectedBillForDetail)}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VOID / CANCELLATION REVERSAL DIALOG */}
      {/* ========================================================================= */}
      {billToVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600 border-b border-gray-100 pb-2">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-bold text-gray-900">
                {isMm ? 'ဘေလ် ပယ်ဖျက်ရန် အတည်ပြုခြင်း' : 'Void & Reverse Bill'}
              </h3>
            </div>

            <p className="text-xs text-gray-600">
              {isMm
                ? 'ဘေလ်ကို ပယ်ဖျက်ပါက ပစ္စည်းများ စာရင်းပြန်တက်မည်ဖြစ်ပြီး ဖောက်သည်အကြွေးနှင့် ဝန်ထမ်းကော်မရှင်များကို အလိုအလျောက် ပြန်လည်နုတ်ယူပါမည်။'
                : 'Voiding this bill will restore product inventory, reverse customer debt, and deduct staff commissions atomically.'}
            </p>

            {voidError && (
              <div className="rounded-xl bg-rose-50 p-2 text-xs font-bold text-rose-700 border border-rose-100">
                {voidError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-gray-700">
                  {isMm ? 'ပယ်ဖျက်ရသည့် အကြောင်းပြချက် *' : 'Mandatory Void Reason *'}
                </label>
                <textarea
                  rows={2}
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  placeholder="e.g. Customer returned goods, Cashier entry error"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs text-gray-900 focus:bg-white"
                />
              </div>

              {settings?.requirePinForVoid && currentUser.role === 'cashier' && (
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">
                    {isMm ? 'မန်နေဂျာ ခွင့်ပြုချက် PIN' : 'Manager Authorization PIN'}
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={voidPin}
                    onChange={e => setVoidPin(e.target.value)}
                    placeholder="****"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-center text-sm font-mono tracking-widest"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setBillToVoid(null);
                  setVoidReason('');
                  setVoidError('');
                }}
                className="flex-1 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-200"
              >
                {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleExecuteVoidBill}
                disabled={!voidReason.trim()}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isMm ? 'ပယ်ဖျက်မည်' : 'Void Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DISCOUNT AUTHORIZATION PIN PROMPT */}
      {/* ========================================================================= */}
      {showDiscountPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 border-b border-gray-100 pb-2">
              <Lock className="h-5 w-5" />
              <h3 className="text-sm font-bold text-gray-900">
                {isMm ? 'လျှော့ဈေး ခွင့်ပြုချက် PIN' : 'Discount Approval PIN'}
              </h3>
            </div>

            <p className="text-xs text-gray-600">
              {isMm
                ? 'လျှော့ဈေးပေးရန် မန်နေဂျာ PIN ထည့်သွင်းပေးပါ'
                : 'Enter manager authorization PIN to apply discount.'}
            </p>

            {discountAuthError && (
              <div className="rounded-xl bg-rose-50 p-2 text-xs font-bold text-rose-700">
                {discountAuthError}
              </div>
            )}

            <input
              type="password"
              maxLength={4}
              value={discountPin}
              onChange={e => setDiscountPin(e.target.value)}
              placeholder="****"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-center text-sm font-mono tracking-widest"
            />

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDiscountPinModal(false);
                  setDiscountAuthError('');
                  setDiscountPin('');
                }}
                className="flex-1 rounded-xl bg-gray-100 py-2 text-xs font-bold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAuthorizeDiscount}
                className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                Authorize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
