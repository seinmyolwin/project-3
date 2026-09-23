import React, { useState, useEffect } from 'react';
import { Customer, UserAccount } from '../../types';
import { db } from '../../db/database';
import { Language } from '../../utils/translations';
import { X, User, Phone, CreditCard, ShieldCheck } from 'lucide-react';

interface CustomerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  currentUser: UserAccount;
  lang: Language;
  onSuccess: (updated: Customer) => void;
}

export const CustomerEditModal: React.FC<CustomerEditModalProps> = ({
  isOpen,
  onClose,
  customer,
  currentUser,
  lang,
  onSuccess,
}) => {
  const isMm = lang === 'my';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [creditLimitMMK, setCreditLimitMMK] = useState(1000000);
  const [creditAllowed, setCreditAllowed] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && customer) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setCreditLimitMMK(customer.creditLimitMMK || 0);
      setCreditAllowed(customer.creditAllowed ?? true);
    }
  }, [isOpen, customer]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const updated: Customer = {
        ...customer,
        name: name.trim(),
        phone: phone.trim() || '09-xxxxxxxxx',
        creditLimitMMK: Number(creditLimitMMK) || 0,
        creditAllowed,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
      };

      await db.customers.put(updated);

      await db.auditLogs.add({
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role || 'staff',
        action: 'CUSTOMER_UPDATE' as any,
        entity: 'Customer',
        entityId: customer.id,
        details: `Updated customer profile ${customer.name}`,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      alert('Error updating customer: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-gray-100 bg-linear-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {isMm ? 'ဖောက်သည် အချက်အလက် ပြင်ဆင်ရန်' : 'Edit Customer Profile'}
              </h3>
              <p className="text-xs text-white/80 font-mono">ID: {customer.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              {isMm ? 'ဖောက်သည် အမည်' : 'Customer Name'} *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium text-gray-900 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              {isMm ? 'ဖုန်းနံပါတ်' : 'Phone Number'}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              {isMm ? 'ခွင့်ပြု အကြွေးပမာဏ (MMK)' : 'Credit Limit (MMK)'}
            </label>
            <input
              type="number"
              min={0}
              step={10000}
              value={creditLimitMMK}
              onChange={e => setCreditLimitMMK(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-mono font-bold text-gray-900 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="editCreditAllowed"
              checked={creditAllowed}
              onChange={e => setCreditAllowed(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="editCreditAllowed" className="text-xs font-bold text-gray-700 select-none">
              {isMm ? 'အကြွေးဝယ်ယူခွင့် ခွင့်ပြုထားသည် (Credit Allowed)' : 'Allow Credit Purchases'}
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-300 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting
                ? isMm ? 'သိမ်းဆည်းနေပါသည်...' : 'Saving...'
                : isMm ? 'သိမ်းဆည်းမည်' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
