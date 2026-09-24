import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  BookOpen,
  HelpCircle,
  Database,
  Printer,
  Shield,
  Layers,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Settings,
  Download,
  Lock,
  Plus,
  RefreshCw,
  TrendingUp,
  Tag,
  Package,
  ShoppingBag,
  DollarSign,
  Coffee,
  Users
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'my';
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose, lang }) => {
  const isMm = lang === 'my';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState(0);

  // Exact 21 clear steps tailored perfectly to Shwe Thiri Spa & KTV ERP with authentic domain data
  const sections = useMemo(() => [
    {
      id: 'dashboard',
      title: isMm ? '၁။ ပင်မ Dashboard နှင့် အခန်းအခြေအနေစောင့်ကြည့်ခြင်း' : '1. Main Dashboard & Room Statuses',
      icon: Layers,
      content: isMm
        ? 'စနစ်တစ်ခုလုံး၏ အခန်းများလည်ပတ်မှုအဆင့်ဆင့်၊ အရောင်းစာရင်းနှင့် သတိပေးချက်များကို တစ်နေရာတည်းတွင် အချိန်နှင့်တပြေးညီ ကြည့်ရှုနိုင်သည့် နေရာဖြစ်ပါသည်။'
        : 'Monitor active sessions, overall shop metrics, inventory levels, and real-time room statuses in one unified workspace.',
      steps: isMm
        ? [
            'အခန်းတစ်ခုချင်းစီ၏ လက်ရှိအခြေအနေကို အရောင်များဖြင့် ခွဲခြားပြသထားပါသည် - အစိမ်းရောင် (အားနေသည်)၊ အနီရောင် (ဧည့်သည်ရှိသည်/နာရီလည်နေသည်)၊ အဝါရောင် (သန့်ရှင်းရေးလုပ်နေသည်)။',
            'ထိပ်ဆုံးတွင် ယနေ့အရောင်းစုစုပေါင်း၊ လက်ရှိဖွင့်ထားသောအခန်းများနှင့် ပစ္စည်းပြတ်လုနီးပါး သတိပေးချက်များကို တန်းမြင်နိုင်ပါသည်။',
            'အရောင်းဝန်ထမ်းများသည် ဤစာမျက်နှာကိုကြည့်ရုံဖြင့် မည်သည့်အခန်းကို ဧည့်သည်သွင်းရမည်ကို ချက်ချင်း သိရှိနိုင်ပါသည်။'
          ]
        : [
            'View room statuses classified by vibrant colors: Green (Available), Red (Occupied / Live Timer active), Yellow (Cleaning).',
            'Track top metrics like Total Daily Sales, Active Rooms, and Low Stock Alerts directly from the dashboard header cards.',
            'Cashiers and waiters use this dashboard to instantly check available slots for incoming guests.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-4">
          {/* Header metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[9px] text-slate-400 font-bold uppercase">ယနေ့စုစုပေါင်းအရောင်း</div>
              <div className="text-sm font-black text-emerald-400 mt-0.5">၈၅၀,၀၀၀ ကျပ်</div>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[9px] text-slate-400 font-bold uppercase">ဖွင့်ထားသော အခန်းများ</div>
              <div className="text-sm font-black text-rose-400 mt-0.5">၄ ခန်း / ၁၀ ခန်း</div>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[9px] text-slate-400 font-bold uppercase">ပစ္စည်းပြတ်လုနီးပါး</div>
              <div className="text-sm font-black text-amber-400 mt-0.5">၂ မျိုး သတိပေး</div>
            </div>
          </div>

          {/* Room status simulation */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="bg-emerald-950/40 border border-emerald-500/40 p-2.5 rounded-lg flex flex-col justify-between h-16">
              <span className="font-extrabold text-white text-[11px]">Room 101 (VIP)</span>
              <span className="bg-emerald-900/50 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold self-start">Available - အားနေသည်</span>
            </div>
            <div className="bg-rose-950/40 border border-rose-500/40 p-2.5 rounded-lg flex flex-col justify-between h-16">
              <span className="font-extrabold text-white text-[11px]">KTV Room 202</span>
              <div className="flex justify-between items-center w-full">
                <span className="bg-rose-900/50 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold">Occupied - ဧည့်သည်ရှိ</span>
                <span className="text-rose-400 font-bold font-mono text-[10px]">⏱️ 01:24:50</span>
              </div>
            </div>
            <div className="bg-amber-950/40 border border-amber-500/40 p-2.5 rounded-lg flex flex-col justify-between h-16">
              <span className="font-extrabold text-white text-[11px]">Spa Bed 3 (Junior)</span>
              <span className="bg-amber-900/50 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold self-start">Cleaning - သန့်ရှင်းရေးလုပ်</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'setup_wizard',
      title: isMm ? '၂။ Setup Wizard ဖြင့် ဆိုင်အချက်အလက် စတင်ပြင်ဆင်ခြင်း' : '2. Setup Wizard & Initial Configurations',
      icon: Settings,
      content: isMm
        ? 'စနစ်ကို ပထမဆုံးအကြိမ် စတင်ဖွင့်လှစ်သောအခါ ဆိုင်အချက်အလက်များနှင့် လုံခြုံရေး PIN ကို လွယ်ကူစွာ စနစ်သွင်းရန် လမ်းညွှန်ဖြစ်ပါသည်။'
        : 'Onboards your shop configuration seamlessly on first application launch, establishing crucial meta information and secure Owner PIN.',
      steps: isMm
        ? [
            '၁။ ဆိုင်အမည် (မြန်မာ/အင်္ဂလိပ်) ကို ရေးသားဖြည့်သွင်းပါ။ ဤအမည်သည် ဘေလ်ဘောက်ချာပြေစာပေါ်တွင် ပေါ်မည်ဖြစ်ပါသည်။',
            '၂။ ဆိုင်၏ ဆက်သွယ်ရန် ဖုန်းနံပါတ်နှင့် လိပ်စာကို ရိုက်ထည့်ပါ။',
            '၃။ စနစ်တစ်ခုလုံး၏ အမြင့်ဆုံးလုပ်ပိုင်ခွင့်ရှိသူ ဆိုင်ရှင် (Owner) အတွက် လျှို့ဝှက် ဂဏန်း PIN (၆ လုံး) ကို သတ်မှတ်ပြီး Finish ကိုနှိပ်ပါ။'
          ]
        : [
            '1. Fill in your Shop Name in both Myanmar and English. This will be printed on receipt headers.',
            '2. Input contact phone numbers and office/shop physical address.',
            '3. Set up a unique 6-digit passcode PIN for the Owner account and click Finish to complete setup.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2.5">
            <h3 className="text-center text-[11px] font-extrabold text-amber-400 border-b border-slate-800 pb-1.5 uppercase">⚙️ Shwe Thiri Spa & KTV - Setup Wizard</h3>
            
            <div className="space-y-2 text-[10px]">
              <div>
                <label className="text-slate-400 font-bold block mb-0.5">ဆိုင်အမည် (မြန်မာ):</label>
                <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white font-bold">ရွှေသီရိ စပါ နှင့် KTV</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 font-bold block mb-0.5">ဖုန်းနံပါတ်:</label>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">09450001122</div>
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-0.5">လိပ်စာ:</label>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">မန္တလေးမြို့</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 font-bold block mb-0.5">အခွန်နှုန်း (Government Tax %):</label>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">၅ %</div>
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-0.5">ဝန်ဆောင်ခ (Service Charge %):</label>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">၁၀ %</div>
                </div>
              </div>
              <div>
                <label className="text-amber-400 font-bold block mb-0.5">ဆိုင်ရှင် လျှို့ဝှက် PIN (Owner Master PIN - 6 Digits):</label>
                <div className="bg-slate-900 px-2 py-1.5 border border-amber-500/30 rounded text-amber-400 tracking-widest font-black text-center text-xs">၉ ၉ ၉ ၉ ၉ ၉</div>
              </div>
            </div>

            <button className="w-full bg-emerald-600 text-slate-950 font-black text-center py-2 rounded text-[10px] cursor-not-allowed uppercase">
              ✓ စနစ်စတင်အသုံးပြုမည် (Finish Setup)
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'owner_privileges',
      title: isMm ? '၃။ Owner အကောင့်နှင့် အသုံးပြုသူအဆင့်ဆင့် လုပ်ပိုင်ခွင့်များ' : '3. User Roles, PINs & Access Privileges',
      icon: Shield,
      content: isMm
        ? 'စနစ်တစ်ခုလုံး၏ လုံခြုံရေးနှင့် ဆိုင်တွင်းဝန်ထမ်းများ၏ အကောင့်ဝင်ရောက်ခွင့် အခန်းကဏ္ဍများကို စီမံခန့်ခွဲသည့်စနစ် ဖြစ်ပါသည်။'
        : 'Understand system permission levels and user role categories (Owner, Manager, Cashier, Waiter) across the app.',
      steps: isMm
        ? [
            '• Owner (ဆိုင်ရှင်): လုပ်ငန်းပြင်ဆင်မှုများ၊ ဘဏ္ဍာရေးအစီရင်ခံစာများ၊ ဒေတာ မိတ္တူကူးခြင်း/ပြန်လည်ရယူခြင်း အပြည့်အစုံ ဆောင်ရွက်ခွင့်ရှိသည်။',
            '• Manager (မန်နေဂျာ) & Cashier (ငွေကိုင်): အခန်းဖွင့်ခြင်း၊ အော်ဒါမှာခြင်း၊ ငွေသိမ်းဘေလ်ရှင်းခြင်း၊ နေ့စဉ်စာရင်းပိတ်သိမ်းခြင်းတို့ ပြုလုပ်နိုင်သည်။',
            '• Waiter / Receptionist (ဧည့်ကြို): အခန်းစတင်ဖွင့်ခြင်းနှင့် ဘီယာ/အအေး စားသောက်ဖွယ်ရာ အော်ဒါများကိုသာ သွင်းနိုင်သည်။ ငွေသိမ်းခွင့်၊ ဘေလ်ဖြတ်ခွင့် သို့မဟုတ် ဘဏ္ဍာရေးကြည့်ခွင့်မရှိပါ။'
          ]
        : [
            '• Owner: Has top administrative access to system configurations, raw financials, backup tools, and staff audits.',
            '• Manager & Cashier: Can initiate room check-ins, place product orders, perform invoice checkouts, and execute daily closing.',
            '• Waiter / Receptionist: Limited to starting sessions and adding beverage/snack orders. Barred from billing, voids, and financial viewing.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 text-[10px]">
            <div className="bg-slate-900 px-3 py-1.5 font-bold text-slate-400 border-b border-slate-800">အသုံးပြုသူရာထူးနှင့် လုပ်ပိုင်ခွင့် နှိုင်းယှဉ်ချက်</div>
            <div className="divide-y divide-slate-850 p-2 space-y-1.5">
              <div className="flex justify-between">
                <span className="font-bold text-amber-400">Owner (ဆိုင်ရှင်)</span>
                <span className="text-emerald-400">✓ လုပ်ဆောင်ချက်အားလုံး (၁၀၀%) ရရှိသည်</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-cyan-400">Manager / Cashier (ငွေကိုင်)</span>
                <span className="text-slate-300">✓ အခန်းဖွင့်/ငွေသိမ်း/ကုန်ကျစရိတ်သွင်း (လယ်ဂျာအရန်သိမ်းမရပါ)</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-purple-400">Waiter / Receptionist (ဧည့်ကြို)</span>
                <span className="text-rose-400">✗ အော်ဒါမှာခွင့်သာရှိသည် (ငွေသိမ်းခွင့်မရှိပါ)</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'add_staff',
      title: isMm ? '၄။ ဝန်ထမ်းအသစ်နှင့် ကော်မရှင်နှုန်းထား သတ်မှတ်ခြင်း' : '4. Setting Up Staff & Commission Rules',
      icon: Users,
      content: isMm
        ? 'စပါးအနှိပ်သည် (Therapist) များနှင့် ကေတီဗွီဝန်ဆောင်မှုပေးသူများ၏ ကိုယ်ရေးမှတ်တမ်းနှင့် ၎င်းတို့ရရှိမည့် ကော်မရှင်နှုန်းထားများ သတ်မှတ်ပုံဖြစ်ပါသည်။'
        : 'Register employees, assign therapist statuses, monthly basic salaries, and custom commission percentages.',
      steps: isMm
        ? [
            '၁။ Settings -> Master Data -> Staff စာမျက်နှာသို့ သွားပါ။',
            '၂။ ဝန်ထမ်းအမည်၊ ဖုန်းနံပါတ်၊ တာဝန်နှင့် လစဉ်အခြေခံလစာတို့ကို ရေးသားဖြည့်သွင်းပါ။',
            '၃။ ကော်မရှင်ရာခိုင်နှုန်း (Commission %) ဥပမာ- ၁၅% သတ်မှတ်ပါ။ ဤဝန်ထမ်းသည် ဝန်ဆောင်မှုပေးတိုင်း ဤနှုန်းထားအတိုင်း ကော်မရှင်ကို စနစ်မှ အလိုအလျောက် တွက်ပေးမည်ဖြစ်ပါသည်။'
          ]
        : [
            '1. Navigate to Settings -> Master Data -> Staff.',
            '2. Enter staff name, contact phone number, job role, and basic monthly salary.',
            '3. Set a dynamic commission rate % (e.g., 15%). The ERP automatically logs commission earnings upon service checkout.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-[10px]">
            <span className="text-[10px] text-emerald-400 font-extrabold block border-b border-slate-800 pb-1">➕ ဝန်ထမ်းအချက်အလက်အသစ် ဖြည့်သွင်းပုံ (Add New Staff)</span>
            
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block mb-0.5">ဝန်ထမ်းအမည် (Staff Name):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white font-bold">မစုစု</div>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">ဖုန်းနံပါတ် (Phone):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">09798765432</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block mb-0.5">ရာထူး/တာဝန် (Role):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">Senior Therapist (အနှိပ်ကျွမ်းကျင်)</div>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">အခြေခံလစာ (Basic Salary):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">၃၀၀,၀၀၀ ကျပ်</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block mb-0.5">ကော်မရှင်ရာခိုင်နှုန်း (Commission %):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-emerald-500/30 text-emerald-400 font-bold rounded">၁၅ %</div>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">ဝင်ရောက်ရန် PIN (Staff PIN):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">၂ ၅ ၈ ၀</div>
                </div>
              </div>
            </div>

            <button className="w-full bg-emerald-600 text-slate-950 font-black text-center py-1.5 rounded text-[10px] cursor-not-allowed">
              ✓ ဝန်ထမ်းစာရင်း သိမ်းဆည်းမည် (Save Staff)
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'add_room',
      title: isMm ? '၅။ KTV / Spa အခန်းများနှင့် စားပွဲများ ထည့်သွင်းခြင်း' : '5. Setting Up Rooms, KTV Boxes & Tables',
      icon: Layers,
      content: isMm
        ? 'ဧည့်သည်များ ဝင်ရောက်အသုံးပြုမည့် KTV ကာရာအိုကေခန်းများ သို့မဟုတ် စပါးအနှိပ်ခုတင်များကို စနစ်ထဲတွင် ဈေးနှုန်းဖြင့် သတ်မှတ်ဖန်တီးပုံ ဖြစ်ပါသည်။'
        : 'Define physical spaces, private KTV rooms, karaoke stages, or massage beds alongside hourly rental rates.',
      steps: isMm
        ? [
            '၁။ Settings -> Master Data -> Rooms စာမျက်နှာသို့ သွားပါ။',
            '၂။ အခန်းအမည် (ဥပမာ- VIP Room 102) နှင့် အမျိုးအစား (Massage/KTV/PS5) ကို ရွေးချယ်ပါ။',
            '၃။ အခန်း၏ တစ်နာရီငှားရမ်းခနှုန်းထား (Hourly Rate) ဥပမာ- ၁၅,၀၀၀ ကျပ် ကို ရိုက်ထည့်ပြီး သိမ်းဆည်းပါ။'
          ]
        : [
            '1. Navigate to Settings -> Master Data -> Rooms.',
            '2. Provide a unique identifier (e.g., VIP Room 102) and classify under Massage, KTV, or PS5 Lounge.',
            '3. Configure its flat Hourly Rental Rate (e.g., 15,000 MMK) and save.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-[10px]">
            <span className="text-[10px] text-emerald-400 font-extrabold block border-b border-slate-800 pb-1">➕ အခန်းအသစ် စာရင်းသွင်းပုံ (Add New Room)</span>
            
            <div className="space-y-1.5">
              <div>
                <span className="text-slate-400 block mb-0.5">အခန်းအမည် / စားပွဲနံပါတ် (Room Name / Table No):</span>
                <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white font-bold">VIP KTV Room 301</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block mb-0.5">အမျိုးအစား (Room Type):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">KTV Karaoke Box</div>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">တစ်နာရီ အခန်းခနှုန်း (Hourly Rate):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-amber-500/30 text-amber-400 font-bold rounded">၂၀,၀၀၀ ကျပ်</div>
                </div>
              </div>
            </div>

            <button className="w-full bg-emerald-600 text-slate-950 font-black text-center py-1.5 rounded text-[10px] cursor-not-allowed">
              ✓ အခန်းစာရင်း သိမ်းဆည်းမည် (Save Room)
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'add_service',
      title: isMm ? '၆။ Spa ဝန်ဆောင်မှုများနှင့် ကော်မရှင်စည်းမျဉ်းများ' : '6. Adding Spa Services & Payout Rules',
      icon: Tag,
      content: isMm
        ? 'ဆိုင်တွင်ရရှိနိုင်သော နှိပ်နယ်မှုပုံစံအမျိုးမျိုး၊ ဆံပင်၊ ခြေသည်းလက်သည်း ဝန်ဆောင်မှုများနှင့် ပုံသေကော်မရှင်များ သတ်မှတ်ပုံဖြစ်ပါသည်။'
        : 'Configure professional spa therapies, body treatments, grooming, or VIP services with clear commission bounds.',
      steps: isMm
        ? [
            '၁။ Settings -> Master Data -> Services စာမျက်နှာသို့ သွားပါ။',
            '၂။ ဝန်ဆောင်မှုအမည် (ဥပမာ- Aromatherapy Oil Massage)၊ သတ်မှတ်ကြာချိန် (မိနစ်- ၉၀) နှင့် ဝန်ဆောင်ခဈေးနှုန်းကို ဖြည့်သွင်းပါ။',
            '၃။ ဤဝန်ဆောင်မှုအတွက် ဝန်ထမ်းအား ပုံသေပေးမည့် ကော်မရှင်ပမာဏ (ဥပမာ- ၆,၀၀၀ ကျပ်) ကို သတ်မှတ်သိမ်းဆည်းပါ။'
          ]
        : [
            '1. Navigate to Settings -> Master Data -> Services.',
            '2. Set the service description (e.g., Aromatherapy Oil Massage), standard duration in minutes (e.g., 90), and checkout price.',
            '3. Specify either a fixed commission payout value (e.g., 6,000 MMK) or percentage rule for the providing therapist.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-[10px]">
            <span className="text-[10px] text-emerald-400 font-extrabold block border-b border-slate-800 pb-1">➕ ဝန်ဆောင်မှုအသစ် ဖြည့်သွင်းပုံ (Add New Service)</span>
            
            <div className="space-y-1.5">
              <div>
                <span className="text-slate-400 block mb-0.5">ဝန်ဆောင်မှုအမည် (Service Name):</span>
                <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white font-bold">Aromatherapy Oil Massage</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-slate-400 block mb-0.5">ကြာချိန် (မိနစ်):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">၉၀ မိနစ်</div>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">ဝန်ဆောင်ခနှုန်း:</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">၃၀,၀၀၀ ကျပ်</div>
                </div>
                <div>
                  <span className="text-emerald-400 block mb-0.5">ဝန်ထမ်းကော်မရှင်:</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-emerald-500/30 text-emerald-400 font-bold rounded">၆,၀၀၀ ကျပ်</div>
                </div>
              </div>
            </div>

            <button className="w-full bg-emerald-600 text-slate-950 font-black text-center py-1.5 rounded text-[10px] cursor-not-allowed">
              ✓ ဝန်ဆောင်မှု သိမ်းဆည်းမည် (Save Service)
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'add_product',
      title: isMm ? '၇။ အအေး၊ ဘီယာနှင့် ကုန်ပစ္စည်းစာရင်း စီမံခန့်ခွဲခြင်း' : '7. Food, Beverage & Inventory Control',
      icon: Package,
      content: isMm
        ? 'KTV နှင့် Spa တွင် ရောင်းချမည့် ဘီယာ၊ အအေး၊ စားသောက်ဖွယ်ရာများနှင့် တစ်ကိုယ်ရေသုံးပစ္စည်းများ၏ ဝယ်ဈေး၊ ရောင်းဈေး၊ ကုန်လက်ကျန် သတ်မှတ်ချက်ဖြစ်ပါသည်။'
        : 'Manage retail items, kitchen food orders, drinks, and stock safety quantities with visual low stock indicators.',
      steps: isMm
        ? [
            '၁။ Settings -> Master Data -> Products စာမျက်နှာသို့ သွားပါ။',
            '၂။ ပစ္စည်းအမည် (ဥပမာ- Heineken Beer (Canned))၊ ဝယ်ဈေး (Cost - ၃,၅၀၀) နှင့် ရောင်းဈေး (Price - ၅,၀၀၀) ကို ဖြည့်စွက်ပါ။',
            '၃။ လက်ရှိကုန်ပစ္စည်းလက်ကျန် (Stock Quantity) နှင့် ပစ္စည်းပြတ်တော့မည့်အဆင့် သတိပေးချက်ပမာဏ (Low Stock Level - ၂၀) တို့ကို ရိုက်ထည့်ပါ။'
          ]
        : [
            '1. Navigate to Settings -> Master Data -> Products.',
            '2. Register the product details: wholesale Cost price (e.g., 3,500 MMK) and retail selling Price (e.g., 5,000 MMK).',
            '3. Record initial physical Stock Quantity and set a Low Stock warning threshold count (e.g., 20 cans).'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-[10px]">
            <span className="text-[10px] text-emerald-400 font-extrabold block border-b border-slate-800 pb-1">➕ ကုန်ပစ္စည်းအသစ် စာရင်းသွင်းပုံ (Add New Product)</span>
            
            <div className="space-y-1.5">
              <div>
                <span className="text-slate-400 block mb-0.5">ကုန်ပစ္စည်းအမည် (Product Name):</span>
                <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white font-bold">Heineken Beer (Canned)</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block mb-0.5">ဝယ်ဈေး (Wholesale Cost):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">၃,၅၀၀ ကျပ်</div>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">ရောင်းဈေး (Selling Price):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">၅,၀၀၀ ကျပ်</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block mb-0.5">လက်ရှိကုန်လက်ကျန် (Stock Count):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">၁၅၀ ဘူး</div>
                </div>
                <div>
                  <span className="text-amber-400 block mb-0.5">အနည်းဆုံး သတိပေးပမာဏ (Low Stock Alert):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-amber-500/30 text-amber-400 font-bold rounded">၂၀ บူး</div>
                </div>
              </div>
            </div>

            <button className="w-full bg-emerald-600 text-slate-950 font-black text-center py-1.5 rounded text-[10px] cursor-not-allowed">
              ✓ ကုန်ပစ္စည်းစာရင်း သိမ်းဆည်းမည် (Save Product)
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'customers',
      title: isMm ? '၈။ ဖောက်သည် VIP နှင့် အကြွေးစာရင်းစောင့်ကြည့်ခြင်း' : '8. Managing Customers, VIP Tiers & Credit Records',
      icon: User,
      content: isMm
        ? 'ဆိုင်၏ အမြဲတမ်းဖောက်သည်များ၊ VIP ကတ်ရှင်များနှင့် ၎င်းတို့၏ ကျန်ရှိနေသေးသော အကြွေး (Outstandings) များကို ထိန်းချုပ်သည့်စနစ် ဖြစ်ပါသည်။'
        : 'Store customer phone records, manage loyalty tier metrics, and monitor outstanding credit due.',
      steps: isMm
        ? [
            '• Settings -> Master Data -> Customers တွင် ဖောက်သည်များ၏ ဖုန်းနံပါတ်၊ အမည်နှင့် VIP Level ကို စာရင်းသွင်းနိုင်ပါသည်။',
            '• ဖောက်သည်တစ်ဦးချင်းစီ၏ ဝယ်ယူမှုသမိုင်းနှင့် အကြွေးကျန်ငွေများကို တန်းစီစောင့်ကြည့်နိုင်ပါသည်။',
            '• ၎င်းတို့အကြွေးလာဆပ်ပါက ချက်ချင်း "Pay Debt" ခလုတ်ကိုနှိပ်၍ လယ်ဂျာစာရင်းတွင် လွယ်ကူစွာရှင်းလင်းနိုင်ပါသည်။'
          ]
        : [
            '• Go to Settings -> Master Data -> Customers to log loyal clientele names and phone numbers.',
            '• Instantly audit active credit balances and accumulated purchase points.',
            '• Settle outstanding due using the "Pay Debt" receipt action on their dynamic profile.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-[10px]">
            <div className="flex justify-between items-center border-b border-slate-800 pb-1">
              <span className="text-white font-extrabold">ဖောက်သည်ကိုယ်ရေးမှတ်တမ်း (Customer Profile)</span>
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded text-[8px] font-black">VIP PLATINUM</span>
            </div>
            <div className="space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span>ဝယ်သူအမည်:</span>
                <span className="font-bold text-white">ဦးမောင်မောင်</span>
              </div>
              <div className="flex justify-between">
                <span>ဆက်သွယ်ရန်ဖုန်း:</span>
                <span className="font-mono text-white">09420001122</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>စုစုပေါင်း ကျန်ရှိအကြွေး (Unpaid Credit):</span>
                <span className="font-extrabold text-sm">၈၀,၀၀၀ ကျပ်</span>
              </div>
            </div>
            <button className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-1.5 rounded text-[9px] cursor-not-allowed">
              💵 အကြွေးလာဆပ်သည်ကို စာရင်းသွင်းမည် (Pay Debt)
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'login_pin',
      title: isMm ? '၉။ စနစ်သို့ အကောင့်ရွေးချယ်ပြီး PIN ဖြင့် ဝင်ရောက်ခြင်း' : '9. Numeric PIN Logging & Account Switch',
      icon: Lock,
      content: isMm
        ? 'စနစ်ကို ဖွင့်ဖွင့်ချင်းတွင် လုံခြုံမှုရှိစေရန် ဝန်ထမ်းအလိုက် သတ်မှတ်ထားသော ဂဏန်း PIN ဖြင့် အကောင့်ဝင်ရောက်ပုံ ဖြစ်ပါသည်။'
        : 'Every cashier, manager, receptionist, and waiter has a distinct login profile and unique numeric PIN code.',
      steps: isMm
        ? [
            '၁။ အက်ပ်၏ Navbar ညာဘက်အပေါ်ဆုံးရှိ "Switch User / Lock PIN" ခလုတ် သို့မဟုတ် ဝန်ထမ်းရွေးချယ်ရန် နေရာသို့ သွားပါ။',
            '၂။ မိမိအသုံးပြုမည့် ဝန်ထမ်းအကောင့်အမည်ကို ရွေးချယ်ပါ။',
            '၃။ မိမိ၏ သတ်မှတ်ထားသော ဂဏန်း PIN နံပါတ် (၄ လုံး သို့မဟုတ် ၆ လုံး) ကို ကီးပက်တွင် ရိုက်နှိပ်ဝင်ရောက်ပါ။'
          ]
        : [
            '1. Tap the "Switch User" Lock PIN icon in the top right menu bar.',
            '2. Choose your customized profile name (e.g. Cashier Su).',
            '3. Enter your private 4 or 6-digit numeric PIN on the secure pad to gain interface access.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans">
          <div className="bg-slate-950 p-3 rounded border border-slate-800 text-center max-w-[200px] mx-auto space-y-2.5">
            <div className="text-[10px] font-extrabold text-white">ရွှေသီရိ စပါ & KTV စကားဝှက်ဝင်ပါ</div>
            
            <div className="grid grid-cols-2 gap-1.5 text-[8px] text-slate-400 text-left">
              <span className="bg-slate-900 p-1 rounded border border-slate-800 font-bold text-center text-white">👤 ကိုဇော် (မန်နေဂျာ)</span>
              <span className="bg-slate-900 p-1 rounded border border-slate-800 font-bold text-center text-slate-400">👤 မစုစု (Cashier)</span>
            </div>

            <div className="bg-slate-900 py-1.5 rounded text-amber-400 text-center text-xs font-black tracking-widest">● ● ● ●</div>
            
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <span className="bg-slate-800 p-1 rounded font-bold text-white">၁</span>
              <span className="bg-slate-800 p-1 rounded font-bold text-white">၂</span>
              <span className="bg-slate-800 p-1 rounded font-bold text-white">၃</span>
              <span className="bg-slate-800 p-1 rounded font-bold text-white">၄</span>
              <span className="bg-slate-800 p-1 rounded font-bold text-white">၅</span>
              <span className="bg-slate-800 p-1 rounded font-bold text-white">၆</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'lan_setup',
      title: isMm ? '၁၀။ အော့ဖ်လိုင်း ဆိုင်တွင်းကွန်ရက် LAN ချိတ်ဆက်နည်း' : '10. Local LAN Multi-device Sync over Wi-Fi',
      icon: RefreshCw,
      content: isMm
        ? 'ကောင်တာ PC ကို Server အဖြစ်ထားရှိပြီး ဆိုင်တွင်းရှိ ဝန်ထမ်းများ၏ ဖုန်း/တက်ဘလတ်များကို ချိတ်ဆက်အသုံးပြုနည်း ဖြစ်ပါသည်။'
        : 'Connect waiter mobile phones and manager tablets over local Wi-Fi Hotspots without requiring active internet.',
      steps: isMm
        ? [
            '၁။ ကောင်တာ PC တွင် ထိပ်ဆုံး Navbar ပေါ်ရှိ "LAN" သို့မဟုတ် ကွန်ရက်သင်္ကေတကို နှိပ်ပါ။',
            '၂။ စနစ်မှ ထုတ်ပေးသော ဆိုင်တွင်း IP လိပ်စာ (ဥပမာ- http://192.168.1.100:3000) နှင့် QR Code ပေါ်လာပါမည်။',
            '၃။ စားပွဲထိုးဖုန်းများ၏ Wi-Fi ကို ဆိုင် Wi-Fi တွင် ချိတ်ဆက်ပြီး ဤ QR Code ကို ကင်မရာဖြင့် စကန်ဖတ်ကာ စင့်ခ်လုပ်အသုံးပြုနိုင်ပါသည်။'
          ]
        : [
            '1. Click the "LAN" connectivity tab on the top menu bar on your main cashier computer.',
            '2. The ERP generates a local server address (e.g., http://192.168.1.100:3000) along with a pairing QR code.',
            '3. Connect waiters phones to the same Wi-Fi router, scan the QR code, and begin sync operations instantly.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-center text-[10px]">
            <span className="text-cyan-400 font-extrabold block">🔗 ဆိုင်တွင်းကွန်ရက်ချိတ်ဆက်ရန် အချက်အလက် (LAN Connect)</span>
            <div className="flex justify-center items-center gap-3">
              <div className="h-12 w-12 bg-white p-1 rounded flex items-center justify-center text-black font-black text-xs border border-cyan-500">QR</div>
              <div className="text-left">
                <span className="text-slate-400 block text-[9px]">Server IP Address:</span>
                <span className="text-white font-extrabold font-mono text-[11px] block text-cyan-400">http://192.168.1.100:3000</span>
                <span className="text-slate-500 text-[8px] block">✓ စားပွဲထိုးဖုန်းမှ ဤ QR Code စကန်ဖတ်ပြီး အော်ဒါသွင်းနိုင်ပါသည်</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'start_session',
      title: isMm ? '၁၁။ Spa / KTV အခန်းသုံးစွဲမှု အချိန်မှတ်စတင်ခြင်း' : '11. Starting Room Sessions & Activating Timers',
      icon: Clock,
      content: isMm
        ? 'ဧည့်သည်ဝင်ရောက်လာသောအခါ အခန်း သို့မဟုတ် ခုတင်ကို စတင်ဖွင့်လှစ်ပြီး အချိန်မှတ် Live Timer စတင်လည်ပတ်ပုံ ဖြစ်ပါသည်။'
        : 'Open private KTV suites, initiate guest spa massage treatments, and activate automated countdown timers.',
      steps: isMm
        ? [
            '၁။ ပင်မစာမျက်နှာ (Rooms View) ရှိ အစိမ်းရောင်ရှိသော အားနေသည့်အခန်း (Available) ကို နှိပ်ပါ။',
            '၂။ ယူမည့်ဝန်ဆောင်မှု (Service)၊ တာဝန်ကျဝန်ထမ်း (Therapist) နှင့် ဖောက်သည် (Customer) တို့ကို ရွေးချယ်ပါ။',
            '၃။ "Start Session" ခလုတ်ကိုနှိပ်သည်နှင့် အခန်းသည် အနီရောင် (Occupied) သို့ပြောင်းသွားပြီး စက္ကန့်မခြား အချိန်စတင်ရေတွက်ပါမည်။'
          ]
        : [
            '1. Click any green "Available" Room card on the rooms layout dashboard.',
            '2. Select requested Service (e.g. Oil Massage), assign available Therapist (e.g. Ma Su Su), and assign Customer.',
            '3. Hit "Start Session". The card turns Red (Occupied) and begins automated real-time timer countdown immediately.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-[10px]">
            <span className="text-[10px] text-rose-400 font-extrabold block border-b border-slate-800 pb-1">⏱️ အခန်းသုံးစွဲမှု စတင်ဖွင့်လှစ်ခြင်း (Start Session)</span>
            
            <div className="space-y-1.5 text-[10px]">
              <div className="flex justify-between">
                <span className="text-slate-400">ရွေးချယ်ထားသော အခန်း:</span>
                <span className="text-white font-bold">Room 102 (VIP SPA BOX)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block mb-0.5">ယူမည့်ဝန်ဆောင်မှု:</span>
                  <div className="bg-slate-900 px-2 py-1 border border-slate-800 rounded text-white">Aromatherapy Oil Massage</div>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">တာဝန်ကျ ဝန်ထမ်း:</span>
                  <div className="bg-slate-900 px-2 py-1 border border-slate-800 rounded text-emerald-400 font-bold">မစုစု (Senior)</div>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">ဖောက်သည် (Customer):</span>
                <div className="bg-slate-900 px-2 py-1 border border-slate-800 rounded text-white font-bold">ဦးမောင်မောင် (VIP)</div>
              </div>
            </div>

            <button className="w-full bg-rose-600 text-white font-black text-center py-2 rounded text-[10px] cursor-not-allowed uppercase">
              🚀 သုံးစွဲမှု စတင်မည် (Start Active Timer)
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'add_orders',
      title: isMm ? '၁၂။ အော်ဒါ မှာယူခြင်းနှင့် အခန်းသို့ ပစ္စည်းပေါင်းထည့်ခြင်း' : '12. Placing Product Orders & Adding Items to Rooms',
      icon: Coffee,
      content: isMm
        ? 'ဧည့်သည်များ သုံးစွဲနေစဉ်အတွင်း ဘီယာ၊ အအေး သို့မဟုတ် နောက်ထပ် ဝန်ဆောင်မှုများကို အခန်းထဲသို့ အပိုထပ်ပေါင်းထည့်ပုံ ဖြစ်ပါသည်။'
        : 'Append beers, snacks, food items, or supplemental massage hours to currently active occupied sessions.',
      steps: isMm
        ? [
            '၁။ လက်ရှိလည်ပတ်နေသော အနီရောင်အခန်း (Occupied) ကတ်ကို နှိပ်ပါ။',
            '၂။ "Add Products / Services" ခလုတ်ကို နှိပ်ပါ။',
            '၃။ ဧည့်သည်မှာယူသော Heineken Beer သို့မဟုတ် ရေခဲ၊ အမြည်းပန်းကန်များကို ရွေးချယ်ပြီး အရေအတွက်သတ်မှတ်ကာ "Add to Bill" ကိုနှိပ်ပါ။'
          ]
        : [
            '1. Click on the Red "Occupied" active room card.',
            '2. Tap "Add Products / Services" action button on the session manager sheet.',
            '3. Select ordered items like Heineken Beer, mineral water, or kitchen dishes, enter count and hit "Add to Bill".'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1.5 text-[10px]">
            <span className="text-cyan-400 font-bold block border-b border-slate-800 pb-1">🍺 အော်ဒါ ပစ္စည်းထည့်ပေါင်းခြင်း (Add Order Items) - Room 102</span>
            <div className="flex justify-between items-center text-slate-300">
              <span>၁။ Heineken Beer (Canned) x ၄ ဘူး</span>
              <span className="font-bold text-white">၂၀,၀၀၀ ကျပ်</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>၂။ အာလူးကြော် အမြည်းပန်းကန် x ၁ ပွဲ</span>
              <span className="font-bold text-white">၄,၅၀၀ ကျပ်</span>
            </div>
            <button className="w-full bg-cyan-600 text-slate-950 font-black py-1.5 rounded text-[9px] mt-1 cursor-not-allowed">
              ✓ စာရင်းထဲသို့ ပေါင်းထည့်မည် (Add to Active Bill)
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'checkout',
      title: isMm ? '၁၃။ အခန်းသုံးစွဲမှု ပြီးဆုံး၍ ဘေလ်ရှင်းခြင်း' : '13. POS Billing Checkout & Ticket Voids',
      icon: ShoppingBag,
      content: isMm
        ? 'ဧည့်သည်ပြန်ချိန်တွင် အခန်းခ၊ ဝန်ဆောင်မှုစရိတ်၊ အစားအသောက်ဖိုးများကို စနစ်မှ စက္ကန့်ပိုင်းအတွင်း တွက်ချက်ပြီး ဘေလ်ရှင်းပုံ ဖြစ်ပါသည်။'
        : 'Settle checkout accounts: aggregate hourly room rents, food logs, tax computations, and dynamic receipt discount margins.',
      steps: isMm
        ? [
            '၁။ အနီရောင်အခန်းကတ်ရှိ "Checkout & Print" ခလုတ်ကို နှိပ်ပါ။',
            '၂။ စနစ်မှ အခန်းအသုံးပြုကြာချိန်၊ ယူခဲ့သော ဝန်ဆောင်မှုများနှင့် စားသောက်ဖွယ်ရာစုစုပေါင်းကို အလိုအလျောက် ပေါင်းပေးပါမည်။',
            '၃။ လျှော့ဈေး (Discount) ရာခိုင်နှုန်း သို့မဟုတ် ငွေပမာဏကို ရိုက်ထည့်ပြီး အသားတင်ပေးရန်ငွေ (Net Total) ကို တွက်ချက်ကာ အတည်ပြုပါ။'
          ]
        : [
            '1. Tap the "Checkout & Print" action inside the active occupied room screen.',
            '2. The ERP aggregates total room hours, spa therapies, and retail food counts into a live draft.',
            '3. Apply optional discount values or coupon parameters. The net balance, tax charges, and service charges compute instantly.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 p-3 rounded border border-slate-800 text-[10px] space-y-1.5 font-mono">
            <span className="text-center font-bold text-white block border-b border-dashed border-slate-800 pb-1">*** ရွှေသီရိ စပါ & KTV ***</span>
            <div className="flex justify-between text-[8px] text-slate-500">
              <span>VCH-2026-0045</span>
              <span>ညငွေကိုင်: မစုစု</span>
            </div>
            <div className="border-b border-dashed border-slate-800 py-1 space-y-1 text-[9px] text-slate-300">
              <div className="flex justify-between"><span>Room 102 Rent (Hourly 2 Hrs)</span><span>၃၀,၀၀၀</span></div>
              <div className="flex justify-between"><span>Oil Massage (90 Min)</span><span>၃၀,၀၀0</span></div>
              <div className="flex justify-between"><span>Heineken Beer (4 Cans)</span><span>၂၀,၀၀၀</span></div>
            </div>
            <div className="space-y-0.5 text-right font-bold text-[9px] text-slate-200">
              <div>စုစုပေါင်း ကျသင့်ငွေ: ၈၀,၀၀၀ ကျပ်</div>
              <div>အခွန် Tax (၅%): ၄,၀၀၀ ကျပ်</div>
              <div>ဝန်ဆောင်ခ (၁၀%): ၈,၀၀၀ ကျပ်</div>
              <div className="text-rose-400">လျှော့ဈေး (Discount): -၄,၀၀၀ ကျပ်</div>
              <div className="text-emerald-400 text-sm font-black border-t border-dashed border-slate-800 pt-1">အသားတင် ပေးရန်: ၈၈,၀၀၀ ကျပ်</div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'payments',
      title: isMm ? '၁၄။ မိုဘိုင်းလ်ငွေပေးချေမှုနှင့် ခွဲခြားငွေချေစနစ်' : '14. Multi-Method Payments & Split Receipts',
      icon: DollarSign,
      content: isMm
        ? 'ငွေသားသာမက မိုဘိုင်းဖုန်း (KBZPay, WavePay) များ သို့မဟုတ် ငွေသားတစ်ဝက်၊ ဖုန်းဖြင့်တစ်ဝက် ခွဲခြားပေးချေမှုပုံစံများ လက်ခံဆောင်ရွက်ပုံ ဖြစ်ပါသည်။'
        : 'Manage split transactions over multiple mediums (e.g. partially cash plus partially KBZPay/WavePay transfer).',
      steps: isMm
        ? [
            '• ငွေပေးချေမှုပုံစံ ရွေးချယ်ရာတွင် Cash သို့မဟုတ် Mobile Banking (KBZPay / WavePay) ကို ရွေးချယ်နိုင်ပါသည်။',
            '• Split Payment (ခွဲချေစနစ်): ဧည့်သည်မှ ငွေကျပ် ၃သောင်းအား ငွေသားပေးပြီး ကျန်ငွေ ၅သောင်းကျော်ကို KBZPay ဖြင့် လွှဲပါက စနစ်တွင် တိကျစွာ ခွဲခြားသတ်မှတ် စာရင်းပိတ်နိုင်ပါသည်။'
          ]
        : [
            '• Choose payment methods between physical Cash and Mobile Wallets (KBZPay, WavePay, KPay QR).',
            '• Use Split Payments to log complex bills (e.g., 30,000 MMK Cash + 58,000 MMK KBZPay) maintaining high-precision cash tallies.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2 text-[10px]">
            <span className="text-amber-400 font-extrabold block border-b border-slate-800 pb-1">💵 ငွေချေစနစ်ရွေးချယ်မှု (Split Payment Setup)</span>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-slate-900 p-2 rounded border border-emerald-500/40">
                <span className="text-emerald-400 font-black block">CASH (လက်ငင်းငွေသား)</span>
                <span className="text-white font-mono font-bold mt-1 block">၃၀,၀၀၀ ကျပ်</span>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-cyan-500/40">
                <span className="text-cyan-400 font-black block">KPay / Mobile Pay</span>
                <span className="text-white font-mono font-bold mt-1 block">၅၈,၀၀၀ ကျပ်</span>
              </div>
            </div>
            <div className="text-center font-bold text-slate-400">စုစုပေါင်း ရှင်းလင်းငွေ: ၈၈,၀၀၀ ကျပ် (ကိုက်ညီပါသည်)</div>
          </div>
        </div>
      )
    },
    {
      id: 'debt_management',
      title: isMm ? '၁၅။ အကြွေးစနစ်ဖြင့် ဘေလ်ပိတ်ခြင်းနှင့် နောက်မှပြန်ဆပ်ခြင်း' : '15. Closing Bills on Credit & Settling Debts',
      icon: FileText,
      content: isMm
        ? 'ဆိုင်၏ VIP အမြဲတမ်းဖောက်သည်များ ငွေမချေဘဲ အကြွေး (Debt) ဖြင့် ဘေလ်ပိတ်သွားပါက စာရင်းထိန်းချုပ်ပုံ ဖြစ်ပါသည်။'
        : 'Process unpaid bills under credit terms and settle outstanding due values within client portfolios.',
      steps: isMm
        ? [
            '၁။ ဘေလ်ရှင်းချိန်တွင် ငွေချေမှုပုံစံနေရာ၌ "Debt / Unpaid" (အကြွေး) ဟု ရွေးချယ်ပြီး ဘေလ်ပိတ်ပါ။',
            '၂။ စနစ်သည် ဤအကြွေးပမာဏကို ဝယ်သူ၏ Customer Profile တွင် အလိုအလျောက် သွားရောက်ပေါင်းထည့်ပေးပါမည်။',
            '၃။ ဖောက်သည်မှ နောက်ပိုင်းတွင် လာရောက်ပေးဆပ်ပါက Customer 360° Profile ရှိ "Pay Debt" ကို နှိပ်ပြီး စာရင်းချေနိုင်ပါသည်။'
          ]
        : [
            '1. Select "Debt / Credit" under payment status options at checkout.',
            '2. The ERP immediately credits the pending balance onto the selected customer profile ledger.',
            '3. When the customer settles the due, click "Pay Debt" inside their profile card to balance the ledger.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[10px] space-y-1.5">
            <div className="flex justify-between text-rose-400 font-extrabold">
              <span>အကြွေးဘေလ် ပိတ်သိမ်းခြင်း (Debt Settle):</span>
              <span>- ၈၈,၀၀၀ ကျပ်</span>
            </div>
            <div className="text-slate-400 text-[9px]">
              * ဤအကြွေးကို ဝယ်သူ <span className="text-white font-bold">"ဦးမောင်မောင် (VIP)"</span> ၏ အကောင့်ထဲသို့ အလိုအလျောက် သွားပေါင်းထည့်ပေးမည်ဖြစ်ပြီး ကောင်တာအံဆွဲငွေသားထဲတွင် ထည့်တွက်မည်မဟုတ်ပါ။
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'staff_commission',
      title: isMm ? '၁၆။ ဝန်ထမ်းကော်မရှင်နှင့် ဆုကြေးမှတ်တမ်းများ' : '16. Staff Commission & Tip Recording',
      icon: Tag,
      content: isMm
        ? 'စပါးအနှိပ်သည် (Therapist) များနှင့် ဝန်ထမ်းများ၏ ဝန်ဆောင်မှုအလိုက် ကော်မရှင်နှင့် ဧည့်သည်ပေးသော Tip ဆုကြေးများကို တွက်ချက်ခြင်းဖြစ်ပါသည်။'
        : 'Automatically credit commissions to therapists and waiters, alongside custom customer-given tips logging.',
      steps: isMm
        ? [
            '• အခန်းသုံးစွဲခ ဘေလ်ရှင်းပြီးသည်နှင့် တာဝန်ကျခဲ့သော ဝန်ထမ်း (Therapist) ၏ ကော်မရှင်စာရင်းသည် အလိုအလျောက် ပေါင်းထည့်ပြီး ဖြစ်ပါမည်။',
            '• ဧည့်သည်မှ ဝန်ထမ်းအား သီးသန့်ပေးသော Tip (မုန့်ဖိုး/ဆုကြေး) ရှိပါကလည်း ငွေကိုင်မှ ဘေလ်ရှင်းချိန်တွင် ချက်ချင်း စာရင်းသွင်းသိမ်းဆည်းပေးနိုင်ပါသည်။',
            '• ဝန်ထမ်းတစ်ဦးချင်းစီအလိုက် ရရှိထားသော ကော်မရှင်မှတ်တမ်းများကို Records -> Commission Reports တွင် အချိန်မရွေး စစ်ဆေးနိုင်ပါသည်။'
          ]
        : [
            '• Upon successful checkout, the system instantly logs therapist commissions according to service master rules.',
            '• Cashiers can optionally log custom "Tip Amounts" awarded to staff during billing checkout.',
            '• Monitor total monthly payouts and individual performance charts under Records -> Commission reports.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[10px] space-y-1">
            <span className="text-emerald-400 font-bold block">📊 ဝန်ထမ်း ကော်မရှင် စာရင်းတွက်ချက်မှု (Commission Settled)</span>
            <div className="flex justify-between">
              <span>ဝန်ထမ်းအမည်: မစုစု (Senior Therapist)</span>
              <span className="font-extrabold text-white">ရရှိငွေ: ၆,၀၀၀ ကျပ်</span>
            </div>
            <div className="flex justify-between text-amber-400">
              <span>ဧည့်သည်ပေးသော Tip (ဆုကြေး):</span>
              <span className="font-bold">+ ၅,၀၀၀ ကျပ်</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'expenses',
      title: isMm ? '၁၇။ ဆိုင်တွင်း နေ့စဉ် အထွေထွေ ကုန်ကျစရိတ်များ သွင်းခြင်း' : '17. Logging Store & General Expenses',
      icon: DollarSign,
      content: isMm
        ? 'ဆိုင်၏ နေ့စဉ်ထွက်ငွေများ (ဥပမာ- ရေခဲဖိုး၊ အမြည်းဝယ်ယူစရိတ်၊ မီးဖိုး၊ ရေဖိုး၊ ဝန်ထမ်းမုန့်ဖိုး) ကို မှတ်တမ်းတင်ခြင်းဖြစ်ပါသည်။'
        : 'Log daily utility payments, materials purchases, marketing costs, and staff salary advance sums.',
      steps: isMm
        ? [
            '၁။ Records -> Expenses စာမျက်နှာသို့ သွားပါ။',
            '၂။ ကုန်ကျစရိတ် အမျိုးအစား (မီးဖိုး/ရေဖိုး/အထွေထွေ) ကို ရွေးချယ်ပါ။',
            '၃။ ကျသင့်ငွေပမာဏနှင့် အကြောင်းအရာတို့ကို ရိုက်ထည့်ပြီး "Save Expense" ကို နှိပ်ပါ။ ဤကုန်ကျစရိတ်များကို အသားတင်အမြတ် (P&L) တွက်ချက်ရာတွင် အလိုအလျောက် နှုတ်ယူတွက်ချက်ပေးပါမည်။'
          ]
        : [
            '1. Navigate to Records -> Expenses.',
            '2. Select expense category (Utilities, Materials, Salary Advance, Kitchen Supply).',
            '3. Specify the value amount and description, and save. These are auto-deducted from gross revenue on P&L sheets.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-[10px]">
            <span className="text-[10px] text-rose-400 font-extrabold block border-b border-slate-800 pb-1">💸 ကုန်ကျစရိတ်အသစ် သွင်းပုံ (Add New Expense)</span>
            
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block mb-0.5">ကတ်တဂိုရီ (Category):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white">Kitchen Supplies (အမြည်းဝယ်ယူစရိတ်)</div>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">ကျသင့်ငွေပမာဏ (Amount):</span>
                  <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-rose-400 font-bold">၁၅,၀၀၀ ကျပ်</div>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">အကြောင်းအရာ (Note):</span>
                <div className="bg-slate-900 px-2 py-1.5 border border-slate-800 rounded text-white font-bold">အော်ဒါအတွက် ကြက်သားနှင့် အသီးအရွက်ဝယ်ယူခြင်း</div>
              </div>
            </div>

            <button className="w-full bg-rose-600 text-white font-black text-center py-1.5 rounded text-[10px] cursor-not-allowed">
              ✓ ကုန်ကျစရိတ် သိမ်းဆည်းမည် (Save Expense)
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'daily_closing',
      title: isMm ? '၁၈။ နေ့စဉ် အရောင်းသိမ်း စာရင်းပိတ်သိမ်းခြင်း' : '18. Executing Daily Shift Cash Closings',
      icon: Clock,
      content: isMm
        ? 'ဆိုင်ပိတ်ချိန်တွင် ကောင်တာအံဆွဲထဲရှိ ငွေသားအစစ်ကို ရေတွက်ပြီး စနစ်ရှိစာရင်းနှင့် လွဲချော်မှု ရှိမရှိ အပြီးသတ် စစ်ဆေးချုပ်ဆိုခြင်း ဖြစ်ပါသည်။'
        : 'Audit shift endings by checking physical cash against ledger calculations and committing cash closings.',
      steps: isMm
        ? [
            '၁။ ညပိုင်းဆိုင်ပိတ်ချိန်တွင် "Daily Closing" စာမျက်နှာသို့ သွားပါ။',
            '၂။ ကောင်တာအံဆွဲအတွင်းရှိ အကြွေနှင့် ငွေစက္ကူများကို အစစ်အမှန်ရေတွက်ပြီး "Actual Cash" အကွက်တွင် ရိုက်ထည့်ပါ။',
            '၃။ စနစ်မှ တွက်ချက်ပေးသော Expected Cash နှင့် ကွာခြားချက် (Difference) ရှိမရှိ စစ်ဆေးပါ။ Difference: ၀ ကျပ် (လွဲချော်မှုမရှိ) ဖြစ်လျှင် အကောင်းဆုံးဖြစ်ပြီး၊ စာရင်းပိတ်ချုပ်ခြင်းကို အတည်ပြုပါ။'
          ]
        : [
            '1. Go to the "Daily Closing" workspace before shutting down counter.',
            '2. Count all actual coins and paper banknotes in the cash drawer and input in the "Actual Cash" box.',
            '3. Review the Difference column. A zero mismatch indicates complete alignment. Tap "Submit Close-out" to finalize.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-[10px]">
            <span className="text-emerald-400 font-extrabold block border-b border-slate-800 pb-1">📊 နေ့စဉ်စာရင်းပိတ်သိမ်းခြင်း (Daily Cash Closing)</span>
            
            <div className="space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span>စနစ်အရ ရှိရမည့် ငွေသား (Expected Cash):</span>
                <span className="font-bold text-white">၆၈၀,၀၀၀ ကျပ်</span>
              </div>
              <div className="space-y-1 mt-1">
                <span className="text-slate-400 block text-[9px]">အံဆွဲထဲရှိ ငွေသားအစစ် (Actual Cash Counted):</span>
                <div className="bg-slate-900 px-3 py-1.5 rounded border border-emerald-500 text-emerald-400 font-black text-xs text-center">
                  ၆၈၀,၀၀၀ ကျပ်
                </div>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1.5 mt-1 font-bold text-emerald-400">
                <span>ခြားနားချက် (Difference Mismatch):</span>
                <span>၀ ကျပ် (ကိုက်ညီပါသည်)</span>
              </div>
            </div>

            <button className="w-full bg-emerald-600 text-slate-950 font-black text-center py-2 rounded text-[10px] cursor-not-allowed">
              ✓ နေ့စဉ်စာရင်းပိတ်ချုပ်ခြင်းကို အတည်ပြုသိမ်းဆည်းမည် (Lock Day Ledger)
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'reports',
      title: isMm ? '၁၉။ အဆင့်မြင့် ဘဏ္ဍာရေး အမြတ်အရှုံး စာရင်းချုပ်' : '19. Financial Insights & Profit & Loss Reporting',
      icon: FileText,
      content: isMm
        ? 'ဆိုင်၏ ဝင်ငွေ၊ ထွက်ငွေ၊ ဝန်ထမ်းလစာများနှင့် အသားတင်အမြတ် (P&L) ကို လအလိုက်၊ ရက်အလိုက် အလိုအလျောက် သရုပ်ခွဲပြသသည့် စာမျက်နှာ ဖြစ်ပါသည်။'
        : 'Access automated P&L dashboards displaying total revenues, logged expenses, therapist payments, and net profit margins.',
      steps: isMm
        ? [
            '• Records -> Reports တွင် လုပ်ငန်း၏ ဘဏ္ဍာရေးတိုးတက်မှုကို အလွယ်တကူ စောင့်ကြည့်နိုင်ပါသည်။',
            '• Gross Revenue (စုစုပေါင်းရောင်းရငွေ) မှ ကုန်ကျစရိတ်များ (Expenses) နှင့် ဝန်ထမ်းကော်မရှင်များကို နှုတ်ယူပြီး အသားတင်အမြတ်အစစ်အမှန် (Net Profit) ကို အလိုအလျောက် ပုံဖော်ပေးပါသည်။',
            '• အများဆုံးရောင်းရသော ဝန်ဆောင်မှုများနှင့် ထိပ်တန်း Therapist ဝန်ထမ်းများကိုလည်း ဇယားများဖြင့် စစ်ဆေးနိုင်ပါသည်။'
          ]
        : [
            '• Review business growth analytics inside Records -> Reports.',
            '• Gross Revenue minus operating Expenses and therapist commissions computes the true Net Profit.',
            '• Audit top performing services and therapist rosters ranked by volume/sales automatically.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1.5 text-[10px]">
            <span className="text-white font-extrabold block">📈 လအလိုက် အမြတ်အရှုံး စာရင်းချုပ် (P&L Summary)</span>
            <div className="space-y-1 divide-y divide-slate-850 pt-1 text-slate-300">
              <div className="flex justify-between py-1"><span>၁။ စုစုပေါင်းရောင်းရငွေ (Gross Revenue):</span><span className="font-bold text-emerald-400">+ ၁,၄၅၀,၀၀၀ ကျပ်</span></div>
              <div className="flex justify-between py-1"><span>၂။ ဝန်ဆောင်မှု ကော်မရှင်ပေးပြီး:</span><span className="font-bold text-rose-450">- ၃၂၀,၀၀၀ ကျပ်</span></div>
              <div className="flex justify-between py-1"><span>၃။ အထွေထွေ ကုန်ကျစရိတ်များ (Expenses):</span><span className="font-bold text-rose-450">- ၁၅၀,၀၀၀ ကျပ်</span></div>
              <div className="flex justify-between py-1 border-t border-slate-800 pt-1.5 font-extrabold text-white text-[11px]">
                <span>အသားတင် အမြတ်အစစ်အမှန် (Net Profit):</span>
                <span className="text-cyan-400">၉၈၀,၀၀၀ ကျပ်</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'backups_restore',
      title: isMm ? '၂၀။ ဒေတာအရန်သိမ်းခြင်းနှင့် ပြန်လည်ရယူခြင်း' : '20. Secure Offline JSON Backup & Disaster Restore',
      icon: Database,
      content: isMm
        ? 'ဆိုင်၏ စာရင်းဇယားများ ဆုံးရှုံးမှုမရှိစေရန် ဒေတာဘေ့စ်တစ်ခုလုံးကို JSON ဖိုင်ဖြင့် မိတ္တူကူးယူ သိမ်းဆည်းပုံ ဖြစ်ပါသည်။'
        : 'Instantly download self-contained database JSON snapshots and recover workspace databases on new systems.',
      steps: isMm
        ? [
            '၁။ Settings -> Backup & Restore စာမျက်နှာသို့ သွားပါ။',
            '၂။ "Create Instant Backup" ခလုတ်ကို နှိပ်လိုက်သည်နှင့် စနစ်ဒေတာတစ်ခုလုံးကို JSON ဖိုင်ဖြင့် ဒေါင်းလုဒ်ရယူပေးပါမည်။ ဤဖိုင်ကို USB Stick တွင် ကူးယူသိမ်းဆည်းပါ။',
            '၃။ စက်ပျက်စီးသွား၍ ဒေတာအဟောင်းများ ပြန်သွင်းလိုပါက "Restore File" နေရာတွင် အဆိုပါ JSON ဖိုင်ကိုရွေးချယ်ပြီး အတည်ပြုပေးရုံဖြင့် စက္ကန့်ပိုင်းအတွင်း ဒေတာအားလုံး ပြန်လည်ရရှိပါမည်။'
          ]
        : [
            '1. Navigate to Settings -> Backup & Restore.',
            '2. Click "Create Instant Backup" to download a unified, lightweight JSON snapshot of your entire database. Save to a safe USB drive.',
            '3. To recover records on a new machine, select the saved JSON file in the Restore panel and click Confirm.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-3">
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-2 text-[10px]">
            <span className="text-cyan-400 font-extrabold block">💾 စနစ်ဒေတာဘေ့စ် အရန်သိမ်းဆည်းခြင်း (JSON Backup)</span>
            <div className="border border-slate-800 p-2 rounded bg-slate-900 flex justify-between items-center">
              <div>
                <span className="text-white font-bold block">shwe_thiri_backup_2026.json</span>
                <span className="text-slate-500 text-[8px]">ဒေတာဇယားများနှင့် ငွေစာရင်းအားလုံး ပါဝင်ပြီးဖြစ်သည်</span>
              </div>
              <button className="bg-cyan-600 text-slate-950 font-black px-3 py-1 rounded text-[10px] cursor-not-allowed">
                ဒေါင်းလုဒ်ရယူမည်
              </button>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'update_system',
      title: isMm ? '၂၁။ အော့ဖ်လိုင်းစနစ် အဆင့်မြှင့်တင်ခြင်း' : '21. Safe 100% Offline Software Updates',
      icon: RefreshCw,
      content: isMm
        ? 'စနစ်ဗားရှင်းအသစ်များ ထွက်ရှိလာပါက မိမိဆိုင်၏ ဒေတာဟောင်းများ မပျောက်ပျက်စေဘဲ အလွယ်တကူ Upgrade လုပ်ဆောင်ပုံ ဖြစ်ပါသည်။'
        : 'Update application binaries securely over offline environments while leaving database records completely untouched.',
      steps: isMm
        ? [
            '• စနစ်အဆင့်မြှင့်တင်ရန်အတွက် မူလဒေတာများကို ဖျက်ရန် လုံးဝမလိုပါ။',
            '• အက်ပ်လီကေးရှင်း EXE ဖိုင်အသစ်ကို လက်ရှိစက်ထဲရှိ မူလဖိုင်နေရာတွင် Overwrite အစားထိုးကူးယူထည့်သွင်းပေးလိုက်ရုံသာ ဖြစ်ပါသည်။',
            '• စနစ်ကို ပြန်ဖွင့်လိုက်သည်နှင့် ယခင်မှတ်တမ်းတင်ထားသမျှသော စပါးအခန်းများ၊ ငွေစာရင်းများနှင့် ဝန်ထမ်းကော်မရှင်များအားလုံး မပြောင်းမလဲ ဆက်လက်အသုံးပြုနိုင်ပါမည်။'
          ]
        : [
            '• No cloud/internet connection or data wiping is required to update the system.',
            '• Simply copy and replace the newly provided executable binary file into your active shop directory.',
            '• Restart the app; all active room session configurations, history audits, and staff commission logs remain preserved.'
          ],
      mockup: (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-sans space-y-2">
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded text-[10px] text-emerald-400 font-bold text-center">
            ✓ ဗားရှင်း v1.0.0 (Production Stable) အောင်မြင်စွာ စင့်ခ်ပြီးပါပြီ။ မူရင်းဒေတာဘေ့စ်ကို ထိခိုက်မှုမရှိဘဲ လုံခြုံစွာ အဆင့်မြှင့်တင်ပြီးဖြစ်ပါသည်။
          </div>
        </div>
      )
    }
  ], [isMm]);

  // Handle simple filter/search query on manual contents
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const query = searchQuery.toLowerCase();
    return sections.filter(
      sec =>
        sec.title.toLowerCase().includes(query) ||
        sec.content.toLowerCase().includes(query) ||
        sec.steps.some(step => step.toLowerCase().includes(query))
    );
  }, [sections, searchQuery]);

  // Adjust active tab if filter renders it out of range
  const currentSection = useMemo(() => {
    if (filteredSections.length === 0) return null;
    if (selectedSection >= filteredSections.length) {
      return filteredSections[0];
    }
    return filteredSections[selectedSection];
  }, [filteredSections, selectedSection]);

  const downloadAsPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print/download the User Manual PDF.');
      return;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const shopName = 'Shwe_Thiri_Spa_And_KTV';
    const filename = `${shopName}-User_Manual-${dateStr}.pdf`;

    printWindow.document.write(`
      <html>
        <head>
          <title>${isMm ? 'ရွှေသီရိ စပါ & KTV အသုံးပြုသူလက်စွဲ' : 'Shwe Thiri Spa & KTV ERP User Manual'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #0f172a;
              padding: 40px;
              line-height: 1.6;
            }
            h1 { text-align: center; font-size: 22px; font-weight: 900; margin-bottom: 5px; color: #1e293b; }
            .subtitle { text-align: center; font-size: 13px; color: #64748b; margin-bottom: 40px; }
            .section { margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 25px; page-break-inside: avoid; }
            .section-title { font-size: 15px; font-weight: 800; color: #1e3a8a; margin-bottom: 10px; }
            .section-desc { font-size: 12px; color: #475569; margin-bottom: 15px; font-style: italic; }
            .steps-list { margin-left: 20px; font-size: 11px; }
            .step-item { margin-bottom: 8px; }
            .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 60px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>${isMm ? 'ရွှေသီရိ စပါ နှင့် KTV စီမံခန့်ခွဲမှုစနစ်' : 'Shwe Thiri Spa & KTV ERP Platform'}</h1>
          <p class="subtitle">${isMm ? 'အသုံးပြုသူလက်စွဲစာအုပ် (User Manual Book)' : 'System Reference Manual Book'} - Generated: ${dateStr}</p>
          
          ${sections.map((sec, idx) => `
            <div class="section">
              <div class="section-title">${sec.title}</div>
              <div class="section-desc">${sec.content}</div>
              <div class="steps-list">
                ${sec.steps.map((step, sIdx) => `
                  <div class="step-item"><b>${sIdx + 1}.</b> ${step}</div>
                `).join('')}
              </div>
            </div>
          `).join('')}
          
          <div class="footer">
            © ${new Date().getFullYear()} Shwe Thiri Spa & KTV • 100% Offline Standalone Systems
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();

    alert(`[PDF ထုတ်ယူခြင်း] စနစ်လမ်းညွှန်စာအုပ်ကို PDF အဖြစ်ဒေါင်းလုဒ်ဆွဲရန် Print Dialog တွင် "Save as PDF" ကိုရွေးချယ်ပြီး "${filename}" အမည်ဖြင့် သိမ်းဆည်းနိုင်ပါသည် ခင်ဗျာ။`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-2 sm:p-4 backdrop-blur-md">
      <div className="w-full max-w-5xl h-[92vh] rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Header Title & Close Bar */}
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-amber-500/20 p-1.5 rounded-lg border border-amber-500/40 text-amber-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-white">
                {isMm ? 'ရွှေသီရိ စပါ & KTV စနစ်သုံး လမ်းညွှန်လက်စွဲစာအုပ်' : 'Shwe Thiri Spa & KTV ERP - Visual Manual'}
              </h1>
              <p className="text-[10px] text-slate-400">
                {isMm ? 'သာမာန်လူများ နားလည်လွယ်ကူစွာ တစ်ခါတည်းဖြည့်သွင်း အသုံးပြုနိုင်မည့် အဆင့်ဆင့်လမ်းညွှန်ချက်' : 'Simple, step-by-step visual training guide for non-technical counter staffs'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar Block */}
        <div className="bg-slate-900/40 px-4 py-2 border-b border-slate-800 flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSelectedSection(0);
              }}
              placeholder={isMm ? 'စကားလုံးများဖြင့် အမြန်ရှာဖွေပါ...' : 'Search manual keywords or instructions...'}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={downloadAsPDF}
              className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-all active:scale-[0.98] shadow-md shadow-cyan-500/10"
              title={isMm ? 'PDF ဖိုင်အဖြစ် ဒေါင်းလုဒ်ရယူရန်' : 'Download User Guide PDF'}
            >
              <Download className="h-3.5 w-3.5 text-slate-950" />
              <span>{isMm ? 'PDF ဒေါင်းရန်' : 'Download PDF'}</span>
            </button>
            <div className="text-[10px] text-amber-400 font-extrabold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 rounded-xl">
              {isMm ? '၂၁ အဆင့် လမ်းညွှန်ချက်' : '21-Step Guide'}
            </div>
          </div>
        </div>

        {/* Split Layout Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Left Navigation Sidebar */}
          <div className="w-1/3 border-r border-slate-800 overflow-y-auto bg-slate-950/60 divide-y divide-slate-900 shrink-0 select-none">
            {filteredSections.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs italic">
                {isMm ? 'ရှာဖွေမှု မတွေ့ရှိပါ။' : 'No sections matched.'}
              </div>
            ) : (
              filteredSections.map((sec, index) => {
                const Icon = sec.icon;
                const isSelected = currentSection?.id === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => setSelectedSection(index)}
                    className={`w-full text-left p-3 flex items-start gap-2.5 transition-all cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-amber-500/10 text-amber-400 font-extrabold border-l-4 border-amber-500'
                        : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span className="line-clamp-2 leading-tight">{sec.title}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Visual Details Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-950 space-y-5">
            {currentSection ? (
              <div className="space-y-4">
                
                {/* Title */}
                <div className="border-b border-slate-800 pb-3">
                  <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                    <span className="text-amber-400">❖</span> {currentSection.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    {currentSection.content}
                  </p>
                </div>

                {/* Simulated Screen / Visual Mockup Representation */}
                <div className="space-y-1.5">
                  <h3 className="text-[10px] uppercase font-black tracking-wider text-slate-500 flex items-center gap-1">
                    <span>📺</span> {isMm ? 'စနစ်၏ စခရင်ပုံစံနမူနာ (Workstation Live GUI Mockup)' : 'Workstation Live GUI Mockup'}
                  </h3>
                  {currentSection.mockup}
                </div>

                {/* Steps & Instructions */}
                <div className="space-y-2 bg-slate-900/30 border border-slate-800/80 p-3.5 rounded-xl">
                  <h3 className="text-[10px] uppercase font-black tracking-wider text-amber-400 flex items-center gap-1">
                    <span>💡</span> {isMm ? 'ဖြည့်သွင်းနည်းစနစ်နှင့် အသုံးပြုရန် အဆင့်ဆင့်' : 'Step-by-Step Counter Guidelines'}
                  </h3>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {currentSection.steps.map((step, idx) => (
                      <li key={idx} className="flex gap-2.5 items-start leading-relaxed">
                        <span className="h-4 w-4 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual Aid format templates for Room Booking / Billing */}
                {currentSection.id === 'start_session' && (
                  <div className="bg-cyan-950/20 border border-cyan-500/30 rounded-xl p-3.5 text-xs text-slate-300 space-y-2 animate-in fade-in duration-300">
                    <span className="font-extrabold text-cyan-400 block text-[10px] uppercase tracking-wider">📋 Input Form Reference Layout (စနစ်သွင်းရန် ပုံစံဝန်း)</span>
                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950/90 p-3 rounded border border-slate-800">
                      <div><span className="text-slate-500 block mb-0.5">Field 1: Room Selection</span><strong className="text-white block bg-slate-900 px-2 py-1 rounded">[Room 102 (VIP)]</strong></div>
                      <div><span className="text-slate-500 block mb-0.5">Field 2: Service Selection</span><strong className="text-white block bg-slate-900 px-2 py-1 rounded">[Aromatherapy Massage]</strong></div>
                      <div><span className="text-slate-500 block mb-0.5">Field 3: Therapist Assign</span><strong className="text-emerald-400 block bg-slate-900 px-2 py-1 rounded">[Ma Su Su]</strong></div>
                      <div><span className="text-slate-500 block mb-0.5">Field 4: Customer Details</span><strong className="text-white block bg-slate-900 px-2 py-1 rounded">[U Maung Maung (VIP)]</strong></div>
                    </div>
                  </div>
                )}

                {currentSection.id === 'checkout' && (
                  <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3.5 text-xs text-slate-300 space-y-2 animate-in fade-in duration-300">
                    <span className="font-extrabold text-amber-400 block text-[10px] uppercase tracking-wider">🧮 Billing Calculation Flow Diagram (ဘေလ်တွက်ချက်မှု စနစ်တကျလမ်းညွှန်)</span>
                    <div className="bg-slate-950/90 p-3 rounded border border-slate-800 space-y-1.5 text-[10px] font-mono">
                      <div className="flex justify-between"><span>[A] Subtotal (Services + Products + Room Hours)</span><span className="text-white font-bold">၈၀,၀၀၀ ကျပ်</span></div>
                      <div className="flex justify-between"><span>[B] Government Tax Charge (+ ၅%)</span><span className="text-white">+ ၄,၀၀၀ ကျပ်</span></div>
                      <div className="flex justify-between"><span>[C] Shop Service Charge (+ ၁၀%)</span><span className="text-white">+ ၈,၀၀၀ ကျပ်</span></div>
                      <div className="flex justify-between text-rose-400"><span>[D] Special Member Discount Applied</span><span className="text-rose-400">- ၄,၀၀၀ ကျပ်</span></div>
                      <div className="flex justify-between text-emerald-400 font-extrabold border-t border-slate-800 pt-1.5 text-xs">
                        <span>[E] Net Payable Bill Total = [A] + [B] + [C] - [D]</span>
                        <span>၈၈,၀၀၀ ကျပ်</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <HelpCircle className="h-10 w-10 text-slate-600 animate-pulse" />
                <p className="text-xs italic">
                  {isMm ? 'ရှာဖွေမည့် စကားလုံးကို ရိုက်ထည့်ပါ သို့မဟုတ် အခန်းတစ်ခုကို ရွေးချယ်ဖတ်ရှုပါ။' : 'Please select a guide chapter from the left panel.'}
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Footer info bar */}
        <div className="bg-slate-900 px-4 py-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500 shrink-0">
          <span>{isMm ? 'ရွှေသီရိ စပါ & KTV စီမံခန့်ခွဲမှုစနစ်' : 'Shwe Thiri Spa & KTV ERP Platform'}</span>
          <span>{isMm ? 'အဆင့်မြင့် ၁၀၀% အော့ဖ်လိုင်းနည်းပညာ' : '100% Secure Offline Database'}</span>
        </div>

      </div>
    </div>
  );
};
