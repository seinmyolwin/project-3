import React, { useState } from 'react';
import {
  StaffMember,
  StaffType,
  Room,
  TableRecord,
  ServiceItem,
  ServiceCategory,
  ProductItem,
  ProductCategory,
  Customer,
  PaymentMethodRecord,
  ExpenseCategoryRecord,
  CommissionRuleRecord,
  UserAccount,
} from '../../types';
import { Language } from '../../utils/translations';
import {
  Users,
  Briefcase,
  DoorOpen,
  LayoutGrid,
  Sparkles,
  Tag,
  ShoppingBag,
  Boxes,
  CreditCard,
  Wallet,
  Receipt,
  Percent,
  Database,
} from 'lucide-react';

import { StaffMasterTab } from './master/StaffMasterTab';
import { StaffTypesMasterTab } from './master/StaffTypesMasterTab';
import { RoomsMasterTab } from './master/RoomsMasterTab';
import { TablesMasterTab } from './master/TablesMasterTab';
import { ServicesMasterTab } from './master/ServicesMasterTab';
import { ServiceCategoriesMasterTab } from './master/ServiceCategoriesMasterTab';
import { ProductsMasterTab } from './master/ProductsMasterTab';
import { ProductCategoriesMasterTab } from './master/ProductCategoriesMasterTab';
import { CustomersMasterTab } from './master/CustomersMasterTab';
import { PaymentMethodsMasterTab } from './master/PaymentMethodsMasterTab';
import { ExpenseCategoriesMasterTab } from './master/ExpenseCategoriesMasterTab';
import { CommissionRulesMasterTab } from './master/CommissionRulesMasterTab';

export type MasterSubTab =
  | 'staff'
  | 'staff_types'
  | 'rooms'
  | 'tables'
  | 'services'
  | 'service_categories'
  | 'products'
  | 'product_categories'
  | 'customers'
  | 'payment_methods'
  | 'expense_categories'
  | 'commission_rules';

interface MasterDataViewProps {
  staff: StaffMember[];
  staffTypes: StaffType[];
  rooms: Room[];
  tables: TableRecord[];
  services: ServiceItem[];
  serviceCategories: ServiceCategory[];
  products: ProductItem[];
  productCategories: ProductCategory[];
  customers: Customer[];
  paymentMethods: PaymentMethodRecord[];
  expenseCategories: ExpenseCategoryRecord[];
  commissionRules: CommissionRuleRecord[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  staff,
  staffTypes,
  rooms,
  tables,
  services,
  serviceCategories,
  products,
  productCategories,
  customers,
  paymentMethods,
  expenseCategories,
  commissionRules,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';
  const [activeSubTab, setActiveSubTab] = useState<MasterSubTab>('staff');

  const navGroups = [
    {
      groupName: isMm ? 'ဝန်ထမ်းနှင့် ကော်မရှင်' : 'Personnel & Commission',
      tabs: [
        {
          id: 'staff' as MasterSubTab,
          label: isMm ? 'ဝန်ထမ်းများ' : 'Staff',
          icon: Users,
          count: staff.length,
          color: 'text-amber-700 bg-amber-50 border-amber-200',
        },
        {
          id: 'staff_types' as MasterSubTab,
          label: isMm ? 'ဝန်ထမ်းရာထူးခွဲ' : 'Staff Types',
          icon: Briefcase,
          count: staffTypes.length,
          color: 'text-amber-700 bg-amber-50 border-amber-200',
        },
        {
          id: 'commission_rules' as MasterSubTab,
          label: isMm ? 'ကော်မရှင်စည်းမျဉ်း' : 'Commission Rules',
          icon: Percent,
          count: commissionRules.length,
          color: 'text-amber-700 bg-amber-50 border-amber-200',
        },
      ],
    },
    {
      groupName: isMm ? 'အခန်းနှင့် နေရာများ' : 'Rooms & Spaces',
      tabs: [
        {
          id: 'rooms' as MasterSubTab,
          label: isMm ? 'အခန်းများ' : 'Rooms',
          icon: DoorOpen,
          count: rooms.length,
          color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        },
        {
          id: 'tables' as MasterSubTab,
          label: isMm ? 'စားပွဲ/ခုံများ' : 'Tables',
          icon: LayoutGrid,
          count: tables.length,
          color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        },
      ],
    },
    {
      groupName: isMm ? 'ဝန်ဆောင်မှု မီနူး' : 'Services Catalog',
      tabs: [
        {
          id: 'services' as MasterSubTab,
          label: isMm ? 'ဝန်ဆောင်မှုများ' : 'Services',
          icon: Sparkles,
          count: services.length,
          color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        },
        {
          id: 'service_categories' as MasterSubTab,
          label: isMm ? 'ဝန်ဆောင်မှုကဏ္ဍ' : 'Service Categories',
          icon: Tag,
          count: serviceCategories.length,
          color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        },
      ],
    },
    {
      groupName: isMm ? 'ကုန်ပစ္စည်းနှင့် စတော့' : 'Products & Goods',
      tabs: [
        {
          id: 'products' as MasterSubTab,
          label: isMm ? 'ကုန်ပစ္စည်းများ' : 'Products',
          icon: ShoppingBag,
          count: products.length,
          color: 'text-blue-700 bg-blue-50 border-blue-200',
        },
        {
          id: 'product_categories' as MasterSubTab,
          label: isMm ? 'ကုန်ပစ္စည်းကဏ္ဍ' : 'Product Categories',
          icon: Boxes,
          count: productCategories.length,
          color: 'text-blue-700 bg-blue-50 border-blue-200',
        },
      ],
    },
    {
      groupName: isMm ? 'ဘဏ္ဍာရေးနှင့် စာရင်း' : 'Finance & Accounts',
      tabs: [
        {
          id: 'customers' as MasterSubTab,
          label: isMm ? 'ဖောက်သည်များ' : 'Customers',
          icon: CreditCard,
          count: customers.length,
          color: 'text-purple-700 bg-purple-50 border-purple-200',
        },
        {
          id: 'payment_methods' as MasterSubTab,
          label: isMm ? 'ငွေပေးချေမှုနည်းလမ်း' : 'Payment Methods',
          icon: Wallet,
          count: paymentMethods.length,
          color: 'text-purple-700 bg-purple-50 border-purple-200',
        },
        {
          id: 'expense_categories' as MasterSubTab,
          label: isMm ? 'အသုံးစရိတ်ကဏ္ဍ' : 'Expense Categories',
          icon: Receipt,
          count: expenseCategories.length,
          color: 'text-purple-700 bg-purple-50 border-purple-200',
        },
      ],
    },
  ];

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Master Data Navigation Bar */}
      <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800 shrink-0">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-gray-900">
                {isMm ? 'ပင်မ အချက်အလက် စီမံခန့်ခွဲမှု (Master Data)' : 'Master Data Configuration'}
              </h1>
            </div>
          </div>
        </div>

