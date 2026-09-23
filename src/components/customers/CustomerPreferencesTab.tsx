import React, { useState, useEffect } from 'react';
import { Customer, CustomerPreferenceProfile, Staff, UserAccount } from '../../types';
import { db } from '../../db/database';
import { Language } from '../../utils/translations';
import { Heart, Save, Check, Sparkles, User, Coffee, Droplet, Thermometer, Sliders } from 'lucide-react';

interface CustomerPreferencesTabProps {
  customer: Customer;
  staff: Staff[];
  currentUser: UserAccount;
  lang: Language;
  onUpdated: (updated: Customer) => void;
}

const DRINK_OPTIONS = ['Plain Water', 'Hot Green Tea', 'Jasmine Tea', 'Ginger Tea', 'Black Coffee', 'Fruit Juice'];
const OIL_OPTIONS = ['Lavender Scent', 'Lemongrass', 'Coconut Oil', 'Eucalyptus', 'Jasmine Blossom', 'Unscented / Mineral'];
const PRESSURE_OPTIONS: ('soft' | 'medium' | 'firm' | 'deep_tissue')[] = ['soft', 'medium', 'firm', 'deep_tissue'];
const TEMP_OPTIONS: ('cool' | 'normal' | 'warm')[] = ['cool', 'normal', 'warm'];

