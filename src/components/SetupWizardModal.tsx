import React, { useState } from 'react';
import { UserAccount, Room, StaffMember, ServiceItem, ProductItem, ShopSettings } from '../types';
import { Language } from '../utils/translations';
import { db } from '../db/database';
import { 
  DoorOpen, 
  Users, 
  ShoppingBag, 
  CheckCircle2, 
  Lock, 
  ArrowRight, 
  Sparkles,
  ShieldCheck,
  Plus,
  Trash2,
  Store,
  CreditCard,
  X
} from 'lucide-react';

interface SetupWizardModalProps {
  currentUser: UserAccount;
  lang: Language;
  onCompleted: (newOwnerUser?: UserAccount) => void;
  onClose: () => void;
}

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({
  currentUser,
  lang,
  onCompleted,
  onClose,
}) => {
  const isMm = lang === 'my';
  const [step, setStep] = useState<number>(1); // Steps: 1. Shop Info, 2. Rooms/Tables, 3. Staff, 4. Services & Products, 5. Payment Methods, 6. Owner Password & Live Launch

  // Step 1: Shop Profile Info
  const [shopNameMm, setShopNameMm] = useState<string>('ရွှေသီရိ စပါနှင့် ကာရာအိုကေ');
  const [shopNameEn, setShopNameEn] = useState<string>('Shwe Thiri Spa & KTV');
  const [shopPhone, setShopPhone] = useState<string>('09-798881234');
  const [shopAddressMm, setShopAddressMm] = useState<string>('အမှတ် (၁၂)၊ ကမ္ဘာအေးဘုရားလမ်း၊ ရန်ကုန်မြို့');
  const [shopAddressEn, setShopAddressEn] = useState<string>('No. 12, Kaba Aye Pagoda Road, Yangon');
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [serviceChargePercent, setServiceChargePercent] = useState<number>(0);

  // Step 2: Rooms & Tables Setup
  const [roomsList, setRoomsList] = useState<Array<{
    id: string;
    name: string;
    nameMm: string;
    roomNumber: string;
    type: 'vip_suite' | 'massage_bed' | 'dining_table';
    hourlyRateMMK: number;
    capacity: number;
  }>>([
    { id: 'r1', name: 'VIP Suite 1 (KTV)', nameMm: 'VIP ခန်း ၁ (KTV)', roomNumber: 'R-01', type: 'vip_suite', hourlyRateMMK: 30000, capacity: 10 },
    { id: 'r2', name: 'VIP Suite 2 (KTV)', nameMm: 'VIP ခန်း ၂ (KTV)', roomNumber: 'R-02', type: 'vip_suite', hourlyRateMMK: 30000, capacity: 10 },
    { id: 'r3', name: 'Massage Room A', nameMm: 'နှိပ်ခန်း A (Spa)', roomNumber: 'R-03', type: 'massage_bed', hourlyRateMMK: 15000, capacity: 2 },
    { id: 'r4', name: 'Massage Room B', nameMm: 'နှိပ်ခန်း B (Spa)', roomNumber: 'R-04', type: 'massage_bed', hourlyRateMMK: 15000, capacity: 2 },
    { id: 'r5', name: 'Table T-01 (Bar)', nameMm: 'စားပွဲ T-01 (ဘား)', roomNumber: 'T-01', type: 'dining_table', hourlyRateMMK: 0, capacity: 4 },
  ]);

  // Step 3: Staff Setup
  const [staffList, setStaffList] = useState<Array<{
    id: string;
    name: string;
    phone: string;
    role: string;
    baseSalaryMMK: number;
    commissionRate: number;
  }>>([
    { id: 's1', name: 'မေသူ', phone: '09-970001111', role: 'Spa Therapist', baseSalaryMMK: 300000, commissionRate: 15 },
    { id: 's2', name: 'ထက်ထက်', phone: '09-970002222', role: 'KTV Waitress', baseSalaryMMK: 250000, commissionRate: 10 },
    { id: 's3', name: 'ဇွဲမာန်', phone: '09-970003333', role: 'Receptionist', baseSalaryMMK: 350000, commissionRate: 5 },
  ]);

  // Step 4: Services & Products Setup
  const [servicesList, setServicesList] = useState<Array<{
    id: string;
    name: string;
    category: string;
    priceMMK: number;
  }>>([
    { id: 'srv1', name: 'Full Body Oil Massage (60 mins)', category: 'Spa Services', priceMMK: 25000 },
    { id: 'srv2', name: 'KTV Room & Sound (Hourly)', category: 'KTV Entertainment', priceMMK: 20000 },
    { id: 'srv3', name: 'Foot Reflexology (45 mins)', category: 'Spa Services', priceMMK: 15000 },
  ]);

  const [productsList, setProductsList] = useState<Array<{
    id: string;
    name: string;
    category: string;
    sellingPriceMMK: number;
    costPriceMMK: number;
    stockQuantity: number;
  }>>([
    { id: 'p1', name: 'Myanmar Beer (640ml Bottle)', category: 'Beverages', sellingPriceMMK: 5000, costPriceMMK: 3200, stockQuantity: 100 },
    { id: 'p2', name: 'Tiger Beer Can', category: 'Beverages', sellingPriceMMK: 3500, costPriceMMK: 2200, stockQuantity: 120 },
    { id: 'p3', name: 'Fried Chicken Wings', category: 'Food & Snacks', sellingPriceMMK: 8000, costPriceMMK: 4500, stockQuantity: 50 },
    { id: 'p4', name: 'Drinking Water (1L)', category: 'Beverages', sellingPriceMMK: 1000, costPriceMMK: 400, stockQuantity: 200 },
  ]);

  // Step 5: Payment Methods
  const [paymentMethodsList, setPaymentMethodsList] = useState<string[]>([
    'Cash (လက်ငင်း)',
    'KBZPay',
    'WavePay',
    'CBPay',
    'AYAPay',
    'Credit Card / Visa'
  ]);

  // Step 6: Owner Password & Launch
  const [ownerPassword, setOwnerPassword] = useState<string>('1234');
  const [confirmPassword, setConfirmPassword] = useState<string>('1234');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Add Item Helper Functions
  const addRoomItem = () => {
    const idx = roomsList.length + 1;
    setRoomsList([...roomsList, {
      id: `r_custom_${Date.now()}_${idx}`,
      name: `Room ${idx}`,
      nameMm: `အခန်း ${idx}`,
      roomNumber: `R-${String(idx).padStart(2, '0')}`,
      type: 'vip_suite',
      hourlyRateMMK: 20000,
      capacity: 4,
    }]);
  };

  const addStaffItem = () => {
    const idx = staffList.length + 1;
    setStaffList([...staffList, {
      id: `s_custom_${Date.now()}_${idx}`,
      name: `Staff ${idx}`,
      phone: `09-900000${idx}`,
      role: 'Staff Member',
      baseSalaryMMK: 250000,
      commissionRate: 10,
    }]);
  };

  const addServiceItem = () => {
    const idx = servicesList.length + 1;
    setServicesList([...servicesList, {
      id: `srv_custom_${Date.now()}_${idx}`,
      name: `New Service ${idx}`,
      category: 'General Services',
      priceMMK: 15000,
    }]);
  };

  const addProductItem = () => {
    const idx = productsList.length + 1;
    setProductsList([...productsList, {
      id: `prod_custom_${Date.now()}_${idx}`,
      name: `New Product ${idx}`,
      category: 'General Goods',
      sellingPriceMMK: 3000,
      costPriceMMK: 1800,
      stockQuantity: 50,
    }]);
  };

  const handleFinishSetup = async () => {
    if (ownerPassword.trim() !== confirmPassword.trim()) {
      setErrorMsg(isMm ? 'စကားဝှက် နှစ်ခု မတူညီပါ' : 'Passwords do not match');
      return;
    }

    if (ownerPassword.trim().length < 4) {
      setErrorMsg(isMm ? 'စကားဝှက် အနည်းဆုံး ၄ လုံး ရှိရပါမည်' : 'Password must be at least 4 characters');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // 1. Clear all previous demo records
      await Promise.all([
        db.users.clear(),
        db.rooms.clear(),
        db.diningTables.clear(),
        db.staff.clear(),
        db.staffTypes.clear(),
        db.services.clear(),
        db.serviceCategories.clear(),
        db.products.clear(),
        db.productCategories.clear(),
        db.sessions.clear(),
        db.invoices.clear(),
        db.customers.clear(),
        db.customerCreditLedger.clear(),
        db.paymentMethods.clear(),
        db.expenseCategoriesMaster.clear(),
        db.commissionRulesMaster.clear(),
        db.staffLedger.clear(),
        db.staffSettlements.clear(),
        db.expenses.clear(),
        db.cashClosings.clear(),
        db.auditLogs.clear(),
        db.settings.clear(),
      ]);

      const now = new Date().toISOString();

      // 2. Build Shop Settings
      const newSettings: ShopSettings = {
        id: 'settings_main',
        shopName: shopNameEn || 'Shwe Thiri Lounge',
        shopNameMm: shopNameMm || 'ရွှေသီရိ စီမံခန့်ခွဲမှုစနစ်',
        phone: shopPhone || '09-798881234',
        address: shopAddressEn || 'Yangon, Myanmar',
        addressMm: shopAddressMm || 'ရန်ကုန်မြို့၊ မြန်မာနိုင်ငံ',
        taxPercent: taxPercent || 0,
        serviceChargePercent: serviceChargePercent || 0,
        allowNegativeStock: false,
        requirePinForVoid: true,
        receiptFooterNote: 'Thank you for choosing Shwe Thiri!',
        receiptFooterNoteMm: 'ရွှေသီရိကို ရွေးချယ်အားပေးသည့်အတွက် ကျေးဇူးတင်ပါသည်။',
        currencySymbol: 'MMK',
      };

      // 3. Build Owner User Account
      const ownerUser: UserAccount = {
        id: 'usr_owner_' + Date.now(),
        name: 'Shop Owner (ဆိုင်ရှင်)',
        username: 'owner',
        pin: ownerPassword.trim(),
        role: 'owner',
        isActive: true,
        createdAt: now,
      };

      // 4. Build Staff Types & Staff Members
      const defaultStaffTypes = [
        { id: 'stftype_therapist', name: 'Spa Therapist', commissionPercent: 15, isActive: true },
        { id: 'stftype_waiter', name: 'Waitress / Waiter', commissionPercent: 10, isActive: true },
        { id: 'stftype_reception', name: 'Receptionist / Cashier', commissionPercent: 5, isActive: true },
      ];

      const parsedStaff = staffList.map((st, idx) => ({
        id: st.id || `stf_custom_${idx}_${Date.now()}`,
        name: st.name.trim(),
        phone: st.phone.trim() || '09-9000000',
        typeId: st.role.toLowerCase().includes('therapist') ? 'stftype_therapist' : st.role.toLowerCase().includes('wait') ? 'stftype_waiter' : 'stftype_reception',
        role: st.role.trim() || 'staff',
        baseSalaryMMK: Number(st.baseSalaryMMK) || 250000,
        commissionRate: Number(st.commissionRate) || 10,
        status: 'available' as const,
        isActive: true,
        joinedDate: now.split('T')[0],
      }));

      // 5. Build Rooms & Dining Tables
      const parsedRooms = roomsList
        .filter(r => r.type !== 'dining_table')
        .map((rm, idx) => ({
          id: rm.id || `rm_custom_${idx}_${Date.now()}`,
          name: rm.name.trim(),
          nameMm: rm.nameMm.trim() || rm.name.trim(),
          roomNumber: rm.roomNumber.trim() || `R-${String(idx + 1).padStart(2, '0')}`,
          type: rm.type,
          hourlyRateMMK: Number(rm.hourlyRateMMK) || 15000,
          surchargeMMK: 0,
          basePriceMMK: 0,
          status: 'available' as const,
          capacity: Number(rm.capacity) || 4,
          isActive: true,
        }));

      const parsedTables = roomsList
        .filter(r => r.type === 'dining_table')
        .map((tb, idx) => ({
          id: tb.id || `tbl_custom_${idx}_${Date.now()}`,
          tableNumber: tb.roomNumber.trim() || `T-${String(idx + 1).padStart(2, '0')}`,
          name: tb.name.trim(),
          capacity: Number(tb.capacity) || 4,
          section: 'Main Lounge',
          status: 'available' as const,
          isActive: true,
        }));

      // 6. Build Service Categories & Services
      const uniqueServiceCats = Array.from(new Set(servicesList.map(s => s.category.trim()))).filter(Boolean);
      const parsedServiceCats = uniqueServiceCats.map((catName, idx) => ({
        id: `srvcat_${idx}_${Date.now()}`,
        name: catName,
        nameMm: catName,
        description: 'Service category',
        isActive: true,
      }));

      const parsedServices = servicesList.map((srv, idx) => {
        const catObj = parsedServiceCats.find(c => c.name === srv.category.trim());
        return {
          id: srv.id || `srv_custom_${idx}_${Date.now()}`,
          name: srv.name.trim(),
          nameMm: srv.name.trim(),
          categoryId: catObj ? catObj.id : 'srvcat_0',
          priceMMK: Number(srv.priceMMK) || 15000,
          costMMK: 0,
          durationMinutes: 60,
          isActive: true,
        };
      });

      // 7. Build Product Categories & Products
      const uniqueProdCats = Array.from(new Set(productsList.map(p => p.category.trim()))).filter(Boolean);
      const parsedProdCats = uniqueProdCats.map((catName, idx) => ({
        id: `prodcat_${idx}_${Date.now()}`,
        name: catName,
        nameMm: catName,
        description: 'Product category',
        isActive: true,
      }));

      const parsedProducts = productsList.map((prod, idx) => {
        const catObj = parsedProdCats.find(c => c.name === prod.category.trim());
        return {
          id: prod.id || `prod_custom_${idx}_${Date.now()}`,
          name: prod.name.trim(),
          nameMm: prod.name.trim(),
          categoryId: catObj ? catObj.id : 'prodcat_0',
          sellingPriceMMK: Number(prod.sellingPriceMMK) || 3000,
          costPriceMMK: Number(prod.costPriceMMK) || 1800,
          stockQuantity: Number(prod.stockQuantity) || 50,
          minStockAlert: 5,
          unit: 'pcs',
          isActive: true,
        };
      });

      // 8. Payment Methods Master
      const parsedPaymentMethods = paymentMethodsList.map((pm, idx) => ({
        id: `paym_${idx}_${Date.now()}`,
        name: pm,
        nameMm: pm,
        type: pm.toLowerCase().includes('cash') ? 'cash' as const : pm.toLowerCase().includes('card') ? 'card' as const : 'digital_wallet' as const,
        isActive: true,
      }));

      // 9. Default Expense Categories & Commission Rules
      const defaultExpenseCats = [
        { id: 'expcat_inventory', name: 'Inventory Purchases', nameMm: 'ကုန်ပစ္စည်း ဝယ်ယူစရိတ်', isActive: true },
        { id: 'expcat_utility', name: 'Utilities & Electricity', nameMm: 'လျှပ်စစ်နှင့် ရေဖိုး စရိတ်', isActive: true },
        { id: 'expcat_salary', name: 'Staff Salaries & Advances', nameMm: 'ဝန်ထမ်းလစာနှင့် ကြိုထုတ်ငွေ', isActive: true },
        { id: 'expcat_rent', name: 'Shop Rent & Maintenance', nameMm: 'ဆိုင်ငှားခနှင့် ပြုပြင်စရိတ်', isActive: true },
      ];

      const defaultCommRules = [
        { id: 'commrule_therapist', staffTypeId: 'stftype_therapist', commissionType: 'percentage' as const, rate: 15, isActive: true },
        { id: 'commrule_waiter', staffTypeId: 'stftype_waiter', commissionType: 'percentage' as const, rate: 10, isActive: true },
      ];

      const initialAuditLog = {
        id: `audit_init_${Date.now()}`,
        timestamp: now,
        userId: ownerUser.id,
        userName: ownerUser.name,
        userRole: ownerUser.role,
        action: 'System Live Setup Completed',
        entity: 'System',
        entityId: 'settings_main',
        details: 'Configured live Master Data and launched production environment.',
      };

      // 10. Atomic Transaction Write
      await db.transaction('rw', [
        db.settings,
        db.users,
        db.rooms,
        db.diningTables,
        db.staff,
        db.staffTypes,
        db.services,
        db.serviceCategories,
        db.products,
        db.productCategories,
        db.paymentMethods,
        db.expenseCategoriesMaster,
        db.commissionRulesMaster,
        db.auditLogs,
      ], async () => {
        await db.settings.put(newSettings);
        await db.users.add(ownerUser);
        if (defaultStaffTypes.length > 0) await db.staffTypes.bulkAdd(defaultStaffTypes as any);
        if (parsedStaff.length > 0) await db.staff.bulkAdd(parsedStaff as any);
        if (parsedRooms.length > 0) await db.rooms.bulkAdd(parsedRooms as any);
        if (parsedTables.length > 0) await db.diningTables.bulkAdd(parsedTables as any);
        if (parsedServiceCats.length > 0) await db.serviceCategories.bulkAdd(parsedServiceCats as any);
        if (parsedServices.length > 0) await db.services.bulkAdd(parsedServices as any);
        if (parsedProdCats.length > 0) await db.productCategories.bulkAdd(parsedProdCats as any);
        if (parsedProducts.length > 0) await db.products.bulkAdd(parsedProducts as any);
        if (parsedPaymentMethods.length > 0) await db.paymentMethods.bulkAdd(parsedPaymentMethods as any);
        if (defaultExpenseCats.length > 0) await db.expenseCategoriesMaster.bulkAdd(defaultExpenseCats as any);
        if (defaultCommRules.length > 0) await db.commissionRulesMaster.bulkAdd(defaultCommRules as any);
        await db.auditLogs.add(initialAuditLog);
      });

      onCompleted(ownerUser);
      onClose();
    } catch (err: any) {
      setErrorMsg('Setup error: ' + err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-3xl rounded-3xl border border-cyan-500/40 bg-[#0b0f19] p-6 shadow-2xl neon-glow-cyan text-white max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 font-extrabold text-white shadow-lg neon-glow-cyan">
              <Sparkles className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">
                {isMm ? 'စတင်အသုံးပြုရန် အဆင့်လိုက် မာစတာဒေတာ စနစ်ထည့်သွင်းခြင်း' : 'Live Setup Wizard & Master Data Builder'}
              </h2>
              <p className="text-xs text-cyan-300 font-semibold mt-0.5">
                {isMm ? 'နမူနာဒေတာများ ဖယ်ရှားပြီး သင့်ဆိုင်အတွက် လိုအပ်သော အချက်အလက်များကို တိုက်ရိုက် ထည့်သွင်းပါ' : 'Set up live shop profile, rooms, staff, services & products'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Steps Progress Bar */}
        <div className="grid grid-cols-6 gap-1.5 my-6">
          {[
            { s: 1, label: isMm ? '၁. ဆိုင်' : '1. Shop' },
            { s: 2, label: isMm ? '၂. အခန်း' : '2. Rooms' },
            { s: 3, label: isMm ? '၃. ဝန်ထမ်း' : '3. Staff' },
            { s: 4, label: isMm ? '၄. ပစ္စည်း' : '4. Items' },
            { s: 5, label: isMm ? '၅. ငွေပေး' : '5. Pay' },
            { s: 6, label: isMm ? '၆. စကားဝှက်' : '6. Password' },
          ].map(st => (
            <button
              key={st.s}
              onClick={() => setStep(st.s)}
              className={`rounded-xl py-2 px-1 text-center text-xs font-bold transition-all border ${
                step === st.s
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400 shadow-md scale-105'
                  : step > st.s
                  ? 'bg-slate-800/90 text-cyan-300 border-slate-700'
                  : 'bg-slate-900/50 text-slate-500 border-slate-800'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Step 1: Shop Information */}
        {step === 1 && (
          <div className="space-y-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-cyan-400 font-bold border-b border-slate-800 pb-3">
              <Store className="h-5 w-5" />
              <span>{isMm ? '၁။ ဆိုင်အချက်အလက် ထည့်သွင်းခြင်း (Shop Profile)' : '1. Shop Profile Setup'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isMm ? 'ဆိုင်အမည် (မြန်မာ)' : 'Shop Name (Myanmar)'}
                </label>
                <input
                  type="text"
                  value={shopNameMm}
                  onChange={e => setShopNameMm(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="ရွှေသီရိ စပါနှင့် ကာရာအိုကေ"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isMm ? 'ဆိုင်အမည် (အင်္ဂလိပ်)' : 'Shop Name (English)'}
                </label>
                <input
                  type="text"
                  value={shopNameEn}
                  onChange={e => setShopNameEn(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="Shwe Thiri Spa & KTV"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isMm ? 'ဖုန်းနံပါတ်' : 'Phone Number'}
                </label>
                <input
                  type="text"
                  value={shopPhone}
                  onChange={e => setShopPhone(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="09-798881234"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isMm ? 'အခွန် (%) / Service Charge (%)' : 'Tax (%) / Service Charge (%)'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={taxPercent}
                    onChange={e => setTaxPercent(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="Tax %"
                  />
                  <input
                    type="number"
                    value={serviceChargePercent}
                    onChange={e => setServiceChargePercent(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="Svc %"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isMm ? 'ဆိုင်လိပ်စာ' : 'Shop Address'}
                </label>
                <input
                  type="text"
                  value={shopAddressMm}
                  onChange={e => setShopAddressMm(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="ရန်ကုန်မြို့၊ မြန်မာနိုင်ငံ"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Rooms & Tables Setup */}
        {step === 2 && (
          <div className="space-y-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold">
                <DoorOpen className="h-5 w-5" />
                <span>{isMm ? '၂။ အခန်းနှင့် စားပွဲများ သတ်မှတ်ခြင်း' : '2. Rooms & Tables Master Configuration'}</span>
              </div>
              <button
                type="button"
                onClick={addRoomItem}
                className="flex items-center gap-1 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-xl transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>{isMm ? '+ အခန်းအသစ်ထည့်ရန်' : '+ Add Room/Table'}</span>
              </button>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {roomsList.map((rm, idx) => (
                <div key={rm.id} className="grid grid-cols-12 gap-2 items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={rm.name}
                      onChange={e => {
                        const updated = [...roomsList];
                        updated[idx].name = e.target.value;
                        updated[idx].nameMm = e.target.value;
                        setRoomsList(updated);
                      }}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 p-1.5 text-white"
                      placeholder="Room Name"
                    />
                  </div>

                  <div className="col-span-3">
                    <select
                      value={rm.type}
                      onChange={e => {
                        const updated = [...roomsList];
                        updated[idx].type = e.target.value as any;
                        setRoomsList(updated);
                      }}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 p-1.5 text-white"
                    >
                      <option value="vip_suite">VIP Suite (KTV)</option>
                      <option value="massage_bed">Massage Bed (Spa)</option>
                      <option value="dining_table">Dining Table (Bar/Table)</option>
                    </select>
                  </div>

                  <div className="col-span-3">
                    <input
                      type="number"
                      value={rm.hourlyRateMMK}
                      onChange={e => {
                        const updated = [...roomsList];
                        updated[idx].hourlyRateMMK = Number(e.target.value);
                        setRoomsList(updated);
                      }}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 p-1.5 text-white"
                      placeholder="Hourly MMK"
                    />
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      value={rm.capacity}
                      onChange={e => {
                        const updated = [...roomsList];
                        updated[idx].capacity = Number(e.target.value);
                        setRoomsList(updated);
                      }}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 p-1.5 text-white"
                      placeholder="Capacity"
                    />
                  </div>

                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => setRoomsList(roomsList.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Staff Setup */}
        {step === 3 && (
          <div className="space-y-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold">
                <Users className="h-5 w-5" />
                <span>{isMm ? '၃။ ဝန်ထမ်းနှင့် ကော်မရှင် သတ်မှတ်ခြင်း' : '3. Staff & Commission Setup'}</span>
              </div>
              <button
                type="button"
                onClick={addStaffItem}
                className="flex items-center gap-1 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-xl transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>{isMm ? '+ ဝန်ထမ်းအသစ်ထည့်ရန်' : '+ Add Staff'}</span>
              </button>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {staffList.map((st, idx) => (
                <div key={st.id} className="grid grid-cols-12 gap-2 items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={st.name}
                      onChange={e => {
                        const updated = [...staffList];
                        updated[idx].name = e.target.value;
                        setStaffList(updated);
                      }}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 p-1.5 text-white"
                      placeholder="Staff Name"
                    />
                  </div>

                  <div className="col-span-3">
                    <input
                      type="text"
                      value={st.role}
                      onChange={e => {
                        const updated = [...staffList];
                        updated[idx].role = e.target.value;
                        setStaffList(updated);
                      }}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 p-1.5 text-white"
                      placeholder="Role (e.g. Therapist)"
                    />
                  </div>

                  <div className="col-span-3">
                    <input
                      type="number"
                      value={st.baseSalaryMMK}
                      onChange={e => {
                        const updated = [...staffList];
                        updated[idx].baseSalaryMMK = Number(e.target.value);
                        setStaffList(updated);
                      }}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 p-1.5 text-white"
                      placeholder="Base Salary MMK"
                    />
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      value={st.commissionRate}
                      onChange={e => {
                        const updated = [...staffList];
                        updated[idx].commissionRate = Number(e.target.value);
                        setStaffList(updated);
                      }}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 p-1.5 text-white"
                      placeholder="Comm %"
                    />
                  </div>

                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => setStaffList(staffList.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Services & Products */}
        {step === 4 && (
          <div className="space-y-5 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
            {/* Services Section */}
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                  <ShoppingBag className="h-4 w-4" />
                  <span>{isMm ? 'ဝန်ဆောင်မှုများ (Services Master)' : 'Services Master'}</span>
                </div>
                <button
                  type="button"
                  onClick={addServiceItem}
                  className="text-xs font-bold bg-cyan-700 hover:bg-cyan-600 text-white px-2.5 py-1 rounded-lg"
                >
                  + Add Service
                </button>
              </div>

              <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                {servicesList.map((srv, idx) => (
                  <div key={srv.id} className="grid grid-cols-12 gap-2 items-center bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs">
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={srv.name}
                        onChange={e => {
                          const updated = [...servicesList];
                          updated[idx].name = e.target.value;
                          setServicesList(updated);
                        }}
                        className="w-full rounded-md bg-slate-900 border border-slate-700 p-1 text-white"
                        placeholder="Service Name"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={srv.category}
                        onChange={e => {
                          const updated = [...servicesList];
                          updated[idx].category = e.target.value;
                          setServicesList(updated);
                        }}
                        className="w-full rounded-md bg-slate-900 border border-slate-700 p-1 text-white"
                        placeholder="Category"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        value={srv.priceMMK}
                        onChange={e => {
                          const updated = [...servicesList];
                          updated[idx].priceMMK = Number(e.target.value);
                          setServicesList(updated);
                        }}
                        className="w-full rounded-md bg-slate-900 border border-slate-700 p-1 text-white"
                        placeholder="Price MMK"
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => setServicesList(servicesList.filter((_, i) => i !== idx))}
                        className="text-red-400 p-0.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Products Section */}
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                  <ShoppingBag className="h-4 w-4" />
                  <span>{isMm ? 'အရောင်းပစ္စည်းများ (Products Master)' : 'Products Master'}</span>
                </div>
                <button
                  type="button"
                  onClick={addProductItem}
                  className="text-xs font-bold bg-cyan-700 hover:bg-cyan-600 text-white px-2.5 py-1 rounded-lg"
                >
                  + Add Product
                </button>
              </div>

              <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                {productsList.map((prod, idx) => (
                  <div key={prod.id} className="grid grid-cols-12 gap-1.5 items-center bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs">
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={prod.name}
                        onChange={e => {
                          const updated = [...productsList];
                          updated[idx].name = e.target.value;
                          setProductsList(updated);
                        }}
                        className="w-full rounded-md bg-slate-900 border border-slate-700 p-1 text-white"
                        placeholder="Product Name"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={prod.category}
                        onChange={e => {
                          const updated = [...productsList];
                          updated[idx].category = e.target.value;
                          setProductsList(updated);
                        }}
                        className="w-full rounded-md bg-slate-900 border border-slate-700 p-1 text-white"
                        placeholder="Category"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={prod.sellingPriceMMK}
                        onChange={e => {
                          const updated = [...productsList];
                          updated[idx].sellingPriceMMK = Number(e.target.value);
                          setProductsList(updated);
                        }}
                        className="w-full rounded-md bg-slate-900 border border-slate-700 p-1 text-white"
                        placeholder="Price"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={prod.stockQuantity}
                        onChange={e => {
                          const updated = [...productsList];
                          updated[idx].stockQuantity = Number(e.target.value);
                          setProductsList(updated);
                        }}
                        className="w-full rounded-md bg-slate-900 border border-slate-700 p-1 text-white"
                        placeholder="Stock"
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => setProductsList(productsList.filter((_, i) => i !== idx))}
                        className="text-red-400 p-0.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Payment Methods */}
        {step === 5 && (
          <div className="space-y-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-cyan-400 font-bold border-b border-slate-800 pb-3">
              <CreditCard className="h-5 w-5" />
              <span>{isMm ? '၅။ ငွေပေးချေမှု နည်းလမ်းများ သတ်မှတ်ခြင်း' : '5. Payment Methods Configuration'}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {['Cash (လက်ငင်း)', 'KBZPay', 'WavePay', 'CBPay', 'AYAPay', 'Credit Card / Visa'].map(pm => {
                const isSelected = paymentMethodsList.includes(pm);
                return (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setPaymentMethodsList(paymentMethodsList.filter(p => p !== pm));
                      } else {
                        setPaymentMethodsList([...paymentMethodsList, pm]);
                      }
                    }}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <CheckCircle2 className={`h-4 w-4 ${isSelected ? 'text-cyan-400' : 'text-slate-600'}`} />
                    <span>{pm}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 6: Owner Password & Confirmation */}
        {step === 6 && (
          <div className="space-y-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-cyan-400 font-bold border-b border-slate-800 pb-3">
              <ShieldCheck className="h-5 w-5" />
              <span>{isMm ? '၆။ ဆိုင်ရှင် PIN/စကားဝှက် သတ်မှတ်ပြီး တိုက်ရိုက် စတင်အသုံးပြုခြင်း' : '6. Set Owner PIN & Launch Live ERP'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isMm ? 'ဆိုင်ရှင် စကားဝှက် / PIN (အသစ်)' : 'Owner PIN / Password (New)'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={ownerPassword}
                    onChange={e => setOwnerPassword(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 pl-9 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="4-digit PIN"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isMm ? 'စကားဝှက် အတည်ပြုပါ' : 'Confirm Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 pl-9 p-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="Re-enter PIN"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <p className="font-bold">
                {isMm ? 'သတိပေးချက်:' : 'Important Warning:'}
              </p>
              <p className="mt-0.5 text-amber-300/90">
                {isMm
                  ? 'အောက်ပါ "စတင်အသုံးပြုမည်" ခလုတ်ကို နှိပ်လိုက်သည်နှင့် နမူနာဒေတာများအားလုံး ဖျက်သိမ်းပြီး ယခု သတ်မှတ်ထားသော မာစတာဒေတာများနှင့် ဆိုင်ရှင်အကောင့်ဖြင့် စနစ်တစ်ခုလုံး တိုက်ရိုက် ချိတ်ဆက် အသုံးပြုနိုင်မည် ဖြစ်ပါသည်။'
                  : 'Clicking Finish Setup will replace default mock data with your configured Master Data and immediately switch into Live Owner mode.'}
              </p>
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-red-500/20 border border-red-500/40 p-3 text-xs text-red-200 font-medium">
                {errorMsg}
              </div>
            )}
          </div>
        )}

        {/* Navigation Actions */}
        <div className="flex items-center justify-between mt-6 border-t border-slate-800 pt-4">
          <button
            type="button"
            disabled={step === 1 || isSubmitting}
            onClick={() => setStep(s => Math.max(1, s - 1))}
            className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-all cursor-pointer min-h-[40px]"
          >
            {isMm ? 'နောက်သို့' : 'Previous'}
          </button>

          {step < 6 ? (
            <button
              type="button"
              onClick={() => setStep(s => Math.min(6, s + 1))}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg hover:from-cyan-400 hover:to-blue-500 transition-all cursor-pointer min-h-[40px]"
            >
              <span>{isMm ? 'ရှေ့သို့' : 'Next Step'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleFinishSetup}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-2.5 text-xs font-black text-slate-950 shadow-xl hover:from-emerald-400 hover:to-cyan-400 active:scale-95 transition-all cursor-pointer min-h-[40px]"
            >
              <CheckCircle2 className="h-4 w-4 text-slate-950" />
              <span>
                {isSubmitting
                  ? (isMm ? 'စနစ်ပြင်ဆင်နေပါသည်...' : 'Configuring Live Data...')
                  : (isMm ? 'စတင်အသုံးပြုမည် (Save & Launch Live ERP)' : 'Save & Launch Live ERP')}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