        {/* Grouped Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {navGroups.flatMap((group) => group.tabs).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-xs ring-1 ring-amber-600'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                <span
                  className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Content */}
      <div>
        {activeSubTab === 'staff' && (
          <StaffMasterTab
            staff={staff}
            staffTypes={staffTypes}
            commissionRules={commissionRules}
            currentUser={currentUser}
            lang={lang}
            onRefresh={onRefresh}
          />
        )}

        {activeSubTab === 'staff_types' && (
          <StaffTypesMasterTab
            staffTypes={staffTypes}
            staff={staff}
            currentUser={currentUser}
            lang={lang}
            onRefresh={onRefresh}
          />
        )}

        {activeSubTab === 'rooms' && (
          <RoomsMasterTab
            rooms={rooms}
            currentUser={currentUser}
            lang={lang}
            onRefresh={onRefresh}
          />
        )}

        {activeSubTab === 'tables' && (
          <TablesMasterTab
            tables={tables}
            rooms={rooms}
            currentUser={currentUser}
            lang={lang}
            onRefresh={onRefresh}
          />
        )}

        {activeSubTab === 'services' && (
          <ServicesMasterTab
            services={services}
            serviceCategories={serviceCategories}
            commissionRules={commissionRules}
            currentUser={currentUser}
            lang={lang}
            onRefresh={onRefresh}
          />
        )}

        {activeSubTab === 'service_categories' && (
          <ServiceCategoriesMasterTab
            categories={serviceCategories}
            services={services}
            currentUser={currentUser}
            lang={lang}
            onRefresh={onRefresh}
          />
        )}

        {activeSubTab === 'products' && (
          <ProductsMasterTab
            products={products}
            productCategories={productCategories}
            currentUser={currentUser}
            lang={lang}
            onRefresh={onRefresh}
          />
        )}

        {activeSubTab === 'product_categories' && (
          <ProductCategoriesMasterTab
            categories={productCategories}
            products={products}
            currentUser={currentUser}
            lang={lang}
            onRefresh={onRefresh}
          />
        )}

        {activeSubTab === 'customers' && (
          <CustomersMasterTab
            customers={customers}
            currentUser={currentUser}
            lang={lang}
            onRefresh={onRefresh}
          />
        )}

        {activeSubTab === 'payment_methods' && (
          <PaymentMethodsMasterTab
            paymentMethods={paymentMethods}
            currentUser={currentUser}
            lang={lang}
            onRefresh={onRefresh}
          />
        )}

        {activeSubTab === 'expense_categories' && (
          <ExpenseCategoriesMasterTab
            categories={expenseCategories}
            currentUser={currentUser}
            lang={lang}
            onRefresh={onRefresh}
          />
        )}

        {activeSubTab === 'commission_rules' && (
          <CommissionRulesMasterTab
            commissionRules={commissionRules}
            currentUser={currentUser}
            lang={lang}
            onRefresh={onRefresh}
          />
        )}
      </div>
    </div>
  );
};