export const CustomerPreferencesTab: React.FC<CustomerPreferencesTabProps> = ({
  customer,
  staff,
  currentUser,
  lang,
  onUpdated,
}) => {
  const isMm = lang === 'my';

  const [pressure, setPressure] = useState<CustomerPreferenceProfile['massagePressure']>('medium');
  const [roomTemp, setRoomTemp] = useState<CustomerPreferenceProfile['roomTemperature']>('normal');
  const [preferredDrink, setPreferredDrink] = useState<string>('');
  const [preferredOil, setPreferredOil] = useState<string>('');
  const [sensitivities, setSensitivities] = useState<string>('');
  const [preferredStaffId, setPreferredStaffId] = useState<string>('');
  const [preferredRoomType, setPreferredRoomType] = useState<string>('');
  const [specialRequests, setSpecialRequests] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const prefs = customer.preferences || {};
    setPressure(prefs.massagePressure || 'medium');
    setRoomTemp(prefs.roomTemperature || 'normal');
    setPreferredDrink(prefs.preferredDrink || '');
    setPreferredOil(prefs.preferredOil || '');
    setSensitivities(prefs.sensitivitiesAndAllergies || '');
    setPreferredStaffId(prefs.preferredStaffId || '');
    setPreferredRoomType(prefs.preferredRoomType || '');
    setSpecialRequests(prefs.specialRequests || '');
    setSavedSuccess(false);
  }, [customer]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const selectedStaff = staff.find(s => s.id === preferredStaffId);
      const newPrefs: CustomerPreferenceProfile = {
        massagePressure: pressure,
        roomTemperature: roomTemp,
        preferredDrink: preferredDrink.trim() || undefined,
        preferredOil: preferredOil.trim() || undefined,
        sensitivitiesAndAllergies: sensitivities.trim() || undefined,
        preferredStaffId: preferredStaffId || undefined,
        preferredStaffName: selectedStaff?.name,
        preferredRoomType: preferredRoomType.trim() || undefined,
        specialRequests: specialRequests.trim() || undefined,
      };

      const updated = await db.updateCustomerPreferences(customer.id, newPrefs, {
        id: currentUser.id,
        name: currentUser.name,
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      onUpdated(updated);
    } catch (err: any) {
      alert('Error saving preferences: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
            <span>{isMm ? 'ဖောက်သည် နှစ်သက်မှု ပရိုဖိုင်' : 'Customer Preference Profile'}</span>
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {isMm ? 'ဝန်ဆောင်မှု အထူးကောင်းမွန်စေရန် ကြိုတင်သိမ်းဆည်းထားသော အချက်အလက်များ' : 'Customized preferences to elevate personal service experience.'}
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {savedSuccess ? (
            <>
              <Check className="h-4 w-4 text-emerald-200" />
              <span>{isMm ? 'သိမ်းပြီးပါပြီ' : 'Saved!'}</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>{isSaving ? (isMm ? 'သိမ်းနေသည်...' : 'Saving...') : (isMm ? 'နှစ်သက်မှု သိမ်းမည်' : 'Save Preferences')}</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Massage Pressure */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
          <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-2">
            <Sliders className="h-3.5 w-3.5 text-purple-600" />
            <span>{isMm ? 'နှိပ်နယ်မှု အား (Massage Pressure)' : 'Massage Pressure Preference'}</span>
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {PRESSURE_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setPressure(opt)}
                className={`rounded-xl border py-2 px-3 text-center font-bold capitalize transition-colors ${
                  pressure === opt
                    ? 'border-purple-600 bg-purple-600 text-white shadow-xs'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {opt.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Room Temperature */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
          <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-2">
            <Thermometer className="h-3.5 w-3.5 text-blue-600" />
            <span>{isMm ? 'အခန်း အပူချိန် (Room Temperature)' : 'Room Temperature Preference'}</span>
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {TEMP_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setRoomTemp(opt)}
                className={`rounded-xl border py-2 px-3 text-center font-bold capitalize transition-colors ${
                  roomTemp === opt
                    ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Preferred Staff */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
          <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-2">
            <User className="h-3.5 w-3.5 text-emerald-600" />
            <span>{isMm ? 'အမြဲတွဲဖက်လိုသော ဝန်ထမ်း (Preferred Staff)' : 'Preferred Therapist / Staff'}</span>
          </label>
          <select
            value={preferredStaffId}
            onChange={e => setPreferredStaffId(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs font-medium text-gray-900 focus:border-emerald-500 focus:outline-hidden"
          >
            <option value="">{isMm ? '-- မည်သူမဆို (No Preference) --' : '-- Any Therapist --'}</option>
            {staff.map(st => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.role})
              </option>
            ))}
          </select>
        </div>

        {/* Room Type */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
          <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>{isMm ? 'အခန်း အမျိုးအစား (Room Type)' : 'Preferred Room Setting'}</span>
          </label>
          <input
            type="text"
            value={preferredRoomType}
            onChange={e => setPreferredRoomType(e.target.value)}
            placeholder="e.g. VIP Single Room, Couple Suite, Foot Hall"
            className="w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs font-medium text-gray-900 focus:border-emerald-500 focus:outline-hidden"
          />
        </div>

        {/* Drink Choice */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
          <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-2">
            <Coffee className="h-3.5 w-3.5 text-amber-700" />
            <span>{isMm ? 'ကြိုဆိုဧည့်ခံ အအေး/အပူ (Welcome Drink)' : 'Welcome Drink Preference'}</span>
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {DRINK_OPTIONS.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setPreferredDrink(d)}
                className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                  preferredDrink === d
                    ? 'bg-amber-700 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={preferredDrink}
            onChange={e => setPreferredDrink(e.target.value)}
            placeholder="Other drink..."
            className="w-full rounded-xl border border-gray-300 bg-white p-2 text-xs text-gray-900 focus:border-emerald-500 focus:outline-hidden"
          />
        </div>

        {/* Oil / Aroma */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
          <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-2">
            <Droplet className="h-3.5 w-3.5 text-teal-600" />
            <span>{isMm ? 'ဆီ / ရနံ့ (Oil & Aromatherapy)' : 'Oil & Fragrance Preference'}</span>
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {OIL_OPTIONS.map(oil => (
              <button
                key={oil}
                type="button"
                onClick={() => setPreferredOil(oil)}
                className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                  preferredOil === oil
                    ? 'bg-teal-700 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {oil}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={preferredOil}
            onChange={e => setPreferredOil(e.target.value)}
            placeholder="Other oil / aroma..."
            className="w-full rounded-xl border border-gray-300 bg-white p-2 text-xs text-gray-900 focus:border-emerald-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Sensitivities & Allergies */}
      <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
        <label className="text-xs font-bold text-rose-900 block mb-1">
          {isMm ? 'သတိပြုရန် ဓာတ်မတည့်မှုများနှင့် ရှောင်ကြဉ်ရမည့်နေရာများ' : 'Sensitivities, Allergies & Avoid Areas'}
        </label>
        <p className="text-[11px] text-rose-700 mb-2">
          {isMm ? 'ဥပမာ - ခါးဆစ်ဒဏ်ရာရှိသည်၊ ပူစီနံနံ့မခံနိုင်ပါ' : 'e.g., Lower back disc injury, allergic to peppermint oil, avoid heavy neck cracking'}
        </p>
        <textarea
          rows={2}
          value={sensitivities}
          onChange={e => setSensitivities(e.target.value)}
          placeholder="Enter allergies or medical precautions..."
          className="w-full rounded-xl border border-rose-200 bg-white p-2.5 text-xs text-gray-900 focus:border-rose-500 focus:outline-hidden"
        />
      </div>

      {/* Special Requests */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
        <label className="text-xs font-bold text-gray-700 block mb-1">
          {isMm ? 'အခြား အထူးမှာကြားချက်များ' : 'General Habits & Special Requests'}
        </label>
        <textarea
          rows={2}
          value={specialRequests}
          onChange={e => setSpecialRequests(e.target.value)}
          placeholder="e.g. Likes quiet room, prefers music low, asks for warm towel after service..."
          className="w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs text-gray-900 focus:border-emerald-500 focus:outline-hidden"
        />
      </div>
    </form>
  );
};
