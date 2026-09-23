import React, { useState, useEffect, useMemo } from 'react';
import {
  MembershipPlan,
  CustomerMembership,
  ServicePackage,
  CustomerPackage,
  PackageRedemptionRecord,
  GiftCard,
  GiftCardRedemptionRecord,
  TipRecord,
  Customer,
  ServiceItem,
  StaffMember,
  UserAccount,
  PaymentMethod,
} from '../../types';
import { db } from '../../db/database';
import { syncManager } from '../../services/syncManager';
import { localServerClient } from '../../services/localServerClient';
import { formatMMK } from '../../domain/financial';
import { Language } from '../../utils/translations';
import {
  Sparkles,
  Package,
  Gift,
  Coins,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  Calendar,
  CreditCard,
  FileText,
  Percent,
  Check,
  X,
  RefreshCw,
  Award,
  ChevronRight,
  ShieldCheck,
  ArrowRight,
  User,
} from 'lucide-react';

interface MembershipsPackagesViewProps {
  currentUser: UserAccount;
  customers: Customer[];
  services: ServiceItem[];
  staff: StaffMember[];
  lang: Language;
  onRefresh: () => void;
}

type SubTab = 'memberships' | 'packages' | 'giftcards' | 'tips' | 'customer360';

export const MembershipsPackagesView: React.FC<MembershipsPackagesViewProps> = ({
  currentUser,
  customers,
  services,
  staff,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';
  const [activeTab, setActiveTab] = useState<SubTab>('memberships');
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Data Collections
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [customerMemberships, setCustomerMemberships] = useState<CustomerMembership[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [tips, setTips] = useState<TipRecord[]>([]);

  // Modals
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [showPurchaseMembershipModal, setShowPurchaseMembershipModal] = useState(false);
  const [showCreatePackageModal, setShowCreatePackageModal] = useState(false);
  const [showPurchasePackageModal, setShowPurchasePackageModal] = useState(false);
  const [showRedeemPackageModal, setShowRedeemPackageModal] = useState(false);
  const [selectedCustomerPackage, setSelectedCustomerPackage] = useState<CustomerPackage | null>(null);
  const [redeemQty, setRedeemQty] = useState(1);
  const [redeemNotes, setRedeemNotes] = useState('');

  const [showIssueGiftCardModal, setShowIssueGiftCardModal] = useState(false);
  const [showRedeemGiftCardModal, setShowRedeemGiftCardModal] = useState(false);
  const [selectedGiftCard, setSelectedGiftCard] = useState<GiftCard | null>(null);
  const [giftCardRedeemAmount, setGiftCardRedeemAmount] = useState(0);
  const [giftCardRedeemNotes, setGiftCardRedeemNotes] = useState('');

  const [showRecordTipModal, setShowRecordTipModal] = useState(false);

  // Form states: New Plan
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanNameMm, setNewPlanNameMm] = useState('');
  const [newPlanDurationDays, setNewPlanDurationDays] = useState(30);
  const [newPlanPrice, setNewPlanPrice] = useState(50000);
  const [newPlanDiscountPercent, setNewPlanDiscountPercent] = useState(10);
  const [newPlanBenefits, setNewPlanBenefits] = useState('');

  // Form states: Purchase Membership
  const [selCustomerId, setSelCustomerId] = useState('');
  const [selPlanId, setSelPlanId] = useState('');
  const [memPaymentMethod, setMemPaymentMethod] = useState<PaymentMethod>('cash');

  // Form states: New Package Template
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgNameMm, setNewPkgNameMm] = useState('');
  const [newPkgServiceId, setNewPkgServiceId] = useState('');
  const [newPkgTotalQty, setNewPkgTotalQty] = useState(10);
  const [newPkgPrice, setNewPkgPrice] = useState(150000);
  const [newPkgValidityDays, setNewPkgValidityDays] = useState(90);

  // Form states: Purchase Package
  const [pkgCustomerId, setPkgCustomerId] = useState('');
  const [pkgTemplateId, setPkgTemplateId] = useState('');
  const [pkgPaymentMethod, setPkgPaymentMethod] = useState<PaymentMethod>('cash');

  // Form states: Issue Gift Card
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardAmount, setNewCardAmount] = useState(50000);
  const [newCardCustomerId, setNewCardCustomerId] = useState('');
  const [newCardExpiryDays, setNewCardExpiryDays] = useState(365);
  const [newCardPaymentMethod, setNewCardPaymentMethod] = useState<PaymentMethod>('cash');
  const [newCardNotes, setNewCardNotes] = useState('');

  // Form states: Tip
  const [tipStaffId, setTipStaffId] = useState('');
  const [tipAmount, setTipAmount] = useState(5000);
  const [tipPaymentMethod, setTipPaymentMethod] = useState<PaymentMethod>('cash');
  const [tipNotes, setTipNotes] = useState('');

  // Customer 360 View State
  const [c360CustomerId, setC360CustomerId] = useState<string>('');
  const [c360Profile, setC360Profile] = useState<any>(null);

  // Search filters
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pList, cmList, spList, cpList, gcList, tList] = await Promise.all([
        db.membershipPlans.toArray(),
        db.customerMemberships.toArray(),
        db.servicePackages.toArray(),
        db.customerPackages.toArray(),
        db.giftCards.toArray(),
        db.tips.toArray(),
      ]);

      setPlans(pList);
      setCustomerMemberships(cmList);
      setPackages(spList);
      setCustomerPackages(cpList);
      setGiftCards(gcList);
      setTips(tList);
    } catch (err: any) {
      console.error('Error loading Phase 27 data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // 1. Create Membership Plan
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim() || newPlanPrice < 0) {
      showToast('error', isMm ? 'အချက်အလက်များ ပြည့်စုံစွာ ဖြည့်ပါ' : 'Please provide plan name and valid price');
      return;
    }

    const planId = `mplan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const planData: MembershipPlan = {
      id: planId,
      businessId: (currentUser as any).businessId || 'default',
      branchId: (currentUser as any).branchId || 'main',
      name: newPlanName.trim(),
      nameMm: newPlanNameMm.trim() || undefined,
      durationDays: Number(newPlanDurationDays) || 30,
      priceMMK: Number(newPlanPrice) || 0,
      discountPercent: Number(newPlanDiscountPercent) || 0,
      benefitsSummary: newPlanBenefits.trim() || undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await syncManager.executeMutation({
        operationType: 'MEMBERSHIP_PLAN_CREATE',
        entityType: 'MEMBERSHIP_PLAN',
        entityId: planId,
        payload: planData,
        offlineMutationFn: async () => {
          await db.membershipPlans.put(planData);
          return planData;
        },
      });

      showToast('success', isMm ? 'အသင်းဝင် ပလန်အသစ် ထည့်သွင်းပြီးပါပြီ' : 'Membership plan created successfully');
      setShowCreatePlanModal(false);
      setNewPlanName('');
      setNewPlanNameMm('');
      setNewPlanBenefits('');
      loadData();
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create membership plan');
    }
  };

  // 2. Purchase Membership for Customer
  const handlePurchaseMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers.find(c => c.id === selCustomerId);
    const plan = plans.find(p => p.id === selPlanId);

    if (!customer || !plan) {
      showToast('error', isMm ? 'ဖောက်သည်နှင့် ပလန်ကို ရွေးချယ်ပါ' : 'Please select both customer and plan');
      return;
    }

    const membershipId = `cmem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    const expiryObj = new Date(now.getTime() + (plan.durationDays || 30) * 24 * 60 * 60 * 1000);
    const expiryDate = expiryObj.toISOString().split('T')[0];

    const customerMembership: CustomerMembership = {
      id: membershipId,
      businessId: (currentUser as any).businessId || 'default',
      branchId: (currentUser as any).branchId || 'main',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      planId: plan.id,
      planName: plan.name,
      startDate,
      expiryDate,
      discountPercent: plan.discountPercent,
      paidAmountMMK: plan.priceMMK,
      paymentMethod: memPaymentMethod,
      status: 'active',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    try {
      await syncManager.executeMutation({
        operationType: 'MEMBERSHIP_PURCHASE',
        entityType: 'CUSTOMER_MEMBERSHIP',
        entityId: membershipId,
        payload: {
          membershipId,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          planId: plan.id,
          paymentMethod: memPaymentMethod,
          startDate,
        },
        offlineMutationFn: async () => {
          await db.customerMemberships.put(customerMembership);
          if (memPaymentMethod === 'cash' && plan.priceMMK > 0) {
            await db.cashTransactions.add({
              id: `ctx_${Date.now()}`,
              transactionCode: `CTX-${Date.now()}`,
              branchId: (currentUser as any).branchId || 'main',
              type: 'inflow',
              category: 'membership_sale_cash',
              amountMMK: plan.priceMMK,
              referenceType: 'sale',
              referenceId: membershipId,
              notes: `Membership sale: ${plan.name} to ${customer.name}`,
              transactionTime: new Date().toISOString(),
              performedBy: currentUser.name,
              createdAt: new Date().toISOString(),
            });
          }
          return customerMembership;
        },
      });

      showToast('success', isMm ? `${customer.name} အတွက် အသင်းဝင်ကတ် ဝယ်ယူမှု အောင်မြင်ပါသည်` : `Membership successfully purchased for ${customer.name}`);
      setShowPurchaseMembershipModal(false);
      loadData();
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to purchase membership');
    }
  };

  // 3. Create Service Package Template
  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    const service = services.find(s => s.id === newPkgServiceId);
    if (!newPkgName.trim() || !service || newPkgTotalQty <= 0) {
      showToast('error', isMm ? 'ဝန်ဆောင်မှုနှင့် ပက်ကေ့ဂျ်အမည် ဖြည့်ပါ' : 'Please provide package name and valid service');
      return;
    }

    const packageId = `spkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const pkgData: ServicePackage = {
      id: packageId,
      businessId: (currentUser as any).businessId || 'default',
      branchId: (currentUser as any).branchId || 'main',
      name: newPkgName.trim(),
      nameMm: newPkgNameMm.trim() || undefined,
      serviceId: service.id,
      serviceName: service.name,
      totalQty: Number(newPkgTotalQty),
      priceMMK: Number(newPkgPrice),
      validityDays: Number(newPkgValidityDays),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await syncManager.executeMutation({
        operationType: 'SERVICE_PACKAGE_CREATE',
        entityType: 'SERVICE_PACKAGE',
        entityId: packageId,
        payload: pkgData,
        offlineMutationFn: async () => {
          await db.servicePackages.put(pkgData);
          return pkgData;
        },
      });

      showToast('success', isMm ? 'ဝန်ဆောင်မှု ပက်ကေ့ဂျ်အသစ် ထည့်သွင်းပြီးပါပြီ' : 'Service package template created');
      setShowCreatePackageModal(false);
      setNewPkgName('');
      setNewPkgNameMm('');
      loadData();
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create service package');
    }
  };

  // 4. Purchase Package for Customer
  const handlePurchasePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers.find(c => c.id === pkgCustomerId);
    const pkgTemplate = packages.find(p => p.id === pkgTemplateId);

    if (!customer || !pkgTemplate) {
      showToast('error', isMm ? 'ဖောက်သည်နှင့် ပက်ကေ့ဂျ်ကို ရွေးချယ်ပါ' : 'Please select both customer and package');
      return;
    }

    const customerPackageId = `cpkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const expiryObj = new Date(now.getTime() + (pkgTemplate.validityDays || 90) * 24 * 60 * 60 * 1000);
    const expiryDate = expiryObj.toISOString().split('T')[0];

    const newCustPkg: CustomerPackage = {
      id: customerPackageId,
      businessId: (currentUser as any).businessId || 'default',
      branchId: (currentUser as any).branchId || 'main',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      packageId: pkgTemplate.id,
      packageName: pkgTemplate.name,
      serviceId: pkgTemplate.serviceId,
      serviceName: pkgTemplate.serviceName,
      purchasedQty: pkgTemplate.totalQty,
      usedQty: 0,
      remainingQty: pkgTemplate.totalQty,
      expiryDate,
      purchasePriceMMK: pkgTemplate.priceMMK,
      paymentMethod: pkgPaymentMethod,
      status: 'active',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    try {
      await syncManager.executeMutation({
        operationType: 'PACKAGE_PURCHASE',
        entityType: 'CUSTOMER_PACKAGE',
        entityId: customerPackageId,
        payload: {
          customerPackageId,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          packageId: pkgTemplate.id,
          paymentMethod: pkgPaymentMethod,
        },
        offlineMutationFn: async () => {
          await db.customerPackages.put(newCustPkg);
          if (pkgPaymentMethod === 'cash' && pkgTemplate.priceMMK > 0) {
            await db.cashTransactions.add({
              id: `ctx_${Date.now()}`,
              transactionCode: `CTX-${Date.now()}`,
              branchId: (currentUser as any).branchId || 'main',
              type: 'inflow',
              category: 'package_sale_cash',
              amountMMK: pkgTemplate.priceMMK,
              referenceType: 'sale',
              referenceId: customerPackageId,
              notes: `Package sale: ${pkgTemplate.name} to ${customer.name}`,
              transactionTime: new Date().toISOString(),
              performedBy: currentUser.name,
              createdAt: new Date().toISOString(),
            });
          }
          return newCustPkg;
        },
      });

      showToast('success', isMm ? `${customer.name} အတွက် ပက်ကေ့ဂျ် ဝယ်ယူမှု အောင်မြင်ပါသည်` : `Package purchased for ${customer.name}`);
      setShowPurchasePackageModal(false);
      loadData();
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to purchase package');
    }
  };

  // 5. Redeem Package Session (With Over-Redemption Prevention)
  const handleRedeemPackageSession = async () => {
    if (!selectedCustomerPackage) return;
    if (redeemQty <= 0) {
      showToast('error', isMm ? 'အသုံးပြုမည့် အရေအတွက် မှန်ကန်စွာ ထည့်ပါ' : 'Invalid redemption quantity');
      return;
    }
    if (redeemQty > selectedCustomerPackage.remainingQty) {
      showToast('error', isMm ? `လက်ကျန် ${selectedCustomerPackage.remainingQty} ထက် ပို၍ မထုတ်ယူနိုင်ပါ` : `Over-redemption prevented: Only ${selectedCustomerPackage.remainingQty} sessions remain`);
      return;
    }

    try {
      await syncManager.executeMutation({
        operationType: 'PACKAGE_REDEEM',
        entityType: 'PACKAGE_REDEMPTION',
        entityId: selectedCustomerPackage.id,
        payload: {
          customerPackageId: selectedCustomerPackage.id,
          quantity: redeemQty,
          notes: redeemNotes,
        },
        offlineMutationFn: async () => {
          return db.redeemPackageTransaction({
            customerPackageId: selectedCustomerPackage.id,
            quantity: redeemQty,
            redeemedBy: currentUser.name,
            notes: redeemNotes,
          });
        },
      });

      showToast('success', isMm ? `ပက်ကေ့ဂျ် ${redeemQty} ကြိမ် အသုံးပြုပြီးပါပြီ` : `Successfully redeemed ${redeemQty} session(s)`);
      setShowRedeemPackageModal(false);
      setSelectedCustomerPackage(null);
      setRedeemQty(1);
      setRedeemNotes('');
      loadData();
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to redeem package');
    }
  };

  // 6. Issue Gift Card
  const handleIssueGiftCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCardAmount <= 0) {
      showToast('error', isMm ? 'လက်ဆောင်ကတ် တန်ဖိုး ထည့်ပါ' : 'Please specify a valid gift card amount');
      return;
    }

    const cardNum = newCardNumber.trim() || `GC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const cardId = `gc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const customer = customers.find(c => c.id === newCardCustomerId);
    const now = new Date();
    const expiryObj = new Date(now.getTime() + (newCardExpiryDays || 365) * 24 * 60 * 60 * 1000);

    const giftCard: GiftCard = {
      id: cardId,
      businessId: (currentUser as any).businessId || 'default',
      branchId: (currentUser as any).branchId || 'main',
      cardNumber: cardNum,
      initialAmountMMK: Number(newCardAmount),
      currentBalanceMMK: Number(newCardAmount),
      customerId: customer?.id,
      customerName: customer?.name,
      issueDate: now.toISOString().split('T')[0],
      expiryDate: expiryObj.toISOString().split('T')[0],
      issuedBy: currentUser.name,
      status: 'active',
      notes: newCardNotes || undefined,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    try {
      await syncManager.executeMutation({
        operationType: 'GIFT_CARD_ISSUE',
        entityType: 'GIFT_CARD',
        entityId: cardId,
        payload: {
          giftCardId: cardId,
          cardNumber: cardNum,
          initialAmountMMK: Number(newCardAmount),
          customerId: customer?.id,
          customerName: customer?.name,
          expiryDays: newCardExpiryDays,
          paymentMethod: newCardPaymentMethod,
          notes: newCardNotes,
        },
        offlineMutationFn: async () => {
          await db.giftCards.put(giftCard);
          if (newCardPaymentMethod === 'cash' && giftCard.initialAmountMMK > 0) {
            await db.cashTransactions.add({
              id: `ctx_${Date.now()}`,
              transactionCode: `CTX-${Date.now()}`,
              branchId: (currentUser as any).branchId || 'main',
              type: 'inflow',
              category: 'gift_card_sale_cash',
              amountMMK: giftCard.initialAmountMMK,
              referenceType: 'sale',
              referenceId: cardId,
              notes: `Gift Card Sale: ${cardNum}`,
              transactionTime: new Date().toISOString(),
              performedBy: currentUser.name,
              createdAt: new Date().toISOString(),
            });
          }
          return giftCard;
        },
      });

      showToast('success', isMm ? `လက်ဆောင်ကတ် ${cardNum} ထုတ်ပေးပြီးပါပြီ` : `Gift Card ${cardNum} issued successfully`);
      setShowIssueGiftCardModal(false);
      setNewCardNumber('');
      setNewCardAmount(50000);
      setNewCardNotes('');
      loadData();
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to issue gift card');
    }
  };

  // 7. Redeem Gift Card (Transactional & Overdraft Protected)
  const handleRedeemGiftCard = async () => {
    if (!selectedGiftCard) return;
    if (giftCardRedeemAmount <= 0) {
      showToast('error', isMm ? 'အသုံးပြုမည့် ငွေပမာဏ မှန်ကန်စွာ ထည့်ပါ' : 'Please specify a valid redemption amount');
      return;
    }
    if (giftCardRedeemAmount > selectedGiftCard.currentBalanceMMK) {
      showToast('error', isMm ? `လက်ကျန်ငွေ ${formatMMK(selectedGiftCard.currentBalanceMMK)} ထက် ပို၍ အသုံးမပြုနိုင်ပါ` : `Overdraft rejected: Card balance is only ${formatMMK(selectedGiftCard.currentBalanceMMK)}`);
      return;
    }

    try {
      await syncManager.executeMutation({
        operationType: 'GIFT_CARD_REDEEM',
        entityType: 'GIFT_CARD_REDEMPTION',
        entityId: selectedGiftCard.id,
        payload: {
          giftCardIdOrNumber: selectedGiftCard.id,
          amountMMK: giftCardRedeemAmount,
          notes: giftCardRedeemNotes,
        },
        offlineMutationFn: async () => {
          return db.redeemGiftCardTransaction({
            giftCardIdOrNumber: selectedGiftCard.id,
            amountMMK: giftCardRedeemAmount,
            redeemedBy: currentUser.name,
            notes: giftCardRedeemNotes,
          });
        },
      });

      showToast('success', isMm ? `လက်ဆောင်ကတ်မှ ${formatMMK(giftCardRedeemAmount)} ဖြတ်တောက်ပြီးပါပြီ` : `Redeemed ${formatMMK(giftCardRedeemAmount)} from gift card`);
      setShowRedeemGiftCardModal(false);
      setSelectedGiftCard(null);
      setGiftCardRedeemAmount(0);
      setGiftCardRedeemNotes('');
      loadData();
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to redeem gift card');
    }
  };

  // 8. Record Staff Tip (Separated from Service Revenue)
  const handleRecordTip = async (e: React.FormEvent) => {
    e.preventDefault();
    const st = staff.find(s => s.id === tipStaffId);
    if (!st || tipAmount <= 0) {
      showToast('error', isMm ? 'ဝန်ထမ်းနှင့် ဆုငွေ ပမာဏ ရွေးချယ်ပါ' : 'Please select staff and enter valid tip amount');
      return;
    }

    const tipId = `tip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      await syncManager.executeMutation({
        operationType: 'TIP_RECORD',
        entityType: 'TIP',
        entityId: tipId,
        payload: {
          tipId,
          staffId: st.id,
          staffName: st.name,
          amountMMK: tipAmount,
          paymentMethod: tipPaymentMethod,
          notes: tipNotes,
        },
        offlineMutationFn: async () => {
          return db.recordTipTransaction({
            staffId: st.id,
            staffName: st.name,
            amountMMK: tipAmount,
            paymentMethod: tipPaymentMethod,
            receivedBy: currentUser.name,
            notes: tipNotes,
          });
        },
      });

      showToast('success', isMm ? `${st.name} အတွက် Tip ${formatMMK(tipAmount)} မှတ်တမ်းတင်ပြီးပါပြီ` : `Tip recorded for ${st.name}`);
      setShowRecordTipModal(false);
      setTipAmount(5000);
      setTipNotes('');
      loadData();
      onRefresh();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to record tip');
    }
  };

  // Customer 360 Loader
  const handleLoadCustomer360 = async (customerId: string) => {
    setC360CustomerId(customerId);
    if (!customerId) {
      setC360Profile(null);
      return;
    }

    try {
      // First try local server client endpoint
      const serverRes = await localServerClient.getCustomerFinancialProfile(customerId);
      if (serverRes && serverRes.success) {
        setC360Profile(serverRes);
        return;
      }
    } catch {
      // Fallback to local Dexie data
    }

    const cust = customers.find(c => c.id === customerId);
    if (!cust) return;

    const [custMems, custPkgs, custCards, custInvs, custLedg] = await Promise.all([
      db.customerMemberships.where('customerId').equals(customerId).toArray(),
      db.customerPackages.where('customerId').equals(customerId).toArray(),
      db.giftCards.where('customerId').equals(customerId).toArray(),
      db.invoices.where('customerId').equals(customerId).toArray(),
      db.customerLedger.where('customerId').equals(customerId).toArray(),
    ]);

    setC360Profile({
      customer: cust,
      memberships: custMems,
      packages: custPkgs,
      giftCards: custCards,
      invoices: custInvs,
      ledger: custLedg,
    });
  };

  // Filtered queries
  const filteredCustomerMemberships = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customerMemberships;
    return customerMemberships.filter(
      m => m.customerName.toLowerCase().includes(q) || m.planName.toLowerCase().includes(q) || (m.customerPhone && m.customerPhone.includes(q))
    );
  }, [customerMemberships, searchQuery]);

  const filteredCustomerPackages = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customerPackages;
    return customerPackages.filter(
      p => p.customerName.toLowerCase().includes(q) || p.packageName.toLowerCase().includes(q) || (p.customerPhone && p.customerPhone.includes(q))
    );
  }, [customerPackages, searchQuery]);

  const filteredGiftCards = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return giftCards;
    return giftCards.filter(
      g => g.cardNumber.toLowerCase().includes(q) || (g.customerName && g.customerName.toLowerCase().includes(q))
    );
  }, [giftCards, searchQuery]);

  // Tip statistics
  const totalTipsToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return tips.filter(t => t.createdAt.startsWith(today)).reduce((sum, t) => sum + (t.amountMMK || 0), 0);
  }, [tips]);

  const tipsByStaff = useMemo(() => {
    const map: Record<string, { staffName: string; totalMMK: number; count: number }> = {};
    tips.forEach(t => {
      if (!map[t.staffId]) {
        map[t.staffId] = { staffName: t.staffName, totalMMK: 0, count: 0 };
      }
      map[t.staffId].totalMMK += t.amountMMK || 0;
      map[t.staffId].count += 1;
    });
    return Object.values(map);
  }, [tips]);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          className={`fixed top-18 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl border backdrop-blur-md transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 neon-glow-cyan'
              : 'bg-rose-950/90 text-rose-200 border-rose-500/40'
          }`}
        >
          {feedbackMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-rose-400" />}
          {feedbackMsg.text}
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#0b0f19] via-[#0d1424] to-[#0b0f19] border border-cyan-500/20 p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shadow-md">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-wide">
              {isMm ? 'အသင်းဝင်၊ ပက်ကေ့ဂျ်နှင့် လက်ဆောင်ကတ် စီမံခန့်ခွဲမှု' : 'Memberships, Packages & Customer Value'}
            </h1>
            <p className="text-xs text-cyan-300/70 font-mono mt-0.5">
              {isMm ? 'Spa / Salon / KTV ဖောက်သည်ဝန်ဆောင်မှုနှင့် စာရင်းကိုင် စနစ်' : 'Client Value Retainers & Staff Attribution Engine'}
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition-all shadow-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isMm ? 'ဒေတာ ပြန်လည်ရယူရန်' : 'Refresh'}
        </button>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-3">
        {[
          { id: 'memberships' as SubTab, labelEn: 'Membership Plans', labelMm: 'အသင်းဝင်ကတ်များ', icon: Sparkles, badge: customerMemberships.length },
          { id: 'packages' as SubTab, labelEn: 'Service Packages', labelMm: 'ဝန်ဆောင်မှု ပက်ကေ့ဂျ်', icon: Package, badge: customerPackages.length },
          { id: 'giftcards' as SubTab, labelEn: 'Gift Cards', labelMm: 'လက်ဆောင်ကတ်', icon: Gift, badge: giftCards.length },
          { id: 'tips' as SubTab, labelEn: 'Staff Tips', labelMm: 'ဆုငွေ / Tip', icon: Coins, badge: tips.length },
          { id: 'customer360' as SubTab, labelEn: 'Customer 360° Value Profile', labelMm: 'ဖောက်သည် အသေးစိတ် အချက်အလက်', icon: UserCheck },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                isActive
                  ? 'bg-cyan-500 text-gray-950 shadow-md shadow-cyan-500/20'
                  : 'bg-[#0f1422] text-gray-400 hover:text-gray-200 hover:bg-[#161d31] border border-gray-800/80'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{isMm ? tab.labelMm : tab.labelEn}</span>
              {tab.badge !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                    isActive ? 'bg-black/20 text-gray-950' : 'bg-gray-800 text-cyan-400'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* 1. MEMBERSHIPS TAB */}
      {/* ======================================================== */}
      {activeTab === 'memberships' && (
        <div className="space-y-6">
          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder={isMm ? 'ဖောက်သည် သို့မဟုတ် ပလန် ရှာရန်...' : 'Search membership or customer...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-800 bg-[#0d1322] pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreatePlanModal(true)}
                className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-900/50 shadow-xs"
              >
                <Plus className="h-4 w-4" />
                {isMm ? 'ပလန်အသစ် ဖန်တီးမည်' : 'New Membership Plan'}
              </button>
              <button
                onClick={() => setShowPurchaseMembershipModal(true)}
                className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-gray-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
              >
                <Sparkles className="h-4 w-4" />
                {isMm ? 'အသင်းဝင်ကတ် ရောင်းချမည်' : 'Sell Membership'}
              </button>
            </div>
          </div>

          {/* Membership Plans Grid */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3">
              {isMm ? 'လက်ရှိ အသင်းဝင် ပလန်များ' : 'Available Membership Plans'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map(p => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-cyan-900/40 bg-[#0b0f19] p-4 relative overflow-hidden shadow-md flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-base font-bold text-white">{p.name}</h4>
                        {p.nameMm && <p className="text-xs text-gray-400">{p.nameMm}</p>}
                      </div>
                      <span className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-[11px] font-bold text-cyan-300 font-mono">
                        {p.discountPercent}% OFF
                      </span>
                    </div>

                    <div className="my-3 space-y-1 text-xs text-gray-300">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{isMm ? 'သက်တမ်း' : 'Duration'}:</span>
                        <span className="font-mono text-cyan-200">{p.durationDays} {isMm ? 'ရက်' : 'Days'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{isMm ? 'ဈေးနှုန်း' : 'Fee'}:</span>
                        <span className="font-mono font-bold text-emerald-400">{formatMMK(p.priceMMK)}</span>
                      </div>
                    </div>

                    {p.benefitsSummary && (
                      <p className="text-[11px] text-gray-400 bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                        {p.benefitsSummary}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <Check className="h-3.5 w-3.5" /> {isMm ? 'အသုံးပြုနိုင်သည်' : 'Active'}
                    </span>
                    <button
                      onClick={() => {
                        setSelPlanId(p.id);
                        setShowPurchaseMembershipModal(true);
                      }}
                      className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
                    >
                      {isMm ? 'ဝယ်ယူမည်' : 'Assign'} <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Memberships Table */}
          <div className="rounded-2xl border border-gray-800 bg-[#0b0f19] overflow-hidden shadow-md">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                {isMm ? 'ဖောက်သည် အသင်းဝင် စာရင်း' : 'Customer Memberships Registry'}
              </h3>
              <span className="text-xs text-gray-400 font-mono">
                {filteredCustomerMemberships.length} {isMm ? 'ဦး' : 'Records'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0f1422] text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-4">{isMm ? 'ဖောက်သည်' : 'Customer'}</th>
                    <th className="py-3 px-4">{isMm ? 'ပလန်' : 'Plan'}</th>
                    <th className="py-3 px-4">{isMm ? 'လျှော့ဈေး' : 'Discount'}</th>
                    <th className="py-3 px-4">{isMm ? 'စတင်ရက်' : 'Start'}</th>
                    <th className="py-3 px-4">{isMm ? 'သက်တမ်းကုန်ရက်' : 'Expiry'}</th>
                    <th className="py-3 px-4">{isMm ? 'ပေးချေငွေ' : 'Paid Fee'}</th>
                    <th className="py-3 px-4">{isMm ? 'အခြေအနေ' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-gray-300">
                  {filteredCustomerMemberships.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        {isMm ? 'အသင်းဝင် မှတ်တမ်း မရှိသေးပါ' : 'No active memberships found'}
                      </td>
                    </tr>
                  ) : (
                    filteredCustomerMemberships.map(cm => {
                      const today = new Date().toISOString().split('T')[0];
                      const isExpired = cm.expiryDate < today;
                      return (
                        <tr key={cm.id} className="hover:bg-[#12192c]/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-white">
                            <div>{cm.customerName}</div>
                            {cm.customerPhone && <div className="text-[10px] text-gray-500 font-mono">{cm.customerPhone}</div>}
                          </td>
                          <td className="py-3 px-4 text-cyan-300 font-semibold">{cm.planName}</td>
                          <td className="py-3 px-4 font-mono font-bold text-cyan-400">{cm.discountPercent}%</td>
                          <td className="py-3 px-4 font-mono text-gray-400">{cm.startDate}</td>
                          <td className="py-3 px-4 font-mono text-gray-400">{cm.expiryDate}</td>
                          <td className="py-3 px-4 font-mono text-emerald-400 font-bold">{formatMMK(cm.paidAmountMMK)}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isExpired
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {isExpired ? (isMm ? 'သက်တမ်းကုန်' : 'Expired') : (isMm ? 'သက်ဝင်နေသည်' : 'Active')}
                            </span>
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

      {/* ======================================================== */}
      {/* 2. PACKAGES TAB */}
      {/* ======================================================== */}
      {activeTab === 'packages' && (
        <div className="space-y-6">
          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder={isMm ? 'ပက်ကေ့ဂျ် သို့မဟုတ် ဖောက်သည် ရှာရန်...' : 'Search package or customer...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-800 bg-[#0d1322] pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreatePackageModal(true)}
                className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-900/50 shadow-xs"
              >
                <Plus className="h-4 w-4" />
                {isMm ? 'ပက်ကေ့ဂျ်အသစ် ဖန်တီးမည်' : 'New Package Template'}
              </button>
              <button
                onClick={() => setShowPurchasePackageModal(true)}
                className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-gray-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
              >
                <Package className="h-4 w-4" />
                {isMm ? 'ပက်ကေ့ဂျ် ရောင်းချမည်' : 'Sell Package'}
              </button>
            </div>
          </div>

          {/* Package Templates Grid */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3">
              {isMm ? 'ပက်ကေ့ဂျ် အမျိုးအစားများ' : 'Service Package Catalog'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {packages.map(pkg => (
                <div
                  key={pkg.id}
                  className="rounded-2xl border border-cyan-900/40 bg-[#0b0f19] p-4 relative overflow-hidden shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-base font-bold text-white">{pkg.name}</h4>
                      <span className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-[11px] font-bold text-cyan-300 font-mono">
                        {pkg.totalQty} {isMm ? 'ကြိမ်' : 'Sessions'}
                      </span>
                    </div>

                    <p className="text-xs text-cyan-400/80 font-mono mt-1">{pkg.serviceName}</p>

                    <div className="my-3 space-y-1 text-xs text-gray-300">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{isMm ? 'သက်တမ်း' : 'Validity'}:</span>
                        <span className="font-mono text-cyan-200">{pkg.validityDays} {isMm ? 'ရက်' : 'Days'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{isMm ? 'စုစုပေါင်း တန်ဖိုး' : 'Price'}:</span>
                        <span className="font-mono font-bold text-emerald-400">{formatMMK(pkg.priceMMK)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">
                      ~ {formatMMK(Math.round(pkg.priceMMK / (pkg.totalQty || 1)))} / {isMm ? 'ကြိမ်' : 'sess'}
                    </span>
                    <button
                      onClick={() => {
                        setPkgTemplateId(pkg.id);
                        setShowPurchasePackageModal(true);
                      }}
                      className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
                    >
                      {isMm ? 'ရောင်းချမည်' : 'Sell'} <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Active Packages Table with Quick Redeem */}
          <div className="rounded-2xl border border-gray-800 bg-[#0b0f19] overflow-hidden shadow-md">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                {isMm ? 'ဖောက်သည် ပက်ကေ့ဂျ်နှင့် လက်ကျန် အရေအတွက်' : 'Customer Packages & Remaining Balance'}
              </h3>
              <span className="text-xs text-gray-400 font-mono">
                {filteredCustomerPackages.length} {isMm ? 'ခု' : 'Records'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0f1422] text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-4">{isMm ? 'ဖောက်သည်' : 'Customer'}</th>
                    <th className="py-3 px-4">{isMm ? 'ပက်ကေ့ဂျ်' : 'Package'}</th>
                    <th className="py-3 px-4">{isMm ? 'ဝန်ဆောင်မှု' : 'Service'}</th>
                    <th className="py-3 px-4">{isMm ? 'ဝယ်ယူ/သုံးပြီး' : 'Total / Used'}</th>
                    <th className="py-3 px-4">{isMm ? 'လက်ကျန်' : 'Remaining'}</th>
                    <th className="py-3 px-4">{isMm ? 'သက်တမ်းကုန်ရက်' : 'Expiry'}</th>
                    <th className="py-3 px-4">{isMm ? 'အခြေအနေ' : 'Status'}</th>
                    <th className="py-3 px-4 text-right">{isMm ? 'ထုတ်ယူအသုံးပြုရန်' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-gray-300">
                  {filteredCustomerPackages.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-500">
                        {isMm ? 'ပက်ကေ့ဂျ် မှတ်တမ်း မရှိသေးပါ' : 'No customer packages found'}
                      </td>
                    </tr>
                  ) : (
                    filteredCustomerPackages.map(cp => {
                      const today = new Date().toISOString().split('T')[0];
                      const isExpired = cp.expiryDate < today;
                      const isExhausted = cp.remainingQty <= 0;
                      return (
                        <tr key={cp.id} className="hover:bg-[#12192c]/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-white">
                            <div>{cp.customerName}</div>
                            {cp.customerPhone && <div className="text-[10px] text-gray-500 font-mono">{cp.customerPhone}</div>}
                          </td>
                          <td className="py-3 px-4 text-cyan-300 font-semibold">{cp.packageName}</td>
                          <td className="py-3 px-4 text-gray-400">{cp.serviceName}</td>
                          <td className="py-3 px-4 font-mono">
                            {cp.purchasedQty} / <span className="text-gray-400">{cp.usedQty}</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-sm">
                            <span className={cp.remainingQty > 0 ? 'text-cyan-400' : 'text-gray-500'}>
                              {cp.remainingQty}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-400">{cp.expiryDate}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isExhausted
                                  ? 'bg-gray-800 text-gray-400'
                                  : isExpired
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {isExhausted
                                ? isMm ? 'ကုန်ဆုံးသွားပါပြီ' : 'Exhausted'
                                : isExpired
                                ? isMm ? 'သက်တမ်းကုန်' : 'Expired'
                                : isMm ? 'အသုံးပြုနိုင်သည်' : 'Active'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              disabled={isExhausted || isExpired}
                              onClick={() => {
                                setSelectedCustomerPackage(cp);
                                setRedeemQty(1);
                                setShowRedeemPackageModal(true);
                              }}
                              className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                                isExhausted || isExpired
                                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                  : 'bg-cyan-500 text-gray-950 hover:bg-cyan-400 shadow-xs'
                              }`}
                            >
                              {isMm ? 'ထုတ်ယူမည်' : 'Redeem'}
                            </button>
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

      {/* ======================================================== */}
      {/* 3. GIFT CARDS TAB */}
      {/* ======================================================== */}
      {activeTab === 'giftcards' && (
        <div className="space-y-6">
          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder={isMm ? 'ကတ်နံပါတ် သို့မဟုတ် ဖောက်သည် ရှာရန်...' : 'Search gift card number or customer...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-800 bg-[#0d1322] pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-hidden"
              />
            </div>

            <button
              onClick={() => setShowIssueGiftCardModal(true)}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-gray-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
            >
              <Gift className="h-4 w-4" />
              {isMm ? 'လက်ဆောင်ကတ် အသစ်ထုတ်ပေးမည်' : 'Issue Gift Card'}
            </button>
          </div>

          {/* Gift Cards Registry */}
          <div className="rounded-2xl border border-gray-800 bg-[#0b0f19] overflow-hidden shadow-md">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                {isMm ? 'ထုတ်ပေးထားသော လက်ဆောင်ကတ်များ' : 'Gift Cards Registry & Balances'}
              </h3>
              <span className="text-xs text-gray-400 font-mono">
                {filteredGiftCards.length} {isMm ? 'ကတ်' : 'Cards'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0f1422] text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-4">{isMm ? 'ကတ်နံပါတ်' : 'Card Number'}</th>
                    <th className="py-3 px-4">{isMm ? 'ဖောက်သည်' : 'Customer'}</th>
                    <th className="py-3 px-4">{isMm ? 'မူလတန်ဖိုး' : 'Initial'}</th>
                    <th className="py-3 px-4">{isMm ? 'လက်ကျန်ငွေ' : 'Current Balance'}</th>
                    <th className="py-3 px-4">{isMm ? 'ထုတ်ပေးရက်' : 'Issue Date'}</th>
                    <th className="py-3 px-4">{isMm ? 'သက်တမ်းကုန်ရက်' : 'Expiry Date'}</th>
                    <th className="py-3 px-4">{isMm ? 'အခြေအနေ' : 'Status'}</th>
                    <th className="py-3 px-4 text-right">{isMm ? 'ငွေဖြတ်တောက်ရန်' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-gray-300">
                  {filteredGiftCards.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-500">
                        {isMm ? 'လက်ဆောင်ကတ် မှတ်တမ်း မရှိသေးပါ' : 'No gift cards found'}
                      </td>
                    </tr>
                  ) : (
                    filteredGiftCards.map(gc => {
                      const today = new Date().toISOString().split('T')[0];
                      const isExpired = gc.expiryDate < today;
                      const isExhausted = gc.currentBalanceMMK <= 0;
                      return (
                        <tr key={gc.id} className="hover:bg-[#12192c]/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-cyan-300 tracking-wider">
                            {gc.cardNumber}
                          </td>
                          <td className="py-3 px-4 text-white">
                            {gc.customerName || <span className="text-gray-500 italic">Bearer / Walk-in</span>}
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-400">{formatMMK(gc.initialAmountMMK)}</td>
                          <td className="py-3 px-4 font-mono font-black text-sm text-emerald-400">
                            {formatMMK(gc.currentBalanceMMK)}
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-400">{gc.issueDate}</td>
                          <td className="py-3 px-4 font-mono text-gray-400">{gc.expiryDate}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isExhausted
                                  ? 'bg-gray-800 text-gray-400'
                                  : isExpired
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {isExhausted
                                ? isMm ? 'ငွေကုန်ပြီ' : 'Exhausted'
                                : isExpired
                                ? isMm ? 'သက်တမ်းကုန်' : 'Expired'
                                : isMm ? 'အသုံးပြုနိုင်သည်' : 'Active'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              disabled={isExhausted || isExpired}
                              onClick={() => {
                                setSelectedGiftCard(gc);
                                setGiftCardRedeemAmount(Math.min(10000, gc.currentBalanceMMK));
                                setShowRedeemGiftCardModal(true);
                              }}
                              className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                                isExhausted || isExpired
                                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs'
                              }`}
                            >
                              {isMm ? 'ငွေဖြတ်မည်' : 'Redeem'}
                            </button>
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

      {/* ======================================================== */}
      {/* 4. TIPS TAB */}
      {/* ======================================================== */}
      {activeTab === 'tips' && (
        <div className="space-y-6">
          {/* Top Info Banner explaining Tip separation */}
          <div className="rounded-2xl bg-cyan-950/30 border border-cyan-500/30 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-cyan-400 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-white block">
                  {isMm ? 'ဝန်ထမ်းဆုငွေ (Tip) သီးခြားခွဲဝေမှု စနစ်' : 'Strict Tip & Gratuity Accounting Isolation'}
                </span>
                <span className="text-gray-400">
                  {isMm
                    ? 'ဆုငွေများကို ဆိုင်၏ ဝန်ဆောင်မှုဝင်ငွေ (Service Revenue) ထဲသို့ မရောနှောဘဲ သက်ဆိုင်ရာ ဝန်ထမ်း၏ စာရင်းထဲသို့ တိုက်ရိုက် ထည့်သွင်းပေးပါသည်။'
                    : 'Customer tips are isolated from shop service turnover and credited directly to staff bonus ledgers.'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowRecordTipModal(true)}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-gray-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20 shrink-0"
            >
              <Coins className="h-4 w-4" />
              {isMm ? 'ဆုငွေ မှတ်တမ်းတင်မည်' : 'Record Tip'}
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-gray-800 bg-[#0b0f19] p-4">
              <span className="text-[11px] font-bold uppercase text-gray-500 block">
                {isMm ? 'ယနေ့ စုစုပေါင်း ဆုငွေ' : 'Total Tips Today'}
              </span>
              <span className="text-xl font-black font-mono text-emerald-400 mt-1 block">
                {formatMMK(totalTipsToday)}
              </span>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-[#0b0f19] p-4">
              <span className="text-[11px] font-bold uppercase text-gray-500 block">
                {isMm ? 'စုစုပေါင်း မှတ်တမ်းအရေအတွက်' : 'Total Tip Entries'}
              </span>
              <span className="text-xl font-black font-mono text-cyan-300 mt-1 block">
                {tips.length} {isMm ? 'ကြိမ်' : 'Records'}
              </span>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-[#0b0f19] p-4">
              <span className="text-[11px] font-bold uppercase text-gray-500 block">
                {isMm ? 'ဆုငွေရရှိသော ဝန်ထမ်း' : 'Staff With Tips'}
              </span>
              <span className="text-xl font-black font-mono text-cyan-300 mt-1 block">
                {tipsByStaff.length} {isMm ? 'ဦး' : 'Staff Members'}
              </span>
            </div>
          </div>

          {/* Staff Tip Distribution Summary */}
          <div className="rounded-2xl border border-gray-800 bg-[#0b0f19] p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3">
              {isMm ? 'ဝန်ထမ်းတစ်ဦးချင်း ဆုငွေ ရရှိမှု အကျဉ်းချုပ်' : 'Staff Tip Attribution Breakdown'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {tipsByStaff.map((st, idx) => (
                <div key={idx} className="rounded-xl border border-gray-800 bg-[#0d1322] p-3">
                  <div className="font-bold text-white text-xs">{st.staffName}</div>
                  <div className="text-base font-extrabold font-mono text-emerald-400 mt-1">
                    {formatMMK(st.totalMMK)}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                    {st.count} {isMm ? 'ကြိမ်' : 'tips'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tip Log Table */}
          <div className="rounded-2xl border border-gray-800 bg-[#0b0f19] overflow-hidden shadow-md">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                {isMm ? 'ဆုငွေ အသေးစိတ် မှတ်တမ်း' : 'Detailed Tip Records'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0f1422] text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-4">{isMm ? 'ဝန်ထမ်း' : 'Staff'}</th>
                    <th className="py-3 px-4">{isMm ? 'ဆုငွေ ပမာဏ' : 'Amount'}</th>
                    <th className="py-3 px-4">{isMm ? 'ပေးချေမှု ပုံစံ' : 'Method'}</th>
                    <th className="py-3 px-4">{isMm ? 'လက်ခံသူ' : 'Received By'}</th>
                    <th className="py-3 px-4">{isMm ? 'အချိန်' : 'Timestamp'}</th>
                    <th className="py-3 px-4">{isMm ? 'မှတ်ချက်' : 'Notes'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-gray-300">
                  {tips.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        {isMm ? 'ဆုငွေ မှတ်တမ်း မရှိသေးပါ' : 'No tip records found'}
                      </td>
                    </tr>
                  ) : (
                    tips.slice(0, 50).map(t => (
                      <tr key={t.id} className="hover:bg-[#12192c]/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">{t.staffName}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">{formatMMK(t.amountMMK)}</td>
                        <td className="py-3 px-4 uppercase font-mono text-[10px] text-cyan-300">{t.paymentMethod}</td>
                        <td className="py-3 px-4 text-gray-400">{t.receivedBy}</td>
                        <td className="py-3 px-4 font-mono text-gray-500">{t.createdAt.replace('T', ' ').substring(0, 16)}</td>
                        <td className="py-3 px-4 text-gray-400">{t.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. CUSTOMER 360° VALUE PROFILE TAB */}
      {/* ======================================================== */}
      {activeTab === 'customer360' && (
        <div className="space-y-6">
          {/* Customer Selector */}
          <div className="rounded-2xl border border-gray-800 bg-[#0b0f19] p-5 shadow-md">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3">
              {isMm ? 'ဖောက်သည် ရွေးချယ်ပါ' : 'Select Customer For Full 360° Value Profile'}
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={c360CustomerId}
                onChange={e => handleLoadCustomer360(e.target.value)}
                className="flex-1 max-w-md rounded-xl border border-gray-800 bg-[#0d1322] px-4 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-hidden"
              >
                <option value="">{isMm ? '-- ဖောက်သည် ရွေးချယ်ပါ --' : '-- Choose Customer --'}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {c360Profile && (
            <div className="space-y-6">
              {/* Profile Summary Card */}
              <div className="rounded-2xl border border-cyan-900/40 bg-[#0b0f19] p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-cyan-400" />
                    <h2 className="text-lg font-bold text-white">{c360Profile.customer?.name}</h2>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{c360Profile.customer?.phone || 'No phone'}</p>
                </div>

                <div className="flex gap-4">
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 uppercase block font-bold">
                      {isMm ? 'ကြွေးကျန်' : 'Debt Balance'}
                    </span>
                    <span className="font-mono text-sm font-black text-rose-400">
                      {formatMMK(c360Profile.customer?.currentBalanceMMK || 0)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 uppercase block font-bold">
                      {isMm ? 'ကြွေးငွေ ကန့်သတ်ချက်' : 'Credit Limit'}
                    </span>
                    <span className="font-mono text-sm font-bold text-gray-300">
                      {formatMMK(c360Profile.customer?.creditLimitMMK || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4-Grid Value Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Active Memberships */}
                <div className="rounded-2xl border border-gray-800 bg-[#0b0f19] p-5 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase">
                    <Sparkles className="h-4 w-4" />
                    <span>{isMm ? 'အသင်းဝင်ကတ်များ' : 'Memberships'}</span>
                  </div>
                  {(!c360Profile.memberships || c360Profile.memberships.length === 0) ? (
                    <p className="text-xs text-gray-500 italic py-3">{isMm ? 'အသင်းဝင်ကတ် မရှိသေးပါ' : 'No memberships'}</p>
                  ) : (
                    c360Profile.memberships.map((m: any) => (
                      <div key={m.id} className="rounded-xl border border-gray-800 bg-[#0d1322] p-3 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-white">{m.plan_name || m.planName}</div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {isMm ? 'သက်တမ်း' : 'Expires'}: {m.expiry_date || m.expiryDate}
                          </div>
                        </div>
                        <span className="rounded-md bg-cyan-500/20 text-cyan-300 px-2 py-0.5 text-xs font-mono font-bold">
                          {m.discount_percent || m.discountPercent}% OFF
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* 2. Service Packages */}
                <div className="rounded-2xl border border-gray-800 bg-[#0b0f19] p-5 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase">
                    <Package className="h-4 w-4" />
                    <span>{isMm ? 'ဝန်ဆောင်မှု ပက်ကေ့ဂျ်များ' : 'Service Packages'}</span>
                  </div>
                  {(!c360Profile.packages || c360Profile.packages.length === 0) ? (
                    <p className="text-xs text-gray-500 italic py-3">{isMm ? 'ပက်ကေ့ဂျ် မရှိသေးပါ' : 'No service packages'}</p>
                  ) : (
                    c360Profile.packages.map((pkg: any) => (
                      <div key={pkg.id} className="rounded-xl border border-gray-800 bg-[#0d1322] p-3 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-white">{pkg.package_name || pkg.packageName}</div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {isMm ? 'သက်တမ်း' : 'Expires'}: {pkg.expiry_date || pkg.expiryDate}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-cyan-400 font-black font-mono text-sm block">
                            {pkg.remaining_qty ?? pkg.remainingQty}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            / {pkg.purchased_qty ?? pkg.purchasedQty} {isMm ? 'ကြိမ်' : 'left'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 3. Gift Cards */}
                <div className="rounded-2xl border border-gray-800 bg-[#0b0f19] p-5 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase">
                    <Gift className="h-4 w-4" />
                    <span>{isMm ? 'လက်ဆောင်ကတ် လက်ကျန်' : 'Linked Gift Cards'}</span>
                  </div>
                  {(!c360Profile.giftCards || c360Profile.giftCards.length === 0) ? (
                    <p className="text-xs text-gray-500 italic py-3">{isMm ? 'လက်ဆောင်ကတ် မရှိပါ' : 'No linked gift cards'}</p>
                  ) : (
                    c360Profile.giftCards.map((gc: any) => (
                      <div key={gc.id} className="rounded-xl border border-gray-800 bg-[#0d1322] p-3 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-cyan-300 font-mono">{gc.card_number || gc.cardNumber}</div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {isMm ? 'သက်တမ်း' : 'Expires'}: {gc.expiry_date || gc.expiryDate}
                          </div>
                        </div>
                        <span className="text-emerald-400 font-black font-mono text-sm">
                          {formatMMK(gc.current_balance_mmk ?? gc.currentBalanceMMK)}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* 4. Invoices & Bills */}
                <div className="rounded-2xl border border-gray-800 bg-[#0b0f19] p-5 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase">
                    <FileText className="h-4 w-4" />
                    <span>{isMm ? 'အရောင်းပြေစာ မှတ်တမ်း' : 'Recent Invoices'}</span>
                  </div>
                  {(!c360Profile.invoices || c360Profile.invoices.length === 0) ? (
                    <p className="text-xs text-gray-500 italic py-3">{isMm ? 'ပြေစာ မရှိပါ' : 'No invoices'}</p>
                  ) : (
                    c360Profile.invoices.slice(0, 5).map((inv: any) => (
                      <div key={inv.id} className="rounded-xl border border-gray-800 bg-[#0d1322] p-3 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-white font-mono">{inv.invoice_number || inv.invoiceNumber}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{inv.date || inv.createdAt?.split('T')[0]}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-white font-bold font-mono block">
                            {formatMMK(inv.total_mmk ?? inv.totalMMK)}
                          </span>
                          <span className="text-[10px] uppercase font-mono text-cyan-400">
                            {inv.payment_status || inv.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE MEMBERSHIP PLAN */}
      {/* ======================================================== */}
      {showCreatePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#0b0f19] p-6 shadow-2xl neon-glow-cyan space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                {isMm ? 'အသင်းဝင် ပလန်အသစ် ဖန်တီးခြင်း' : 'Create Membership Plan'}
              </h3>
              <button onClick={() => setShowCreatePlanModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'ပလန် အမည်' : 'Plan Name'}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Gold Membership"
                  value={newPlanName}
                  onChange={e => setNewPlanName(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'မြန်မာ အမည် (ရွေးချယ်ရန်)' : 'Myanmar Name (Optional)'}</label>
                <input
                  type="text"
                  placeholder="e.g. ရွှေသီရိ ရွှေအဆင့် အသင်းဝင်ကတ်"
                  value={newPlanNameMm}
                  onChange={e => setNewPlanNameMm(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'သက်တမ်း (ရက်)' : 'Duration (Days)'}</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newPlanDurationDays}
                    onChange={e => setNewPlanDurationDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'လျှော့ဈေး %' : 'Discount %'}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={newPlanDiscountPercent}
                    onChange={e => setNewPlanDiscountPercent(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'အသင်းဝင်ကြေး (ကျပ်)' : 'Membership Price (MMK)'}</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newPlanPrice}
                  onChange={e => setNewPlanPrice(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-emerald-400 font-mono font-bold focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'ခံစားခွင့်များ အကျဉ်းချုပ်' : 'Benefits Summary'}</label>
                <textarea
                  rows={2}
                  placeholder="e.g. 10% discount on all spa & massage sessions, complimentary welcome herbal drink"
                  value={newPlanBenefits}
                  onChange={e => setNewPlanBenefits(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePlanModal(false)}
                  className="rounded-xl border border-gray-800 px-4 py-2 text-gray-400 hover:text-white"
                >
                  {isMm ? 'ပယ်ဖျက်မည်' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-5 py-2 font-bold text-gray-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
                >
                  {isMm ? 'အတည်ပြု ထည့်သွင်းမည်' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: PURCHASE / SELL MEMBERSHIP */}
      {/* ======================================================== */}
      {showPurchaseMembershipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#0b0f19] p-6 shadow-2xl neon-glow-cyan space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                {isMm ? 'အသင်းဝင်ကတ် ရောင်းချခြင်း' : 'Sell Membership to Customer'}
              </h3>
              <button onClick={() => setShowPurchaseMembershipModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePurchaseMembership} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'ဖောက်သည် ရွေးချယ်ပါ' : 'Customer'}</label>
                <select
                  required
                  value={selCustomerId}
                  onChange={e => setSelCustomerId(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="">{isMm ? '-- ဖောက်သည် ရွေးပါ --' : '-- Select Customer --'}</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'အသင်းဝင် ပလန်' : 'Membership Plan'}</label>
                <select
                  required
                  value={selPlanId}
                  onChange={e => setSelPlanId(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="">{isMm ? '-- ပလန် ရွေးပါ --' : '-- Select Plan --'}</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {formatMMK(p.priceMMK)} ({p.durationDays} Days, {p.discountPercent}% OFF)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'ငွေပေးချေမှု ပုံစံ' : 'Payment Method'}</label>
                <select
                  value={memPaymentMethod}
                  onChange={e => setMemPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="cash">{isMm ? 'ငွေသား (Cash)' : 'Cash'}</option>
                  <option value="kbzpay">KBZPay</option>
                  <option value="wavepay">WavePay</option>
                  <option value="card">{isMm ? 'ဘဏ်ကတ် (Card)' : 'Card'}</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPurchaseMembershipModal(false)}
                  className="rounded-xl border border-gray-800 px-4 py-2 text-gray-400 hover:text-white"
                >
                  {isMm ? 'ပယ်ဖျက်မည်' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-5 py-2 font-bold text-gray-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
                >
                  {isMm ? 'အရောင်း အတည်ပြုမည်' : 'Confirm Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE PACKAGE TEMPLATE */}
      {/* ======================================================== */}
      {showCreatePackageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#0b0f19] p-6 shadow-2xl neon-glow-cyan space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="h-4 w-4 text-cyan-400" />
                {isMm ? 'ဝန်ဆောင်မှု ပက်ကေ့ဂျ်အသစ် ဖန်တီးခြင်း' : 'Create Service Package'}
              </h3>
              <button onClick={() => setShowCreatePackageModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'ပက်ကေ့ဂျ် အမည်' : 'Package Name'}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10x Aroma Massage Package"
                  value={newPkgName}
                  onChange={e => setNewPkgName(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'သက်ဆိုင်သည့် ဝန်ဆောင်မှု' : 'Service'}</label>
                <select
                  required
                  value={newPkgServiceId}
                  onChange={e => setNewPkgServiceId(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="">{isMm ? '-- ဝန်ဆောင်မှု ရွေးပါ --' : '-- Select Service --'}</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {formatMMK(s.priceMMK)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'စုစုပေါင်း အကြိမ်ရေ' : 'Total Sessions'}</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newPkgTotalQty}
                    onChange={e => setNewPkgTotalQty(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'သက်တမ်း (ရက်)' : 'Validity Days'}</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newPkgValidityDays}
                    onChange={e => setNewPkgValidityDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'ပက်ကေ့ဂျ် ဈေးနှုန်း (ကျပ်)' : 'Package Price (MMK)'}</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newPkgPrice}
                  onChange={e => setNewPkgPrice(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-emerald-400 font-mono font-bold focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePackageModal(false)}
                  className="rounded-xl border border-gray-800 px-4 py-2 text-gray-400 hover:text-white"
                >
                  {isMm ? 'ပယ်ဖျက်မည်' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-5 py-2 font-bold text-gray-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
                >
                  {isMm ? 'အတည်ပြု ထည့်သွင်းမည်' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: PURCHASE PACKAGE */}
      {/* ======================================================== */}
      {showPurchasePackageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#0b0f19] p-6 shadow-2xl neon-glow-cyan space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="h-4 w-4 text-cyan-400" />
                {isMm ? 'ပက်ကေ့ဂျ် ရောင်းချခြင်း' : 'Sell Package to Customer'}
              </h3>
              <button onClick={() => setShowPurchasePackageModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePurchasePackage} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'ဖောက်သည် ရွေးချယ်ပါ' : 'Customer'}</label>
                <select
                  required
                  value={pkgCustomerId}
                  onChange={e => setPkgCustomerId(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="">{isMm ? '-- ဖောက်သည် ရွေးပါ --' : '-- Select Customer --'}</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'ပက်ကေ့ဂျ် အမျိုးအစား' : 'Package'}</label>
                <select
                  required
                  value={pkgTemplateId}
                  onChange={e => setPkgTemplateId(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="">{isMm ? '-- ပက်ကေ့ဂျ် ရွေးပါ --' : '-- Select Package --'}</option>
                  {packages.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {formatMMK(p.priceMMK)} ({p.totalQty} Sessions)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'ငွေပေးချေမှု ပုံစံ' : 'Payment Method'}</label>
                <select
                  value={pkgPaymentMethod}
                  onChange={e => setPkgPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="cash">{isMm ? 'ငွေသား (Cash)' : 'Cash'}</option>
                  <option value="kbzpay">KBZPay</option>
                  <option value="wavepay">WavePay</option>
                  <option value="card">{isMm ? 'ဘဏ်ကတ် (Card)' : 'Card'}</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPurchasePackageModal(false)}
                  className="rounded-xl border border-gray-800 px-4 py-2 text-gray-400 hover:text-white"
                >
                  {isMm ? 'ပယ်ဖျက်မည်' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-5 py-2 font-bold text-gray-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
                >
                  {isMm ? 'အရောင်း အတည်ပြုမည်' : 'Confirm Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: REDEEM PACKAGE SESSION */}
      {/* ======================================================== */}
      {showRedeemPackageModal && selectedCustomerPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-cyan-500/30 bg-[#0b0f19] p-6 shadow-2xl neon-glow-cyan space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                {isMm ? 'ပက်ကေ့ဂျ် အသုံးပြုခြင်း' : 'Redeem Package Session'}
              </h3>
              <button onClick={() => setShowRedeemPackageModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl bg-[#0d1322] border border-gray-800 p-3 space-y-1 text-xs">
              <div className="font-bold text-white">{selectedCustomerPackage.packageName}</div>
              <div className="text-gray-400">{isMm ? 'ဖောက်သည်' : 'Customer'}: {selectedCustomerPackage.customerName}</div>
              <div className="text-cyan-400 font-mono font-bold">
                {isMm ? 'လက်ကျန် အရေအတွက်' : 'Remaining Sessions'}: {selectedCustomerPackage.remainingQty}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 font-semibold mb-1">
                  {isMm ? 'ထုတ်ယူအသုံးပြုမည့် အရေအတွက်' : 'Quantity to Redeem'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedCustomerPackage.remainingQty}
                  value={redeemQty}
                  onChange={e => setRedeemQty(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white font-mono font-bold focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'မှတ်ချက် (ရွေးချယ်ရန်)' : 'Notes'}</label>
                <input
                  type="text"
                  placeholder="e.g. Session on Room VIP-1"
                  value={redeemNotes}
                  onChange={e => setRedeemNotes(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRedeemPackageModal(false)}
                  className="rounded-xl border border-gray-800 px-4 py-2 text-gray-400 hover:text-white"
                >
                  {isMm ? 'ပယ်ဖျက်မည်' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleRedeemPackageSession}
                  className="rounded-xl bg-cyan-500 px-5 py-2 font-bold text-gray-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
                >
                  {isMm ? 'ထုတ်ယူ အတည်ပြုမည်' : 'Confirm Redeem'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ISSUE GIFT CARD */}
      {/* ======================================================== */}
      {showIssueGiftCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#0b0f19] p-6 shadow-2xl neon-glow-cyan space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Gift className="h-4 w-4 text-cyan-400" />
                {isMm ? 'လက်ဆောင်ကတ် အသစ် ထုတ်ပေးခြင်း' : 'Issue Gift Card'}
              </h3>
              <button onClick={() => setShowIssueGiftCardModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleIssueGiftCard} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 font-semibold mb-1">
                  {isMm ? 'ကတ်နံပါတ် (အလိုအလျောက် သို့မဟုတ် စိတ်ကြိုက်)' : 'Card Number (Auto or Custom)'}
                </label>
                <input
                  type="text"
                  placeholder="Leave blank for auto GC-YYYY-XXXXXX"
                  value={newCardNumber}
                  onChange={e => setNewCardNumber(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-cyan-300 font-mono tracking-wider focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'ကတ်တန်ဖိုး (ကျပ်)' : 'Card Amount (MMK)'}</label>
                <input
                  type="number"
                  min={1000}
                  required
                  value={newCardAmount}
                  onChange={e => setNewCardAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-emerald-400 font-mono font-bold text-sm focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">
                  {isMm ? 'ဖောက်သည် ချိတ်ဆက်ရန် (ရွေးချယ်ရန်)' : 'Link Customer (Optional for Bearer)'}
                </label>
                <select
                  value={newCardCustomerId}
                  onChange={e => setNewCardCustomerId(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="">{isMm ? '-- မည်သူမဆို ကိုင်ဆောင်နိုင်သည် (Bearer) --' : '-- Bearer / Unassigned --'}</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'သက်တမ်း (ရက်)' : 'Validity Days'}</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newCardExpiryDays}
                    onChange={e => setNewCardExpiryDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'ငွေပေးချေမှု ပုံစံ' : 'Payment Method'}</label>
                  <select
                    value={newCardPaymentMethod}
                    onChange={e => setNewCardPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                  >
                    <option value="cash">{isMm ? 'ငွေသား (Cash)' : 'Cash'}</option>
                    <option value="kbzpay">KBZPay</option>
                    <option value="wavepay">WavePay</option>
                    <option value="card">{isMm ? 'ဘဏ်ကတ် (Card)' : 'Card'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'မှတ်ချက်' : 'Notes'}</label>
                <input
                  type="text"
                  placeholder="e.g. Birthday Gift Voucher"
                  value={newCardNotes}
                  onChange={e => setNewCardNotes(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIssueGiftCardModal(false)}
                  className="rounded-xl border border-gray-800 px-4 py-2 text-gray-400 hover:text-white"
                >
                  {isMm ? 'ပယ်ဖျက်မည်' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-5 py-2 font-bold text-gray-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
                >
                  {isMm ? 'ကတ် ထုတ်ပေးမည်' : 'Issue Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: REDEEM GIFT CARD */}
      {/* ======================================================== */}
      {showRedeemGiftCardModal && selectedGiftCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-cyan-500/30 bg-[#0b0f19] p-6 shadow-2xl neon-glow-cyan space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-400" />
                {isMm ? 'လက်ဆောင်ကတ်မှ ငွေဖြတ်တောက်ခြင်း' : 'Redeem Gift Card'}
              </h3>
              <button onClick={() => setShowRedeemGiftCardModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl bg-[#0d1322] border border-gray-800 p-3 space-y-1 text-xs">
              <div className="font-mono font-bold text-cyan-300 text-sm tracking-wider">{selectedGiftCard.cardNumber}</div>
              <div className="text-emerald-400 font-mono font-black text-sm">
                {isMm ? 'လက်ကျန်ငွေ' : 'Available Balance'}: {formatMMK(selectedGiftCard.currentBalanceMMK)}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 font-semibold mb-1">
                  {isMm ? 'ဖြတ်တောက်မည့် ငွေပမာဏ (ကျပ်)' : 'Amount to Deduct (MMK)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedGiftCard.currentBalanceMMK}
                  value={giftCardRedeemAmount}
                  onChange={e => setGiftCardRedeemAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white font-mono font-bold text-sm focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'မှတ်ချက်' : 'Notes'}</label>
                <input
                  type="text"
                  placeholder="e.g. POS Bill Payment"
                  value={giftCardRedeemNotes}
                  onChange={e => setGiftCardRedeemNotes(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRedeemGiftCardModal(false)}
                  className="rounded-xl border border-gray-800 px-4 py-2 text-gray-400 hover:text-white"
                >
                  {isMm ? 'ပယ်ဖျက်မည်' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleRedeemGiftCard}
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20"
                >
                  {isMm ? 'ဖြတ်တောက် အတည်ပြုမည်' : 'Confirm Deduct'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: RECORD TIP */}
      {/* ======================================================== */}
      {showRecordTipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#0b0f19] p-6 shadow-2xl neon-glow-cyan space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Coins className="h-4 w-4 text-cyan-400" />
                {isMm ? 'ဝန်ထမ်း ဆုငွေ (Tip) မှတ်တမ်းတင်ခြင်း' : 'Record Staff Tip'}
              </h3>
              <button onClick={() => setShowRecordTipModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordTip} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'ဝန်ထမ်း ရွေးချယ်ပါ' : 'Staff Member'}</label>
                <select
                  required
                  value={tipStaffId}
                  onChange={e => setTipStaffId(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="">{isMm ? '-- ဝန်ထမ်း ရွေးပါ --' : '-- Select Staff Member --'}</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'ဆုငွေ ပမာဏ (ကျပ်)' : 'Tip Amount (MMK)'}</label>
                <input
                  type="number"
                  min={500}
                  step={500}
                  required
                  value={tipAmount}
                  onChange={e => setTipAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-emerald-400 font-mono font-bold text-sm focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'ပေးချေမှု ပုံစံ' : 'Payment Method'}</label>
                <select
                  value={tipPaymentMethod}
                  onChange={e => setTipPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="cash">{isMm ? 'ငွေသား (Cash)' : 'Cash'}</option>
                  <option value="kbzpay">KBZPay</option>
                  <option value="wavepay">WavePay</option>
                  <option value="card">{isMm ? 'ဘဏ်ကတ် (Card)' : 'Card'}</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">{isMm ? 'မှတ်ချက်' : 'Notes'}</label>
                <input
                  type="text"
                  placeholder="e.g. Gratuity from Guest"
                  value={tipNotes}
                  onChange={e => setTipNotes(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0d1322] px-3 py-2 text-white focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRecordTipModal(false)}
                  className="rounded-xl border border-gray-800 px-4 py-2 text-gray-400 hover:text-white"
                >
                  {isMm ? 'ပယ်ဖျက်မည်' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-5 py-2 font-bold text-gray-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
                >
                  {isMm ? 'မှတ်တမ်းတင် အတည်ပြုမည်' : 'Record Tip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
