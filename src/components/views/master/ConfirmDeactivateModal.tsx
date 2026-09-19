import React from 'react';
import { AlertTriangle, X, Check, ShieldAlert } from 'lucide-react';
import { Language } from '../../../utils/translations';

interface ConfirmDeactivateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  itemName: string;
  currentStatus: boolean; // true = active (will be deactivated), false = inactive (will be reactivated)
  lang: Language;
}

export const ConfirmDeactivateModal: React.FC<ConfirmDeactivateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  currentStatus,
  lang,
}) => {
  if (!isOpen) return null;
  const isMm = lang === 'my';

  const isDeactivating = currentStatus;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                isDeactivating
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              {isDeactivating ? (
                <AlertTriangle className="h-6 w-6" />
              ) : (
                <ShieldAlert className="h-6 w-6" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{title}</h3>
              <p className="text-xs text-gray-500">{itemName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 text-xs leading-relaxed text-slate-600">
          {isDeactivating ? (
            <div>
              <p className="font-semibold text-slate-800 mb-1">
                {isMm
                  ? 'အမြဲတမ်း ဖျက်ဆီးခြင်းမပြုဘဲ "အသုံးမပြုတော့ပါ (Inactive)" အဖြစ်သာ ပြောင်းလဲပါမည်။'
                  : 'Soft Inactivation Protection:'}
              </p>
              <p>
                {isMm
                  ? 'ယခင် သတ်မှတ်ထားသော စာရင်းများ၊ ဘောင်ချာဟောင်းများနှင့် စာရင်းကိုင်မှတ်တမ်းများ မပျက်စီးစေရန်အတွက် အပြီးဖျက်မည့်အစား ပိတ်ထားပေးပါမည်။ လိုအပ်ပါက အချိန်မရွေး ပြန်လည်ဖွင့်နိုင်ပါသည်။'
                  : 'This record will be marked as Inactive instead of hard-deleted to safeguard historical invoices, commissions, and ledger audit logs. You can reactivate it at any time.'}
              </p>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-slate-800 mb-1">
                {isMm
                  ? 'ဤအချက်အလက်ကို ပြန်လည်အသုံးပြုခွင့် (Active) ပြုလုပ်မည်ဖြစ်ပါသည်။'
                  : 'Reactivate Master Record:'}
              </p>
              <p>
                {isMm
                  ? 'ယခုမှတ်တမ်းကို စနစ်အတွင်း ပုံမှန်ရွေးချယ် အသုံးပြုနိုင်တော့မည် ဖြစ်ပါသည်။'
                  : 'This record will become available across POS, session dispatch, and operational dropdowns.'}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors ${
              isDeactivating
                ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
            }`}
          >
            <Check className="h-4 w-4" />
            <span>
              {isDeactivating
                ? isMm
                  ? 'ပိတ်ရန် အတည်ပြုသည်'
                  : 'Confirm Deactivation'
                : isMm
                ? 'ပြန်လည်ဖွင့်ရန် အတည်ပြုသည်'
                : 'Confirm Reactivation'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
