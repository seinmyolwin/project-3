import React from 'react';
import { UserAccount, ShopSettings } from '../types';
import { Language, translations } from '../utils/translations';
import {
  LayoutGrid,
  ShoppingBag,
  Users,
  CreditCard,
  ReceiptText,
  BadgePercent,
  TrendingUp,
  ShieldCheck,
  Database,
  Lock,
  Globe,
  WifiOff,
} from 'lucide-react';

export type ActiveTab =
  | 'rooms'
  | 'pos'
  | 'staff'
  | 'customers'
  | 'expenses'
  | 'cashClosing'
  | 'reports'
  | 'masterData'
  | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  currentUser: UserAccount | null;
  onOpenPINModal: () => void;
  lang: Language;
  onToggleLang: () => void;
  settings: ShopSettings | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onOpenPINModal,
  lang,
  onToggleLang,
  settings,
}) => {
  const isMm = lang === 'my';

  const navItems = [
    { id: 'rooms' as ActiveTab, icon: LayoutGrid, labelEn: 'Rooms & Sessions', labelMm: 'အခန်းနှင့် ဆက်ရှင်' },
    { id: 'pos' as ActiveTab, icon: ShoppingBag, labelEn: 'Direct POS', labelMm: 'အရောင်းကောင်တာ' },
    { id: 'staff' as ActiveTab, icon: Users, labelEn: 'Staff & Commissions', labelMm: 'ဝန်ထမ်းနှင့် ကော်မရှင်' },
    { id: 'customers' as ActiveTab, icon: CreditCard, labelEn: 'Customers & Credit', labelMm: 'ဖောက်သည်နှင့် ကြွေးကျန်' },
    { id: 'expenses' as ActiveTab, icon: ReceiptText, labelEn: 'Expenses', labelMm: 'ကုန်ကျစရိတ်' },
    { id: 'cashClosing' as ActiveTab, icon: BadgePercent, labelEn: 'Cash Closing', labelMm: 'နေ့စဉ်စာရင်းပိတ်' },
    { id: 'reports' as ActiveTab, icon: TrendingUp, labelEn: 'Reports & P&L', labelMm: 'အစီရင်ခံစာ' },
    { id: 'masterData' as ActiveTab, icon: Database, labelEn: 'Master Data', labelMm: 'အခြေခံဒေတာများ' },
    { id: 'settings' as ActiveTab, icon: ShieldCheck, labelEn: 'System & Backup', labelMm: 'စနစ်နှင့် မိတ္တူ' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-xs">
      {/* Top Banner with branding, status & user switch */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6 bg-slate-900 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 font-bold text-slate-950 shadow-sm">
            ရွှေ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white sm:text-base">
                {isMm ? settings?.shopNameMm || 'ရွှေသီရိ စပါနှင့် ကာရာအိုကေ' : settings?.shopName || 'Shwe Thiri Spa & KTV'}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-300 border border-emerald-500/30">
                <WifiOff className="h-3 w-3" />
                <span>100% Offline</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {isMm ? 'မြန်မာစီးပွားရေးနှင့် စာရင်းကိုင် စီမံခန့်ခွဲမှုစနစ်' : 'Business Management & Accounting ERP'}
            </p>
          </div>
        </div>

        {/* Right side: language & user info */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Toggle */}
          <button
            onClick={onToggleLang}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 active:bg-slate-600 transition-colors"
            title="Toggle Myanmar / English"
          >
            <Globe className="h-3.5 w-3.5 text-amber-400" />
            <span>{isMm ? 'English' : 'မြန်မာစာ'}</span>
          </button>

          {/* Current User & PIN switch */}
          <button
            onClick={onOpenPINModal}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition-all hover:border-slate-600"
          >
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <div className="text-left">
              <div className="font-semibold text-white truncate max-w-[120px] sm:max-w-[160px]">
                {currentUser?.name || 'Cashier'}
              </div>
              <div className="text-[10px] text-amber-300 uppercase tracking-wider">
                {currentUser?.role || 'cashier'} • Switch PIN
              </div>
            </div>
            <Lock className="h-3 w-3 text-slate-400 ml-1" />
          </button>
        </div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="flex overflow-x-auto px-4 py-1.5 bg-gray-50 border-t border-gray-100 scrollbar-none">
        <nav className="flex gap-1.5" aria-label="Tabs">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-200/80 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                <span>{isMm ? item.labelMm : item.labelEn}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
