import React from 'react';
import { Invoice, ShopSettings } from '../types';
import { formatMMK } from '../domain/financial';
import { Printer, X, CheckCircle2 } from 'lucide-react';

interface ReceiptModalProps {
  invoice: Invoice;
  settings: ShopSettings | null;
  onClose: () => void;
  lang?: 'my' | 'en';
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  invoice,
  settings,
  onClose,
  lang = 'my',
}) => {
  const handlePrint = () => {
    window.print();
  };

  const isMyanmar = lang === 'my';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header toolbar */}
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-semibold">Payment Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="overflow-y-auto p-6 text-gray-900" id="printable-receipt">
          <div className="mx-auto max-w-xs border border-dashed border-gray-300 bg-white p-5 font-mono text-xs shadow-xs">
            {/* Header */}
            <div className="text-center">
              <h2 className="text-base font-bold tracking-tight text-gray-900">
                {settings?.shopNameMm || 'ရွှေသီရိ အကြောပြင်၊ စပါနှင့် ကာရာအိုကေ'}
              </h2>
              <p className="text-[11px] text-gray-600 font-sans">
                {settings?.shopName || 'Shwe Thiri Spa & KTV Lounge'}
              </p>
              <p className="mt-1 text-[10px] text-gray-500">{settings?.addressMm || settings?.address}</p>
              <p className="text-[10px] text-gray-500">Tel: {settings?.phone || '09-798881234'}</p>
              <div className="my-2 border-b border-dashed border-gray-300" />
            </div>

            {/* Receipt Meta */}
            <div className="space-y-0.5 text-[11px] text-gray-700">
              <div className="flex justify-between">
                <span>Voucher #:</span>
                <span className="font-bold text-gray-900">{invoice.invoiceCode}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{new Date(invoice.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{invoice.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-semibold">{invoice.customerName}</span>
              </div>
              <div className="my-2 border-b border-dashed border-gray-300" />
            </div>

            {/* Items Table */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase">
                <span>Item / Service</span>
                <span>Amount</span>
              </div>
              {invoice.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-[11px] leading-tight">
                  <div className="pr-2">
                    <span>{item.description}</span>
                    {item.quantity > 1 && (
                      <span className="block text-[10px] text-gray-500">
                        {item.quantity} x {formatMMK(item.unitPriceMMK)}
                      </span>
                    )}
                  </div>
                  <span className="font-medium">{formatMMK(item.totalPriceMMK)}</span>
                </div>
              ))}
            </div>

            <div className="my-2 border-b border-dashed border-gray-300" />

            {/* Totals */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>{formatMMK(invoice.subtotalMMK)}</span>
              </div>
              {invoice.discountAmountMMK > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount ({invoice.discountValue}{invoice.discountType === 'percentage' ? '%' : ' MMK'}):</span>
                  <span>-{formatMMK(invoice.discountAmountMMK)}</span>
                </div>
              )}
              {invoice.serviceChargeAmountMMK > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Service Charge:</span>
                  <span>{formatMMK(invoice.serviceChargeAmountMMK)}</span>
                </div>
              )}
              {invoice.taxAmountMMK > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Commercial Tax:</span>
                  <span>{formatMMK(invoice.taxAmountMMK)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-800 pt-1">
                <span>TOTAL:</span>
                <span>{formatMMK(invoice.totalMMK)}</span>
              </div>
            </div>

            <div className="my-2 border-b border-dashed border-gray-300" />

            {/* Payments & Change */}
            <div className="space-y-0.5 text-[11px] text-gray-700">
              {invoice.payments.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span className="uppercase">Paid via {p.method}:</span>
                  <span className="font-semibold">{formatMMK(p.amountMMK)}</span>
                </div>
              ))}
              {invoice.payments[0]?.tenderedMMK && invoice.payments[0].tenderedMMK > invoice.totalMMK && (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>Cash Tendered:</span>
                    <span>{formatMMK(invoice.payments[0].tenderedMMK)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span>Change Returned:</span>
                    <span>{formatMMK(invoice.payments[0].changeMMK || 0)}</span>
                  </div>
                </>
              )}
              {invoice.balanceDueMMK > 0 && (
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>Credit / Balance Due:</span>
                  <span>{formatMMK(invoice.balanceDueMMK)}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 border-t border-dashed border-gray-300 pt-3 text-center text-[10px] text-gray-500">
              <p className="font-sans">{settings?.receiptFooterNoteMm}</p>
              <p className="mt-1 font-sans text-[9px]">{settings?.receiptFooterNote}</p>
              <p className="mt-2 text-[9px] text-gray-400">--- Powered by Shwe Thiri ERP (Offline) ---</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
