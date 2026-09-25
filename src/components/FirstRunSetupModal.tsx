import React, { useState } from 'react';
import { ShieldCheck, Lock, User, KeyRound, AlertTriangle, ArrowRight } from 'lucide-react';
import { Language } from '../utils/translations';
import { hashPassword } from '../utils/cryptoAuth';
import { db } from '../db/database';
import { localServerClient } from '../services/localServerClient';
import { authSession } from '../services/authSession';
import { UserAccount } from '../types';

interface FirstRunSetupModalProps {
  lang: Language;
  onOwnerCreated: (ownerAccount: UserAccount) => void;
}

export const FirstRunSetupModal: React.FC<FirstRunSetupModalProps> = ({
  lang,
  onOwnerCreated,
}) => {
  const isMm = lang === 'my';

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    const cleanUsername = username.toLowerCase().trim();
    const cleanPassword = password.trim();

    if (!cleanName) {
      setError(isMm ? 'ကျေးဇူးပြု၍ ဆိုင်ရှင်အမည် ထည့်သွင်းပါ' : 'Please enter the owner name');
      return;
    }

    if (!cleanUsername || cleanUsername.length < 3) {
      setError(isMm ? 'အသုံးပြုသူအမည် အနည်းဆုံး ၃ လုံး ရှိရပါမည်' : 'Username must be at least 3 characters');
      return;
    }

    if (!cleanPassword || cleanPassword.length < 4 || cleanPassword.length > 6) {
      setError(isMm ? 'စကားဝှက်သည် ၄ လုံးမှ ၆ လုံးအထိ ဖြစ်ရပါမည် (Password must be 4-6 characters)' : 'Password must be between 4 and 6 characters');
      return;
    }

    if (cleanPassword !== confirmPassword.trim()) {
      setError(isMm ? 'စကားဝှက် ၂ ကြိမ် ရိုက်ထည့်မှု မတူညီပါ' : 'Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      let createdUserId = 'usr_owner_root';
      // 1. Try server-side owner setup if LAN server is reachable
      try {
        const setupRes = await localServerClient.setupOwner({
          name: cleanName,
          username: cleanUsername,
          password: cleanPassword,
        });
        if (setupRes && setupRes.user && setupRes.user.id) {
          createdUserId = setupRes.user.id;
        }
        if (setupRes && setupRes.token) {
          authSession.setLanSession({
            token: setupRes.token,
            user: {
              ...setupRes.user,
              mustChangePassword: false,
            },
            deviceId: authSession.getOrCreateDeviceId(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      } catch (serverErr) {
        console.warn('LAN server owner setup notice (falling back to offline Dexie setup if unreachable):', serverErr);
      }

      // 2. Persist locally to Dexie with Salted SHA-256
      const { passwordHash, salt } = hashPassword(cleanPassword);
      const newOwner: UserAccount = {
        id: createdUserId,
        name: cleanName,
        username: cleanUsername,
        role: 'owner',
        pinHash: passwordHash,
        pinSalt: salt,
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date().toISOString(),
      };

      await db.users.put(newOwner);
      onOwnerCreated(newOwner);
    } catch (err: any) {
      setError(err.message || (isMm ? 'အကောင့်ဖန်တီးမှု မအောင်မြင်ပါ' : 'Failed to create owner account'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-slate-700/60 bg-[#0f172a] p-8 shadow-2xl text-slate-100">
        <div className="text-center space-y-2 mb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            {isMm ? 'ပထမဆုံး ဆိုင်ရှင်အကောင့် သတ်မှတ်ခြင်း' : 'Initial Owner Setup'}
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {isMm
              ? 'စနစ်ကို လုံခြုံစွာ အသုံးပြုရန် ဆိုင်ရှင် (Master Owner) အကောင့်ကို ဦးစွာ ဖန်တီးပေးပါ'
              : 'Create the primary Administrator/Owner account to secure your 100% offline ERP'}
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {isMm ? 'ဆိုင်ရှင် အမည် (Owner Name)' : 'Owner Full Name'}
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={isMm ? 'ဥပမာ - ဦးဇော်မင်း' : 'e.g. U Zaw Min'}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {isMm ? 'အသုံးပြုသူ အမည် (Username)' : 'Username (Login ID)'}
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="owner"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 lowercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {isMm ? 'စကားဝှက် (Password)' : 'Password'}
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {isMm ? 'စကားဝှက် အတည်ပြုပါ (Confirm Password)' : 'Confirm Password'}
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-xs font-black text-slate-950 shadow-lg hover:from-emerald-400 hover:to-teal-400 focus:outline-none disabled:opacity-50 cursor-pointer transition-all"
          >
            <span>{isSubmitting ? (isMm ? 'ဖန်တီးနေသည်...' : 'Creating...') : (isMm ? 'ဆိုင်ရှင်အကောင့် ဖန်တီးမည်' : 'Create Owner Account')}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
