/**
 * Bilingual Translations Dictionary (Myanmar / English)
 * Written for Myanmar shop operators, cashiers, and managers.
 */

export type Language = 'my' | 'en';

export const translations = {
  // Navigation
  rooms: { en: 'Rooms & Sessions', my: 'အခန်းနှင့် ဆက်ရှင်များ' },
  pos: { en: 'Direct POS Sales', my: 'အမြန် အရောင်းကောင်တာ' },
  staff: { en: 'Staff & Commission', my: 'ဝန်ထမ်းနှင့် ကော်မရှင်' },
  customers: { en: 'Customers & Credit', my: 'ဖောက်သည်နှင့် ကြွေးကျန်' },
  expenses: { en: 'Expenses', my: 'ကုန်ကျစရိတ်များ' },
  cashClosing: { en: 'Daily Cash Closing', my: 'နေ့စဉ် စာရင်းပိတ်' },
  reports: { en: 'Reports & P&L', my: 'အစီရင်ခံစာနှင့် အမြတ်/အရှုံး' },
  settings: { en: 'System & Backup', my: 'စနစ်နှင့် မိတ္တူ' },

  // General Status
  available: { en: 'Available', my: 'အားနေသည်' },
  occupied: { en: 'In Service', my: 'အသုံးပြုနေသည်' },
  cleaning: { en: 'Cleaning', my: 'သန့်ရှင်းရေး' },
  reserved: { en: 'Reserved', my: 'ကြိုတင်ထားသည်' },
  active: { en: 'Active', my: 'လုပ်ဆောင်ဆဲ' },
  completed: { en: 'Completed', my: 'ပြီးစီးပြီး' },
  cancelled: { en: 'Cancelled', my: 'ပယ်ဖျက်ပြီး' },
  voided: { en: 'Voided', my: 'ဖျက်သိမ်းပြီး' },

  // Staff Roles & Status
  therapist: { en: 'Therapist', my: 'အကြောပြင် ပညာရှင်' },
  masseuse: { en: 'Masseuse', my: 'အနှိပ် ပညာရှင်' },
  ktv_host: { en: 'KTV Host', my: 'ကာရာအိုကေ ဝန်ဆောင်မှု' },
  receptionist: { en: 'Receptionist', my: 'ဧည့်ကြို' },
  cleaner: { en: 'Cleaner', my: 'သန့်ရှင်းရေး' },
  bartender: { en: 'Bartender', my: 'ဘားသမား' },
  in_service: { en: 'In Service', my: 'တာဝန်ထမ်းဆောင်ဆဲ' },
  off_duty: { en: 'Off Duty', my: 'အလုပ်ဆင်းသည်' },

  // Payment methods
  cash: { en: 'Cash', my: 'ငွေသား' },
  kpay: { en: 'KBZPay (KPay)', my: 'ကေပီအက်စ် (KPay)' },
  wave: { en: 'WavePay', my: 'ဝေ့ဖ်မန်းနီး (WavePay)' },
  cbpay: { en: 'CB Pay', my: 'စီဘီပီအက်စ် (CB Pay)' },
  ayapay: { en: 'AYA Pay', my: 'ဧရာပီအက်စ် (AYA Pay)' },
  credit: { en: 'Credit (Debt)', my: 'အကြွေးစာရင်း' },

  // UI Common
  startSession: { en: 'Start New Session', my: 'ဆက်ရှင် အသစ်စတင်ရန်' },
  checkout: { en: 'Checkout & Bill', my: 'ငွေရှင်းရန်' },
  addOrder: { en: 'Add Drink / Food', my: 'အစားအသောက်/အချိုရည် ထည့်ရန်' },
  cancelSession: { en: 'Cancel / Void', my: 'ဖျက်သိမ်းမည်' },
  markClean: { en: 'Mark Ready', my: 'အဆင်သင့်ဖြစ်ပြီ' },
  viewReceipt: { en: 'View Receipt', my: 'ဘောက်ချာကြည့်ရန်' },
  save: { en: 'Save', my: 'သိမ်းဆည်းမည်' },
  cancel: { en: 'Cancel', my: 'မလုပ်တော့ပါ' },
  confirm: { en: 'Confirm', my: 'အတည်ပြုမည်' },
  total: { en: 'Total', my: 'စုစုပေါင်း' },
  subtotal: { en: 'Subtotal', my: 'စုစုပေါင်းငွေ' },
  discount: { en: 'Discount', my: 'လျှော့ဈေး' },
  tax: { en: 'Commercial Tax', my: 'ကုန်သွယ်လုပ်ငန်းခွန်' },
  serviceCharge: { en: 'Service Charge', my: 'ဝန်ဆောင်ခ' },
  paidAmount: { en: 'Paid Amount', my: 'ပေးချေငွေ' },
  balanceDue: { en: 'Balance Due', my: 'ကျန်ငွေ' },
  change: { en: 'Change', my: 'ပြန်အမ်းငွေ' },
  tendered: { en: 'Tendered Cash', my: 'လက်ခံရရှိငွေ' },
  print: { en: 'Print Receipt', my: 'ဘောက်ချာ ပရင့်ထုတ်မည်' },
  offlineGuaranteed: { en: '100% Offline (Local Storage)', my: '၁၀၀% အင်တာနက်မလို (ဒေသတွင်း သိမ်းဆည်းသည်)' },
};

export function getTranslation(key: keyof typeof translations, lang: Language): string {
  const item = translations[key];
  if (!item) return String(key);
  return item[lang] || item.en;
}
