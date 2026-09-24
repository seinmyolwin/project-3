import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, CheckCircle, X, Share, PlusSquare, Sparkles, ShieldCheck, WifiOff } from 'lucide-react';
import { Language } from '../utils/translations';

interface PWAInstallModalProps {
  lang: Language;
  isOpenManual?: boolean;
  onCloseManual?: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  lang,
  isOpenManual,
  onCloseManual,
}) => {
  const { isInstallable, isInstalled, isIOS, isMobileOrTablet, install } = usePWAInstall();
  const isMm = lang === 'my';

  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem('shwe_pwa_prompt_dismissed') === 'true';
  });

  const [installing, setInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // Manual-only trigger via Navbar "App / Install" action
  const shouldShow = Boolean(isOpenManual);

  if (!shouldShow || isInstalled) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('shwe_pwa_prompt_dismissed', 'true');
    if (onCloseManual) onCloseManual();
  };

  const handleInstallClick = async () => {
    setInstalling(true);
    try {
      const success = await install();
      if (success) {
        setInstallSuccess(true);
        setTimeout(() => {
          handleDismiss();
        }, 2500);
      }
    } catch (err) {
      console.error('Install error:', err);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="w-full max-w-md rounded-3xl border-2 border-cyan-500/40 bg-[#0d1322] p-6 shadow-2xl space-y-5 text-white relative overflow-hidden neon-glow-cyan">
        {/* Top Decorative Glow */}
        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 shadow-md">
              <img
                src="/pwa-192x192.png"
                alt="App Icon"
                className="h-10 w-10 rounded-xl object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
              <Smartphone className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-1.5">
                <span>{isMm ? 'ရွှေသီရိ ERP App ထည့်သွင်းရန်' : 'Install Shwe Thiri ERP App'}</span>
                <Sparkles className="h-4 w-4 text-cyan-400" />
              </h3>
              <p className="text-xs text-cyan-300/80 font-medium">
                {isMm ? 'ဖုန်း သို့ တက်ဘလက်ထဲသို့ Offline App အဖြစ် ထည့်သွင်းမည်' : 'Standalone Native Offline Application'}
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="space-y-2.5 rounded-2xl bg-[#131b2e] p-4 border border-cyan-500/20 text-xs">
          <div className="flex items-center gap-2.5 text-slate-200">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              {isMm
                ? 'Chrome Browser လိပ်စာဘား မပါဘဲ Play Store App အတိုင်း သီးသန့် ပေါ်မည်။'
                : 'Runs in full standalone mode without browser UI/address bar.'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-slate-200">
            <WifiOff className="h-4 w-4 text-cyan-400 shrink-0" />
            <span>
              {isMm
                ? 'အင်တာနက် မလိုဘဲ 100% Offline အပြည့်အဝ အလုပ်လုပ်မည်။'
                : 'Works 100% offline without internet connection.'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-slate-200">
            <Smartphone className="h-4 w-4 text-purple-400 shrink-0" />
            <span>
              {isMm
                ? 'ဖုန်းနှင့် တက်ဘလက် Home Screen တွင် သီးသန့် အိုင်ကွန် ပေါ်မည်။'
                : 'Direct shortcut on home screen with native app icon.'}
            </span>
          </div>
        </div>

        {/* Install Action Area */}
        {installSuccess ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 p-4 text-emerald-300 text-sm font-bold animate-fadeIn">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <span>{isMm ? 'App ကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ!' : 'Application successfully installed!'}</span>
          </div>
        ) : isInstallable ? (
          <div className="space-y-2 pt-1">
            <button
              onClick={handleInstallClick}
              disabled={installing}
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 py-3.5 px-5 text-sm font-black text-white shadow-xl hover:shadow-cyan-500/20 active:scale-98 transition-all cursor-pointer border border-cyan-400/40"
            >
              <Download className={`h-5 w-5 text-white ${installing ? 'animate-bounce' : ''}`} />
              <span>
                {installing
                  ? isMm ? 'ထည့်သွင်းနေပါသည်...' : 'Installing Application...'
                  : isMm ? 'ယခုပင် ဖုန်း/တက်ဘလက်ထဲသို့ App ထည့်သွင်းမည်' : 'Install App to Home Screen'}
              </span>
            </button>
            <p className="text-[11px] text-center text-slate-400 font-medium">
              {isMm ? 'Chrome Browser popup မှ "Install" သို့မဟုတ် "Add to Home Screen" ကို နှိပ်ပါ' : 'Click Install when prompted by browser'}
            </p>
          </div>
        ) : isIOS ? (
          /* iOS Safari Step-by-step Guide */
          <div className="rounded-2xl bg-slate-900/90 border border-purple-500/30 p-4 space-y-2 text-xs">
            <div className="font-extrabold text-purple-300 flex items-center gap-1.5">
              <Share className="h-4 w-4 text-purple-400" />
              <span>{isMm ? 'iPhone / iPad တွင် App ထည့်သွင်းနည်း:' : 'How to install on iPhone / iPad:'}</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300 font-medium leading-relaxed">
              <li>
                {isMm ? 'Safari ဘရောက်ဆာ၏ အောက်ခြေရှိ ' : 'Tap the '}
                <strong className="text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Share</strong>
                {isMm ? ' ခလုတ်ကို နှိပ်ပါ။' : ' button in Safari toolbar.'}
              </li>
              <li>
                {isMm ? 'အောက်သို့ဆွဲ၍ ' : 'Scroll down and tap '}
                <strong className="text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Add to Home Screen</strong>
                {isMm ? ' ကို နှိပ်ပါ။' : '.'}
              </li>
              <li>
                {isMm ? 'ညာဘက်အပေါ်ရှိ ' : 'Tap '}
                <strong className="text-cyan-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Add</strong>
                {isMm ? ' ကို နှိပ်ပြီးပါပြီ။' : ' in top right.'}
              </li>
            </ol>
          </div>
        ) : (
          /* Android / Desktop fallback guide */
          <div className="space-y-2">
            <button
              onClick={() => {
                alert(
                  isMm
                    ? 'Chrome/Edge Browser ၏ ညာဘက်အပေါ်ရှိ အစက် (၃) စက် (Menu) ကို နှိပ်ပြီး "Install App" သို့မဟုတ် "Add to Home Screen" ကို နှိပ်၍ အသုံးပြုနိုင်ပါသည်'
                    : 'Open Chrome Menu (3 dots) in top right and select "Install App" or "Add to Home Screen".'
                );
              }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 hover:bg-cyan-500 py-3 px-4 text-xs font-bold text-white shadow-md active:scale-95 transition-all"
            >
              <Download className="h-4 w-4" />
              <span>{isMm ? 'Browser Menu မှ App ထည့်သွင်းနည်း ကြည့်မည်' : 'How to Install via Chrome Menu'}</span>
            </button>
          </div>
        )}

        {/* Footer Dismiss Button */}
        <div className="flex justify-center pt-1 border-t border-slate-800/80">
          <button
            onClick={handleDismiss}
            className="text-xs font-bold text-slate-400 hover:text-cyan-300 underline underline-offset-4 cursor-pointer"
          >
            {isMm ? 'ယခုမလုပ်ဆောင်ပါ (ခဏထားမည်)' : 'Dismiss for now'}
          </button>
        </div>
      </div>
    </div>
  );
};
