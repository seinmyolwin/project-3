import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, LogOut } from 'lucide-react';
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

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPassword = newPassword.trim();
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
      // 1. Update on the LAN Server
      try {
        await localServerClient.changeUserPassword(currentUser.id, cleanPassword);
      } catch (serverErr: any) {
        console.warn('Server password change error during mandatory reset:', serverErr);
        // If we are online and it failed (e.g. 403, 400), we should throw/display it
        if (serverErr.status !== 0) {
          throw serverErr;
        }
      }

      // 2. Update locally in IndexedDB Dexie
      const { passwordHash, salt } = hashPassword(cleanPassword);
      await db.users.update(currentUser.id, {
        pinHash: passwordHash,
        pinSalt: salt,
        mustChangePassword: false,
      });

      // 3. Clear forced state and update current user
      const updatedUser: UserAccount = {
        ...currentUser,
        mustChangePassword: false,
      };

      onSuccess(updatedUser);
    } catch (err: any) {
      setError(err.message || (isMm ? 'စကားဝှက် ပြောင်းလဲခြင်း မအောင်မြင်ပါ' : 'Failed to change password. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05070c]/90 px-4 py-6 backdrop-blur-md select-none">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl space-y-6 neon-glow-rose">
        
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Lock className="h-7 w-7 animate-bounce" />
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-wide">
            {isMm ? 'စကားဝှက် အသစ်သတ်မှတ်ရန် လိုအပ်ပါသည်' : 'Password Reset Required'}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed px-4">
            {isMm 
              ? 'လုံခြုံရေးအရ သင်၏ အကောင့်အတွက် စကားဝှက်အသစ်တစ်ခုကို မဖြစ်မနေ သတ်မှတ်ပေးရန် လိုအပ်ပါသည်။'
              : 'For security reasons, you are required to change your password before continuing.'}
          </p>
        </div>

        {error && (
          <div className="flex gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-300">
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {isMm ? 'စကားဝှက်အသစ် (New Password)' : 'New Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={isMm ? 'စကားဝှက်အသစ် ရိုက်ထည့်ပါ' : 'Enter new password'}
                disabled={isLoading}
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-3 pl-4 pr-11 text-sm font-medium text-white placeholder-slate-600 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-colors"
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
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-3 px-4 text-sm font-medium text-white placeholder-slate-600 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center rounded-xl bg-rose-600 py-3 text-xs font-bold text-white hover:bg-rose-500 disabled:bg-rose-800/50 disabled:text-rose-300 transition-colors shadow-lg shadow-rose-900/25"
          >
            {isLoading 
              ? (isMm ? 'သိမ်းဆည်းနေပါသည်...' : 'Updating password...')
              : (isMm ? 'စကားဝှက်အသစ် သိမ်းဆည်းမည်' : 'Update & Continue')}
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
