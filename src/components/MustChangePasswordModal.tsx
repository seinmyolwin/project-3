import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, LogOut, User, KeyRound, ShieldAlert } from 'lucide-react';
import { UserAccount } from '../types';
import { db } from '../db/database';
import { Language } from '../utils/translations';
import { hashPassword } from '../utils/cryptoAuth';
import { localServerClient } from '../services/localServerClient';

interface MustChangePasswordModalProps {
  currentUser: UserAccount;
  lang: Language;
  onSuccess: (updatedUser: UserAccount) => void;
  onLogout: () => void;
}

export const MustChangePasswordModal: React.FC<MustChangePasswordModalProps> = ({
  currentUser,
  lang,
  onSuccess,
  onLogout,
}) => {
  const isMm = lang === 'my';
  const isDefaultOwner = currentUser.username === 'owner';

  const [name, setName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPassword = newPassword.trim();

    if (isDefaultOwner) {
      if (!name.trim()) {
        setError(isMm ? 'ဆိုင်ရှင်အမည် ထည့်သွင်းရန် လိုအပ်ပါသည်' : 'Display name is required');
        return;
      }
      if (!newUsername.trim() || newUsername.trim().length < 3) {
        setError(isMm ? 'အသုံးပြုသူအမည် အနည်းဆုံး ၃ လုံး ရှိရပါမည်' : 'Username must be at least 3 characters');
        return;
      }
      if (newUsername.toLowerCase().trim() === 'owner') {
        setError(isMm ? 'လုံခြုံရေးအရ "owner" မဟုတ်သော အခြားအသုံးပြုသူအမည်တစ်ခု ရွေးချယ်ပါ' : 'For security, please choose a username other than "owner"');
        return;
      }
    }

    if (cleanPassword.length < 4) {
      setError(isMm ? 'စကားဝှက် အနည်းဆုံး ၄ လုံး ရှိရပါမည်' : 'Password must be at least 4 characters');
      return;
    }

    if (cleanPassword !== confirmPassword.trim()) {
      setError(isMm ? 'စကားဝှက် ၂ ကြိမ် ရိုက်ထည့်မှု မတူညီပါ' : 'Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      let updatedUser: UserAccount;

      if (isDefaultOwner) {
        const targetUsername = newUsername.toLowerCase().trim();
        const targetName = name.trim();

        // 1. Submit to atomic server setup endpoint
        await localServerClient.completeFirstSetup(currentUser.id, {
          name: targetName,
          newUsername: targetUsername,
          newPassword: cleanPassword,
        });

        // 2. Overwrite locally in Dexie database
        const { passwordHash, salt } = hashPassword(cleanPassword);
        await db.users.put({
          id: currentUser.id,
          name: targetName,
          username: targetUsername,
          role: 'owner',
          pinHash: passwordHash,
          pinSalt: salt,
          isActive: true,
          mustChangePassword: false,
          createdAt: currentUser.createdAt || new Date().toISOString(),
        });

        updatedUser = {
          ...currentUser,
          name: targetName,
          username: targetUsername,
          mustChangePassword: false,
        };
      } else {
        // Normal staff user mandatory password reset
        await localServerClient.changeUserPassword(currentUser.id, cleanPassword);

        // Update locally in IndexedDB Dexie
        const { passwordHash, salt } = hashPassword(cleanPassword);
        await db.users.put({
          id: currentUser.id,
          name: currentUser.name,
          username: currentUser.username,
          role: currentUser.role,
          pinHash: passwordHash,
          pinSalt: salt,
          isActive: true,
          mustChangePassword: false,
          createdAt: currentUser.createdAt || new Date().toISOString(),
        });

        updatedUser = {
          ...currentUser,
          mustChangePassword: false,
        };
      }

      onSuccess(updatedUser);
    } catch (err: any) {
      setError(err.message || (isMm ? 'လုပ်ဆောင်မှု မအောင်မြင်ပါ' : 'Setup failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05070c]/95 px-4 py-6 backdrop-blur-md select-none">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-slate-900 p-6 shadow-2xl space-y-5 neon-glow-amber">
        
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {isDefaultOwner ? (
              <ShieldAlert className="h-7 w-7 animate-pulse" />
            ) : (
              <Lock className="h-7 w-7 animate-bounce" />
            )}
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-wide">
            {isDefaultOwner 
              ? (isMm ? 'အကောင့်စတင်အသုံးပြုရန် သတ်မှတ်ခြင်း' : 'Complete Your Account Setup')
              : (isMm ? 'စကားဝှက် အသစ်သတ်မှတ်ရန် လိုအပ်ပါသည်' : 'Password Reset Required')}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed px-2">
            {isDefaultOwner
              ? (isMm 
                  ? 'လုံခြုံရေးအရ သင်၏ ကိုယ်ပိုင် ဆိုင်ရှင်အကောင့်အချက်အလက်များကို မဖြစ်မနေ သတ်မှတ်ပေးရန် လိုအပ်ပါသည်။ သတ်မှတ်ပြီးပါက default "owner" အကောင့်မှာ ထာဝရပျက်ပြယ်သွားပါမည်။'
                  : 'For security reasons, you must configure your personal Owner credentials. Once submitted, default credentials will stop working permanently.')
              : (isMm 
                  ? 'လုံခြုံရေးအရ သင်၏ အကောင့်အတွက် စကားဝှက်အသစ်တစ်ခုကို မဖြစ်မနေ သတ်မှတ်ပေးရန် လိုအပ်ပါသည်။'
                  : 'For security reasons, you are required to change your password before continuing.')}
          </p>
        </div>

        {error && (
          <div className="flex gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-300">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-400" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isDefaultOwner && (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {isMm ? 'ဆိုင်ရှင် အမည် (Owner Name)' : 'Owner Full Name'}
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={isMm ? 'ဦးဇော်မင်း' : 'e.g. U Zaw Min'}
                    disabled={isLoading}
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-3 pl-10 pr-4 text-sm font-medium text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {isMm ? 'အသုံးပြုသူ အမည်အသစ် (New Username)' : 'New Username (Login ID)'}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    placeholder="e.g. zawmin"
                    disabled={isLoading}
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-3 pl-10 pr-4 text-sm font-medium text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors lowercase"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {isMm 
                ? (isDefaultOwner ? 'စကားဝှက်အသစ် (New Password)' : 'စကားဝှက်အသစ် (New Password)')
                : 'New Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={isMm ? 'စကားဝှက်အသစ် ရိုက်ထည့်ပါ' : 'Enter new password'}
                disabled={isLoading}
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-3 pl-4 pr-11 text-sm font-medium text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {isMm ? 'စကားဝှက်ကို အတည်ပြုပါ (Confirm Password)' : 'Confirm Password'}
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder={isMm ? 'စကားဝှက်အသစ်ကို ထပ်မံရိုက်ထည့်ပါ' : 'Confirm new password'}
              disabled={isLoading}
              required
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-3 px-4 text-sm font-medium text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-3.5 text-xs font-black text-slate-950 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-900/25"
          >
            {isLoading 
              ? (isMm ? 'သိမ်းဆည်းနေပါသည်...' : 'Saving setup...')
              : (isMm ? 'အကောင့်သစ် အတည်ပြုပြီး ရှေ့သို့သွားမည်' : 'Complete Setup & Continue')}
          </button>
        </form>

        <div className="border-t border-slate-800/60 pt-4">
          <button
            type="button"
            onClick={onLogout}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-950 hover:text-slate-200 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>{isMm ? 'ပြန်ထွက်မည် (Logout)' : 'Logout'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
