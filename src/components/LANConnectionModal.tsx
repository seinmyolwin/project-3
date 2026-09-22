import React, { useState, useEffect } from 'react';
import { Wifi, Copy, Check, ShieldCheck, X } from 'lucide-react';
import QRCode from 'qrcode';
import { Language } from '../utils/translations';

interface LANConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const LANConnectionModal: React.FC<LANConnectionModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const isMm = lang === 'my';
  const [copied, setCopied] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = window.location.origin;
      setCurrentUrl(url);

      // Generate local offline QR data URL
      QRCode.toDataURL(url, {
        width: 220,
        margin: 1,
        color: {
          dark: '#06b6d4',
          light: '#0b0f19',
        },
      })
        .then(dataUrl => setQrDataUrl(dataUrl))
        .catch(err => console.error('Error generating offline QR code:', err));
    }
  }, []);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-xl rounded-3xl border border-cyan-500/40 bg-[#0b0f19] p-6 text-slate-100 shadow-2xl neon-glow-cyan space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 text-white shadow-lg neon-glow-cyan">
              <Wifi className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-wide">
                {isMm ? 'Offline Connection (QR Code)' : 'Offline Connection (QR Code)'}
              </h2>
              <p className="text-xs text-cyan-400 font-medium">
                {isMm ? 'ဖုန်း သို့မဟုတ် တက်ဘလက်ဖြင့် QR ကို Scan ဖတ်၍ ချိတ်ဆက်ပါ' : 'Scan QR code with phone camera to connect instantly'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111827] text-slate-400 hover:bg-slate-800 hover:text-white transition-all min-h-[44px] min-w-[44px]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* QR Code Center Display */}
        <div className="flex flex-col items-center justify-center bg-[#07090e] border border-cyan-500/30 rounded-2xl p-5 space-y-3">
          <div className="bg-[#0b0f19] p-3 rounded-2xl shadow-lg border-2 border-cyan-500">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="LAN Connection QR Code"
                className="h-44 w-44 object-contain rounded-xl"
              />
            ) : (
              <div className="h-44 w-44 flex items-center justify-center bg-slate-900 text-cyan-400 text-xs font-mono">
                Generating Local QR...
              </div>
            )}
          </div>
          <p className="text-xs text-cyan-300 font-bold text-center">
            {isMm ? '📲 အခြားဖုန်းကင်မရာဖြင့် ဤ QR ကို Scan ဖတ်ပါ' : '📲 Scan this QR with your phone camera or QR reader'}
          </p>
        </div>

        {/* Current Server URL Box */}
        <div className="rounded-2xl border border-cyan-500/30 bg-[#111827] p-3.5 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {isMm ? 'ပင်မ ဆာဗာ လိပ်စာ (Server Address)' : 'Primary Server Address'}
          </span>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[#07090e] p-2.5 border border-slate-800">
            <span className="font-mono text-xs font-black text-cyan-300 truncate select-all">
              {currentUrl}
            </span>
            <button
              onClick={handleCopyUrl}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-bold text-white shadow-lg hover:bg-cyan-500 active:scale-95 transition-all shrink-0 min-h-[38px]"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? (isMm ? 'ကူးယူပြီး!' : 'Copied!') : (isMm ? 'ကူးရန်' : 'Copy')}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            <span>{isMm ? 'ဆိုင်တွင်း Wi-Fi (100% လုံခြုံသည်)' : 'Same Local Wi-Fi Router (100% Secure)'}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-bold text-white hover:bg-slate-700 active:scale-95 transition-all min-h-[40px]"
          >
            {isMm ? 'ပိတ်မည်' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
