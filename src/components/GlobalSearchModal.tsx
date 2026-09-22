import React, { useState, useRef, useEffect } from 'react';
import { Customer, Invoice, StaffMember } from '../types';
import { Language } from '../utils/translations';
import { Search, X, User, Receipt, Users, ArrowRight, ExternalLink } from 'lucide-react';
import { formatMMK } from '../domain/financial';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  invoices: Invoice[];
  staff: StaffMember[];
  lang: Language;
  onSelectCustomer?: (customer: Customer) => void;
  onSelectInvoice?: (invoice: Invoice) => void;
  onSelectStaff?: (staffMember: StaffMember) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  customers,
  invoices,
  staff,
  lang,
  onSelectCustomer,
  onSelectInvoice,
  onSelectStaff,
}) => {
  const isMm = lang === 'my';
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmed = query.trim().toLowerCase();

  const matchedCustomers = trimmed
    ? customers.filter(
        c =>
          c.name.toLowerCase().includes(trimmed) ||
          c.phone.toLowerCase().includes(trimmed) ||
          c.id.toLowerCase().includes(trimmed)
      ).slice(0, 5)
    : [];

  const matchedInvoices = trimmed
    ? invoices.filter(
        i =>
          i.invoiceCode.toLowerCase().includes(trimmed) ||
          i.customerName?.toLowerCase().includes(trimmed) ||
          i.id.toLowerCase().includes(trimmed)
      ).slice(0, 5)
    : [];

  const matchedStaff = trimmed
    ? staff.filter(
        s =>
          s.name.toLowerCase().includes(trimmed) ||
          s.phone.toLowerCase().includes(trimmed) ||
          s.role.toLowerCase().includes(trimmed) ||
          s.id.toLowerCase().includes(trimmed)
      ).slice(0, 5)
    : [];

  const totalResults = matchedCustomers.length + matchedInvoices.length + matchedStaff.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-4 pt-20 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl rounded-3xl border border-cyan-500/40 bg-[#0b0f19] p-5 text-slate-100 shadow-2xl neon-glow-cyan space-y-4">
        
        {/* Search Header Input */}
        <div className="relative flex items-center">
          <Search className="absolute left-4 h-5 w-5 text-cyan-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isMm ? 'ဖောက်သည်အမည်၊ ဖုန်း၊ ဘောက်ချာနံပါတ် သို့မဟုတ် ဝန်ထမ်းအမည် ရှာရန်...' : 'Search customers, invoices, or staff by name, phone or ID...'}
            className="w-full rounded-2xl border border-cyan-500/40 bg-[#07090e] py-3.5 pl-12 pr-10 text-sm font-bold text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-400"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 rounded-lg p-1 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="absolute right-3 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-slate-700"
            >
              ESC
            </button>
          )}
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
          {!query ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Search className="mx-auto h-8 w-8 text-cyan-500/40 animate-pulse" />
              <p className="text-xs font-medium">
                {isMm ? 'ဖောက်သည်၊ ဘောက်ချာ သို့မဟုတ် ဝန်ထမ်းများကို အမြန်ရှာဖွေရန် အမည် သို့မဟုတ် ID ရိုက်ထည့်ပါ' : 'Type a name, phone number, or ID to instantly find records across the ERP.'}
              </p>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p className="text-xs">
                {isMm ? `"${query}" နှင့် ကိုက်ညီသော ရလဒ် မတွေ့ရှိပါ။` : `No matching records found for "${query}".`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Customers Match */}
              {matchedCustomers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    <User className="h-3.5 w-3.5" />
                    <span>{isMm ? 'ဖောက်သည်များ (Customers)' : 'Customers'}</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchedCustomers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          onSelectCustomer?.(c);
                          onClose();
                        }}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#111827] p-3 hover:border-cyan-500/50 hover:bg-[#1a2236] cursor-pointer transition-all group"
                      >
                        <div>
                          <div className="font-bold text-white text-xs group-hover:text-cyan-300">{c.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{c.phone} • Tier: {c.tier}</div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-cyan-400 font-semibold">
                          <span>{formatMMK(c.totalSpentMMK || 0)}</span>
                          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoices Match */}
              {matchedInvoices.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
                    <Receipt className="h-3.5 w-3.5" />
                    <span>{isMm ? 'ဘောက်ချာများ (Invoices)' : 'Invoices'}</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchedInvoices.map(inv => (
                      <div
                        key={inv.id}
                        onClick={() => {
                          onSelectInvoice?.(inv);
                          onClose();
                        }}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#111827] p-3 hover:border-purple-500/50 hover:bg-[#1a2236] cursor-pointer transition-all group"
                      >
                        <div>
                          <div className="font-bold text-white text-xs font-mono group-hover:text-purple-300">{inv.invoiceCode}</div>
                          <div className="text-[11px] text-slate-400">{inv.customerName || 'General Customer'} • {inv.createdAt.split('T')[0]}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-400 text-xs font-mono">{formatMMK(inv.netTotalMMK)}</span>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-500 group-hover:text-purple-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Staff Match */}
              {matchedStaff.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    <Users className="h-3.5 w-3.5" />
                    <span>{isMm ? 'ဝန်ထမ်းများ (Staff)' : 'Staff Members'}</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchedStaff.map(s => (
                      <div
                        key={s.id}
                        onClick={() => {
                          onSelectStaff?.(s);
                          onClose();
                        }}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#111827] p-3 hover:border-emerald-500/50 hover:bg-[#1a2236] cursor-pointer transition-all group"
                      >
                        <div>
                          <div className="font-bold text-white text-xs group-hover:text-emerald-300">{s.name}</div>
                          <div className="text-[11px] text-slate-400">{s.role} • {s.phone}</div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.status === 'available' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                          {s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-[11px] text-slate-400">
          <span>{isMm ? 'ရှာဖွေရန် ဖောက်သည်၊ ဘောက်ချာ သို့မဟုတ် ဝန်ထမ်းအမည်ကို ရိုက်ထည့်ပါ' : 'Instant global search across all local database records'}</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
          >
            {isMm ? 'ပိတ်မည်' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
