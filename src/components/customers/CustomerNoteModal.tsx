import React, { useState, useEffect } from 'react';
import { Customer, CustomerServiceNote, CustomerNoteCategory, UserAccount } from '../../types';
import { db } from '../../db/database';
import { Language } from '../../utils/translations';
import { X, FileText, Lock, ShieldCheck, Tag, Sparkles } from 'lucide-react';

interface CustomerNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  existingNote?: CustomerServiceNote | null;
  linkContext?: {
    sessionId?: string;
    bookingId?: string;
    serviceId?: string;
    serviceName?: string;
    staffId?: string;
    staffName?: string;
  };
  currentUser: UserAccount;
  lang: Language;
  onSuccess: () => void;
}

const COMMON_FOCUS_AREAS = [
  'Neck & Shoulders',
  'Upper Back',
  'Lower Back',
  'Legs & Calves',
  'Feet & Reflexology',
  'Head & Scalp',
  'Arms & Hands',
  'Face & Skin',
];

export const CustomerNoteModal: React.FC<CustomerNoteModalProps> = ({
  isOpen,
  onClose,
  customer,
  existingNote,
  linkContext,
  currentUser,
  lang,
  onSuccess,
}) => {
  const isMm = lang === 'my';
  const canManagePrivate = ['owner', 'manager', 'admin'].includes(currentUser.role);

  const [category, setCategory] = useState<CustomerNoteCategory>('service');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedFocus, setSelectedFocus] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (existingNote) {
        setCategory(existingNote.category);
        setTitle(existingNote.title);
        setContent(existingNote.content);
        setSelectedFocus(existingNote.focusAreas || []);
        setTags(existingNote.tags || []);
        setIsPrivate(!!existingNote.isPrivate);
      } else {
        setCategory(linkContext?.serviceName ? 'service' : 'treatment');
        setTitle(linkContext?.serviceName ? `Note for ${linkContext.serviceName}` : 'Service Note');
        setContent('');
        setSelectedFocus([]);
        setTags([]);
        setIsPrivate(false);
      }
    }
  }, [isOpen, existingNote, linkContext]);

  if (!isOpen) return null;

  const toggleFocus = (area: string) => {
    setSelectedFocus(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const removeTag = (t: string) => {
    setTags(tags.filter(tag => tag !== t));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    try {
      if (existingNote) {
        await db.updateCustomerServiceNote(
          existingNote.id,
          {
            category,
            title: title.trim(),
            content: content.trim(),
            tags,
            focusAreas: selectedFocus,
            isPrivate: canManagePrivate ? isPrivate : existingNote.isPrivate,
          },
          { id: currentUser.id, name: currentUser.name, role: currentUser.role }
        );
      } else {
        await db.addCustomerServiceNote({
          customerId: customer.id,
          customerName: customer.name,
          sessionId: linkContext?.sessionId,
          bookingId: linkContext?.bookingId,
          serviceId: linkContext?.serviceId,
          serviceName: linkContext?.serviceName,
          staffId: linkContext?.staffId,
          staffName: linkContext?.staffName,
          category,
          title: title.trim(),
          content: content.trim(),
          tags,
          focusAreas: selectedFocus,
          isPrivate: canManagePrivate ? isPrivate : false,
          createdBy: currentUser.name || 'Staff',
          createdById: currentUser.id,
          businessId: customer.businessId || 'default',
          branchId: customer.branchId || 'main',
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Error saving note: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-gray-100 bg-linear-to-r from-purple-600 to-indigo-700 px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {existingNote
                  ? isMm ? 'မှတ်စု ပြင်ဆင်ရန်' : 'Edit Service Note'
                  : isMm ? 'မှတ်စု အသစ်မှတ်တမ်းတင်ရန်' : 'Add Service & Treatment Note'}
              </h3>
              <p className="text-xs text-white/80">
                {customer.name} {linkContext?.serviceName ? `• ${linkContext.serviceName}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Category */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              {isMm ? 'မှတ်စု အမျိုးအစား' : 'Note Category'}
            </label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 text-xs">
              {(['preference', 'treatment', 'service', 'follow_up', 'general'] as CustomerNoteCategory[]).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-xl border py-2 px-2 text-center font-bold capitalize transition-colors ${
                    category === cat
                      ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-xs'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              {isMm ? 'မှတ်စု ခေါင်းစဉ်' : 'Title'} *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Medium Pressure Shoulder Focus"
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium text-gray-900 focus:border-purple-500 focus:outline-hidden"
            />
          </div>

          {/* Focus Areas */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              {isMm ? 'အဓိက အလေးထား ကုသ/ပြုစုရမည့် နေရာများ' : 'Focus / Treatment Areas'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_FOCUS_AREAS.map(area => {
                const isSelected = selectedFocus.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleFocus(area)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              {isMm ? 'အသေးစိတ် မှတ်တမ်း' : 'Detailed Notes'} *
            </label>
            <textarea
              required
              rows={4}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={isMm ? 'ဖောက်သည် စိတ်တိုင်းကျမှု၊ ပြုစုခဲ့ပုံနှင့် နောက်တစ်ကြိမ် သတိထားရမည့်အချက်များ...' : 'Client preferences, treatment notes, observations for next visit...'}
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm text-gray-900 focus:border-purple-500 focus:outline-hidden"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              {isMm ? 'အမြန်ရှာ တဂ်များ' : 'Tags'}
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="e.g. aroma:lavender, pressure:firm"
                className="flex-1 rounded-xl border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-purple-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-200"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 border border-purple-200"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-purple-400 hover:text-purple-600"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sensitive / Private toggle (Restricted by Role) */}
          {canManagePrivate ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="noteIsPrivate"
                  checked={isPrivate}
                  onChange={e => setIsPrivate(e.target.checked)}
                  className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="noteIsPrivate" className="flex items-center gap-1.5 text-xs font-bold text-amber-900 select-none">
                  <Lock className="h-3.5 w-3.5 text-amber-600" />
                  <span>{isMm ? 'လုံခြုံစိတ်ချရသော သီးသန့်မှတ်စုအဖြစ် သတ်မှတ်မည် (Private / Sensitive Note)' : 'Mark as Confidential / Sensitive Note'}</span>
                </label>
              </div>
              <p className="mt-1 text-[11px] text-amber-700 pl-7">
                {isMm
                  ? 'အထူးခွင့်ပြုချက်ရှိသော မန်နေဂျာနှင့် ပိုင်ရှင်များသာ ကြည့်ရှုခွင့်ရှိမည် ဖြစ်သည်။'
                  : 'Only authorized roles (Owner, Manager, Admin) can view this note. Concealed from general staff.'}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-[11px] text-gray-500 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-gray-400" />
              <span>Standard service note (visible to service team)</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-3 border-t border-gray-100">
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
              className="flex-1 rounded-xl bg-purple-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {isSubmitting
                ? isMm ? 'သိမ်းဆည်းနေပါသည်...' : 'Saving...'
                : isMm ? 'မှတ်တမ်း သိမ်းဆည်းမည်' : 'Save Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
