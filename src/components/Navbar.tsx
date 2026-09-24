import React, { useState } from 'react';
import { UserAccount, ShopSettings } from '../types';
import { Language } from '../utils/translations';
import logoImg from '../assets/images/shwe_thiri_logo_1790061980846.jpg';
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
  LogOut,
  Globe,
  Radio,
  Search,
  Sparkles,
  BookOpen,
  CalendarDays,
  Smartphone,
  Download,
  PieChart,
} from 'lucide-react';

import { SyncState } from '../services/syncManager';

export type ActiveTab =
  | 'dashboard'
  | 'rooms'
  | 'bookings'
  | 'pos'
  | 'memberships'
  | 'staff'
  | 'customers'
  | 'expenses'
  | 'records'
  | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  currentUser: UserAccount | null;
  onOpenPINModal: () => void;
  onLogout?: () => void;
  lang: Language;
  onToggleLang: () => void;
  settings: ShopSettings | null;
  onOpenLANModal: () => void;
  onOpenSearchModal: () => void;
  onOpenSetupWizard: () => void;
  onOpenPWAModal?: () => void;
  syncState?: SyncState;
  syncMessage?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onOpenPINModal,
  onLogout,
  lang,
  onToggleLang,
  settings,
  onOpenLANModal,
  onOpenSearchModal,
  onOpenSetupWizard,
  onOpenPWAModal,
  syncState = 'LOCAL_ONLY',
  syncMessage = '',
}) => {
  const isMm = lang === 'my';
  const [imgSrc, setImgSrc] = useState<string>(logoImg);
  const [logoFailed, setLogoFailed] = useState(false);

  const navItems = [
    { id: 'dashboard' as ActiveTab, icon: PieChart, labelEn: 'Dashboard', labelMm: 'ဒက်ရှ်ဘုတ်' },
    { id: 'rooms' as ActiveTab, icon: LayoutGrid, labelEn: 'Rooms', labelMm: 'အခန်း' },
    { id: 'bookings' as ActiveTab, icon: CalendarDays, labelEn: 'Bookings', labelMm: 'ချိန်းဆိုမှု' },
    { id: 'pos' as ActiveTab, icon: ShoppingBag, labelEn: 'POS', labelMm: 'အရောင်း' },
    { id: 'memberships' as ActiveTab, icon: Sparkles, labelEn: 'Memberships', labelMm: 'အသင်းဝင်' },
    { id: 'staff' as ActiveTab, icon: Users, labelEn: 'Staff', labelMm: 'ဝန်ထမ်း' },
    { id: 'customers' as ActiveTab, icon: CreditCard, labelEn: 'Customers', labelMm: 'ဖောက်သည်' },
    { id: 'expenses' as ActiveTab, icon: ReceiptText, labelEn: 'Expenses', labelMm: 'စရိတ်' },
    { id: 'records' as ActiveTab, icon: BookOpen, labelEn: 'Records', labelMm: 'မှတ်တမ်း' },
    { id: 'settings' as ActiveTab, icon: ShieldCheck, labelEn: 'Settings', labelMm: 'ဆက်တင်' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-cyan-500/20 bg-[#07090e]/95 backdrop-blur-md shadow-md">
      {/* Top Header Row - Compact, Proportioned, Non-wrapping */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-[#0b0f19] border-b border-cyan-900/30">
        {/* Brand & Status Section */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            onClick={() => onSelectTab('dashboard')}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-[#07090e] border border-cyan-500/40 shadow-xs overflow-hidden shrink-0 cursor-pointer hover:border-cyan-400 transition-all"
            title="Go to Dashboard"
          >
            {!logoFailed ? (
              <img
                src={imgSrc}
                alt="Shwe Thiri Logo"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => {
                  setImgSrc((prev) => {
                    if (prev !== '/logo.jpg' && prev !== '/logo_app.jpg') {
                      return '/logo.jpg';
                    }
                    if (prev === '/logo.jpg') {
                      return '/logo_app.jpg';
                    }
                    setLogoFailed(true);
                    return prev;
                  });
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 font-black text-xs">
                ST
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-extrabold tracking-tight text-white truncate max-w-[120px] xs:max-w-[160px] sm:max-w-[260px] md:max-w-none">
              {isMm ? settings?.shopNameMm || 'ရွှေသီရိ စပါနှင့် ကာရာအိုကေ' : settings?.shopName || 'Shwe Thiri Spa & KTV'}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black text-emerald-300 border border-emerald-500/50 shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                <span>LIVE!</span>
              </div>

              <button
                onClick={onOpenLANModal}
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold border transition-all cursor-pointer ${
                  syncState === 'ONLINE_LAN' || syncState === 'SYNCED'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                }`}
                title={syncMessage || 'LAN Connection Status'}
              >
                <Radio className="h-2.5 w-2.5 sm:h-3 sm:w-3 animate-pulse" />
                <span>{syncState === 'ONLINE_LAN' || syncState === 'SYNCED' ? 'LAN' : 'Offline'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Header Action Tools & User Profile */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Quick Search */}
          <button
            onClick={onOpenSearchModal}
            className="inline-flex items-center gap-1 rounded-lg bg-purple-500/15 p-1.5 sm:px-2 sm:py-1 text-[10px] font-bold text-purple-300 border border-purple-500/40 hover:bg-purple-500/25 transition-all"
            title={isMm ? 'ရှာဖွေရန်' : 'Search (Ctrl+K)'}
            aria-label="Search"
          >
            <Search className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden md:inline">{isMm ? 'ရှာရန်' : 'Search'}</span>
          </button>

          {/* Setup Wizard (Owner Only) */}
          {currentUser?.role === 'owner' && (
            <button
              onClick={onOpenSetupWizard}
              className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 p-1.5 sm:px-2 sm:py-1 text-[10px] font-black text-slate-950 border border-emerald-400/50 transition-all"
              title="Setup Wizard"
              aria-label="Setup Wizard"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Setup</span>
            </button>
          )}

          {/* App / PWA Install */}
          {onOpenPWAModal && (
            <button
              onClick={onOpenPWAModal}
              className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/20 p-1.5 sm:px-2 sm:py-1 text-[10px] font-bold text-cyan-200 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all"
              title="Install App / PWA"
              aria-label="Install App"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">App</span>
            </button>
          )}

          {/* Language Toggle */}
          <button
            onClick={onToggleLang}
            className="flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-[#111827] px-2 py-1 text-[10px] sm:text-[11px] font-bold text-cyan-300 hover:bg-cyan-950/40 transition-all"
            title={isMm ? 'Switch to English' : 'မြန်မာဘာသာသို့ ပြောင်းမည်'}
            aria-label="Toggle Language"
          >
            <Globe className="h-3.5 w-3.5 text-cyan-400" />
            <span>{isMm ? 'EN' : 'မြန်မာ'}</span>
          </button>

          {/* Current User & PIN switch */}
          <button
            onClick={onOpenPINModal}
            className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-[#111827] px-2 py-1 text-xs text-slate-200 hover:bg-purple-950/30 transition-all"
            title="Switch User / Lock PIN"
            aria-label="Switch User"
          >
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <div className="text-left hidden sm:block">
              <div className="font-bold text-white text-[11px] truncate max-w-[90px] md:max-w-[130px]">
                {currentUser?.name || 'Cashier'}
              </div>
              <div className="text-[9px] text-purple-400 uppercase font-semibold leading-tight">
                {currentUser?.role || 'cashier'}
              </div>
            </div>
            <Lock className="h-3.5 w-3.5 text-purple-400 shrink-0" />
          </button>

          {/* Explicit Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              title={isMm ? 'အကောင့်မှထွက်မည်' : 'Logout'}
              aria-label="Logout"
              className="flex items-center justify-center rounded-lg border border-rose-500/30 bg-rose-950/30 p-1.5 text-rose-300 hover:bg-rose-900/50 hover:text-white transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Compact Tab Navigation Bar - Ultra-compact single horizontal scrollable row */}
      <div className="flex overflow-x-auto px-2 py-1 sm:px-3 sm:py-1.5 bg-[#0b0f19] border-t border-slate-800 scrollbar-none">
        <nav className="flex gap-1 sm:gap-1.5 w-full justify-start lg:justify-center" aria-label="Tabs">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-1 sm:gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-600 to-purple-600 text-white shadow-sm border border-cyan-400/40'
                    : 'bg-[#111827] text-slate-300 border border-slate-800 hover:bg-[#1f293d] hover:text-white'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-cyan-400'}`} />
                <span>{isMm ? item.labelMm : item.labelEn}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
