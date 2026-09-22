import React from 'react';
import { UserAccount, ShopSettings } from '../types';
import { Language } from '../utils/translations';
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
  Radio,
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
  onOpenLANModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onOpenPINModal,
  lang,
  onToggleLang,
  settings,
  onOpenLANModal,
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
    <header className="sticky top-0 z-40 border-b border-cyan-500/20 bg-[#07090e]/95 backdrop-blur-md shadow-lg">
      {/* Top Banner with Neon Night Theme */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 bg-[#0b0f19] border-b border-cyan-900/40">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-purple-600 to-pink-500 font-extrabold text-white shadow-lg neon-glow-cyan">
            ရွှေ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-wide text-white sm:text-lg">
                {isMm ? settings?.shopNameMm || 'ရွှေသီရိ စပါနှင့် ကာရာအိုကေ' : settings?.shopName || 'Shwe Thiri Spa & KTV'}
              </h1>
              <button
                onClick={onOpenLANModal}
                className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-300 border border-cyan-500/40 neon-glow-cyan hover:bg-cyan-500/25 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                title="Click to view LAN multi-device connection guide & server address"
              >
                <Radio className="h-3.5 w-3.5 animate-pulse text-cyan-400" />
                <span>Offline Connection</span>
              </button>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block font-medium">
              Neon Night Entertainment POS & Accounting ERP
            </p>
          </div>
        </div>

        {/* Right side: language & user info */}
        <div className="flex items-center gap-3">
          {/* Language Toggle */}
          <button
            onClick={onToggleLang}
            className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-[#111827] px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-950/40 active:bg-cyan-900/50 transition-all min-h-[44px]"
            title="Toggle Myanmar / English"
          >
            <Globe className="h-4 w-4 text-cyan-400" />
            <span>{isMm ? 'English' : 'မြန်မာစာ'}</span>
          </button>

          {/* Current User & PIN switch */}
          <button
            onClick={onOpenPINModal}
            className="flex items-center gap-2.5 rounded-xl border border-purple-500/30 bg-[#111827] px-4 py-2 text-xs text-slate-200 hover:bg-purple-950/30 transition-all min-h-[44px]"
          >
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
            <div className="text-left">
              <div className="font-bold text-white text-sm truncate max-w-[130px] sm:max-w-[170px]">
                {currentUser?.name || 'Cashier 1'}
              </div>
              <div className="text-[11px] text-purple-400 uppercase tracking-wider font-semibold">
                {currentUser?.role || 'cashier'} • SWITCH PIN
              </div>
            </div>
            <Lock className="h-4 w-4 text-purple-400 ml-1" />
          </button>
        </div>
      </div>

      {/* Main Tab Navigation Bar - Touch Friendly */}
      <div className="flex overflow-x-auto px-4 py-2 bg-[#0b0f19] border-t border-slate-800 scrollbar-none">
        <nav className="flex gap-2" aria-label="Tabs">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-4 py-3 text-xs sm:text-sm font-bold transition-all min-h-[48px] ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-600 to-purple-600 text-white shadow-lg neon-glow-cyan border border-cyan-400/40'
                    : 'bg-[#111827] text-slate-300 border border-slate-800 hover:bg-[#1f293d] hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${isActive ? 'text-white' : 'text-cyan-400'}`} />
                <span>{isMm ? item.labelMm : item.labelEn}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
