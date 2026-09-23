import React from 'react';
import { Customer, CustomerServiceHistoryItem } from '../../types';
import { formatMMK } from '../../domain/financial';
import { Language } from '../../utils/translations';
import {
  Scissors,
  Calendar,
  Clock,
  User,
  RotateCw,
  FileText,
  CreditCard,
  Building,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface CustomerServiceHistoryTabProps {
  customer: Customer;
  history: CustomerServiceHistoryItem[];
  lang: Language;
  onOpenRebook: (item: CustomerServiceHistoryItem) => void;
  onOpenAddNote: (context: {
    sessionId?: string;
    bookingId?: string;
    serviceId?: string;
    serviceName?: string;
    staffId?: string;
    staffName?: string;
  }) => void;
}

export const CustomerServiceHistoryTab: React.FC<CustomerServiceHistoryTabProps> = ({
  customer,
  history,
  lang,
  onOpenRebook,
  onOpenAddNote,
}) => {
  const isMm = lang === 'my';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'active':
      case 'in_service':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Scissors className="h-4 w-4 text-emerald-600" />
            <span>{isMm ? 'ဝန်ဆောင်မှု ရယူခဲ့မှု မှတ်တမ်း' : 'Service History & Rebooking'}</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              {history.length}
            </span>
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {isMm
              ? 'ယခင် ပြီးစီးခဲ့သော ဝန်ဆောင်မှုများမှ ပြန်လည်ရက်ချိန်း (Rebooking) ပြုလုပ်နိုင်ပါသည်'
              : 'Direct audit of completed spa & beauty sessions with 1-click rebooking.'}
          </p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center bg-gray-50/50">
          <Scissors className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-xs font-bold text-gray-500">
            {isMm ? 'ဝန်ဆောင်မှု ရယူခဲ့သည့် မှတ်တမ်း မရှိသေးပါ' : 'No service records found for this customer yet.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="border-b border-gray-100 bg-gray-50 font-bold uppercase tracking-wider text-[10px] text-gray-500">
              <tr>
                <th className="px-4 py-3">{isMm ? 'ရက်စွဲ' : 'Date'}</th>
                <th className="px-4 py-3">{isMm ? 'ဝန်ဆောင်မှု' : 'Service'}</th>
                <th className="px-4 py-3">{isMm ? 'ဝန်ထမ်း' : 'Staff'}</th>
                <th className="px-4 py-3">{isMm ? 'အခန်း' : 'Room'}</th>
                <th className="px-3 py-3 text-center">{isMm ? 'ကြာချိန်' : 'Duration'}</th>
                <th className="px-4 py-3 text-right">{isMm ? 'ကျသင့်ငွေ' : 'Amount'}</th>
                <th className="px-3 py-3">{isMm ? 'ငွေချေမှု' : 'Payment'}</th>
                <th className="px-3 py-3">{isMm ? 'အခြေအနေ' : 'Status'}</th>
                <th className="px-4 py-3 text-right">{isMm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {history.map(item => (
                <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3.5 whitespace-nowrap font-mono text-gray-900">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      <span>{item.date}</span>
                    </div>
                    {item.code && (
                      <span className="text-[10px] text-gray-400 block font-mono">#{item.code}</span>
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="font-bold text-gray-900 block">{item.serviceName}</span>
                    {item.notes && (
                      <span className="text-[11px] text-gray-500 truncate max-w-xs block">
                        {item.notes}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-gray-700">
                      <User className="h-3.5 w-3.5 text-gray-400" />
                      <span>{item.staffName || 'Unassigned'}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                    <div className="flex items-center gap-1">
                      <Building className="h-3.5 w-3.5 text-gray-400" />
                      <span>{item.roomName || 'Main'}</span>
                    </div>
                  </td>

                  <td className="px-3 py-3.5 text-center whitespace-nowrap font-mono text-gray-700">
                    <div className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px]">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span>{item.durationMinutes}m</span>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-right whitespace-nowrap font-mono font-bold text-gray-900">
                    {formatMMK(item.amountMMK)}
                  </td>

                  <td className="px-3 py-3.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 capitalize border border-emerald-100">
                      <CreditCard className="h-3 w-3 text-emerald-600" />
                      <span>{item.paymentMethod || 'cash'}</span>
                    </span>
                  </td>

                  <td className="px-3 py-3.5 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Rebook Button */}
                      <button
                        type="button"
                        onClick={() => onOpenRebook(item)}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                        title="Rebook this service"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        <span>{isMm ? 'ပြန်ချိန်းမည်' : 'REBOOK'}</span>
                      </button>

                      {/* Add Note Button */}
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAddNote({
                            sessionId: item.sourceType === 'session' ? item.sourceId : undefined,
                            serviceId: item.serviceId,
                            serviceName: item.serviceName,
                            staffId: item.staffId,
                            staffName: item.staffName,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                        title="Add Note for this service"
                      >
                        <FileText className="h-3.5 w-3.5 text-purple-600" />
                        <span>{isMm ? 'မှတ်စု' : '+ Note'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
