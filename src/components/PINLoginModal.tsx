import React, { useState } from 'react';
import { UserAccount } from '../types';
import { Lock, Delete, X, Check, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { verifyPin } from '../utils/cryptoAuth';
import { localServerClient } from '../services/localServerClient';
import { authSession } from '../services/authSession';
import { realtimeClient } from '../services/realtimeClient';
import { syncManager } from '../services/syncManager';

interface PINModalProps {
  users: UserAccount[];
  currentUser: UserAccount | null;
  onSelectUser: (user: UserAccount) => void;
  onClose: () => void;
  requiredRole?: 'owner' | 'manager';
  title?: string;
  onSuccess?: () => void;
}

export const PINModal: React.FC<PINModalProps> = ({
  users,
  onSelectUser,
  onClose,
  requiredRole,
  title,
  onSuccess,
}) => {
  const eligibleUsers = requiredRole
    ? users.filter(u => u.role === requiredRole || u.role === 'owner')
    : users;

  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(eligibleUsers[0] || null);
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
      setError('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!selectedUser) {
      setError('Invalid PIN or account selection');
      return;
    }

    if (!pin) {
      setError('Please enter your security PIN');
      return;
    }

    setIsAuthenticating(true);
    setError('');

    try {
      // Step 1: Attempt Server LAN Authentication
      try {
        const lanRes = await localServerClient.pinLogin({
          usernameOrId: selectedUser.username || selectedUser.id,
          pin,
        });

        if (lanRes && lanRes.success && lanRes.token) {
          // Connected & Authenticated with LAN Server
          realtimeClient.connect();
          syncManager.checkHealth();
          const mergedUser = {
            ...selectedUser,
            mustChangePassword: lanRes.user.mustChangePassword,
          };
          onSelectUser(mergedUser);
          if (onSuccess) onSuccess();
          onClose();
          return;
        }
      } catch (serverErr: any) {
        // If server explicitly returned 401 or 403 (e.g. wrong PIN or Revoked Device), fail securely
        if (serverErr.status === 401 || serverErr.status === 403) {
          setError(serverErr.message || 'Invalid authentication credential. Please try again.');
          setPin('');
          return;
        }
        // Network error / server unreachable: proceed to Step 2 (Offline Fallback)
      }

      // Step 2: Safe Offline Local Authentication Fallback
      const isLocalValid = verifyPin(pin, selectedUser.pinHash, selectedUser.pinSalt, selectedUser.pin);
      if (isLocalValid) {
        authSession.setOfflineSession(selectedUser);
        onSelectUser(selectedUser);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError('Invalid authentication credential. Please try again.');
        setPin('');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {title || 'Switch User / Enter PIN'}
              </h3>
              <p className="text-xs text-gray-500">
                {requiredRole ? `Manager authorization required` : 'Select profile and enter PIN'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Selection Chips */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-gray-600">Select User Account</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {eligibleUsers.map(user => {
              const isSelected = selectedUser?.id === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setSelectedUser(user);
                    setPin('');
                    setError('');
                  }}
                  className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-all ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600/20'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xs font-semibold truncate w-full">{user.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">{user.role}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PIN Display */}
        <div className="mb-4 flex flex-col items-center justify-center rounded-xl bg-gray-50 py-3">
          <div className="flex gap-3">
            {[0, 1, 2, 3].map(index => (
              <div
                key={index}
                className={`h-4 w-4 rounded-full border-2 transition-all ${
                  pin.length > index
                    ? 'border-emerald-600 bg-emerald-600 scale-110'
                    : 'border-gray-300 bg-transparent'
                }`}
              />
            ))}
          </div>
          {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="flex h-12 items-center justify-center rounded-xl bg-gray-100 text-lg font-bold text-gray-800 active:bg-gray-200 hover:bg-gray-200"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="flex h-12 items-center justify-center rounded-xl bg-gray-200 text-xs font-semibold text-gray-600 active:bg-gray-300"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="flex h-12 items-center justify-center rounded-xl bg-gray-100 text-lg font-bold text-gray-800 active:bg-gray-200 hover:bg-gray-200"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex h-12 items-center justify-center rounded-xl bg-gray-200 text-gray-700 active:bg-gray-300"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          disabled={isAuthenticating}
          onClick={handleSubmit}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {isAuthenticating ? 'Verifying...' : 'Authenticate & Continue'}
        </button>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Encrypted Salted SHA-256 Authentication</span>
        </div>
      </div>
    </div>
  );
};
